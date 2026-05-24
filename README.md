# 📻 Radio Teknologi Informasi

Radio streaming web app dengan Node.js + WebSocket + SHOUTcast.

## Stack
- **Frontend**: HTML/CSS/JS (vanilla)
- **Backend**: Node.js + Express + WebSocket
- **Streaming**: SHOUTcast v2
- **Process Manager**: PM2
- **Web Server**: Nginx
- **CI/CD**: GitHub Actions (self-hosted runner)

## Setup Lokal

```bash
npm install
cp .env.example .env
# Edit .env sesuai konfigurasi
npm run dev
```

Buka http://localhost:3000

## Deploy ke Server

Push ke branch `main` → GitHub Actions otomatis deploy via self-hosted runner.

## Konfigurasi .env

```env
PORT=3000
SHOUTCAST_HOST=192.168.141.41
SHOUTCAST_PORT=8000
SHOUTCAST_STREAM_ID=1
SHOUTCAST_ADMIN_PASS=password_admin_kamu
STREAM_URL=http://192.168.141.41:8000/stream
ALLOWED_ORIGIN=*
```

## Struktur Project

```
rti/
├── server.js              ← Backend utama
├── package.json
├── .env.example
├── public/
│   └── index.html         ← Frontend
└── .github/
    └── workflows/
        └── deploy.yml     ← CI/CD GitHub Actions
```
