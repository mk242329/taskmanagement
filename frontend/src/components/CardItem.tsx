import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card } from '../api/cards'
import {
  formatDue,
  getPriority,
  isOverdue,
  PRIORITY_LABELS,
} from '../domain/card'

type Props = {
  card: Card
  now: Date
  /** カードをクリックしたとき（編集ウィンドウを開く） */
  onOpen: () => void
  /** チェックボックスを押したとき（次のリストへ移す） */
  onCheck: () => void
  /** ゴミ箱マークを押したとき（削除確認ダイアログを開く） */
  onDelete: () => void
}

/** SC-01 ③ カード。ドラッグで移動・並び替えできる（F-05・F-06） */
function CardItem({ card, now, onOpen, onCheck, onDelete }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })
  const overdue = isOverdue(card, now)

  const classNames = ['card']
  if (overdue) classNames.push('overdue')
  // 掴んでいる間は、元の場所に薄い影だけを残す（掴んだカードは DragOverlay で描く）
  if (isDragging) classNames.push('dragging')

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={classNames.join(' ')}
      data-testid="card"
      role="button"
      tabIndex={0}
      aria-label={`${card.title} を編集`}
      aria-roledescription="並び替えできるタスク"
      onClick={onOpen}
      onKeyDown={(e) => {
        // チェックボックス・ゴミ箱マークでのキー操作は、カードの操作にしない
        if (e.target !== e.currentTarget) return
        // Enter は編集。スペースはドラッグの開始・終了（dnd-kit に渡す）
        if (e.key === 'Enter' && !isDragging) {
          e.preventDefault()
          onOpen()
          return
        }
        listeners?.onKeyDown?.(e)
      }}
    >
      <CardContent
        card={card}
        now={now}
        onCheck={onCheck}
        onDelete={onDelete}
      />
    </div>
  )
}

/** ドラッグ中にマウスについてくるカード */
export function CardDragPreview({ card, now }: { card: Card; now: Date }) {
  const overdue = isOverdue(card, now)
  return (
    <div
      className={overdue ? 'card overdue card-preview' : 'card card-preview'}
    >
      <CardContent card={card} now={now} />
    </div>
  )
}

/** カードの中身（チェックボックス・優先度・タイトル・期限） */
function CardContent({
  card,
  now,
  onCheck,
  onDelete,
}: {
  card: Card
  now: Date
  /** 省略するとチェックボックスは押せない（ドラッグ中の表示用） */
  onCheck?: () => void
  /** 省略するとゴミ箱マークを表示しない（ドラッグ中の表示用） */
  onDelete?: () => void
}) {
  const priority = getPriority(card, now)
  return (
    <>
      <div className="card-line1">
        {/* チェックの状態はリストで決まる。押すと移動し、移った先のリストで表示し直す */}
        {onCheck !== undefined ? (
          <input
            type="checkbox"
            className="card-check"
            checked={card.listId === 'done'}
            onChange={onCheck}
            aria-label={`${card.title} の完了`}
            // チェックボックスを押しても編集ウィンドウは開かない（F-11）
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <input
            type="checkbox"
            className="card-check"
            checked={card.listId === 'done'}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
          />
        )}
        <span className={`priority priority-${priority}`}>
          {PRIORITY_LABELS[priority]}
        </span>
        <span className="card-title">{card.title}</span>
        {onDelete !== undefined && (
          <button
            type="button"
            className="card-delete"
            aria-label={`${card.title} を削除`}
            title="削除"
            // 押しても編集ウィンドウは開かない
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <TrashIcon />
          </button>
        )}
      </div>
      {card.dueAt !== null && (
        <div className="card-due">{formatDue(card.dueAt)}</div>
      )}
    </>
  )
}

/** ゴミ箱マーク */
function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

export default CardItem
