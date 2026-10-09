import { mockFetch } from '../test/cards'
import { ApiError, fetchCards } from './cards'

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
