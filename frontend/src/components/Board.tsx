import { useEffect, useState } from 'react'
import { fetchCards, type Card } from '../api/cards'
import { LISTS } from '../domain/card'
import CardList from './CardList'

// 優先度・期限切れの表示を決め直す間隔
const REFRESH_INTERVAL_MS = 30 * 1000

/** SC-01 ボード画面（3つのリスト） */
function Board() {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

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
      {LISTS.map((list) => (
        <CardList
          key={list.id}
          name={list.name}
          cards={cards.filter((card) => card.listId === list.id)}
          now={now}
        />
      ))}
    </main>
  )
}

export default Board
