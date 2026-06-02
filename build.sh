#!/usr/bin/env bash
# ============================================================
#  资源版本号自动生成
#  对静态资源算内容哈希，写回 index.html 的 ?v=<hash>。
#  资源内容变了 → 哈希变 → URL 变 → 绕过 Cloudflare 的
#  immutable 长缓存，自动拿到新文件。内容没变则哈希不变。
#  幂等：可反复执行，结果一致。
# ============================================================
set -euo pipefail

cd "$(dirname "$0")"

HTML="index.html"
ASSETS=(style.css script.js zodiac.js)

changed=0
for f in "${ASSETS[@]}"; do
  [ -f "$f" ] || { echo "skip: $f 不存在"; continue; }
  hash="$(sha1sum "$f" | cut -c1-10)"
  # 转义文件名里的点，避免被当作正则通配
  fre="$(printf '%s' "$f" | sed 's/\./\\./g')"
  # 把 href/src 里的该资源（无论是否已带 ?v=）统一替换为新哈希
  before="$(cat "$HTML")"
  sed -i -E "s#((href|src)=\"$fre)(\?v=[^\"]*)?\"#\1?v=$hash\"#g" "$HTML"
  if [ "$before" != "$(cat "$HTML")" ]; then
    echo "updated: $f -> v=$hash"
    changed=1
  else
    echo "unchanged: $f (v=$hash)"
  fi
done

[ "$changed" -eq 1 ] && echo "index.html 已更新。" || echo "index.html 无需变更。"
