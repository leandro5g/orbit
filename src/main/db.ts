import { DatabaseSync } from 'node:sqlite'

export interface UsageSample {
  ts: number
  five_pct: number
  five_reset: number
  week_pct: number | null
  week_reset: number | null
}

/** Persistência local (SQLite embutido no Node do Electron): preferências, histórico de uso e de sessões. */
export class LocalStore {
  private db: DatabaseSync

  constructor(file: string) {
    this.db = new DatabaseSync(file)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS usage_samples (
        account TEXT NOT NULL, ts INTEGER NOT NULL,
        five_pct REAL NOT NULL, five_reset INTEGER NOT NULL,
        week_pct REAL, week_reset INTEGER,
        PRIMARY KEY (account, ts)
      );
      CREATE TABLE IF NOT EXISTS session_history (
        session_id TEXT PRIMARY KEY, account TEXT NOT NULL, project TEXT, cwd TEXT,
        first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, last_state TEXT
      );
      CREATE TABLE IF NOT EXISTS works (
        id TEXT PRIMARY KEY, title TEXT, custom_title TEXT, project TEXT NOT NULL, cwd TEXT NOT NULL,
        root TEXT NOT NULL, account TEXT NOT NULL, session_id TEXT NOT NULL, status TEXT NOT NULL,
        created INTEGER NOT NULL, updated INTEGER NOT NULL, requested_at INTEGER,
        hidden INTEGER NOT NULL DEFAULT 0, done_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS work_sessions (
        session_id TEXT PRIMARY KEY, work_id TEXT NOT NULL, account TEXT NOT NULL, started INTEGER NOT NULL
      );
    `)
  }

  get<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined
    if (!row) return fallback
    try {
      return JSON.parse(row.value) as T
    } catch {
      return fallback
    }
  }

  set(key: string, value: unknown): void {
    this.db
      .prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, JSON.stringify(value))
  }

  addSample(account: string, s: UsageSample): void {
    this.db
      .prepare(
        'INSERT OR IGNORE INTO usage_samples (account, ts, five_pct, five_reset, week_pct, week_reset) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(account, s.ts, s.five_pct, s.five_reset, s.week_pct, s.week_reset)
  }

  /** Amostras da mesma janela de 5h (mesmo reset), a partir de `since`. */
  samples(account: string, fiveReset: number, since: number): UsageSample[] {
    return this.db
      .prepare(
        'SELECT ts, five_pct, five_reset, week_pct, week_reset FROM usage_samples WHERE account = ? AND five_reset = ? AND ts >= ? ORDER BY ts'
      )
      .all(account, fiveReset, since) as unknown as UsageSample[]
  }

  touchSession(id: string, account: string, project: string, cwd: string, state: string, now: number): void {
    this.db
      .prepare(
        `INSERT INTO session_history (session_id, account, project, cwd, first_seen, last_seen, last_state)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET last_seen = excluded.last_seen, last_state = excluded.last_state`
      )
      .run(id, account, project, cwd, now, now, state)
  }

  run(sql: string, ...params: (string | number | null)[]): void {
    this.db.prepare(sql).run(...params)
  }

  one<T>(sql: string, ...params: (string | number | null)[]): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined
  }

  all<T>(sql: string, ...params: (string | number | null)[]): T[] {
    return this.db.prepare(sql).all(...params) as unknown as T[]
  }

  prune(now: number): void {
    const cutoff = now - 30 * 24 * 3600_000
    this.db.prepare('DELETE FROM usage_samples WHERE ts < ?').run(cutoff)
    this.db.prepare('DELETE FROM session_history WHERE last_seen < ?').run(cutoff)
    this.db.prepare('DELETE FROM work_sessions WHERE work_id IN (SELECT id FROM works WHERE updated < ?)').run(cutoff)
    this.db.prepare('DELETE FROM works WHERE updated < ?').run(cutoff)
  }

  close(): void {
    this.db.close()
  }
}
