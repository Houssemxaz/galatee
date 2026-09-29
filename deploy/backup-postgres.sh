#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/srv/galatee/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_PATH="$BACKUP_DIR/galatee-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
docker compose exec -T postgres sh -c \
  'pg_dump --clean --if-exists --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  | gzip > "$BACKUP_PATH"

gzip -t "$BACKUP_PATH"

find "$BACKUP_DIR" -type f -name 'galatee-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
echo "Backup PostgreSQL créé et vérifié: $BACKUP_PATH"
