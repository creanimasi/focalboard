# ============================================
# Focalboard Restore Script for Windows
# ============================================
# Usage: .\restore-focalboard.ps1 -BackupDate "20260204_230325"
# ============================================

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupDate
)

$ErrorActionPreference = "Stop"

# Configuration
$FOCALBOARD_DIR = "c:\Users\enigm\OneDrive\Pictures\focalboard-local\focalboard"
$BACKUP_DIR = "$FOCALBOARD_DIR\backups"
$FILES_DIR = "$FOCALBOARD_DIR\files"

# Database credentials
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "focalboard"
$DB_USER = "postgres"

Write-Host "=========================================="
Write-Host "Focalboard Restore Script"
Write-Host "=========================================="

# List available backups if no date specified
if (-not $BackupDate) {
    Write-Host "`nAvailable backups:" -ForegroundColor Yellow
    Write-Host "`nDatabase backups:"
    Get-ChildItem "$BACKUP_DIR\db\*.zip" | Sort-Object LastWriteTime -Descending | ForEach-Object {
        $date = $_.Name -replace 'focalboard_db_|\.sql\.zip', ''
        $size = [math]::Round($_.Length / 1KB, 2)
        Write-Host "  - $date ($size KB)"
    }
    
    Write-Host "`nFile backups:"
    Get-ChildItem "$BACKUP_DIR\files\*.zip" | Sort-Object LastWriteTime -Descending | ForEach-Object {
        $date = $_.Name -replace 'focalboard_files_|\.zip', ''
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  - $date ($size MB)"
    }
    
    Write-Host "`nUsage: .\restore-focalboard.ps1 -BackupDate `"YYYYMMDD_HHMMSS`"" -ForegroundColor Cyan
    exit
}

# Confirm restore
Write-Host "`nWARNING: This will overwrite current data!" -ForegroundColor Red
Write-Host "Backup date: $BackupDate" -ForegroundColor Yellow
$confirm = Read-Host "Are you sure? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Restore cancelled."
    exit
}

# Stop Focalboard server
Write-Host "`nStopping Focalboard server..."
Get-Process | Where-Object {$_.ProcessName -like "*focalboard*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 1. Restore Database
Write-Host "`nRestoring database..."

$DB_BACKUP_FILE = "$BACKUP_DIR\db\focalboard_db_$BackupDate.sql.zip"

if (Test-Path $DB_BACKUP_FILE) {
    $tempDir = "$env:TEMP\focalboard_restore"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    # Extract
    Expand-Archive -Path $DB_BACKUP_FILE -DestinationPath $tempDir -Force
    $sqlFile = Get-ChildItem "$tempDir\*.sql" | Select-Object -First 1
    
    if ($sqlFile) {
        $PG_PATH = "C:\Program Files\PostgreSQL\*\bin"
        $psql = Get-ChildItem "$PG_PATH\psql.exe" -ErrorAction Stop | Select-Object -First 1 -ExpandProperty FullName
        
        $env:PGPASSWORD = "M4Ccj6YZn7#jQ*udRDzW%#z08vMC8Wa6"
        
        # Drop and recreate database
        Write-Host "  Dropping existing database..."
        & $psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" postgres
        
        Write-Host "  Creating fresh database..."
        & $psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME;" postgres
        
        Write-Host "  Restoring data..."
        & $psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $sqlFile.FullName
        
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        Remove-Item $tempDir -Recurse -Force
        
        Write-Host "  Database restored!" -ForegroundColor Green
    }
} else {
    Write-Host "  ERROR: Database backup not found: $DB_BACKUP_FILE" -ForegroundColor Red
}

# 2. Restore Files
Write-Host "`nRestoring files..."

$FILES_BACKUP = "$BACKUP_DIR\files\focalboard_files_$BackupDate.zip"

if (Test-Path $FILES_BACKUP) {
    # Backup current files first
    if (Test-Path $FILES_DIR) {
        $currentBackup = "$FILES_DIR.bak"
        if (Test-Path $currentBackup) { Remove-Item $currentBackup -Recurse -Force }
        Rename-Item $FILES_DIR -NewName "$FILES_DIR.bak"
    }
    
    # Extract
    New-Item -ItemType Directory -Path $FILES_DIR -Force | Out-Null
    Expand-Archive -Path $FILES_BACKUP -DestinationPath $FILES_DIR -Force
    
    $fileCount = (Get-ChildItem $FILES_DIR -Recurse -File).Count
    Write-Host "  Files restored! ($fileCount files)" -ForegroundColor Green
    
    # Remove old backup
    if (Test-Path "$FILES_DIR.bak") {
        Remove-Item "$FILES_DIR.bak" -Recurse -Force
    }
} else {
    Write-Host "  ERROR: Files backup not found: $FILES_BACKUP" -ForegroundColor Red
}

# 3. Start Focalboard server
Write-Host "`nStarting Focalboard server..."
Start-Process -FilePath "$FOCALBOARD_DIR\bin\focalboard-server.exe" -WindowStyle Hidden
Start-Sleep -Seconds 3

$process = Get-Process | Where-Object {$_.ProcessName -like "*focalboard*"}
if ($process) {
    Write-Host "Server started (PID: $($process.Id))" -ForegroundColor Green
} else {
    Write-Host "WARNING: Server may not have started properly" -ForegroundColor Yellow
}

Write-Host "`n=========================================="
Write-Host "Restore completed!" -ForegroundColor Green
Write-Host "=========================================="
