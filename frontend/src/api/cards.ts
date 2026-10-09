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
  notified: boolean
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
  const res = await fetch('/api/cards')
  if (!res.ok) {
    throw await readError(res)
  }
  return res.json()
}

/** カードを追加する。追加先のリストの一番下に入り、追加したカードが返る */
export async function createCard(input: CardCreateInput): Promise<Card> {
  const res = await fetch('/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw await readError(res)
  }
  return res.json()
}

/** カードのタイトル・説明文・期限・時間厳守を変更し、編集後のカードが返る */
export async function updateCard(
  id: number,
  input: CardUpdateInput,
): Promise<Card> {
  const res = await fetch(`/api/cards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw await readError(res)
  }
  return res.json()
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

async function readError(res: Response): Promise<ApiError> {
  try {
    const body: ErrorResponse = await res.json()
    return new ApiError(body.message, body.errors)
  } catch {
    // バックエンドが止まっているときなど、JSON が返らない場合
    return new ApiError(`サーバーとの通信に失敗しました（${res.status}）`)
  }
}
