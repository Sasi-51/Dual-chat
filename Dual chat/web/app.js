'use strict';
const $ = id => document.getElementById(id);
let ws = null, bridgeMode = 'websocket', peerName = 'Bluetooth device', reconnectTimer = null;
const pending = new Map();
let uploadId = 0;

function setStatus(message, connected = false, mode = connected ? 'CONNECTED' : 'OFFLINE') {
  $('statusText').textContent = 'Status: ' + message;
  $('peerStatus').textContent = message;
  $('mode').textContent = mode;
  $('statusBar').classList.toggle('connected', connected);
}
function emitCommand(payload) {
  // Android WebView bridge is injected by the Java host application.
  if (window.QuickChat) {
    try {
      const q = window.QuickChat;
      switch (payload.action) {
        case 'paired': q.paired(); break;
        case 'scan': q.paired(); setStatus('Showing paired devices — Android discovery requires permission flow'); break;
        case 'server': q.server(); break;
        case 'connect': q.connect(payload.address); break;
        case 'sendText': q.sendText(payload.message); break;
        case 'sendFile': q.sendFile(payload.name, payload.data); break;
        case 'sendFileStart': q.sendFileStart(payload.name, payload.size, payload.id); break;
        case 'sendFileChunk': q.sendFileChunk(payload.id, payload.data, payload.offset); break;
        case 'sendFileEnd': q.sendFileEnd(payload.id); break;
        case 'disconnect': q.disconnect(); break;
      }
    } catch (e) { setStatus('Android bridge error: ' + e.message); }
    return;
  }
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    setStatus('Start the Java desktop bridge, then refresh this page');
    return;
  }
  ws.send(JSON.stringify(payload));
}
function connectBridge() {
  if (window.QuickChat) { bridgeMode = 'android'; setStatus('Android Bluetooth bridge ready', false, 'READY'); return; }
  bridgeMode = 'websocket';
  try { ws = new WebSocket('ws://127.0.0.1:8765'); }
  catch (e) { setStatus('Unable to open local bridge'); scheduleReconnect(); return; }
  ws.onopen = () => setStatus('Java bridge connected — choose PAIRED or SCAN', false, 'READY');
  ws.onclose = () => { setStatus('Java bridge disconnected — start desktop bridge'); scheduleReconnect(); };
  ws.onerror = () => setStatus('Java bridge unavailable — start desktop bridge');
  ws.onmessage = event => { try { handleEvent(JSON.parse(event.data)); } catch (e) { console.warn('Invalid bridge event', e); } };
}
function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => { if (!window.QuickChat && (!ws || ws.readyState === WebSocket.CLOSED)) connectBridge(); }, 2500);
}
window.onQuickChatEvent = handleEvent;
function handleEvent(m) {
  switch (m.event) {
    case 'devices': renderDevices(m.devices || []); break;
    case 'status': setStatus(m.message || 'Bluetooth status changed', !!m.connected); break;
    case 'text': addBubble(m.message || '', false); break;
    case 'ack': {
      const item = pending.get(m.message);
      if (item) { item.querySelector('.meta').textContent = item.dataset.time + ' · delivered ✓✓'; pending.delete(m.message); }
      break;
    }
    case 'fileStart': showTransfer('Receiving ' + (m.name || 'file'), 0); break;
    case 'fileProgress': showTransfer('Transferring file', Number(m.percent) || 0); break;
    case 'uploadProgress': showTransfer('Sending file', Number(m.percent) || 0); break;
    case 'file': addReceivedFile(m.name || 'received-file', m.data || ''); showTransfer('File received', 100); setTimeout(hideTransfer, 1400); break;
    case 'error': setStatus(m.message || 'Bluetooth error'); break;
  }
}
function renderDevices(devices) {
  $('deviceCount').textContent = devices.length;
  $('devices').replaceChildren();
  if (!devices.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'No paired devices found. Pair devices in system Bluetooth settings first.'; $('devices').append(p); return; }
  devices.forEach(device => {
    const button = document.createElement('button'); button.className = 'device';
    const name = document.createElement('span'); name.textContent = device.name || 'Unknown device';
    const address = document.createElement('small'); address.textContent = device.address || '';
    button.append(name, address);
    button.addEventListener('click', () => { peerName = device.name || 'Bluetooth device'; $('peer').textContent = peerName; emitCommand({ action: 'connect', address: device.address }); });
    $('devices').append(button);
  });
}
function addBubble(text, sent) {
  const welcome = document.querySelector('.welcome'); if (welcome) welcome.remove();
  const bubble = document.createElement('div'); bubble.className = 'bubble' + (sent ? ' sent' : ''); bubble.textContent = text;
  const meta = document.createElement('div'); meta.className = 'meta';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  meta.textContent = time + (sent ? ' · sent' : ''); bubble.dataset.time = time; bubble.append(meta); $('messages').append(bubble); $('messages').scrollTop = $('messages').scrollHeight;
  if (sent) pending.set(text, bubble);
  return bubble;
}
function addReceivedFile(name, base64) {
  const bubble = document.createElement('div'); bubble.className = 'bubble file-bubble';
  const title = document.createElement('div'); title.textContent = '📎 ' + name + ' — received';
  const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.append(title, meta);
  bubble.addEventListener('click', () => { const a = document.createElement('a'); a.href = 'data:application/octet-stream;base64,' + base64; a.download = name; a.click(); });
  $('messages').append(bubble); $('messages').scrollTop = $('messages').scrollHeight;
}
function showTransfer(label, percent) { $('transfer').classList.add('show'); $('transferName').textContent = label; const p = Math.max(0, Math.min(100, percent)); $('transferPct').textContent = p + '%'; $('progress').style.width = p + '%'; }
function hideTransfer() { $('transfer').classList.remove('show'); }
function sendText() { const text = $('message').value.trim(); if (!text) return; addBubble(text, true); emitCommand({ action: 'sendText', message: text }); $('message').value = ''; $('message').focus(); }
$('paired').addEventListener('click', () => emitCommand({ action: 'paired' }));
$('scan').addEventListener('click', () => emitCommand({ action: 'scan' }));
$('server').addEventListener('click', () => emitCommand({ action: 'server' }));
$('disconnect').addEventListener('click', () => emitCommand({ action: 'disconnect' }));
$('send').addEventListener('click', sendText);
$('message').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } });
$('file').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  if (file.size > 100 * 1024 * 1024) { setStatus('Choose a file smaller than 100 MB'); e.target.value = ''; return; }
  try {
    if (!window.QuickChat && (!ws || ws.readyState !== WebSocket.OPEN)) throw new Error('Java bridge is not connected');
    const id = ++uploadId;
    showTransfer('Preparing ' + file.name, 0);
    emitCommand({ action: 'sendFileStart', id, name: file.name, size: file.size });
    const chunkSize = 8192;
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const bytes = new Uint8Array(await file.slice(offset, Math.min(offset + chunkSize, file.size)).arrayBuffer());
      let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      emitCommand({ action: 'sendFileChunk', id, offset, data: btoa(binary) });
      showTransfer('Sending ' + file.name, Math.min(99, Math.round((Math.min(offset + bytes.length, file.size) / Math.max(file.size, 1)) * 100)));
    }
    emitCommand({ action: 'sendFileEnd', id });
    addBubble('📎 ' + file.name + ' (' + file.size.toLocaleString() + ' bytes)', true);
    showTransfer('Sent ' + file.name, 100); setTimeout(hideTransfer, 1400);
  } catch (err) { setStatus('File error: ' + err.message); }
  e.target.value = '';
});
connectBridge();
