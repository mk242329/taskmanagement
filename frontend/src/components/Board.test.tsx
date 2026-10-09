import { render, screen, within } from '@testing-library/react'
import { makeCard, mockFetch } from '../test/cards'
import Board from './Board'

afterEach(() => {
  vi.restoreAllMocks()
})

test('API から取得したカードを3つのリストに分けて表示する', async () => {
  const fetchMock = mockFetch(200, [
    makeCard({ id: 1, title: '課題A', listId: 'todo' }),
    makeCard({ id: 2, title: '課題B', listId: 'todo' }),
    makeCard({ id: 3, title: '資料作成', listId: 'doing' }),
  ])

  render(<Board />)

  const todo = await screen.findByRole('region', { name: '未着手' })
  expect(fetchMock).toHaveBeenCalledWith('/api/cards')
  expect(within(todo).getByRole('heading')).toHaveTextContent('未着手 (2)')
  // API の順番のまま並べる
  expect(
    within(todo)
      .getAllByTestId('card')
      .map((card) => card.querySelector('.card-title')?.textContent),
  ).toEqual(['課題A', '課題B'])

  const doing = screen.getByRole('region', { name: '作業中' })
  expect(within(doing).getByRole('heading')).toHaveTextContent('作業中 (1)')
  expect(within(doing).getByText('資料作成')).toBeInTheDocument()

  const done = screen.getByRole('region', { name: '完了' })
  expect(within(done).getByRole('heading')).toHaveTextContent('完了 (0)')
  expect(within(done).queryAllByTestId('card')).toHaveLength(0)
})

test('カードに優先度・期限を表示し、期限切れは赤くする', async () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  mockFetch(200, [
    makeCard({ id: 1, title: '期限切れ', dueAt: yesterday, listId: 'todo' }),
    makeCard({ id: 2, title: '期限なし', dueAt: null, listId: 'todo' }),
    makeCard({ id: 3, title: '完了済み', dueAt: yesterday, listId: 'done' }),
  ])

  render(<Board />)

  const overdue = (await screen.findByText('期限切れ')).closest('.card')!
  expect(overdue).toHaveClass('overdue')
  expect(within(overdue as HTMLElement).getByText('高')).toHaveClass(
    'priority-high',
  )
  expect(overdue.querySelector('.card-due')).not.toBeNull()

  const noDue = screen.getByText('期限なし').closest('.card')!
  expect(noDue).not.toHaveClass('overdue')
  expect(within(noDue as HTMLElement).getByText('低')).toHaveClass(
    'priority-low',
  )
  expect(noDue.querySelector('.card-due')).toBeNull()

  // 完了リストのカードは期限を過ぎていても赤くしない。チェックが付いている
  const done = screen.getByText('完了済み').closest('.card')!
  expect(done).not.toHaveClass('overdue')
  expect(
    screen.getByRole('checkbox', { name: '完了済み の完了' }),
  ).toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: '期限切れ の完了' }),
  ).not.toBeChecked()
})

test('読み込み中は「読み込み中…」を表示する', () => {
  vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}))
  render(<Board />)
  expect(screen.getByText('読み込み中…')).toBeInTheDocument()
})

test('API がエラーを返したらメッセージを表示する', async () => {
  mockFetch(500, { message: 'サーバーでエラーが発生しました', errors: {} })
  render(<Board />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'カードを読み込めませんでした：サーバーでエラーが発生しました',
  )
})

test('サーバーにつながらないときもメッセージを表示する', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('', { status: 502 }),
  )
  render(<Board />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'サーバーとの通信に失敗しました（502）',
  )
})
