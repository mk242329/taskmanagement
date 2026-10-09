import {
  formatDue,
  getPriority,
  isOverdue,
  toDueAt,
  validateTitle,
} from './card'

// 2026-10-07 12:00（ブラウザの時刻）を「今」とする
const now = new Date(2026, 9, 7, 12, 0)

/** 今日から days 日後の hour 時（ブラウザの時刻）を ISO 文字列にする */
function dueAt(days: number, hour = 18): string {
  return new Date(2026, 9, 7 + days, hour, 0).toISOString()
}

describe('getPriority', () => {
  test.each([
    ['期限なし', null, false, 'low'], // T-12-01
    ['期限が今日', dueAt(0), false, 'high'], // T-12-02
    ['期限が過去', dueAt(-1), false, 'high'], // T-12-03
    ['期限が明日', dueAt(1), false, 'medium'], // T-12-04
    ['期限が7日後', dueAt(7), false, 'medium'], // T-12-05
    ['期限が8日後', dueAt(8), false, 'low'], // T-12-06
    ['期限なし・時間厳守', null, true, 'medium'], // T-12-07
    ['期限が3日後・時間厳守', dueAt(3), true, 'high'], // T-12-08
    ['期限が今日・時間厳守', dueAt(0), true, 'high'], // T-12-09
  ] as const)('%s → %s', (_, due, strict, expected) => {
    expect(getPriority({ dueAt: due, strict }, now)).toBe(expected)
  })

  test('期限の時刻は見ず、日付だけで決める', () => {
    // 今日の 0:00（すでに過ぎた時刻）でも、明日の 0:00 でも日付で判定する
    expect(getPriority({ dueAt: dueAt(1, 0), strict: false }, now)).toBe(
      'medium',
    )
    expect(getPriority({ dueAt: dueAt(0, 23), strict: false }, now)).toBe(
      'high',
    )
  })
})

describe('isOverdue', () => {
  test('期限を過ぎた未完了のカードは期限切れ', () => {
    expect(isOverdue({ dueAt: dueAt(0, 11), listId: 'todo' }, now)).toBe(true)
    expect(isOverdue({ dueAt: dueAt(-1), listId: 'doing' }, now)).toBe(true)
  })

  test('期限前・期限なし・完了リストのカードは期限切れでない', () => {
    expect(isOverdue({ dueAt: dueAt(0, 13), listId: 'todo' }, now)).toBe(false)
    expect(isOverdue({ dueAt: null, listId: 'todo' }, now)).toBe(false)
    expect(isOverdue({ dueAt: dueAt(-1), listId: 'done' }, now)).toBe(false)
  })
})

test('formatDue は「月/日 時:分」の形にする', () => {
  expect(formatDue(new Date(2026, 8, 30, 20, 5).toISOString())).toBe(
    '9/30 20:05',
  )
})

describe('validateTitle', () => {
  test.each([
    ['空', '', 'タイトルを入力してください'], // T-03-01
    ['空白だけ', ' 　 ', 'タイトルを入力してください'], // T-03-02
    ['1文字', 'a', null], // T-03-03
    ['50文字', 'あ'.repeat(50), null], // T-03-04
    ['51文字', 'あ'.repeat(51), 'タイトルは50文字以内で入力してください'], // T-03-05
  ] as const)('%s', (_, title, expected) => {
    expect(validateTitle(title)).toBe(expected)
  })
})

test('toDueAt は入力欄の値（ブラウザの時刻）を ISO 文字列にし、空なら null にする', () => {
  expect(toDueAt('2026-10-07T18:30')).toBe(
    new Date(2026, 9, 7, 18, 30).toISOString(),
  )
  expect(toDueAt('')).toBeNull()
})
