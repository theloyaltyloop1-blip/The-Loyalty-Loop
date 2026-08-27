#!/bin/bash
# Local point-in-time backup for The Loyalty Loop.
#
# Git/GitHub is the primary backup for source code (see CHANGELOG.md /
# README.md). This script exists for the two things Git doesn't cover:
# a snapshot you can grab in seconds without a clone, and a copy of the
# live Supabase database schema. Adapted from The Lazy Developer course,
# Module 3 ("Never lose data again with backups and version control").
#
# Usage: ./scripts/backup.sh
# Requires: rsync. Optional: the Supabase CLI (`supabase`) linked to this
# project, for a live schema dump — safely skipped if not installed/linked.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${LOYALTY_LOOP_BACKUP_DIR:-$SOURCE_DIR/../loyalty-loop-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

read -p "Enter a name for this backup (e.g., v1.1.0-security): " BACKUP_NAME
BACKUP_NAME=${BACKUP_NAME:-unnamed}
BACKUP_NAME=$(echo "$BACKUP_NAME" | tr ' ' '_')

DEST="$BACKUP_DIR/backup_${TIMESTAMP}_${BACKUP_NAME}"
mkdir -p "$DEST"

echo -e "${GREEN}Starting backup at $(date)${NC}"

echo -e "${YELLOW}Backing up project files...${NC}"
rsync -av --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude 'build' \
  --exclude '.expo' \
  --exclude '.next' \
  --exclude 'test_output' \
  --exclude 'coverage' \
  "$SOURCE_DIR/" \
  "$DEST/" \
  && echo -e "${GREEN}Project files backup successful${NC}" \
  || echo -e "${RED}Project files backup failed${NC}"

echo -e "${YELLOW}Copying migration files (schema reference)...${NC}"
mkdir -p "$DEST/db_schema"
if [ -d "$SOURCE_DIR/supabase/migrations" ]; then
  cp "$SOURCE_DIR/supabase/migrations/"*.sql "$DEST/db_schema/" 2>/dev/null \
    && echo -e "${GREEN}Migration files copied${NC}" \
    || echo -e "${RED}No .sql migration files found to copy${NC}"
else
  echo -e "${RED}Warning: no supabase/migrations directory found${NC}"
fi

echo -e "${YELLOW}Attempting a live schema dump via the Supabase CLI...${NC}"
if command -v supabase >/dev/null 2>&1; then
  ( cd "$SOURCE_DIR" && supabase db dump -f "$DEST/db_schema/live_schema_dump.sql" ) \
    && echo -e "${GREEN}Live schema dump successful${NC}" \
    || echo -e "${YELLOW}Live schema dump skipped (CLI not linked to a project, or not logged in) — migration files above still cover the schema${NC}"
else
  echo -e "${YELLOW}Supabase CLI not installed — skipping live schema dump${NC}"
fi

cat << EOF > "$DEST/BACKUP_INFO.md"
# The Loyalty Loop Backup

**Backup Date:** $(date)
**Backup Name:** ${BACKUP_NAME}
**Timestamp:** ${TIMESTAMP}

## Contents
- Project source (excluding node_modules, .git, build output)
- SQL migration files (\`db_schema/*.sql\`) and, if available, a live schema dump

## Restoring

### Code
\`\`\`bash
rsync -av "$DEST/" /path/to/restore/location/
cd /path/to/restore/location
npm install
\`\`\`

### Database
Migrations in \`db_schema/\` are the source of truth — apply them in order
against a fresh Supabase project with \`supabase db push\`, or use
\`db_schema/live_schema_dump.sql\` (if present) to restore the exact schema
as it existed at backup time.

### Environment variables
Not included in this backup — pull them fresh from each app's EAS
environment (\`eas env:list\`) or the Vercel project settings.
EOF

echo -e "${YELLOW}Cleaning old backups (keeping last 10)...${NC}"
cd "$BACKUP_DIR" 2>/dev/null && ls -t | grep "^backup_" | tail -n +11 | xargs -r rm -rf

echo -e "${GREEN}Backup completed at $(date)${NC}"
echo -e "${GREEN}Stored at: ${NC}${DEST}"
