require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  port: process.env.PORT || 3000,
  shoutcast: {
    host: process.env.SHOUTCAST_HOST || '192.168.141.41',
    port: process.env.SHOUTCAST_PORT || 8000,
    streamId: process.env.SHOUTCAST_STREAM_ID || 1,
    adminPass: process.env.SHOUTCAST_ADMIN_PASS || '',
  },
  streamUrl: process.env.STREAM_URL || 'http://192.168.141.41:8000/stream',
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
};

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: CONFIG.allowedOrigin }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  listenerCount: 0,
  nowPlaying: { title: 'Radio Teknologi Informasi', artist: '', genre: '', startedAt: Date.now(), duration: 0 },
  shoutcastListeners: 0,
  currentDJ: { name: 'Kak Rina', show: 'Morning Vibes', avatar: 'R', color: '#7F77DD', bio: 'Host energik yang selalu bikin pagi kamu semangat!' },
  playlist: [
    { id: 1, title: 'Awan Lena', artist: 'Mahalini', genre: 'Pop', duration: '3:58', votes: 0 },
    { id: 2, title: 'Cinta Luar Biasa', artist: 'Andmesh', genre: 'Pop', duration: '4:12', votes: 0 },
    { id: 3, title: 'Takut', artist: 'Idgitaf', genre: 'Indie', duration: '3:45', votes: 0 },
    { id: 4, title: 'Bunga', artist: 'Efek Rumah Kaca', genre: 'Indie', duration: '5:02', votes: 0 },
    { id: 5, title: 'Ruang Sendiri', artist: 'Kunto Aji', genre: 'Pop', duration: '4:30', votes: 0 },
    { id: 6, title: 'Manusia Kuat', artist: 'Tulus', genre: 'Jazz Pop', duration: '3:52', votes: 0 },
    { id: 7, title: 'Rehat', artist: 'Kunto Aji', genre: 'Indie', duration: '4:10', votes: 0 },
    { id: 8, title: 'Separuh Aku', artist: 'Noah', genre: 'Pop Rock', duration: '4:22', votes: 0 },
  ],
  requests: [
    { id: 1, song: 'Cinta Luar Biasa', artist: 'Andmesh', from: 'Sari di Sleman', votes: 12, timestamp: Date.now() - 300000 },
    { id: 2, song: 'Takut', artist: 'Idgitaf', from: 'Budi di Bantul', votes: 8, timestamp: Date.now() - 180000 },
  ],
  chatMessages: [
    { id: 1, name: 'Admin RTI', color: '#7F77DD', text: 'Selamat datang di Radio Teknologi Informasi! 📻', timestamp: Date.now() - 600000 },
    { id: 2, name: 'Pendengar', color: '#D4537E', text: 'Halo Radio TI! Salam dari Yogyakarta 🎶', timestamp: Date.now() - 300000 },
  ],
  schedule: [
    { time: '06:00', show: 'Pagi Ceria', dj: 'Kak Sinta', status: 'done' },
    { time: '08:00', show: 'Morning Vibes', dj: 'Kak Rina', status: 'on-air' },
    { time: '10:00', show: 'Hits Indonesia', dj: 'Mas Dion', status: 'next' },
    { time: '12:00', show: 'Siang Santai', dj: 'Kak Ayu', status: 'upcoming' },
    { time: '15:00', show: 'Tech Talk', dj: 'Mas Rio', status: 'upcoming' },
    { time: '19:00', show: 'Malam Romantis', dj: 'Kak Bella', status: 'upcoming' },
    { time: '22:00', show: 'Night Zone', dj: 'Mas Hafiz', status: 'upcoming' },
  ],
  djs: [
    { name: 'Kak Rina', show: 'Morning Vibes', time: '08:00–10:00', avatar: 'R', color: '#7F77DD', bio: 'Host energik yang selalu bikin pagi kamu semangat!' },
    { name: 'Mas Dion', show: 'Hits Indonesia', time: '10:00–12:00', avatar: 'D', color: '#D4537E', bio: 'Pencinta musik Indonesia dari Sabang sampai Merauke.' },
    { name: 'Kak Ayu', show: 'Siang Santai', time: '12:00–15:00', avatar: 'A', color: '#1D9E75', bio: 'Suara lembut yang menemani istirahat siangmu.' },
    { name: 'Mas Rio', show: 'Tech Talk', time: '15:00–19:00', avatar: 'R', color: '#EF9F27', bio: 'Membahas dunia teknologi informasi terkini.' },
    { name: 'Kak Bella', show: 'Malam Romantis', time: '19:00–22:00', avatar: 'B', color: '#D4537E', bio: 'Teman setia di malam yang syahdu.' },
    { name: 'Mas Hafiz', show: 'Night Zone', time: '22:00–00:00', avatar: 'H', color: '#534AB7', bio: 'Musik deep dan chill untuk menutup harimu.' },
  ],
  nextRequestId: 3,
  nextChatId: 3,
};

