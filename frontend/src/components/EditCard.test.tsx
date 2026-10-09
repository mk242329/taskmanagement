import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Card, CardUpdateInput } from '../api/cards'
import { toLocalInput } from '../domain/card'
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
 * 一覧の取得には initial を返し、編集には putResponse で作った内容を返す。
 * putResponse を省略すると、送った内容で編集できたことにする
 */
function mockApi(
  initial: Card[],
  putResponse?: (input: CardUpdateInput) => Response,
) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method !== 'PUT') {
      return jsonResponse(200, initial)
    }
    const input: CardUpdateInput = JSON.parse(String(init.body))
    if (putResponse !== undefined) {
      return putResponse(input)
    }
    const id = Number(String(url).split('/').pop())
    const current = initial.find((card) => card.id === id)
    return jsonResponse(200, makeCard({ ...current, ...input }))
  })
}

/** fetch に送った編集の内容（PUT の URL と本文）を取り出す */
function putRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'PUT')
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }))
}

async function openEditDialog(title: string) {
  await userEvent.click(
    await screen.findByRole('button', { name: `${title} を編集` }),
  )
  return screen.getByRole('dialog', { name: 'タスクの編集' })
}

const DUE = new Date(2026, 9, 7, 18, 30).toISOString()

test('カードをクリックすると、今の内容が入った編集ウィンドウが開く', async () => {
  // T-04-01（「削除」ボタンは F-04 で追加する）
  mockApi([
    makeCard({
      id: 1,
      title: '課題A',
      description: '第3章',
      dueAt: DUE,
      strict: true,
    }),
  ])
  render(<Board />)

  const dialog = await openEditDialog('課題A')

  expect(within(dialog).getByLabelText('タイトル（必須）')).toHaveValue('課題A')
  expect(within(dialog).getByLabelText('説明文')).toHaveValue('第3章')
  expect(within(dialog).getByLabelText('期限')).toHaveValue(toLocalInput(DUE))
  expect(within(dialog).getByLabelText('時間厳守')).toBeChecked()
})

test('内容を変えて保存すると、ウィンドウが閉じてカードの表示が変わる', async () => {
  // T-04-02・T-04-03
  const fetchMock = mockApi([
    makeCard({ id: 1, title: '1枚目', listId: 'todo' }),
    makeCard({ id: 2, title: '課題A', listId: 'todo' }),
    makeCard({ id: 3, title: '3枚目', listId: 'todo' }),
  ])
  render(<Board />)

  const dialog = await openEditDialog('課題A')
  const title = within(dialog).getByLabelText('タイトル（必須）')
  await userEvent.clear(title)
  await userEvent.type(title, '課題B')
  await userEvent.type(within(dialog).getByLabelText('説明文'), '第4章')
  fireEvent.change(within(dialog).getByLabelText('期限'), {
    target: { value: '2026-10-07T18:30' },
  })
  await userEvent.click(within(dialog).getByLabelText('時間厳守'))
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))

  expect(putRequests(fetchMock)).toEqual([
    {
      url: '/api/cards/2',
      body: {
        title: '課題B',
        description: '第4章',
        dueAt: DUE,
        strict: true,
      },
    },
  ])
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  // 同じ場所のまま表示が変わる。期限が過去で時間厳守なので、優先度は高・期限切れ
  const todo = screen.getByRole('region', { name: '未着手' })
  const cards = within(todo).getAllByTestId('card')
  expect(
    cards.map((card) => card.querySelector('.card-title')?.textContent),
  ).toEqual(['1枚目', '課題B', '3枚目'])
  expect(within(cards[1]).getByText('高')).toHaveClass('priority-high')
  expect(cards[1]).toHaveClass('overdue')
})

