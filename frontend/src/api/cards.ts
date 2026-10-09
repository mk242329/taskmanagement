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

/** API がエラーのときに返す形（backend の ApiExceptionHandler.ErrorResponse） */
type ErrorResponse = {
  message: string
  errors: Record<string, string>
}

/** カード一覧を取得する。リストの表示順 → リスト内の並び順で返る */
export async function fetchCards(): Promise<Card[]> {
  const res = await fetch('/api/cards')
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
  return res.json()
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body: ErrorResponse = await res.json()
    return body.message
  } catch {
    // バックエンドが止まっているときなど、JSON が返らない場合
    return `サーバーとの通信に失敗しました（${res.status}）`
  }
}
