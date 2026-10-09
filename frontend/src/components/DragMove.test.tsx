import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Card, ListId } from '../api/cards'
import { LISTS } from '../domain/card'
import { makeCard } from '../test/cards'
import Board from './Board'

// jsdom は画面の配置を計算しないため、リストとカードの位置を決めておく。
// リストは横に 300px ごと、カードはリストの中で上から 60px ごとに並べる
const LIST_WIDTH = 300
const CARD_HEIGHT = 60

function fakeRect(el: Element): DOMRect {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect
  // ドラッグ中にマウスについてくるカードは、掴んだカードと同じ位置から動き始める
  if (
    el.classList.contains('card-preview') ||
    el.querySelector(':scope > .card-preview') !== null
  ) {
    const dragging = document.querySelector('.card.dragging')
    return dragging === null ? rect(0, 0, 0, 0) : fakeRect(dragging)
  }
  const section = el.closest('section.list')
  if (section === null) return rect(0, 0, 0, 0)
  const listIndex = LISTS.findIndex(
    (list) => list.name === section.getAttribute('aria-label'),
  )
  const left = listIndex * LIST_WIDTH
  if (el === section) return rect(left, 0, LIST_WIDTH - 20, 600)
  if (el.getAttribute('data-testid') === 'card') {
    const cards = [...section.querySelectorAll('[data-testid="card"]')]
    return rect(
      left + 10,
      50 + cards.indexOf(el) * CARD_HEIGHT,
      LIST_WIDTH - 40,
      50,
    )
  }
  return rect(0, 0, 0, 0)
}

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      return fakeRect(this)
    },
  )
  Element.prototype.scrollIntoView = () => {}
})

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
 * 一覧の取得には今のカードを返し、移動ではサーバーと同じように指定の位置へ移して一覧を返す。
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
    const { listId, position } = JSON.parse(String(init.body)) as {
      listId: ListId
      position: number
    }
    const moved = { ...cards.find((card) => card.id === id)!, listId }
    const rest = cards.filter((card) => card.id !== id)
    cards = LISTS.flatMap((list) => {
      const inList = rest.filter((card) => card.listId === list.id)
      if (list.id === listId) inList.splice(position, 0, moved)
      return inList.map((card, i) => ({ ...card, position: i }))
    })
    return jsonResponse(200, cards)
  })
}

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

/** スペースキーでカードを掴む。dnd-kit は次の処理の順番から矢印キーを受け付けるため、少し待つ */
async function grab(card: HTMLElement) {
  await act(async () => {
    fireEvent.keyDown(card, { key: ' ', code: 'Space' })
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** キーボードでカードを掴み、矢印キーで動かして置く */
async function dragWithKeyboard(title: string, keys: string[]) {
  const card = await screen.findByRole('button', { name: `${title} を編集` })
  card.focus()
  await grab(card)
  for (const key of keys) {
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? card, { key, code: key })
    })
  }
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? card, {
      key: ' ',
      code: 'Space',
    })
  })
}

test('同じリストの中で、一番下のカードを一番上へ移すと順番が入れ替わり保存する', async () => {
  // T-07-01
  const fetchMock = mockApi([
    makeCard({ id: 1, title: 'A', listId: 'todo', position: 0 }),
    makeCard({ id: 2, title: 'B', listId: 'todo', position: 1 }),
    makeCard({ id: 3, title: 'C', listId: 'todo', position: 2 }),
  ])
  render(<Board />)

  await dragWithKeyboard('C', ['ArrowUp', 'ArrowUp'])

  expect(titlesIn('未着手')).toEqual(['C', 'A', 'B'])
  expect(moveRequests(fetchMock)).toEqual([
    { url: '/api/cards/3/move', body: { listId: 'todo', position: 0 } },
  ])
})

test('別のリストへドラッグすると、そのリストに移り保存する。完了へ移すとチェックが付く', async () => {
  // T-06-01・T-06-02・T-13-08
  const fetchMock = mockApi([
    makeCard({ id: 1, title: 'A', listId: 'todo', position: 0 }),
    makeCard({ id: 2, title: 'B', listId: 'doing', position: 0 }),
  ])
  render(<Board />)

  await dragWithKeyboard('A', ['ArrowRight'])
  expect(titlesIn('未着手')).toEqual([])
  expect(titlesIn('作業中')).toContain('A')
  expect(
    within(screen.getByRole('region', { name: '作業中' })).getByRole('heading'),
  ).toHaveTextContent('作業中 (2)')

  // 空の「完了」へ
  await dragWithKeyboard('A', ['ArrowRight'])
  expect(titlesIn('完了')).toEqual(['A'])
  expect(screen.getByRole('checkbox', { name: 'A の完了' })).toBeChecked()

  expect(moveRequests(fetchMock).map((r) => r.body.listId)).toEqual([
    'doing',
    'done',
  ])
})

test('動かさずに置いたときは保存しない', async () => {
  const fetchMock = mockApi([
    makeCard({ id: 1, title: 'A', listId: 'todo', position: 0 }),
  ])
  render(<Board />)

  await dragWithKeyboard('A', [])

  expect(titlesIn('未着手')).toEqual(['A'])
  expect(moveRequests(fetchMock)).toEqual([])
})

test('Esc で取り消すと元の並びに戻り、保存しない', async () => {
  const fetchMock = mockApi([
    makeCard({ id: 1, title: 'A', listId: 'todo', position: 0 }),
    makeCard({ id: 2, title: 'B', listId: 'doing', position: 0 }),
  ])
  render(<Board />)

  const card = await screen.findByRole('button', { name: 'A を編集' })
  card.focus()
  await grab(card)
  await act(async () => {
    fireEvent.keyDown(card, { key: 'ArrowRight', code: 'ArrowRight' })
  })
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? card, {
      key: 'Escape',
      code: 'Escape',
    })
  })

  expect(titlesIn('未着手')).toEqual(['A'])
  expect(titlesIn('作業中')).toEqual(['B'])
  expect(moveRequests(fetchMock)).toEqual([])
})

test('保存に失敗したら、元の並びに戻してメッセージを表示する', async () => {
  mockApi(
    [
      makeCard({ id: 1, title: 'A', listId: 'todo', position: 0 }),
      makeCard({ id: 2, title: 'B', listId: 'todo', position: 1 }),
    ],
    () => new Response('', { status: 502 }),
  )
  render(<Board />)

  await dragWithKeyboard('B', ['ArrowUp'])

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'タスクを移動できませんでした：サーバーとの通信に失敗しました（502）',
  )
  expect(titlesIn('未着手')).toEqual(['A', 'B'])
})

test('Enter では掴まずに編集ウィンドウを開く', async () => {
  mockApi([makeCard({ id: 1, title: 'A', listId: 'todo', position: 0 })])
  render(<Board />)

  const card = await screen.findByRole('button', { name: 'A を編集' })
  card.focus()
  fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' })

  expect(screen.getByRole('dialog', { name: 'タスクの編集' })).toBeVisible()
})
