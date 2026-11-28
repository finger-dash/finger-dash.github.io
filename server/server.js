// Game server: WebSocket endpoint at /ws and a local health check at /health.
// Rooms and race simulation will be added on top of this connection layer.
'use strict';
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { WebSocketServer } = require('ws');
const { originAllowed, createBucket, parseMessage } = require('./limits.js');

const MAX_PAYLOAD = 1024; // bytes
const MAX_CONNECTIONS = 100;
const RATE = 30, BURST = 60; // messages per second per connection
const HEARTBEAT_MS = 30000;

function createServer({ allowedOrigins, version = 'dev', heartbeatMs = HEARTBEAT_MS }) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, version, connections: wss.clients.size }));
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });

  const reject = (socket, status) => {
    socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  };

  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => socket.destroy());
    if (req.url.split('?')[0] !== '/ws') return reject(socket, '404 Not Found');
    if (!originAllowed(req.headers.origin, allowedOrigins)) return reject(socket, '403 Forbidden');
    if (wss.clients.size >= MAX_CONNECTIONS) return reject(socket, '503 Service Unavailable');
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws) => {
    // The server names the player; ids sent by clients are never trusted.
    const id = randomUUID();
    const take = createBucket(RATE, BURST, Date.now());
    const send = (message) => ws.send(JSON.stringify(message));
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', () => ws.terminate());
    ws.on('message', (data, isBinary) => {
      if (!take(Date.now())) return ws.close(1008, 'rate limit');
      const message = isBinary ? null : parseMessage(data);
      if (!message) return ws.close(1007, 'invalid message');
      if (message.type === 'ping') {
        return send({ type: 'pong', t: Number(message.t) || 0, serverTime: Date.now() });
      }
      send({ type: 'error', error: 'unknown type' });
    });
    send({ type: 'welcome', id, version });
  });

  // Drops connections that stopped answering.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, heartbeatMs);
  server.on('close', () => clearInterval(heartbeat));

  server.shutdown = () => {
    for (const ws of wss.clients) ws.close(1001, 'server restarting');
    server.close();
  };
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:8080')
    .split(/\s+/).filter(Boolean);
  const server = createServer({ allowedOrigins, version: process.env.VERSION || 'dev' });
  server.listen(port, () => console.log(`listening on :${port}, origins: ${allowedOrigins.join(' ')}`));
  process.on('SIGTERM', () => { server.shutdown(); setTimeout(() => process.exit(0), 500); });
}

module.exports = { createServer };
