import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Card, CardCreateInput } from '../api/cards'
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
 * 一覧の取得には initial を返し、追加には postResponse で作った内容を返す。
 * postResponse を省略すると、送った内容で追加できたことにする
 */
function mockApi(
  initial: Card[],
  postResponse?: (input: CardCreateInput) => Response,
) {
  let nextId = 100
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (_url, init) => {
      if (init?.method !== 'POST') {
        return jsonResponse(200, initial)
      }
      const input: CardCreateInput = JSON.parse(String(init.body))
      if (postResponse !== undefined) {
        return postResponse(input)
      }
      return jsonResponse(201, makeCard({ ...input, id: nextId++ }))
    })
}

/** fetch に送った追加の内容（POST の本文）を取り出す */
function postedBodies(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init?.body)))
}

async function openAddDialog(listName: string) {
  const list = await screen.findByRole('region', { name: listName })
  await userEvent.click(
    within(list).getByRole('button', { name: '＋ タスクを追加' }),
  )
  return screen.getByRole('dialog', { name: 'タスクの追加' })
}

test('「＋ タスクを追加」で、空の入力欄の追加ウィンドウが開く', async () => {
  // T-02-01・T-02-02
  mockApi([])
  render(<Board />)

  const dialog = await openAddDialog('未着手')

  expect(within(dialog).getByLabelText('タイトル（必須）')).toHaveValue('')
  expect(within(dialog).getByLabelText('説明文')).toHaveValue('')
  expect(within(dialog).getByLabelText('期限')).toHaveValue('')
  expect(within(dialog).getByLabelText('時間厳守')).not.toBeChecked()
  expect(within(dialog).getByTestId('form-priority')).toHaveTextContent('低')
  expect(
    within(dialog).queryByRole('button', { name: '削除' }),
  ).not.toBeInTheDocument()
  // 説明文は 500 文字までしか入力できない（T-03-07）
  expect(within(dialog).getByLabelText('説明文')).toHaveAttribute(
    'maxLength',
    '500',
  )
})

test('入力して保存すると、ウィンドウが閉じてリストの一番下にカードが入る', async () => {
  // T-02-03・T-02-04
  const fetchMock = mockApi([
    makeCard({ id: 1, title: '既存', listId: 'todo' }),
  ])
  render(<Board />)

  const dialog = await openAddDialog('未着手')
  await userEvent.type(
    within(dialog).getByLabelText('タイトル（必須）'),
    '課題A',
  )
  await userEvent.type(within(dialog).getByLabelText('説明文'), '第3章')
  fireEvent.change(within(dialog).getByLabelText('期限'), {
    target: { value: '2026-10-07T18:30' },
  })
  await userEvent.click(within(dialog).getByLabelText('時間厳守'))
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))

  expect(postedBodies(fetchMock)).toEqual([
    {
      title: '課題A',
      description: '第3章',
      dueAt: new Date(2026, 9, 7, 18, 30).toISOString(),
      strict: true,
      listId: 'todo',
    },
  ])
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  const todo = screen.getByRole('region', { name: '未着手' })
  expect(within(todo).getByRole('heading')).toHaveTextContent('未着手 (2)')
  expect(
    within(todo)
      .getAllByTestId('card')
      .map((card) => card.querySelector('.card-title')?.textContent),
  ).toEqual(['既存', '課題A'])
})

test('「作業中」「完了」の追加ボタンからは、そのリストに追加する', async () => {
  // T-02-05
  const fetchMock = mockApi([])
  render(<Board />)

  for (const name of ['作業中', '完了']) {
    const dialog = await openAddDialog(name)
    await userEvent.type(
      within(dialog).getByLabelText('タイトル（必須）'),
      `${name}のタスク`,
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))
    const list = screen.getByRole('region', { name })
    expect(within(list).getByText(`${name}のタスク`)).toBeInTheDocument()
  }
  expect(postedBodies(fetchMock).map((body) => body.listId)).toEqual([
    'doing',
    'done',
  ])
})

test('期限・時間厳守を変えると、優先度の表示がその場で変わる', async () => {
  mockApi([])
  render(<Board />)

  const dialog = await openAddDialog('未着手')
  const priority = within(dialog).getByTestId('form-priority')

  await userEvent.click(within(dialog).getByLabelText('時間厳守'))
  expect(priority).toHaveTextContent('中')

  // 期限が今日なら高
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  fireEvent.change(within(dialog).getByLabelText('期限'), {
    target: {
      value: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T23:59`,
    },
  })
  expect(priority).toHaveTextContent('高')
})

test('タイトルに誤りがあるときはエラーを表示して保存せず、直すと保存できる', async () => {
  // T-03-01・T-03-05・T-03-09
  const fetchMock = mockApi([])
  render(<Board />)

  const dialog = await openAddDialog('未着手')
  const title = within(dialog).getByLabelText('タイトル（必須）')
  const save = within(dialog).getByRole('button', { name: '保存' })

  await userEvent.click(save)
  expect(title).toHaveAccessibleDescription('タイトルを入力してください')
  expect(title).toHaveClass('input-error')

  await userEvent.type(title, 'あ'.repeat(51))
  await userEvent.click(save)
  expect(title).toHaveAccessibleDescription(
    'タイトルは50文字以内で入力してください',
  )
  expect(postedBodies(fetchMock)).toEqual([])

  await userEvent.clear(title)
  await userEvent.type(title, '課題A')
  await userEvent.click(save)
  expect(postedBodies(fetchMock)).toHaveLength(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByText('課題A')).toBeInTheDocument()
})

test('「キャンセル」を押すと、保存せずにウィンドウを閉じる', async () => {
  // T-02-07
  const fetchMock = mockApi([])
  render(<Board />)

  const dialog = await openAddDialog('未着手')
  await userEvent.type(
    within(dialog).getByLabelText('タイトル（必須）'),
    '課題A',
  )
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'キャンセル' }),
  )

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(postedBodies(fetchMock)).toEqual([])
  expect(screen.queryAllByTestId('card')).toHaveLength(0)

  // 開き直すと入力欄は空に戻っている
  const reopened = await openAddDialog('未着手')
  expect(within(reopened).getByLabelText('タイトル（必須）')).toHaveValue('')
})

test('API が入力の誤りを返したら、タイトルの下にメッセージを表示する', async () => {
  mockApi([], () =>
    jsonResponse(400, {
      message: '入力内容に誤りがあります',
      errors: { title: 'タイトルは50文字以内で入力してください' },
    }),
  )
  render(<Board />)

  const dialog = await openAddDialog('未着手')
  const title = within(dialog).getByLabelText('タイトル（必須）')
  await userEvent.type(title, '課題A')
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))

  expect(title).toHaveAccessibleDescription(
    'タイトルは50文字以内で入力してください',
  )
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

test('保存に失敗したら、ウィンドウを開いたままメッセージを表示する', async () => {
  mockApi([], () => new Response('', { status: 502 }))
  render(<Board />)

  const dialog = await openAddDialog('未着手')
  await userEvent.type(
    within(dialog).getByLabelText('タイトル（必須）'),
    '課題A',
  )
  await userEvent.click(within(dialog).getByRole('button', { name: '保存' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    '保存できませんでした：サーバーとの通信に失敗しました（502）',
  )
  expect(within(dialog).getByLabelText('タイトル（必須）')).toHaveValue('課題A')
  expect(within(dialog).getByRole('button', { name: '保存' })).toBeEnabled()
})
