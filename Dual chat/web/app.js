'use strict';
const $ = id => document.getElementById(id);
let ws = null, relaySocket = null, activeMode = 'bluetooth', internetJoined = false, bridgeMode = 'websocket', peerName = 'Bluetooth device', reconnectTimer = null;
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
function showMode(mode) {
  activeMode = mode;
  const internet = mode === 'internet';
  $('internetPanel').hidden = !internet;
  $('bluetoothActions').hidden = internet;
  $('devicesSection').hidden = internet;
  $('bluetoothMode').classList.toggle('selected', !internet);
  $('internetMode').classList.toggle('selected', internet);
  $('connectionType').textContent = internet ? 'INTERNET' : 'RFCOMM';
  $('composerNote').textContent = internet ? 'Live messages travel through the QuickChat internet relay.' : 'Bluetooth messages and files travel directly over RFCOMM.';
  $('footerNote').textContent = internet ? 'INTERNET CHAT · REAL-TIME WEBSOCKET MESSAGING' : 'DIRECT BLUETOOTH · NO INTERNET REQUIRED FOR DEVICE-TO-DEVICE CHAT';
  if (internet) setStatus(internetJoined ? 'Connected to internet room' : 'Enter your name and room code, then connect', internetJoined, internetJoined ? 'ONLINE' : 'READY');
  else setStatus('Bluetooth mode selected — ' + (window.QuickChat ? 'Android bridge ready' : 'Java bridge connection is local to this PC'), false, 'BLUETOOTH');
}
function connectInternet() {
  const url = $('relayUrl').value.trim();
  const room = $('roomCode').value.trim();
  const name = $('internetName').value.trim() || 'Guest';
  if (!/^wss?:\/\//i.test(url)) { setStatus('Enter a valid ws:// or wss:// server URL'); return; }
  if (!room) { setStatus('Enter a room code'); return; }
  if (relaySocket && relaySocket.readyState === WebSocket.OPEN) relaySocket.close();
  setStatus('Connecting to internet relay…', false, 'CONNECTING');
  try { relaySocket = new WebSocket(url); }
  catch (e) { setStatus('Cannot create WebSocket: ' + e.message); return; }
  relaySocket.onopen = () => {
    relaySocket.send(JSON.stringify({type:'join', room, name}));
  };
  relaySocket.onmessage = event => {
    let m; try { m = JSON.parse(event.data); } catch { return; }
    if (m.type === 'ready') setStatus('Relay connected; joining room…', false, 'JOINING');
    else if (m.type === 'joined') {
      internetJoined = true; $('internetConnect').disabled = true; $('internetDisconnect').disabled = false;
      $('peer').textContent = 'Room ' + m.room; setStatus('Connected to room ' + m.room + ' · ' + m.members + ' member(s)', true, 'ONLINE');
      addSystemMessage('You joined room ' + m.room);
    } else if (m.type === 'chat') {
      addNamedBubble(m.text, m.name, false);
    } else if (m.type === 'presence') {
      addSystemMessage(m.name + (m.action === 'joined' ? ' joined the room' : ' left the room'));
    } else if (m.type === 'error') {
      setStatus(m.message || 'Relay error'); 
    } else if (m.type === 'sent') {
      const item = pending.get(m.id); if (item) { item.querySelector('.meta').textContent = item.dataset.time + ' · delivered ✓✓'; pending.delete(m.id); }
    }
  };
  relaySocket.onerror = () => setStatus('Internet connection failed. Check Render URL and service status.');
  relaySocket.onclose = () => {
    internetJoined = false; $('internetConnect').disabled = false; $('internetDisconnect').disabled = true;
    if (activeMode === 'internet') setStatus('Disconnected from internet relay', false, 'OFFLINE');
  };
}
function disconnectInternet() {
  if (relaySocket) relaySocket.close();
  relaySocket = null; internetJoined = false;
  $('internetConnect').disabled = false; $('internetDisconnect').disabled = true;
  setStatus('Disconnected from internet chat', false, 'OFFLINE');
}
function addSystemMessage(text) {
  const el = document.createElement('div'); el.className = 'system-message'; el.textContent = text;
  $('messages').append(el); $('messages').scrollTop = $('messages').scrollHeight;
}
function addNamedBubble(text, name, sent) {
  const welcome = document.querySelector('.welcome'); if (welcome) welcome.remove();
  const bubble = document.createElement('div'); bubble.className = 'bubble' + (sent ? ' sent' : '');
  const who = document.createElement('strong'); who.className = 'sender-name'; who.textContent = name;
  const body = document.createElement('div'); body.textContent = text;
  const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  bubble.append(who, body, meta); $('messages').append(bubble); $('messages').scrollTop = $('messages').scrollHeight; return bubble;
}
function sendText() {
  const text = $('message').value.trim(); if (!text) return;
  if (activeMode === 'internet') {
    if (!relaySocket || relaySocket.readyState !== WebSocket.OPEN || !internetJoined) { setStatus('Connect to an internet room before sending'); return; }
    const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2,8);
    const item = addNamedBubble(text, $('internetName').value.trim() || 'Guest', true);
    item.dataset.time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    pending.set(id, item);
    relaySocket.send(JSON.stringify({type:'chat', id, text}));
  } else {
    addBubble(text, true); emitCommand({ action: 'sendText', message: text });
  }
  $('message').value = ''; $('message').focus();
}
$('bluetoothMode').addEventListener('click', () => showMode('bluetooth'));
$('internetMode').addEventListener('click', () => showMode('internet'));
$('internetConnect').addEventListener('click', connectInternet);
$('internetDisconnect').addEventListener('click', disconnectInternet);
$('paired').addEventListener('click', () => emitCommand({ action: 'paired' }));
$('scan').addEventListener('click', () => emitCommand({ action: 'scan' }));
$('server').addEventListener('click', () => emitCommand({ action: 'server' }));
$('disconnect').addEventListener('click', () => { if (activeMode === 'internet') disconnectInternet(); else emitCommand({ action: 'disconnect' }); });
$('send').addEventListener('click', sendText);
$('message').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } });
$('file').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  if (activeMode === 'internet') { setStatus('Internet file sharing is not enabled yet'); e.target.value = ''; return; }
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
