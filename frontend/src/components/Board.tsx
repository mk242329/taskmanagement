import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useRef, useState } from 'react'
import {
  createCard,
  fetchCards,
  moveCard,
  updateCard,
  type Card,
  type ListId,
} from '../api/cards'
import { LISTS, nextListOnCheck } from '../domain/card'
import { moveLocally, resolveDropTarget } from '../domain/move'
import { CardDragPreview } from './CardItem'
import CardFormDialog, { type CardFormValues } from './CardFormDialog'
import CardList from './CardList'

// 優先度・期限切れの表示を決め直す間隔
const REFRESH_INTERVAL_MS = 30 * 1000
// これだけ動かしたらドラッグとみなす。それより小さい動きはクリック（編集・チェック）にする
const DRAG_START_DISTANCE_PX = 5

// 画面読み上げ向けの説明（dnd-kit の既定は英語のため）
const SCREEN_READER_INSTRUCTIONS =
  'スペースキーでタスクを掴み、矢印キーで動かして、もう一度スペースキーで置きます。Esc キーで取り消します。'

function listName(listId: ListId): string {
  return LISTS.find((list) => list.id === listId)?.name ?? listId
}

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
  // 掴んでいるカードの id。null のときはドラッグしていない
  const [draggingId, setDraggingId] = useState<number | null>(null)
  // ドラッグを始めたときの並び。取り消し・保存の失敗のときに戻す
  const beforeDrag = useRef<Card[] | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_START_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter は編集ウィンドウを開くのに使うため、掴むのはスペースだけにする
      keyboardCodes: {
        start: ['Space'],
        cancel: ['Escape'],
        end: ['Space', 'Enter'],
      },
    }),
  )

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

  function titleOf(id: number | string): string {
    return cards?.find((card) => card.id === id)?.title ?? 'タスク'
  }

  function positionText(id: number | string): string {
    const card = cards?.find((c) => c.id === id)
    if (card === undefined) return ''
    return `「${listName(card.listId)}」の${card.position + 1}番目`
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `${titleOf(active.id)} を掴みました。`,
    onDragOver: ({ active }) =>
      `${titleOf(active.id)} を ${positionText(active.id)} に動かしています。`,
    onDragEnd: ({ active }) =>
      `${titleOf(active.id)} を ${positionText(active.id)} に置きました。`,
    onDragCancel: ({ active }) =>
      `${titleOf(active.id)} の移動を取り消しました。`,
  }

  function handleDragStart({ active }: DragStartEvent) {
    beforeDrag.current = cards
    setActionError(null)
    setDraggingId(Number(active.id))
  }

  /** 別のリストの上に来たら、その場でそのリストへ移して見せる */
  function handleDragOver({ active, over }: DragOverEvent) {
    if (cards === null || over === null) return
    const id = Number(active.id)
    const target = resolveDropTarget(cards, id, over.id)
    const current = cards.find((card) => card.id === id)
    if (target === null || current === undefined) return
    if (target.listId !== current.listId) {
      setCards(moveLocally(cards, id, target))
    }
  }

  /** 落とした場所に移して、変わっていれば保存する（F-05・F-06） */
  async function handleDragEnd({ active, over }: DragEndEvent) {
    const before = beforeDrag.current
    beforeDrag.current = null
    setDraggingId(null)
    if (cards === null || before === null) return

    const id = Number(active.id)
    const target = over === null ? null : resolveDropTarget(cards, id, over.id)
    if (target === null) {
      setCards(before)
      return
    }
    const next = moveLocally(cards, id, target)
    setCards(next)

    const moved = next.find((card) => card.id === id)
    const original = before.find((card) => card.id === id)
    if (
      moved === undefined ||
      (original?.listId === moved.listId &&
        original.position === moved.position)
    ) {
      return
    }
    try {
      setCards(await moveCard(id, moved.listId, moved.position))
      setNow(new Date())
    } catch (e: unknown) {
      setCards(before)
      const message = e instanceof Error ? e.message : String(e)
      setActionError(`タスクを移動できませんでした：${message}`)
    }
  }

  function handleDragCancel() {
    if (beforeDrag.current !== null) setCards(beforeDrag.current)
    beforeDrag.current = null
    setDraggingId(null)
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

  const draggingCard = cards.find((card) => card.id === draggingId)

  // API がリスト内の並び順で返すため、ここでは並べ替えない
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: SCREEN_READER_INSTRUCTIONS },
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
            listId={list.id}
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
      <DragOverlay>
        {draggingCard !== undefined && (
          <CardDragPreview card={draggingCard} now={now} />
        )}
      </DragOverlay>
    </DndContext>
  )
}

export default Board
