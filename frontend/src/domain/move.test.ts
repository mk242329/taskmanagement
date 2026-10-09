import type { Card } from '../api/cards'
import { makeCard } from '../test/cards'
import {
  listDroppableId,
  moveLocally,
  removeLocally,
  resolveDropTarget,
} from './move'

// 未着手：1, 2, 3／作業中：4／完了：なし
const cards: Card[] = [
  makeCard({ id: 1, listId: 'todo', position: 0 }),
  makeCard({ id: 2, listId: 'todo', position: 1 }),
  makeCard({ id: 3, listId: 'todo', position: 2 }),
  makeCard({ id: 4, listId: 'doing', position: 0 }),
]

/** 「リスト:id」の形で並びを返す */
function layout(list: Card[]) {
  return list.map((card) => `${card.listId}:${card.id}:${card.position}`)
}

describe('resolveDropTarget', () => {
  test('別のリストのカードの上に落とすと、そのカードの位置に入る', () => {
    expect(resolveDropTarget(cards, 1, 4)).toEqual({
      listId: 'doing',
      index: 0,
    })
  })

  test('同じリストのカードの上に落とすと、そのカードの位置に入る', () => {
    expect(resolveDropTarget(cards, 3, 1)).toEqual({ listId: 'todo', index: 0 })
    expect(resolveDropTarget(cards, 1, 3)).toEqual({ listId: 'todo', index: 2 })
  })

  test('リストに落とすと一番下に入る。空のリストにも落とせる', () => {
    expect(resolveDropTarget(cards, 1, listDroppableId('doing'))).toEqual({
      listId: 'doing',
      index: 1,
    })
    expect(resolveDropTarget(cards, 1, listDroppableId('done'))).toEqual({
      listId: 'done',
      index: 0,
    })
    // 同じリストなら、自分を除いた一番下
    expect(resolveDropTarget(cards, 1, listDroppableId('todo'))).toEqual({
      listId: 'todo',
      index: 2,
    })
  })

  test('知らない場所に落としたときは null', () => {
    expect(resolveDropTarget(cards, 1, 999)).toBeNull()
    expect(resolveDropTarget(cards, 1, 'unknown')).toBeNull()
  })
})

describe('moveLocally', () => {
  test('一番下のカードを一番上へ移すと、順番が入れ替わる', () => {
    // T-07-01
    expect(layout(moveLocally(cards, 3, { listId: 'todo', index: 0 }))).toEqual(
      ['todo:3:0', 'todo:1:1', 'todo:2:2', 'doing:4:0'],
    )
  })

  test('一番上のカードを一番下へ移せる', () => {
    expect(layout(moveLocally(cards, 1, { listId: 'todo', index: 2 }))).toEqual(
      ['todo:2:0', 'todo:3:1', 'todo:1:2', 'doing:4:0'],
    )
  })

  test('別のリストの真ん中へ移すと、落とした位置に入り両方のリストを詰め直す', () => {
    // T-06-01・T-07-02
    const twoDoing = [
      ...cards,
      makeCard({ id: 5, listId: 'doing', position: 1 }),
    ]
    expect(
      layout(moveLocally(twoDoing, 2, { listId: 'doing', index: 1 })),
    ).toEqual(['todo:1:0', 'todo:3:1', 'doing:4:0', 'doing:2:1', 'doing:5:2'])
  })

  test('空のリストへ移せる', () => {
    // T-06-03・T-06-04
    expect(layout(moveLocally(cards, 4, { listId: 'done', index: 0 }))).toEqual(
      ['todo:1:0', 'todo:2:1', 'todo:3:2', 'done:4:0'],
    )
  })

  test('順番がリストの枚数より大きいときは一番下に入る', () => {
    expect(
      layout(moveLocally(cards, 1, { listId: 'doing', index: 99 })),
    ).toEqual(['todo:2:0', 'todo:3:1', 'doing:4:0', 'doing:1:1'])
  })
})

test('removeLocally はカードを除き、残ったカードの並び順を詰め直す', () => {
  expect(layout(removeLocally(cards, 2))).toEqual([
    'todo:1:0',
    'todo:3:1',
    'doing:4:0',
  ])
})
