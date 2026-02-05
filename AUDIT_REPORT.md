# 📋 Laporan Audit Focalboard Application
**Tanggal**: 5 Februari 2026  
**Versi Aplikasi**: 8.0.0  
**Auditor**: GitHub Copilot

---

## 🔴 Temuan Kritis (Critical)

### 1. **Password Database Hardcoded**
**Lokasi**: `backup-focalboard.ps1` line 47  
**Risiko**: Password database PostgreSQL (`M4Ccj6YZn7#jQ*udRDzW%#z08vMC8Wa6`) ditulis langsung dalam script backup.  
**Dampak**: Jika repository di-push ke GitHub/GitLab public, kredensial database akan bocor.  
**Rekomendasi**:
```powershell
# Gunakan environment variable atau Azure Key Vault
$env:PGPASSWORD = [System.Environment]::GetEnvironmentVariable("DB_PASSWORD","User")
```

### 2. **Secret Token Hardcoded di Config**
**Lokasi**: 
- `config.json` line 11
- `backups/config_*.json` (3 files)
**Risiko**: Secret token `QPgXNZPRYa1AZp4FtOhyt8yc14EMJdmN` disimpan dalam config yang di-track di Git.  
**Dampak**: Session hijacking, unauthorized access.  
**Rekomendasi**:
```json
{
  "secret": "${FOCALBOARD_SECRET:-QPgXNZPRYa1AZp4FtOhyt8yc14EMJdmN}"
}
```
Gunakan environment variable `FOCALBOARD_SECRET` di production.

### 3. **Password Database di docker-compose.yml**
**Lokasi**: `deploy/docker-compose.yml` lines 15, 28  
**Risiko**: Password database `CRMBoard2026Secure` hardcoded dalam docker-compose.  
**Dampak**: Credential exposure jika file di-commit ke public repo.  
**Rekomendasi**: Buat file `.env` dan gunakan `${POSTGRES_PASSWORD}`.

---

## 🟠 Temuan Tinggi (High)

### 4. **File Backup Config di Git**
**Lokasi**: `backups/config_*.json`  
**Risiko**: File backup config berisi secret dan password masuk ke version control.  
**Dampak**: Semua versi historis dari secret bisa diakses lewat Git history.  
**Rekomendasi**: 
```gitignore
# Tambahkan di .gitignore
backups/config_*.json
backups/*.json
```
Jalankan:
```bash
git rm --cached backups/config_*.json
git commit -m "Remove sensitive config backups from git"
```

### 5. **Port Prometheus Exposed**
**Lokasi**: `docker/Dockerfile` line 40, `config.json` line 17  
**Risiko**: Port Prometheus (9092) di-expose tanpa autentikasi.  
**Dampak**: Metrics dan informasi internal aplikasi bisa diakses publik.  
**Rekomendasi**: 
- Set `prometheusaddress: ""` jika tidak digunakan
- Atau batasi akses dengan firewall/reverse proxy

### 6. **Dependencies Outdated**
**Lokasi**: `webapp/package.json`, `server/go.mod`  
**Temuan**:
- Node.js base image: `node:16.3.0` (EOL April 2024)
- React: `17.0.2` (bukan latest stable)
- Marked: `4.0.12` (ada CVE di versi < 4.0.16)
**Rekomendasi**:
```bash
# Update Node.js di Dockerfile
FROM node:20-alpine

# Update dependencies
npm audit fix
npm update marked
```

---

## 🟡 Temuan Sedang (Medium)

### 7. **Config Port Inconsistency**
**Lokasi**: `deploy/docker-compose.yml` line 11-13  
**Risiko**: Port mapping `8182:8000` tapi env var `FOCALBOARD_PORT=8182` tidak sesuai dengan container internal port (8000).  
**Dampak**: Aplikasi tidak bisa diakses karena misconfiguration.  
**Rekomendasi**:
```yaml
ports:
  - "8182:8000"
environment:
  - FOCALBOARD_PORT=8000  # Internal port tetap 8000
```
External akses via 8182, internal tetap 8000.