// ─── SHOUTCAST METADATA POLLER ────────────────────────────────────────────────
async function pollShoutcast() {
  try {
    const url = `http://${CONFIG.shoutcast.host}:${CONFIG.shoutcast.port}/statistics?json=1&sid=${CONFIG.shoutcast.streamId}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RTI-Backend/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const song = data.currentsong || '';
    const listeners = data.currentlisteners || 0;

    let title = song, artist = '';
    const dash = song.indexOf(' - ');
    if (dash > -1) {
      artist = song.substring(0, dash).trim();
      title = song.substring(dash + 3).trim();
    }

    const changed = state.nowPlaying.title !== title || state.nowPlaying.artist !== artist;
    if (changed && title) {
      state.nowPlaying = { title, artist, genre: '', startedAt: Date.now(), duration: 0 };
      broadcast('NOW_PLAYING', state.nowPlaying);
      console.log(`[SHOUTcast] Now playing: ${artist} - ${title}`);
    }

    if (state.shoutcastListeners !== listeners) {
      state.shoutcastListeners = listeners;
      broadcast('LISTENER_COUNT', { count: state.listenerCount + listeners });
    }
  } catch (err) {
    // SHOUTcast belum aktif, skip
  }
}

setInterval(pollShoutcast, 10000);
pollShoutcast();

// ─── BROADCAST ───────────────────────────────────────────────────────────────
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: Date.now() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// ─── REST API ─────────────────────────────────────────────────────────────────
app.get('/api/state', (req, res) => {
  res.json({
    nowPlaying: state.nowPlaying,
    currentDJ: state.currentDJ,
    playlist: state.playlist,
    requests: state.requests,
    chatMessages: state.chatMessages.slice(-50),
    schedule: state.schedule,
    djs: state.djs,
    listenerCount: state.listenerCount + state.shoutcastListeners,
    streamUrl: CONFIG.streamUrl,
  });
});

app.get('/api/config', (req, res) => {
  res.json({ streamUrl: CONFIG.streamUrl });
});

app.post('/api/request', (req, res) => {
  const { song, artist, from, message } = req.body;
  if (!song) return res.status(400).json({ error: 'Judul lagu wajib diisi' });
  const request = { id: state.nextRequestId++, song, artist: artist || '', from: from || 'Pendengar setia', message: message || '', votes: 0, timestamp: Date.now() };
  state.requests.unshift(request);
  if (state.requests.length > 30) state.requests.pop();
  broadcast('NEW_REQUEST', request);
  res.json({ success: true, request });
});

app.post('/api/request/:id/vote', (req, res) => {
  const r = state.requests.find(r => r.id === parseInt(req.params.id));
  if (!r) return res.status(404).json({ error: 'Request tidak ditemukan' });
  r.votes++;
  broadcast('UPDATE_REQUEST', r);
  res.json({ success: true, votes: r.votes });
});

app.post('/api/chat', (req, res) => {
  const { name, text, color } = req.body;
  if (!text) return res.status(400).json({ error: 'Pesan kosong' });
  const msg = { id: state.nextChatId++, name: name || 'Pendengar', text, color: color || '#7F77DD', timestamp: Date.now() };
  state.chatMessages.push(msg);
  if (state.chatMessages.length > 100) state.chatMessages.shift();
  broadcast('NEW_CHAT', msg);
  res.json({ success: true, message: msg });
});

app.post('/api/playlist/:id/vote', (req, res) => {
  const song = state.playlist.find(s => s.id === parseInt(req.params.id));
  if (!song) return res.status(404).json({ error: 'Lagu tidak ditemukan' });
  song.votes++;
  broadcast('UPDATE_PLAYLIST', state.playlist);
  res.json({ success: true, votes: song.votes });
});

app.post('/api/admin/now-playing', (req, res) => {
  const { title, artist, genre, duration } = req.body;
  state.nowPlaying = { title, artist, genre: genre || '', startedAt: Date.now(), duration: duration || 0 };
  broadcast('NOW_PLAYING', state.nowPlaying);
  res.json({ success: true });
});

app.post('/api/admin/dj', (req, res) => {
  const { name, show, avatar, color, bio } = req.body;
  state.currentDJ = { name, show, avatar, color, bio };
  broadcast('DJ_CHANGE', state.currentDJ);
  res.json({ success: true });
});

app.post('/api/admin/schedule', (req, res) => {
  const { schedule } = req.body;
  if (!Array.isArray(schedule)) return res.status(400).json({ error: 'Format salah' });
  state.schedule = schedule;
  broadcast('SCHEDULE_UPDATE', state.schedule);
  res.json({ success: true });
});

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
wss.on('connection', (ws) => {
  state.listenerCount++;
  broadcast('LISTENER_COUNT', { count: state.listenerCount + state.shoutcastListeners });

  ws.send(JSON.stringify({
    type: 'INIT',
    data: {
      nowPlaying: state.nowPlaying,
      currentDJ: state.currentDJ,
      listenerCount: state.listenerCount + state.shoutcastListeners,
      chatMessages: state.chatMessages.slice(-20),
      requests: state.requests,
      playlist: state.playlist,
      schedule: state.schedule,
      djs: state.djs,
      streamUrl: CONFIG.streamUrl,
    }
  }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }));
    } catch (e) {}
  });

  ws.on('close', () => {
    state.listenerCount = Math.max(0, state.listenerCount - 1);
    broadcast('LISTENER_COUNT', { count: state.listenerCount + state.shoutcastListeners });
  });
});

// ─── START ───────────────────────────────────────────────────────────────────
server.listen(CONFIG.port, () => {
  console.log(`\n📻  Radio Teknologi Informasi — Web Server`);
  console.log(`    http://localhost:${CONFIG.port}`);
  console.log(`\n📡  SHOUTcast: http://${CONFIG.shoutcast.host}:${CONFIG.shoutcast.port}`);
  console.log(`    Stream URL: ${CONFIG.streamUrl}\n`);
});
