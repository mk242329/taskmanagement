import { useEffect, useState } from 'react'
import {
  createCard,
  fetchCards,
  moveCard,
  updateCard,
  type Card,
  type ListId,
} from '../api/cards'
import { LISTS, nextListOnCheck } from '../domain/card'
import CardFormDialog, { type CardFormValues } from './CardFormDialog'
import CardList from './CardList'

// 優先度・期限切れの表示を決め直す間隔
const REFRESH_INTERVAL_MS = 30 * 1000

/** SC-01 ボード画面（3つのリスト） */
function Board() {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  // カードを追加しようとしているリスト。null のときはウィンドウを閉じている
  const [addingTo, setAddingTo] = useState<ListId | null>(null)
  // 編集しているカード。null のときはウィンドウを閉じている
  const [editing, setEditing] = useState<Card | null>(null)
  // 移動など、ボード上の操作に失敗したときのメッセージ
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    fetchCards()
      .then((loaded) => {
        if (!ignore) setCards(loaded)
      })
      .catch((e: unknown) => {
        if (!ignore) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      ignore = true
    }
  }, [])

  // 時間が経つと優先度・期限切れが変わるため、定期的に描き直す
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  async function handleAdd(listId: ListId, values: CardFormValues) {
    const created = await createCard({ ...values, listId })
    // 追加したカードはリストの一番下に入るため、末尾に足せば並び順どおりになる
    setCards((prev) => [...(prev ?? []), created])
    setNow(new Date())
    setAddingTo(null)
  }

  async function handleEdit(id: number, values: CardFormValues) {
    const updated = await updateCard(id, values)
    // リストと並び順は変わらないため、同じ場所のカードを入れ替える
    setCards((prev) =>
      (prev ?? []).map((card) => (card.id === id ? updated : card)),
    )
    setNow(new Date())
    setEditing(null)
  }

  /** チェックボックスで次のリストの一番下へ移す（F-11） */
  async function handleCheck(card: Card) {
    setActionError(null)
    try {
      // 両方のリストの並び順が変わるため、返ってきた一覧で置き換える
      setCards(await moveCard(card.id, nextListOnCheck(card.listId)))
      setNow(new Date())
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setActionError(`タスクを移動できませんでした：${message}`)
    }
  }

  if (error !== null) {
    return (
      <p className="board-message board-error" role="alert">
        カードを読み込めませんでした：{error}
      </p>
    )
  }
  if (cards === null) {
    return <p className="board-message">読み込み中…</p>
  }

  // API がリスト内の並び順で返すため、ここでは並べ替えない
  return (
    <main className="board">
      {actionError !== null && (
        <p
          className="board-message board-error board-action-error"
          role="alert"
        >
          {actionError}
        </p>
      )}
      {LISTS.map((list) => (
        <CardList
          key={list.id}
          name={list.name}
          cards={cards.filter((card) => card.listId === list.id)}
          now={now}
          onAdd={() => setAddingTo(list.id)}
          onOpen={setEditing}
          onCheck={handleCheck}
        />
      ))}
      {addingTo !== null && (
        <CardFormDialog
          heading="タスクの追加"
          onSave={(values) => handleAdd(addingTo, values)}
          onCancel={() => setAddingTo(null)}
        />
      )}
      {editing !== null && (
        <CardFormDialog
          heading="タスクの編集"
          initial={editing}
          onSave={(values) => handleEdit(editing.id, values)}
          onCancel={() => setEditing(null)}
        />
      )}
    </main>
  )
}

export default Board
