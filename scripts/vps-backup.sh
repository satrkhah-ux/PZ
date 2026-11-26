#!/usr/bin/env bash
# بيزارا — نسخة احتياطية ليلية لقاعدة البيانات
#
# Every order, customer, loyalty card and debt the cafe has ever recorded lives
# in one hosted database with no copy anywhere else. This takes one, nightly,
# onto the owner's own server — which has 349GB free and is already paid for.
#
# Two rules it exists to honour:
#   * a truncated dump is worse than no dump, because it looks like safety.
#     The file is written to .tmp and only becomes a backup once gzip verifies
#     and the dump's own completion marker is present.
#   * pg_dump is not installed on this host and nothing should be installed for
#     this; the Postgres 17 image is already pulled, so it runs there.
#
# Covers the `public` schema: orders, order_items, customers, debts, menu,
# tables, expenses. NOT the auth schema — staff logins are managed by Supabase
# and would have to be recreated, which is minutes of work against months of
# takings.
set -euo pipefail

DIR="$HOME/backups/pizzara"
KEEP_DAYS=30
IMAGE="public.ecr.aws/supabase/postgres:17.12.0.000"
URL_FILE="$HOME/apps/pizzara/.db-url"

mkdir -p "$DIR"
[ -r "$URL_FILE" ] || { echo "$(date -Is) no db url at $URL_FILE"; exit 1; }

STAMP=$(date +%F)
OUT="$DIR/pizzara-$STAMP.sql.gz"
TMP="$OUT.tmp"

# The URL goes in as an env var, never as an argument — arguments are readable
# in `ps` by any user on the box.
docker run --rm -e "DBURL=$(cat "$URL_FILE")" --entrypoint sh "$IMAGE" -c \
  'pg_dump --no-owner --no-privileges --schema=public "$DBURL"' 2>/dev/null | gzip -9 > "$TMP"

if ! gzip -t "$TMP" 2>/dev/null; then
  echo "$(date -Is) BACKUP FAILED: archive is corrupt"; rm -f "$TMP"; exit 1
fi
if ! zcat "$TMP" | tail -5 | grep -q "PostgreSQL database dump complete"; then
  echo "$(date -Is) BACKUP FAILED: dump was cut short"; rm -f "$TMP"; exit 1
fi
ROWS=$(zcat "$TMP" | grep -c "^COPY public\." || true)
if [ "${ROWS:-0}" -lt 5 ]; then
  echo "$(date -Is) BACKUP FAILED: only $ROWS tables — refusing to call this a backup"; rm -f "$TMP"; exit 1
fi

mv "$TMP" "$OUT"
find "$DIR" -name 'pizzara-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: $(du -h "$OUT" | cut -f1), $ROWS tables, $(ls "$DIR" | wc -l) kept"
