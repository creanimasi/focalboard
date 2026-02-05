# ============================================
# Focalboard Backup Script for Windows
# ============================================
# Run manually or schedule with Task Scheduler
# ============================================

$ErrorActionPreference = "Continue"

# Configuration
$FOCALBOARD_DIR = "c:\Users\enigm\OneDrive\Pictures\focalboard-local\focalboard"
$BACKUP_DIR = "$FOCALBOARD_DIR\backups"
$FILES_DIR = "$FOCALBOARD_DIR\files"
$DATE = Get-Date -Format "yyyyMMdd_HHmmss"
$LOG_FILE = "$BACKUP_DIR\backup_log.txt"

# Database credentials
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "focalboard"
$DB_USER = "postgres"
# Password will be prompted or use PGPASSWORD env variable

# Logging function
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LOG_FILE -Value $logMessage
}

Write-Log "=========================================="
Write-Log "Starting Focalboard Backup"
Write-Log "=========================================="

# 1. Backup Database
Write-Log "Backing up PostgreSQL database..."

$DB_BACKUP_FILE = "$BACKUP_DIR\db\focalboard_db_$DATE.sql"
$PG_DUMP = "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe"

try {
    # Find pg_dump
    $pgDumpPath = Get-ChildItem $PG_DUMP -ErrorAction Stop | Select-Object -First 1 -ExpandProperty FullName
    
    # Set password environment variable temporarily
    $env:PGPASSWORD = "M4Ccj6YZn7#jQ*udRDzW%#z08vMC8Wa6"
    
    # Run pg_dump
    & $pgDumpPath -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $DB_BACKUP_FILE
    
    # Clear password from environment
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    
    if (Test-Path $DB_BACKUP_FILE) {
        $dbSize = (Get-Item $DB_BACKUP_FILE).Length / 1KB
        Write-Log "Database backup SUCCESS: $DB_BACKUP_FILE ($([math]::Round($dbSize, 2)) KB)"
        
        # Compress the backup
        $compressedFile = "$DB_BACKUP_FILE.zip"
        Compress-Archive -Path $DB_BACKUP_FILE -DestinationPath $compressedFile -Force
        Remove-Item $DB_BACKUP_FILE -Force
        Write-Log "Compressed to: $compressedFile"
    } else {
        Write-Log "ERROR: Database backup file not created!"
    }
} catch {
    Write-Log "ERROR backing up database: $_"
}

# 2. Backup Files (attachments, avatars, etc.)
Write-Log "Backing up files..."

$FILES_BACKUP = "$BACKUP_DIR\files\focalboard_files_$DATE.zip"

try {
    if (Test-Path $FILES_DIR) {
        $fileCount = (Get-ChildItem $FILES_DIR -Recurse -File).Count
        Compress-Archive -Path "$FILES_DIR\*" -DestinationPath $FILES_BACKUP -Force
        $zipSize = (Get-Item $FILES_BACKUP).Length / 1MB
        Write-Log "Files backup SUCCESS: $FILES_BACKUP ($fileCount files, $([math]::Round($zipSize, 2)) MB)"
    } else {
        Write-Log "WARNING: Files directory not found: $FILES_DIR"
    }
} catch {
    Write-Log "ERROR backing up files: $_"
}

# 3. Backup Config
Write-Log "Backing up config..."

$CONFIG_BACKUP = "$BACKUP_DIR\config_$DATE.json"
try {
    Copy-Item "$FOCALBOARD_DIR\config.json" -Destination $CONFIG_BACKUP -Force
    Write-Log "Config backup SUCCESS: $CONFIG_BACKUP"
} catch {
    Write-Log "ERROR backing up config: $_"
}

# 4. Cleanup old backups (keep last 7 days)
Write-Log "Cleaning up old backups..."

$cutoffDate = (Get-Date).AddDays(-7)

# Clean old DB backups
Get-ChildItem "$BACKUP_DIR\db\*.zip" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | ForEach-Object {
    Write-Log "Deleting old backup: $($_.Name)"
    Remove-Item $_.FullName -Force
}

# Clean old file backups
Get-ChildItem "$BACKUP_DIR\files\*.zip" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | ForEach-Object {
    Write-Log "Deleting old backup: $($_.Name)"
    Remove-Item $_.FullName -Force
}

# Clean old configs
Get-ChildItem "$BACKUP_DIR\config_*.json" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | ForEach-Object {
    Write-Log "Deleting old config: $($_.Name)"
    Remove-Item $_.FullName -Force
}

# 5. Summary
Write-Log "=========================================="
Write-Log "Backup Summary:"

$dbBackups = Get-ChildItem "$BACKUP_DIR\db\*.zip" -ErrorAction SilentlyContinue
$fileBackups = Get-ChildItem "$BACKUP_DIR\files\*.zip" -ErrorAction SilentlyContinue

Write-Log "  Database backups: $($dbBackups.Count)"
Write-Log "  File backups: $($fileBackups.Count)"

$totalSize = 0
if ($dbBackups) { $totalSize += ($dbBackups | Measure-Object -Property Length -Sum).Sum }
if ($fileBackups) { $totalSize += ($fileBackups | Measure-Object -Property Length -Sum).Sum }
Write-Log "  Total backup size: $([math]::Round($totalSize/1MB, 2)) MB"

Write-Log "=========================================="
Write-Log "Backup completed!"
Write-Log "=========================================="

# Optional: Copy to Google Drive (if OneDrive/GDrive sync folder exists)
$GDRIVE_BACKUP = "G:\My Drive\Backups\Focalboard"
if (Test-Path "G:\My Drive") {
    Write-Log "Syncing to Google Drive..."
    if (-not (Test-Path $GDRIVE_BACKUP)) {
        New-Item -ItemType Directory -Path $GDRIVE_BACKUP -Force | Out-Null
    }
    Copy-Item "$BACKUP_DIR\db\*.zip" -Destination "$GDRIVE_BACKUP\" -Force -ErrorAction SilentlyContinue
    Copy-Item "$BACKUP_DIR\files\*.zip" -Destination "$GDRIVE_BACKUP\" -Force -ErrorAction SilentlyContinue
    Write-Log "Google Drive sync completed!"
}

Write-Host "`nBackup selesai! Cek log di: $LOG_FILE" -ForegroundColor Green
