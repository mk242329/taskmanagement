import { useId, useState } from 'react'

type Props = {
  message: string
  /** 「OK」を押したとき。失敗したら例外を投げ、ダイアログは開いたままにする */
  onOk: () => Promise<void>
  onCancel: () => void
}

/** SC-03 削除確認ダイアログ（アプリの見た目に合わせたもの） */
function ConfirmDialog({ message, onOk, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const id = useId()

  async function handleOk() {
    setError(null)
    setBusy(true)
    try {
      await onOk()
    } catch (e: unknown) {
      const reason = e instanceof Error ? e.message : String(e)
      setError(`削除できませんでした：${reason}`)
      setBusy(false)
    }
  }

  return (
    <div
      className="dialog-backdrop confirm-backdrop"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          // 下にある編集ウィンドウまで閉じないよう、ここで止める
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <div
        className="dialog confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-message`}
      >
        <p id={`${id}-message`} className="confirm-message">
          {message}
        </p>
        {error !== null && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-buttons">
          {/* 押し間違えても消えないよう、最初は「キャンセル」を選んでおく */}
          <button type="button" className="button" onClick={onCancel} autoFocus>
            キャンセル
          </button>
          <button
            type="button"
            className="button button-danger"
            onClick={handleOk}
            disabled={busy}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog
