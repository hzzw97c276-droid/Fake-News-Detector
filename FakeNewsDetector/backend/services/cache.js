import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dir, '..', 'cache.db');
const TTL_HOURS = 6; // cache expires after 6 hours

let _db = null;

function getDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS claim_cache (
      key       TEXT PRIMARY KEY,
      payload   TEXT NOT NULL,
      created   INTEGER NOT NULL
    );
  `);
  return _db;
}

/** Normalize claim → cache key: lowercase, collapse whitespace, trim */
function cacheKey(claim) {
  return claim.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function cacheGet(claim) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT payload, created FROM claim_cache WHERE key = ?').get(cacheKey(claim));
    if (!row) return null;
    const ageMs = Date.now() - row.created;
    if (ageMs > TTL_HOURS * 3_600_000) {
      db.prepare('DELETE FROM claim_cache WHERE key = ?').run(cacheKey(claim));
      return null;
    }
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export function cacheSet(claim, payload) {
  try {
    const db = getDb();
    db.prepare(
      'INSERT OR REPLACE INTO claim_cache (key, payload, created) VALUES (?, ?, ?)',
    ).run(cacheKey(claim), JSON.stringify(payload), Date.now());
  } catch {
    // Non-fatal — if cache write fails, continue without caching
  }
}

/** Prune all expired rows (call periodically) */
export function cachePrune() {
  try {
    const db = getDb();
    const cutoff = Date.now() - TTL_HOURS * 3_600_000;
    db.prepare('DELETE FROM claim_cache WHERE created < ?').run(cutoff);
  } catch {
    /* ignore */
  }
}
