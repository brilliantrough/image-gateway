#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "release check failed: $*" >&2
  exit 1
}

if [[ -n "$(git ls-files config/upstreams.json knowledge.md cat.png .local .agents .superpowers docs/superpowers 2>/dev/null)" ]]; then
  echo "Tracked local-only files:" >&2
  git ls-files config/upstreams.json knowledge.md cat.png .local .agents .superpowers docs/superpowers >&2
  fail "remove local configs, local docs, test assets, and agent artifacts from git before publishing"
fi

secret_report="$(mktemp)"
candidate_files="$(mktemp)"

git ls-files --cached --others --exclude-standard -z \
  ':!:package-lock.json' \
  ':!:scripts/check-release.sh' \
  ':!:node_modules/**' \
  ':!:dist/**' >"$candidate_files"

if xargs -0 grep -nE '(sk-[A-Za-z0-9_-]{16,}|sk-sp-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ADMIN_PASSWORD=123456)' <"$candidate_files" >"$secret_report" 2>/dev/null; then
  cat "$secret_report" >&2
  rm -f "$secret_report" "$candidate_files"
  fail "possible real secret or default admin password found in public candidate files"
fi
rm -f "$secret_report" "$candidate_files"

[[ -f config/upstreams.example.json ]] || fail "missing config/upstreams.example.json"
[[ -f .env.example ]] || fail "missing .env.example"

echo "release check passed"
