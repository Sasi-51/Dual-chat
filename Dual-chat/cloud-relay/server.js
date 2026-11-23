"use strict";
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");
const PORT = Number(process.env.PORT || 10000);
const rooms = new Map();
const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    return res.end(JSON.stringify({ service: "QuickChat real-time relay", status: "ok", transport: "WebSocket" }));
  }
  res.writeHead(404); res.end("Not found");
});
const wss = new WebSocketServer({ server, maxPayload: 1024 * 1024 });
function send(ws, data) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function broadcast(room, data, except) {
  for (const client of rooms.get(room) || []) if (client !== except) send(client, data);
}
wss.on("connection", (ws) => {
  ws.isAlive = true; ws.room = null; ws.name = "Guest";
  ws.on("pong", () => { ws.isAlive = true; });
  send(ws, { type: "ready", message: "Connected to QuickChat relay" });
  ws.on("message", (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { type: "error", message: "Invalid JSON" }); }
    if (msg.type === "join") {
      const room = String(msg.room || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
      const name = String(msg.name || "Guest").trim().slice(0, 32) || "Guest";
      if (!room) return send(ws, { type: "error", message: "Enter a valid room code" });
      if (ws.room && rooms.has(ws.room)) { rooms.get(ws.room).delete(ws); broadcast(ws.room, { type: "presence", action: "left", name: ws.name }, ws); }
      ws.room = room; ws.name = name;
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(ws);
      send(ws, { type: "joined", room, name, members: rooms.get(room).size });
      broadcast(room, { type: "presence", action: "joined", name }, ws);
      return;
    }
    if (msg.type === "chat") {
      if (!ws.room || !rooms.has(ws.room)) return send(ws, { type: "error", message: "Join a room before sending messages" });
      const text = String(msg.text || "").trim();
      if (!text || text.length > 4000) return;
      const packet = { type: "chat", id: String(msg.id || ""), name: ws.name, text, timestamp: Date.now() };
      broadcast(ws.room, packet, ws);
      send(ws, { type: "sent", id: packet.id, timestamp: packet.timestamp });
    }
  });
  ws.on("close", () => {
    if (ws.room && rooms.has(ws.room)) {
      const room = rooms.get(ws.room); room.delete(ws);
      broadcast(ws.room, { type: "presence", action: "left", name: ws.name });
      if (!room.size) rooms.delete(ws.room);
    }
  });
});
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 25000);
wss.on("close", () => clearInterval(heartbeat));
server.listen(PORT, "0.0.0.0", () => console.log(`QuickChat relay listening on ${PORT}`));
