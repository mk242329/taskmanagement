import { useId, useState, type FormEvent } from 'react'
import { ApiError, type CardCreateInput } from '../api/cards'
import {
  DESCRIPTION_MAX_LENGTH,
  getPriority,
  PRIORITY_LABELS,
  toDueAt,
  validateTitle,
} from '../domain/card'

/** ウィンドウで入力する内容（追加先のリストは呼び出し側が決める） */
export type CardFormValues = Omit<CardCreateInput, 'listId'>

type Props = {
  heading: string
  /** 保存する。失敗したら例外を投げ、ウィンドウは開いたままにする */
  onSave: (values: CardFormValues) => Promise<void>
  onCancel: () => void
}

/** SC-02 カード編集ウィンドウ（今は追加だけに使う） */
function CardFormDialog({ heading, onSave, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  // 日付と時刻の入力欄の値（例：2026-10-10T18:00）。空なら期限なし
  const [due, setDue] = useState('')
  const [strict, setStrict] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const id = useId()
  const dueAt = toDueAt(due)
  // 入力中の期限と時間厳守から決まる優先度を、その場で表示する
  const priority = getPriority({ dueAt, strict })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const error = validateTitle(title)
    setTitleError(error)
    setSaveError(null)
    if (error !== null) return

    setSaving(true)
    try {
      await onSave({ title, description, dueAt, strict })
    } catch (e: unknown) {
      if (e instanceof ApiError && e.errors.title !== undefined) {
        setTitleError(e.errors.title)
      } else {
        const message = e instanceof Error ? e.message : String(e)
        setSaveError(`保存できませんでした：${message}`)
      }
      setSaving(false)
    }
  }

  return (
    <div
      className="dialog-backdrop"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-heading`}
        onSubmit={handleSubmit}
        noValidate
      >
        <h2 id={`${id}-heading`} className="dialog-heading">
          {heading}
        </h2>

        <div className="form-row">
          <label htmlFor={`${id}-title`} className="form-label">
            タイトル（必須）
          </label>
          <div className="form-field">
            <input
              id={`${id}-title`}
              type="text"
              className={titleError !== null ? 'input input-error' : 'input'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={titleError !== null}
              aria-describedby={
                titleError !== null ? `${id}-title-error` : undefined
              }
              autoFocus
            />
            {titleError !== null && (
              <p id={`${id}-title-error`} className="form-error">
                {titleError}
              </p>
            )}
          </div>
        </div>

        <div className="form-row">
          <label htmlFor={`${id}-description`} className="form-label">
            説明文
          </label>
          <div className="form-field">
            <textarea
              id={`${id}-description`}
              className="input"
              rows={4}
              maxLength={DESCRIPTION_MAX_LENGTH}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <label htmlFor={`${id}-due`} className="form-label">
            期限
          </label>
          <div className="form-field">
            <input
              id={`${id}-due`}
              type="datetime-local"
              className="input"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <label htmlFor={`${id}-strict`} className="form-label">
            時間厳守
          </label>
          <div className="form-field form-inline">
            <input
              id={`${id}-strict`}
              type="checkbox"
              checked={strict}
              onChange={(e) => setStrict(e.target.checked)}
            />
            <span className="form-note">
              遅れてはいけないタスク（優先度が1段階上がります）
            </span>
          </div>
        </div>

        <div className="form-row">
          <span className="form-label">優先度</span>
          <div className="form-field form-inline">
            <span
              className={`priority priority-${priority}`}
              data-testid="form-priority"
            >
              {PRIORITY_LABELS[priority]}
            </span>
            <span className="form-note">
              期限と時間厳守から自動で決まります
            </span>
          </div>
        </div>

        {saveError !== null && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}

        {/* 「削除」は編集のときだけ左端に置く（F-04 で追加する） */}
        <div className="dialog-buttons">
          <button type="button" className="button" onClick={onCancel}>
            キャンセル
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={saving}
          >
            保存
          </button>
        </div>
      </form>
    </div>
  )
}

export default CardFormDialog
