import type { Card } from '../api/cards'

/** テスト用のカードを作る。指定しない項目は既定値にする */
export function makeCard(overrides: Partial<Card>): Card {
  return {
    id: 1,
    title: 'カード',
    description: '',
    dueAt: null,
    strict: false,
    listId: 'todo',
    position: 0,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

/** fetch をモックし、指定した内容を返すようにする */
export function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}
