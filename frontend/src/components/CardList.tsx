import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Card, ListId } from '../api/cards'
import { listDroppableId } from '../domain/move'
import CardItem from './CardItem'

type Props = {
  listId: ListId
  name: string
  cards: Card[]
  now: Date
  onAdd: () => void
  onOpen: (card: Card) => void
  onCheck: (card: Card) => void
}

/** SC-01 ② リスト。カードを落とせる（空のリストにも落とせる） */
function CardList({ listId, name, cards, now, onAdd, onOpen, onCheck }: Props) {
  const { setNodeRef } = useDroppable({ id: listDroppableId(listId) })

  return (
    <section ref={setNodeRef} className="list" aria-label={name}>
      <h2 className="list-title">
        {name} ({cards.length})
      </h2>
      <SortableContext
        items={cards.map((card) => card.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="card-area">
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              now={now}
              onOpen={() => onOpen(card)}
              onCheck={() => onCheck(card)}
            />
          ))}
        </div>
      </SortableContext>
      <button type="button" className="add-button" onClick={onAdd}>
        ＋ タスクを追加
      </button>
    </section>
  )
}

export default CardList
