// ドラッグ＆ドロップでのカードの移動・並び替え（F-05・F-06）。どこに落としたかから、移した先を決める
import type { Card, ListId } from '../api/cards'
import { LISTS } from './card'

/** 移した先のリストと、リストの中での順番（0 が一番上） */
export type DropTarget = { listId: ListId; index: number }

const LIST_DROPPABLE_PREFIX = 'list-'

/** リストそのもの（空のリストやカードの下の余白）に落とすときの id */
export function listDroppableId(listId: ListId): string {
  return `${LIST_DROPPABLE_PREFIX}${listId}`
}

/**
 * カード（activeId）を、どこ（overId）に落としたかから、移した先を決める。
 * - カードの上に落としたとき：そのカードの位置に入る（同じリストなら入れ替わる）
 * - リストに落としたとき：そのリストの一番下に入る
 */
export function resolveDropTarget(
  cards: Card[],
  activeId: number,
  overId: string | number,
): DropTarget | null {
  if (typeof overId === 'string') {
    const list = LISTS.find((l) => listDroppableId(l.id) === overId)
    if (list === undefined) return null
    const others = cards.filter(
      (card) => card.listId === list.id && card.id !== activeId,
    )
    return { listId: list.id, index: others.length }
  }
  const over = cards.find((card) => card.id === overId)
  if (over === undefined) return null
  const inList = cards.filter((card) => card.listId === over.listId)
  return {
    listId: over.listId,
    index: inList.findIndex((card) => card.id === over.id),
  }
}

/**
 * カードを target へ移した一覧を返す。サーバーと同じく、カードを外してから
 * 指定した順番に入れ、リストの表示順 → リスト内の並び順に並べて並び順を振り直す
 */
export function moveLocally(
  cards: Card[],
  id: number,
  target: DropTarget,
): Card[] {
  const moving = cards.find((card) => card.id === id)
  if (moving === undefined) return cards
  const rest = cards.filter((card) => card.id !== id)
  return LISTS.flatMap((list) => {
    const inList = rest.filter((card) => card.listId === list.id)
    if (list.id === target.listId) {
      inList.splice(Math.min(target.index, inList.length), 0, {
        ...moving,
        listId: target.listId,
      })
    }
    return inList.map((card, position) =>
      card.position === position ? card : { ...card, position },
    )
  })
}
