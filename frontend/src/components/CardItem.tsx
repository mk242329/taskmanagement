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
}

/** SC-01 ③ カード */
function CardItem({ card, now }: Props) {
  const priority = getPriority(card, now)
  const overdue = isOverdue(card, now)

  return (
    <div className={overdue ? 'card overdue' : 'card'} data-testid="card">
      <div className="card-line1">
        {/* チェックでのリスト移動は、移動の API ができてから付ける */}
        <input
          type="checkbox"
          className="card-check"
          checked={card.listId === 'done'}
          readOnly
          aria-label={`${card.title} の完了`}
        />
        <span className={`priority priority-${priority}`}>
          {PRIORITY_LABELS[priority]}
        </span>
        <span className="card-title">{card.title}</span>
      </div>
      {card.dueAt !== null && (
        <div className="card-due">{formatDue(card.dueAt)}</div>
      )}
    </div>
  )
}

export default CardItem
