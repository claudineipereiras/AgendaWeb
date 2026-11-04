#!/usr/bin/env bash
# ==============================================================================
# AgendaWeb Automated Backup Utility
# ==============================================================================
# Creates a timestamped archive of the full codebase, documentation, and schema.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_ARCHIVE="${BACKUP_DIR}/agendaweb_backup_${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "✦ Taking full AgendaWeb project backup..."

tar -czf "$BACKUP_ARCHIVE" \
  --exclude="node_modules" \
  --exclude=".git" \
  --exclude="backups" \
  --exclude="tmp" \
  --exclude="scratch" \
  --exclude="*.zip" \
  -C "$DIR" .

echo "✓ Full codebase archive created:"
echo "  ${BACKUP_ARCHIVE} ($(du -h "$BACKUP_ARCHIVE" | cut -f1))"

# Copy latest production schema snapshot
cp "${DIR}/Application/config/schema.sql" "${BACKUP_DIR}/schema_snapshot_${TIMESTAMP}.sql"
echo "✓ Database schema snapshot saved:"
echo "  ${BACKUP_DIR}/schema_snapshot_${TIMESTAMP}.sql"

echo ""
echo "✦ Backup complete and safely stored in backups/"
