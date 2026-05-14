import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbFile = process.env.DB_FILE
    ? path.resolve(process.env.DB_FILE)
    : path.join(__dirname, 'data.sqlite');

export const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        temperature REAL,
        humidity REAL
    );
    CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);

    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        level TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        meta TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
    CREATE INDEX IF NOT EXISTS idx_events_level ON events(level);
`);

const stmtInsertReading = db.prepare(
    'INSERT INTO readings (ts, temperature, humidity) VALUES (?, ?, ?)',
);
const stmtInsertEvent = db.prepare(
    'INSERT INTO events (ts, level, category, message, meta) VALUES (?, ?, ?, ?, ?)',
);
const stmtRecentReadings = db.prepare(
    'SELECT ts, temperature AS temp, humidity AS humi FROM readings WHERE ts >= ? ORDER BY ts ASC',
);
const stmtRecentEvents = db.prepare(
    'SELECT id, ts, level, category, message, meta FROM events ORDER BY ts DESC LIMIT ?',
);
const stmtCountEvents = db.prepare(
    "SELECT level, COUNT(*) AS count FROM events WHERE ts >= ? GROUP BY level",
);
const stmtTotalReadings = db.prepare('SELECT COUNT(*) AS count FROM readings');
const stmtPurgeOldReadings = db.prepare('DELETE FROM readings WHERE ts < ?');
const stmtPurgeOldEvents = db.prepare('DELETE FROM events WHERE ts < ?');

export function insertReading(ts, temperature, humidity) {
    stmtInsertReading.run(ts, temperature, humidity);
}

export function insertEvent({ ts, level, category, message, meta }) {
    const metaJson = meta ? JSON.stringify(meta) : null;
    const result = stmtInsertEvent.run(ts, level, category, message, metaJson);
    return {
        id: result.lastInsertRowid,
        ts,
        level,
        category,
        message,
        meta: meta ?? null,
    };
}

export function getReadingsSince(sinceMs) {
    return stmtRecentReadings.all(sinceMs);
}

export function getRecentEvents(limit = 50) {
    return stmtRecentEvents.all(limit).map((row) => ({
        ...row,
        meta: row.meta ? JSON.parse(row.meta) : null,
    }));
}

export function getEventCountsSince(sinceMs) {
    const rows = stmtCountEvents.all(sinceMs);
    return rows.reduce((acc, row) => {
        acc[row.level] = row.count;
        return acc;
    }, {});
}

export function getTotalReadings() {
    return stmtTotalReadings.get().count;
}

export function purgeOlderThan(ms) {
    const cutoff = Date.now() - ms;
    stmtPurgeOldReadings.run(cutoff);
    stmtPurgeOldEvents.run(cutoff);
}
