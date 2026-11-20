// 게임 모음집 서버 (Render 무료 플랜용)
// - 게임 HTML/이미지 파일을 그대로 보내줌
// - /mqtt : 참가자 폰과 메인 화면을 잇는 우리 전용 중계 서버 (MQTT over WebSocket)
//   게임들은 원래 공용 MQTT 서버(emqx, hivemq …)를 썼는데, 여기를 맨 앞에 두고 공용 서버는 예비로 남겨둠
// - /vendor/mqtt.min.js : CDN이 막혀도 게임이 열리도록 mqtt.js를 직접 제공
// - /healthz : Render 상태 확인 + 모음집 첫 화면에서 서버를 미리 깨우는 용도
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, createWebSocketStream } = require('ws');
const aedes = require('aedes')();

const PORT = process.env.PORT || 10000;
const ROOT = __dirname;

// 이 모음집 게임들이 쓰는 토픽만 받음 (아무나 이 서버를 공용 중계로 쓰지 못하게)
const TOPIC_PREFIXES = [
  'bluffdice100v1/', 'bombrelay-v2/', 'chamepop1/', 'claude-game-box/',
  'rhsniper1/', 'shadowtag1/',
];
const allowed = topic => TOPIC_PREFIXES.some(p => topic.startsWith(p));
aedes.authorizePublish = (client, packet, cb) => cb(allowed(packet.topic) ? null : new Error('topic not allowed'));
aedes.authorizeSubscribe = (client, sub, cb) => cb(null, allowed(sub.topic) ? sub : null);
aedes.on('clientError', () => {});
aedes.on('connectionError', () => {});

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
};
const VENDOR = {
  '/vendor/mqtt.min.js': path.join(ROOT, 'node_modules/mqtt/dist/mqtt.min.js'),
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch (e) { return send(res, 400, 'bad request'); }
  const p = decodeURIComponent(url.pathname);

  if (p === '/healthz') {
    return send(res, 200, 'ok', { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  }
  if (VENDOR[p]) {
    return fs.readFile(VENDOR[p], (err, buf) => {
      if (err) return send(res, 404, 'not found');
      send(res, 200, buf, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
    });
  }

  // 저장소 맨 위 폴더의 게임 파일만 보냄 (하위 폴더·숨김 파일·서버 파일은 안 보냄)
  const name = p === '/' ? 'index.html' : p.slice(1);
  const ext = path.extname(name).toLowerCase();
  if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.') || !TYPES[ext]) {
    return send(res, 404, 'not found');
  }
  fs.readFile(path.join(ROOT, name), (err, buf) => {
    if (err) return send(res, 404, 'not found');
    send(res, 200, buf, {
      'Content-Type': TYPES[ext],
      // HTML은 매번 새로 받아서 업데이트가 바로 보이게
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
  });
});

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 64 * 1024,
  handleProtocols: protocols => (protocols.has('mqtt') ? 'mqtt' : protocols.values().next().value || false),
});
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/mqtt')) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    const stream = createWebSocketStream(ws);
    stream.on('error', () => {});
    aedes.handle(stream, req);
  });
});

server.listen(PORT, () => console.log(`game box server on :${PORT}`));