### 8. **SSL/TLS Disabled**
**Lokasi**: `config.json` line 9  
**Risiko**: `"useSSL": false` dan `"secureCookie": true` bertentangan.  
**Dampak**: Cookie tidak aman jika tidak ada HTTPS di reverse proxy.  
**Rekomendasi**: Deploy dengan reverse proxy (Nginx/Traefik) yang handle HTTPS.

### 9. **Open Registration Enabled**
**Lokasi**: `config.json` line 27  
**Risiko**: `"enableOpenRegistration": true` memungkinkan siapa saja mendaftar.  
**Dampak**: Spam account, abuse, unauthorized access.  
**Rekomendasi**: Set `false` dan gunakan invite-only atau SSO.

---

## 🟢 Temuan Informasi (Info)

### 10. **Telemetry Disabled**
**Lokasi**: `config.json` line 16  
**Status**: `"telemetry": false` ✅ Bagus untuk privacy.

### 11. **.gitignore Comprehensive**
**Status**: File `.gitignore` sudah cukup lengkap, namun perlu tambahan:
```gitignore
# Tambahkan
*.env
.env.*
config.json
backups/config_*.json
```

### 12. **Docker Multi-stage Build**
**Status**: `docker/Dockerfile` menggunakan multi-stage build ✅ Good practice.

---

## 📊 Summary Audit

| Kategori | Jumlah | Status |
|----------|--------|--------|
| 🔴 Critical | 3 | **ACTION REQUIRED** |
| 🟠 High | 3 | **ACTION REQUIRED** |
| 🟡 Medium | 3 | Recommended |
| 🟢 Info | 3 | Good |
| **Total** | **12** | - |

---

## ✅ Rekomendasi Deployment ke Coolify

### Langkah Pre-deployment:

1. **Buat file `.env` untuk Coolify**:
```env
# Database
POSTGRES_DB=focalboard
POSTGRES_USER=focalboard
POSTGRES_PASSWORD=<GENERATE_STRONG_PASSWORD>

# Focalboard
FOCALBOARD_SECRET=<GENERATE_UUID>
FOCALBOARD_PORT=8000
FOCALBOARD_DBCONFIG=postgres://focalboard:${POSTGRES_PASSWORD}@postgres:5432/focalboard?sslmode=disable
```

2. **Update `.gitignore`**:
```gitignore
.env
.env.*
config.json
bin/config.json
backups/config_*.json
backups/*.sql
```

3. **Fix `docker-compose.yml`**:
```yaml
environment:
  - FOCALBOARD_PORT=8000
  - FOCALBOARD_DBCONFIG=postgres://focalboard:${POSTGRES_PASSWORD}@postgres:5432/focalboard?sslmode=disable
  - FOCALBOARD_SECRET=${FOCALBOARD_SECRET}
```

4. **Hapus file sensitif dari Git**:
```bash
git rm --cached backups/config_*.json
git rm --cached config.json
git commit -m "chore: remove sensitive files"
```

5. **Deploy di Coolify**:
   - Upload `docker-compose.yml`
   - Set environment variables di Coolify dashboard
   - Enable HTTPS/SSL di Coolify
   - Set domain: `board.creanimasi.com`

---

## 🔐 Security Checklist

- [ ] Remove hardcoded passwords dari semua file
- [ ] Generate secret baru untuk production
- [ ] Update dependencies ke versi terbaru
- [ ] Set `enableOpenRegistration: false`
- [ ] Enable HTTPS di reverse proxy
- [ ] Backup database secara teratur (automated)
- [ ] Set proper firewall rules (hanya port 80/443)
- [ ] Monitor logs untuk suspicious activity

---

## 📝 Catatan Tambahan

- Aplikasi sudah siap untuk deployment Docker/Coolify
- Struktur folder sudah baik dan terorganisir
- Perlu perhatian khusus pada keamanan kredensial
- Pertimbangkan implementasi SSO/OAuth untuk auth yang lebih aman

**Status Deployment**: ⚠️ **READY WITH FIXES REQUIRED**

Deploy setelah memperbaiki 3 temuan Critical dan 3 temuan High.
