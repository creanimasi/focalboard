#!/bin/bash
# ============================================
# Focalboard Backup Script for Linux VPS
# ============================================
# Crontab: 0 2 * * * /opt/focalboard/backup-focalboard.sh
# ============================================

set -e

# Configuration
FOCALBOARD_DIR="/opt/focalboard"
BACKUP_DIR="/opt/focalboard/backups"
FILES_DIR="/mnt/synology-focalboard/files"  # NAS mount point
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$BACKUP_DIR/backup_log.txt"

# Database credentials
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="focalboard"
DB_USER="focalboard"
DB_PASS="M4Ccj6YZn7#jQ*udRDzW%#z08vMC8Wa6"

# Google Drive remote name (configured with rclone)
GDRIVE_REMOTE="gdrive"
GDRIVE_PATH="Backups/Focalboard"

# Telegram notification (optional)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""

# n8n webhook (optional)
N8N_WEBHOOK=""

# ============================================

# Create directories
mkdir -p "$BACKUP_DIR/db"
mkdir -p "$BACKUP_DIR/files"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Send notification
notify() {
    local message="$1"
    local status="$2"  # success or error
    
    # Telegram
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=🗄️ Focalboard Backup $status\n\n$message" \
            -d "parse_mode=HTML" > /dev/null 2>&1
    fi
    
    # n8n webhook
    if [ -n "$N8N_WEBHOOK" ]; then
        curl -s -X POST "$N8N_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"status\": \"$status\", \"message\": \"$message\", \"timestamp\": \"$(date -Iseconds)\"}" > /dev/null 2>&1
    fi
}

log "=========================================="
log "Starting Focalboard Backup"
log "=========================================="

ERRORS=""

# 1. Backup Database
log "Backing up PostgreSQL database..."

DB_BACKUP_FILE="$BACKUP_DIR/db/focalboard_db_$DATE.sql"

export PGPASSWORD="$DB_PASS"
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$DB_BACKUP_FILE" 2>/dev/null; then
    # Compress
    gzip "$DB_BACKUP_FILE"
    DB_SIZE=$(du -h "$DB_BACKUP_FILE.gz" | cut -f1)
    log "Database backup SUCCESS: $DB_BACKUP_FILE.gz ($DB_SIZE)"
else
    log "ERROR: Database backup failed!"
    ERRORS="$ERRORS\n- Database backup failed"
fi
unset PGPASSWORD

# 2. Backup Files from NAS
log "Backing up files from NAS..."

FILES_BACKUP="$BACKUP_DIR/files/focalboard_files_$DATE.tar.gz"

if mountpoint -q "$(dirname $FILES_DIR)" 2>/dev/null || [ -d "$FILES_DIR" ]; then
    FILE_COUNT=$(find "$FILES_DIR" -type f 2>/dev/null | wc -l)
    if tar -czf "$FILES_BACKUP" -C "$(dirname $FILES_DIR)" "$(basename $FILES_DIR)" 2>/dev/null; then
        FILES_SIZE=$(du -h "$FILES_BACKUP" | cut -f1)
        log "Files backup SUCCESS: $FILES_BACKUP ($FILE_COUNT files, $FILES_SIZE)"
    else
        log "ERROR: Files backup failed!"
        ERRORS="$ERRORS\n- Files backup failed"
    fi
else
    log "WARNING: NAS not mounted at $FILES_DIR"
    ERRORS="$ERRORS\n- NAS not mounted"
fi

# 3. Backup Config
log "Backing up config..."

CONFIG_BACKUP="$BACKUP_DIR/config_$DATE.json"
if cp "$FOCALBOARD_DIR/config.json" "$CONFIG_BACKUP" 2>/dev/null; then
    log "Config backup SUCCESS: $CONFIG_BACKUP"
else
    log "WARNING: Config backup failed"
fi

# 4. Sync to Google Drive
log "Syncing to Google Drive..."

if command -v rclone &> /dev/null; then
    # Sync database backups
    if rclone copy "$BACKUP_DIR/db/" "$GDRIVE_REMOTE:$GDRIVE_PATH/db/" --max-age 24h 2>/dev/null; then
        log "Database synced to Google Drive"
    else
        log "WARNING: Failed to sync database to Google Drive"
    fi
    
    # Sync file backups
    if rclone copy "$BACKUP_DIR/files/" "$GDRIVE_REMOTE:$GDRIVE_PATH/files/" --max-age 24h 2>/dev/null; then
        log "Files synced to Google Drive"
    else
        log "WARNING: Failed to sync files to Google Drive"
    fi
else
    log "WARNING: rclone not installed, skipping Google Drive sync"
fi

# 5. Cleanup old backups (keep last 7 days)
log "Cleaning up old backups..."

find "$BACKUP_DIR/db" -name "*.gz" -mtime +7 -delete 2>/dev/null
find "$BACKUP_DIR/files" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null
find "$BACKUP_DIR" -name "config_*.json" -mtime +7 -delete 2>/dev/null

# Also cleanup old backups in Google Drive (keep 14 days)
if command -v rclone &> /dev/null; then
    rclone delete "$GDRIVE_REMOTE:$GDRIVE_PATH/db/" --min-age 14d 2>/dev/null || true
    rclone delete "$GDRIVE_REMOTE:$GDRIVE_PATH/files/" --min-age 14d 2>/dev/null || true
fi

log "Old backups cleaned up"

# 6. Summary
log "=========================================="
log "Backup Summary:"

DB_COUNT=$(ls -1 "$BACKUP_DIR/db/"*.gz 2>/dev/null | wc -l)
FILES_COUNT=$(ls -1 "$BACKUP_DIR/files/"*.tar.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

log "  Database backups: $DB_COUNT"
log "  File backups: $FILES_COUNT"
log "  Total backup size: $TOTAL_SIZE"
log "=========================================="

# Send notification
if [ -z "$ERRORS" ]; then
    log "Backup completed successfully!"
    notify "✅ Backup completed\n\n📊 Database: $DB_COUNT backups\n📁 Files: $FILES_COUNT backups\n💾 Total: $TOTAL_SIZE" "success"
else
    log "Backup completed with errors!"
    notify "⚠️ Backup completed with errors:\n$ERRORS\n\n📊 Database: $DB_COUNT backups\n📁 Files: $FILES_COUNT backups" "error"
fi

log "==========================================\n"
