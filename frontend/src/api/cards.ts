// カードの API を呼び出す

export type ListId = 'todo' | 'doing' | 'done'

/** API が返すカード（backend の CardResponse と同じ形）。日時は UTC の ISO 8601 文字列 */
export type Card = {
  id: number
  title: string
  description: string
  dueAt: string | null
  strict: boolean
  listId: ListId
  position: number
  createdAt: string
  updatedAt: string
}

/** カードを追加するときに送る内容（backend の CardCreateRequest と同じ形） */
export type CardCreateInput = {
  title: string
  description: string
  dueAt: string | null
  strict: boolean
  listId: ListId
}

/** カードを編集するときに送る内容（backend の CardUpdateRequest と同じ形） */
export type CardUpdateInput = Omit<CardCreateInput, 'listId'>

/** API がエラーのときに返す形（backend の ApiExceptionHandler.ErrorResponse） */
type ErrorResponse = {
  message: string
  errors: Record<string, string>
}

/** カード一覧を取得する。リストの表示順 → リスト内の並び順で返る */
export async function fetchCards(): Promise<Card[]> {
  const res = await request('/api/cards')
  return res.json()
}

/** カードを追加する。追加先のリストの一番下に入り、追加したカードが返る */
export async function createCard(input: CardCreateInput): Promise<Card> {
  const res = await request('/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return res.json()
}

/** カードのタイトル・説明文・期限・時間厳守を変更し、編集後のカードが返る */
export async function updateCard(
  id: number,
  input: CardUpdateInput,
): Promise<Card> {
  const res = await request(`/api/cards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return res.json()
}

/**
 * カードを別のリスト・別の位置へ移す（同じリストなら並び替え）。
 * position はリストの中での順番（0 が一番上）で、省略すると一番下に入る。移動後のカード一覧が返る
 */
export async function moveCard(
  id: number,
  listId: ListId,
  position?: number,
): Promise<Card[]> {
  const res = await request(`/api/cards/${id}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listId, position }),
  })
  return res.json()
}

/** カードを削除する。残ったカードの並び順はサーバーで詰め直される */
export async function deleteCard(id: number): Promise<void> {
  await request(`/api/cards/${id}`, { method: 'DELETE' })
}

/** API がエラーを返したときの例外。入力の誤りは項目ごとのメッセージを errors に持つ */
export class ApiError extends Error {
  errors: Record<string, string>

  constructor(message: string, errors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.errors = errors
  }
}

/**
 * API を呼び出す。サーバーに届かないときや、エラーが返ったときは ApiError を投げる
 */
async function request(...args: Parameters<typeof fetch>): Promise<Response> {
  let res: Response
  try {
    res = await fetch(...args)
  } catch {
    // バックエンドが止まっているなど、サーバーに届かない場合（fetch の英語のメッセージは出さない）
    throw new ApiError('サーバーに接続できませんでした')
  }
  if (!res.ok) {
    throw await readError(res)
  }
  return res
}

async function readError(res: Response): Promise<ApiError> {
  const fallback = `サーバーとの通信に失敗しました（${res.status}）`
  try {
    const body: Partial<ErrorResponse> = await res.json()
    // message が入っていない形で返ることもあるため、そのときは状態コードを出す
    if (typeof body.message !== 'string' || body.message === '') {
      return new ApiError(fallback)
    }
    return new ApiError(body.message, body.errors ?? {})
  } catch {
    // JSON が返らない場合
    return new ApiError(fallback)
  }
}
