import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import http from 'node:http';

import {
    db,
    insertReading,
    insertEvent,
    getReadingsSince,
    getRecentEvents,
    getEventCountsSince,
    getTotalReadings,
    purgeOlderThan,
} from './db.js';
import { detectAlerts, initialAlertState } from './alerts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3000);
const DEMO = process.env.DEMO === '1';
const RETENTION_MS = Number(process.env.RETENTION_MS ?? 7 * 24 * 60 * 60 * 1000); // 7 days
let esp32Host = process.env.ESP32_HOST ?? '192.168.1.50';
let esp32Port = Number(process.env.ESP32_PORT ?? 80);

const app = express();
app.use(express.json());

const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// ----- state -----
const serverStartedAt = Date.now();
let esp32ConnectedSince = null;
let alertState = { ...initialAlertState };
let lastSensor = null;

// ----- APIs -----
app.get('/api/esp32', (_req, res) => {
    res.json({ host: esp32Host, port: esp32Port, connected: esp32Connected() });
});

app.post('/api/esp32', (req, res) => {
    const { host, port } = req.body ?? {};
    if (typeof host === 'string' && host.trim()) esp32Host = host.trim();
    if (port && Number.isFinite(Number(port))) esp32Port = Number(port);
    recordEvent('info', 'bridge', `ESP32 target updated to ${esp32Host}:${esp32Port}`, { host: esp32Host, port: esp32Port });
    reconnectEsp32();
    res.json({ host: esp32Host, port: esp32Port });
});

app.get('/api/history', (req, res) => {
    const windowMs = Number(req.query.windowMs ?? 60 * 60 * 1000); // last hour default
    const since = Date.now() - windowMs;
    res.json({ since, readings: getReadingsSince(since) });
});

app.get('/api/alerts', (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 500);
    res.json({ events: getRecentEvents(limit) });
});

app.get('/api/stats', (_req, res) => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    res.json({
        serverStartedAt,
        esp32ConnectedSince,
        esp32Connected: esp32Connected(),
        host: esp32Host,
        port: esp32Port,
        totalReadings: getTotalReadings(),
        alertsLast24h: getEventCountsSince(dayAgo),
        lastSensor,
    });
});

// ----- HTTP + WS servers -----
const server = http.createServer(app);
const browserWss = new WebSocketServer({ server, path: '/ws' });

let esp32Socket = null;
let esp32Reconnect = null;

function esp32Connected() {
    return esp32Socket?.readyState === WebSocket.OPEN;
}

function broadcast(message) {
    const text = typeof message === 'string' ? message : JSON.stringify(message);
    for (const client of browserWss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(text);
    }
}

function bridgeStatusPayload() {
    return {
        page: 'bridge',
        connected: esp32Connected(),
        host: esp32Host,
        port: esp32Port,
        esp32ConnectedSince,
        serverStartedAt,
    };
}

function recordEvent(level, category, message, meta = null) {
    const event = insertEvent({ ts: Date.now(), level, category, message, meta });
    broadcast({ page: 'event', event });
    return event;
}

function processSensorReading(parsed) {
    const ts = Date.now();
    const temp = Number(parsed.temperature);
    const humi = Number(parsed.humidity);
    insertReading(ts, temp, humi);
    lastSensor = { ts, temperature: temp, humidity: humi };

    const { alerts, next } = detectAlerts({ ts, temp, humi, prev: alertState });
    alertState = next;
    for (const alert of alerts) {
        const event = insertEvent(alert);
        broadcast({ page: 'event', event });
    }
}

// ----- ESP32 bridge -----
function connectEsp32() {
    if (esp32Reconnect) {
        clearTimeout(esp32Reconnect);
        esp32Reconnect = null;
    }

    const url = `ws://${esp32Host}:${esp32Port}/ws`;
    console.log(`[esp32] connecting -> ${url}`);

    const socket = new WebSocket(url);
    esp32Socket = socket;

    socket.on('open', () => {
        console.log('[esp32] connected');
        esp32ConnectedSince = Date.now();
        recordEvent('info', 'bridge', `Connected to ESP32 at ${esp32Host}:${esp32Port}`);
        broadcast(bridgeStatusPayload());
    });

    socket.on('message', (data) => {
        const text = data.toString();
        try {
            const parsed = JSON.parse(text);
            if (parsed.page === 'sensor') processSensorReading(parsed);
        } catch {
            // forward raw to browsers anyway
        }
        broadcast(text);
    });

    socket.on('close', () => {
        const wasConnected = esp32ConnectedSince !== null;
        console.log('[esp32] disconnected, retrying in 3s');
        esp32Socket = null;
        if (wasConnected) {
            recordEvent('warning', 'bridge', 'ESP32 connection lost');
            esp32ConnectedSince = null;
        }
        broadcast(bridgeStatusPayload());
        esp32Reconnect = setTimeout(connectEsp32, 3000);
    });

    socket.on('error', (err) => {
        console.log(`[esp32] error: ${err.message}`);
        try { socket.close(); } catch {}
    });
}

function reconnectEsp32() {
    if (esp32Socket) {
        try { esp32Socket.close(); } catch {}
        esp32Socket = null;
    }
    connectEsp32();
}

// ----- Browser WS clients -----
browserWss.on('connection', (client) => {
    client.send(JSON.stringify(bridgeStatusPayload()));
    if (lastSensor) {
        client.send(JSON.stringify({
            page: 'sensor',
            temperature: lastSensor.temperature,
            humidity: lastSensor.humidity,
        }));
    }

    client.on('message', (raw) => {
        const text = raw.toString();
        if (!esp32Connected()) {
            recordEvent('warning', 'command', 'Command rejected — ESP32 not connected', { raw: text.slice(0, 120) });
            client.send(JSON.stringify({ page: 'bridge', error: 'esp32_not_connected' }));
            return;
        }
        esp32Socket.send(text);
        recordEvent('info', 'command', 'Command forwarded to ESP32', { raw: text.slice(0, 120) });
    });
});

// ----- demo mode (fake readings if no ESP32 reachable) -----
if (DEMO) {
    console.log('[demo] generating synthetic sensor data every 5s');
    let t = 26;
    let h = 55;
    setInterval(() => {
        t += (Math.random() - 0.5) * 2;
        h += (Math.random() - 0.5) * 3;
        t = Math.max(18, Math.min(38, t));
        h = Math.max(20, Math.min(90, h));
        processSensorReading({ temperature: t, humidity: h });
        broadcast({ page: 'sensor', temperature: t, humidity: h });
    }, 5000);
}

// ----- retention cleanup -----
setInterval(() => purgeOlderThan(RETENTION_MS), 60 * 60 * 1000);

recordEvent('info', 'system', 'Server started');
connectEsp32();

server.listen(PORT, () => {
    console.log(`[http] listening on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
    recordEvent('info', 'system', 'Server stopping');
    db.close();
    process.exit(0);
});
