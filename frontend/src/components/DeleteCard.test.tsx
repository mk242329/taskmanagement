import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Card } from '../api/cards'
import { makeCard } from '../test/cards'
import Board from './Board'

afterEach(() => {
  vi.restoreAllMocks()
})

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * 一覧の取得には initial を返し、削除には deleteResponse を返す。
 * deleteResponse を省略すると、削除できたことにする（204）
 */
function mockApi(initial: Card[], deleteResponse?: () => Response) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_url, init) => {
      if (init?.method !== 'DELETE') {
        return jsonResponse(200, initial)
      }
      return deleteResponse?.() ?? new Response(null, { status: 204 })
    })
}

/** fetch に送った削除の URL を取り出す */
function deletedUrls(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'DELETE')
    .map(([url]) => url)
}

function titlesIn(listName: string) {
  const list = screen.getByRole('region', { name: listName })
  return within(list)
    .queryAllByTestId('card')
    .map((card) => card.querySelector('.card-title')?.textContent)
}

const CARDS = [
  makeCard({ id: 1, title: '課題A', listId: 'todo', position: 0 }),
  makeCard({ id: 2, title: '課題B', listId: 'todo', position: 1 }),
]

describe('ボードのゴミ箱マーク', () => {
  test('押すと確認ダイアログが出て、編集ウィンドウは開かない', async () => {
    mockApi(CARDS)
    render(<Board />)

    await userEvent.click(
      await screen.findByRole('button', { name: '課題A を削除' }),
    )

    const confirm = screen.getByRole('alertdialog', {
      name: 'このタスクを削除しますか？',
    })
    expect(confirm).toBeInTheDocument()
    // 押し間違えても消えないよう、最初は「キャンセル」が選ばれている
    expect(
      within(confirm).getByRole('button', { name: 'キャンセル' }),
    ).toHaveFocus()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('「OK」を押すと削除し、リストの枚数が1減る', async () => {
    const fetchMock = mockApi(CARDS)
    render(<Board />)

    await userEvent.click(
      await screen.findByRole('button', { name: '課題A を削除' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(deletedUrls(fetchMock)).toEqual(['/api/cards/1'])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(titlesIn('未着手')).toEqual(['課題B'])
    expect(
      within(screen.getByRole('region', { name: '未着手' })).getByRole(
        'heading',
      ),
    ).toHaveTextContent('未着手 (1)')
  })

  test('「キャンセル」や Esc では削除しない', async () => {
    const fetchMock = mockApi(CARDS)
    render(<Board />)

    await userEvent.click(
      await screen.findByRole('button', { name: '課題A を削除' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '課題A を削除' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    expect(deletedUrls(fetchMock)).toEqual([])
    expect(titlesIn('未着手')).toEqual(['課題A', '課題B'])
  })

  test('削除に失敗したら、ダイアログを開いたままメッセージを表示する', async () => {
    mockApi(CARDS, () =>
      jsonResponse(404, {
        message: 'カードが見つかりません（id=1）',
        errors: {},
      }),
    )
    render(<Board />)

    await userEvent.click(
      await screen.findByRole('button', { name: '課題A を削除' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))

    const confirm = screen.getByRole('alertdialog')
    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      '削除できませんでした：カードが見つかりません（id=1）',
    )
    expect(titlesIn('未着手')).toEqual(['課題A', '課題B'])
  })
})

describe('編集ウィンドウの「削除」', () => {
  async function openEditDialog(title: string) {
    await userEvent.click(
      await screen.findByRole('button', { name: `${title} を編集` }),
    )
    return screen.getByRole('dialog', { name: 'タスクの編集' })
  }

  test('追加のときは「削除」を表示しない', async () => {
    mockApi([])
    render(<Board />)

    const list = await screen.findByRole('region', { name: '未着手' })
    await userEvent.click(
      within(list).getByRole('button', { name: '＋ タスクを追加' }),
    )

    expect(
      within(screen.getByRole('dialog')).queryByRole('button', {
        name: '削除',
      }),
    ).not.toBeInTheDocument()
  })

  test('「削除」を押すと確認ダイアログが出て、「キャンセル」で編集ウィンドウに戻る', async () => {
    // T-05-01・T-05-02
    const fetchMock = mockApi(CARDS)
    render(<Board />)

    const dialog = await openEditDialog('課題A')
    // 入力途中の内容は、確認から戻っても残っている
    await userEvent.type(within(dialog).getByLabelText('説明文'), 'メモ')
    await userEvent.click(within(dialog).getByRole('button', { name: '削除' }))
    const confirm = screen.getByRole('alertdialog', {
      name: 'このタスクを削除しますか？',
    })

    await userEvent.click(
      within(confirm).getByRole('button', { name: 'キャンセル' }),
    )

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    const back = screen.getByRole('dialog', { name: 'タスクの編集' })
    expect(within(back).getByLabelText('説明文')).toHaveValue('メモ')
    expect(deletedUrls(fetchMock)).toEqual([])
  })

  test('確認で Esc を押しても、編集ウィンドウは閉じない', async () => {
    mockApi(CARDS)
    render(<Board />)

    const dialog = await openEditDialog('課題A')
    await userEvent.click(within(dialog).getByRole('button', { name: '削除' }))
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'タスクの編集' })).toBeVisible()
  })

  test('「OK」を押すと、ウィンドウが閉じてカードが削除される', async () => {
    // T-05-03
    const fetchMock = mockApi(CARDS)
    render(<Board />)

    const dialog = await openEditDialog('課題B')
    await userEvent.click(within(dialog).getByRole('button', { name: '削除' }))
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(deletedUrls(fetchMock)).toEqual(['/api/cards/2'])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(titlesIn('未着手')).toEqual(['課題A'])
  })
})
