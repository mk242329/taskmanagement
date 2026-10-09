import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Card, ListId } from '../api/cards'
import { LISTS } from '../domain/card'
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
 * 一覧の取得には今のカードを返し、移動ではサーバーと同じように一番下へ移して一覧を返す。
 * moveResponse を渡すと、移動にはその内容を返す
 */
function mockApi(initial: Card[], moveResponse?: () => Response) {
  let cards = initial
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method !== 'PATCH') {
      return jsonResponse(200, cards)
    }
    if (moveResponse !== undefined) {
      return moveResponse()
    }
    const id = Number(String(url).split('/').at(-2))
    const { listId } = JSON.parse(String(init.body)) as { listId: ListId }
    const moved = { ...cards.find((card) => card.id === id)!, listId }
    const rest = cards.filter((card) => card.id !== id)
    // リストの表示順 → リスト内の並び順に並べ、並び順を振り直す
    cards = LISTS.flatMap((list) =>
      [...rest, moved]
        .filter((card) => card.listId === list.id)
        .map((card, position) => ({ ...card, position })),
    )
    return jsonResponse(200, cards)
  })
}

/** fetch に送った移動の内容（PATCH の URL と本文）を取り出す */
function moveRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'PATCH')
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }))
}

function titlesIn(listName: string) {
  const list = screen.getByRole('region', { name: listName })
  return within(list)
    .queryAllByTestId('card')
    .map((card) => card.querySelector('.card-title')?.textContent)
}

test('未着手 → 作業中 → 完了 と一番下へ移り、完了のチェックを外すと作業中へ戻る', async () => {
  // T-13-01〜T-13-04
  const fetchMock = mockApi([
    makeCard({ id: 1, title: '課題A', listId: 'todo' }),
    makeCard({ id: 2, title: '資料作成', listId: 'doing' }),
    makeCard({ id: 3, title: '本を返す', listId: 'done' }),
  ])
  render(<Board />)

  const checkbox = () => screen.getByRole('checkbox', { name: '課題A の完了' })
  await screen.findByText('課題A')
  expect(checkbox()).not.toBeChecked()

  await userEvent.click(checkbox())
  expect(titlesIn('未着手')).toEqual([])
  expect(titlesIn('作業中')).toEqual(['資料作成', '課題A'])
  expect(checkbox()).not.toBeChecked()
  expect(
    within(screen.getByRole('region', { name: '作業中' })).getByRole('heading'),
  ).toHaveTextContent('作業中 (2)')

  await userEvent.click(checkbox())
  expect(titlesIn('作業中')).toEqual(['資料作成'])
  expect(titlesIn('完了')).toEqual(['本を返す', '課題A'])
  expect(checkbox()).toBeChecked()

  await userEvent.click(checkbox())
  expect(titlesIn('作業中')).toEqual(['資料作成', '課題A'])
  expect(titlesIn('完了')).toEqual(['本を返す'])
  expect(checkbox()).not.toBeChecked()

  // 並び順は省略して送り、サーバーに一番下へ入れてもらう
  expect(moveRequests(fetchMock)).toEqual([
    { url: '/api/cards/1/move', body: { listId: 'doing' } },
    { url: '/api/cards/1/move', body: { listId: 'done' } },
    { url: '/api/cards/1/move', body: { listId: 'doing' } },
  ])
})

test('期限切れのカードを完了へ移すと、赤色の表示が消える', async () => {
  // T-13-06
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  mockApi([
    makeCard({ id: 1, title: '課題A', listId: 'doing', dueAt: yesterday }),
  ])
  render(<Board />)

  expect((await screen.findByText('課題A')).closest('.card')).toHaveClass(
    'overdue',
  )
  await userEvent.click(screen.getByRole('checkbox', { name: '課題A の完了' }))

  expect(screen.getByText('課題A').closest('.card')).not.toHaveClass('overdue')
})

test('移動に失敗したら、カードはそのままでメッセージを表示する', async () => {
  mockApi([makeCard({ id: 1, title: '課題A', listId: 'todo' })], () =>
    jsonResponse(404, {
      message: 'カードが見つかりません（id=1）',
      errors: {},
    }),
  )
  render(<Board />)

  await userEvent.click(
    await screen.findByRole('checkbox', { name: '課題A の完了' }),
  )

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'タスクを移動できませんでした：カードが見つかりません（id=1）',
  )
  expect(titlesIn('未着手')).toEqual(['課題A'])
  expect(
    screen.getByRole('checkbox', { name: '課題A の完了' }),
  ).not.toBeChecked()
})
