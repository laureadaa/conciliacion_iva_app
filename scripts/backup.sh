#!/bin/sh
# Atomic SQLite backup using the .backup command (safe with WAL).
# Keeps the last 14 daily backups.
set -e

SRC="${DATABASE_URL:-/app/data/app.db}"
DIR="${BACKUP_DIR:-/app/backups}"
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="$DIR/app-$STAMP.db"

mkdir -p "$DIR"

if [ ! -f "$SRC" ]; then
  echo "[backup] source $SRC not found, skipping"
  exit 0
fi

sqlite3 "$SRC" ".backup '$OUT'"
gzip -9 "$OUT"
echo "[backup] wrote $OUT.gz"

# Retention: 14 most recent
ls -1t "$DIR"/app-*.db.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "[backup] retention applied (keep 14)"
