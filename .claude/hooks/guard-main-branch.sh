#!/bin/bash
# main ブランチへの直接コミット・プッシュをブロックする PreToolUse フック。
# 終了コード 2 で終わると Claude Code はコマンドを実行せず、stderr の内容を Claude に返す。

command=$(jq -r '.tool_input.command // ""')

# git コマンドを含まないなら何もしない
if ! grep -Eq '(^|[^[:alnum:]_-])git[[:space:]]' <<<"$command"; then
  exit 0
fi

current_branch=$(git -C "${CLAUDE_PROJECT_DIR:-.}" branch --show-current 2>/dev/null)

block() {
  echo "ブロック: $1" >&2
  echo "CLAUDE.md の開発フローに従い、イシューを作成してから作業用ブランチを切り、PR で main に取り込んでください。" >&2
  exit 2
}

# main 上でのコミット
if grep -Eq 'git[[:space:]]+([^;&|]*[[:space:]])?commit([[:space:]]|$)' <<<"$command" && [ "$current_branch" = "main" ]; then
  block "main ブランチ上でのコミットは禁止されています。"
fi

# main へのプッシュ
if grep -Eq 'git[[:space:]]+([^;&|]*[[:space:]])?push([[:space:]]|$)' <<<"$command"; then
  # 明示的に main を指定している（例: git push origin main / HEAD:main / +main）
  if grep -Eq 'push[^;&|]*([[:space:]]|:|\+)main([[:space:]]|$|;|&|\|)' <<<"$command"; then
    block "main ブランチへの直接プッシュは禁止されています。"
  fi
  # main 上でリモート指定のみ・引数なしのプッシュ（現在のブランチ = main が送られる）
  if [ "$current_branch" = "main" ]; then
    block "main ブランチ上でのプッシュは禁止されています。"
  fi
fi

exit 0
