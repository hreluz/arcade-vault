#!/usr/bin/env bash
# PostToolUse hook: format the written/edited file with Prettier, then lint it with ESLint.
# Remaining ESLint errors are reported back to Claude (exit 2) so it can fix them.

project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')

[ -n "$file" ] && [ -f "$file" ] || exit 0
case "$file" in "$project_dir"/*) ;; *) exit 0 ;; esac

cd "$project_dir" || exit 0
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
source "$NVM_DIR/nvm.sh" >/dev/null 2>&1 && nvm use --silent >/dev/null 2>&1

npx --no-install prettier --write --ignore-unknown --log-level warn "$file" >&2

case "$file" in
  *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs)
    if ! output=$(npx --no-install eslint --fix --no-warn-ignored "$file" 2>&1); then
      echo "ESLint found problems in $file that --fix could not resolve:" >&2
      echo "$output" >&2
      exit 2
    fi
    ;;
esac
exit 0
