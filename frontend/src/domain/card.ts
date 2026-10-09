// カードの優先度・期限切れの判定と、期限の表示形式（docs/design/data-flow.md の「4. 通知・期限切れの判定」）
import type { Card, ListId } from '../api/cards'

// リストは3つ固定のため、プログラムの中に直接書く
export const LISTS: { id: ListId; name: string }[] = [
  { id: 'todo', name: '未着手' },
  { id: 'doing', name: '作業中' },
  { id: 'done', name: '完了' },
]

export type Priority = 'low' | 'medium' | 'high'

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

// 優先度の低い順。時間厳守のときは、この並びで1段階上げる
const PRIORITY_LEVELS: Priority[] = ['low', 'medium', 'high']
// 期限の日付が「今日から何日後まで」なら中にするか（当日以前は高）
const MEDIUM_PRIORITY_DAYS = 7

type DueInfo = Pick<Card, 'dueAt' | 'strict'>

/** 期限の日付が今日から何日後か（今日は0、過ぎていればマイナス）。時刻は見ない */
function daysUntilDue(dueAt: string, now: Date): number {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueAt)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
}

/** 期限と時間厳守から優先度を決める */
export function getPriority(card: DueInfo, now: Date = new Date()): Priority {
  let level = 0
  if (card.dueAt !== null) {
    const days = daysUntilDue(card.dueAt, now)
    if (days <= 0) {
      level = 2
    } else if (days <= MEDIUM_PRIORITY_DAYS) {
      level = 1
    }
  }
  if (card.strict) {
    level = Math.min(level + 1, PRIORITY_LEVELS.length - 1)
  }
  return PRIORITY_LEVELS[level]
}

/** 期限を過ぎた未完了のカードか */
export function isOverdue(
  card: Pick<Card, 'dueAt' | 'listId'>,
  now: Date = new Date(),
): boolean {
  return (
    card.dueAt !== null && card.listId !== 'done' && new Date(card.dueAt) <= now
  )
}

/** 「9/30 20:00」の形にする（ブラウザの時刻で表示する） */
export function formatDue(dueAt: string): string {
  const d = new Date(dueAt)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
}