test('期限を空にして保存すると、期限の欄が表示されなくなる', async () => {
  // T-04-04・T-10-05
  const fetchMock = mockApi([makeCard({ id: 1, title: '課題A', dueAt: DUE })])
  render(<Board />)

  const dialog = await openEditDialog('課題A')
  fireEvent.change(within(dialog).getByLabelText('期限'), {
    target: { value: '' },
  })
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))

  expect(putRequests(fetchMock)[0].body.dueAt).toBeNull()
  const card = screen.getByTestId('card')
  expect(card.querySelector('.card-due')).toBeNull()
  expect(card).not.toHaveClass('overdue')
})

test('期限を触らずに保存すると、今の期限をそのまま送る', async () => {
  // 入力欄は秒を持たないため、秒が切り捨てられて期限が変わったことにならないようにする
  const withSeconds = new Date(2026, 9, 7, 18, 30, 45).toISOString()
  const fetchMock = mockApi([
    makeCard({ id: 1, title: '課題A', dueAt: withSeconds }),
  ])
  render(<Board />)

  const dialog = await openEditDialog('課題A')
  await userEvent.type(within(dialog).getByLabelText('説明文'), 'メモ')
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))

  expect(putRequests(fetchMock)[0].body.dueAt).toBe(withSeconds)
})

test('期限・時間厳守を変えると、保存する前から優先度の表示が変わる', async () => {
  // T-12-10
  mockApi([makeCard({ id: 1, title: '課題A' })])
  render(<Board />)

  const dialog = await openEditDialog('課題A')
  const priority = within(dialog).getByTestId('form-priority')
  expect(priority).toHaveTextContent('低')

  await userEvent.click(within(dialog).getByLabelText('時間厳守'))
  expect(priority).toHaveTextContent('中')
})

test('「キャンセル」を押すと、カードの内容は変わらない', async () => {
  // T-04-05
  const fetchMock = mockApi([makeCard({ id: 1, title: '課題A' })])
  render(<Board />)

  const dialog = await openEditDialog('課題A')
  const title = within(dialog).getByLabelText('タイトル（必須）')
  await userEvent.clear(title)
  await userEvent.type(title, '別のタイトル')
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'キャンセル' }),
  )

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(putRequests(fetchMock)).toEqual([])
  expect(screen.getByText('課題A')).toBeInTheDocument()

  // 開き直すと今の内容に戻っている
  const reopened = await openEditDialog('課題A')
  expect(within(reopened).getByLabelText('タイトル（必須）')).toHaveValue(
    '課題A',
  )
})

test('タイトルを空にして保存すると、エラーを表示して保存しない', async () => {
  // T-04-06
  const fetchMock = mockApi([makeCard({ id: 1, title: '課題A' })])
  render(<Board />)

  const dialog = await openEditDialog('課題A')
  const title = within(dialog).getByLabelText('タイトル（必須）')
  await userEvent.clear(title)
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))

  expect(title).toHaveAccessibleDescription('タイトルを入力してください')
  expect(putRequests(fetchMock)).toEqual([])
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('保存に失敗したら、ウィンドウを開いたままメッセージを表示する', async () => {
  mockApi([makeCard({ id: 1, title: '課題A' })], () =>
    jsonResponse(404, {
      message: 'カードが見つかりません（id=1）',
      errors: {},
    }),
  )
  render(<Board />)

  const dialog = await openEditDialog('課題A')
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    '保存できませんでした：カードが見つかりません（id=1）',
  )
})

test('チェックボックスを押しても、編集ウィンドウは開かない', async () => {
  // T-13-05
  mockApi([makeCard({ id: 1, title: '課題A' })])
  render(<Board />)

  await userEvent.click(
    await screen.findByRole('checkbox', { name: '課題A の完了' }),
  )

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('キーボードの Enter でも編集ウィンドウを開ける', async () => {
  mockApi([makeCard({ id: 1, title: '課題A' })])
  render(<Board />)

  const card = await screen.findByRole('button', { name: '課題A を編集' })
  card.focus()
  await userEvent.keyboard('{Enter}')

  expect(
    screen.getByRole('dialog', { name: 'タスクの編集' }),
  ).toBeInTheDocument()
})
