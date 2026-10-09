import type { Card } from '../api/cards'
import CardItem from './CardItem'

type Props = {
  name: string
  cards: Card[]
  now: Date
  onAdd: () => void
  onOpen: (card: Card) => void
}

/** SC-01 ② リスト */
function CardList({ name, cards, now, onAdd, onOpen }: Props) {
  return (
    <section className="list" aria-label={name}>
      <h2 className="list-title">
        {name} ({cards.length})
      </h2>
      <div className="card-area">
        {cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            now={now}
            onOpen={() => onOpen(card)}
          />
        ))}
      </div>
      <button type="button" className="add-button" onClick={onAdd}>
        ＋ タスクを追加
      </button>
    </section>
  )
}

export default CardList
