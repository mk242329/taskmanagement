import type { Card } from '../api/cards'
import CardItem from './CardItem'

type Props = {
  name: string
  cards: Card[]
  now: Date
}

/** SC-01 ② リスト */
function CardList({ name, cards, now }: Props) {
  return (
    <section className="list" aria-label={name}>
      <h2 className="list-title">
        {name} ({cards.length})
      </h2>
      <div className="card-area">
        {cards.map((card) => (
          <CardItem key={card.id} card={card} now={now} />
        ))}
      </div>
      {/* カード編集ウィンドウを作るまでは、押しても何もしない */}
      <button type="button" className="add-button">
        ＋ タスクを追加
      </button>
    </section>
  )
}

export default CardList
