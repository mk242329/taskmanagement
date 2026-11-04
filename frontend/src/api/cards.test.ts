import { mockFetch } from '../test/cards'
import { ApiError, fetchCards, moveCard, sha256Hex } from './cards'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('API のエラー', () => {
  it('入力の誤りは、メッセージと項目ごとのエラーを持つ', async () => {
    mockFetch(400, {
      message: '入力内容に誤りがあります',
      errors: { title: 'タイトルを入力してください' },
    })

    const error = await fetchCards().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('入力内容に誤りがあります')
    expect((error as ApiError).errors).toEqual({
      title: 'タイトルを入力してください',
    })
  })

  it('message のない形で返ったときは、状態コードを出す', async () => {
    // Spring の既定のエラーの形
    mockFetch(500, {
      timestamp: '2026-10-10T00:00:00Z',
      status: 500,
      error: 'Internal Server Error',
      path: '/api/cards',
    })

    await expect(fetchCards()).rejects.toThrow(
      'サーバーとの通信に失敗しました（500）',
    )
  })

  it('サーバーに届かないときは、日本語のメッセージにする', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch'),
    )

    const error = await fetchCards().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe('サーバーに接続できませんでした')
  })
})

describe('sha256Hex', () => {
  it('文字列（UTF-8）の SHA-256 を 16 進数で返す', async () => {
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(await sha256Hex('あ')).toBe(
      'dc5a4d3d82f7e15792959dc661538ae0e541ce66494516f5c9cfd9cd3308494d',
    )
  })
})

describe('本文のある API', () => {
  it('本文の SHA-256 を x-amz-content-sha256 ヘッダーで送る', async () => {
    const fetchMock = mockFetch(200, [])

    await moveCard(1, 'done', 0)

    const [, init] = fetchMock.mock.calls[0]
    const body = '{"listId":"done","position":0}'
    expect(init?.body).toBe(body)
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-amz-content-sha256': await sha256Hex(body),
    })
  })
})
