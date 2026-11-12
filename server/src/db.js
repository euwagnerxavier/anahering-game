// Persistência em SQLite usando o módulo nativo node:sqlite (sem compilação no ARM).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS decrees (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     author TEXT NOT NULL,
     text TEXT NOT NULL,
     ip_hash TEXT NOT NULL,
     hidden INTEGER NOT NULL DEFAULT 0,
     reports INTEGER NOT NULL DEFAULT 0,
     created_at INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS idx_decrees_visible ON decrees(hidden, id DESC);
   CREATE INDEX IF NOT EXISTS idx_decrees_ip ON decrees(ip_hash, created_at);
   CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS reports (decree_id INTEGER NOT NULL, ip_hash TEXT NOT NULL,
     PRIMARY KEY (decree_id, ip_hash));`,
];

export function openDb(dbPath) {
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
  let version = row ? Number(row.value) : 0;
  for (; version < MIGRATIONS.length; version++) {
    db.exec(MIGRATIONS[version]);
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)").run(String(version + 1));
  }

  const st = {
    listVisible: db.prepare(
      'SELECT id, author, text, created_at AS createdAt FROM decrees WHERE hidden = 0 ORDER BY id DESC LIMIT ?'
    ),
    insert: db.prepare('INSERT INTO decrees (author, text, ip_hash, created_at) VALUES (?, ?, ?, ?)'),
    countSince: db.prepare('SELECT COUNT(*) AS n FROM decrees WHERE ip_hash = ? AND created_at > ?'),
    addReport: db.prepare('INSERT OR IGNORE INTO reports (decree_id, ip_hash) VALUES (?, ?)'),
    bumpReports: db.prepare(
      'UPDATE decrees SET reports = (SELECT COUNT(*) FROM reports WHERE decree_id = ?), ' +
        'hidden = CASE WHEN (SELECT COUNT(*) FROM reports WHERE decree_id = ?) >= ? THEN 1 ELSE hidden END WHERE id = ?'
    ),
    hide: db.prepare('UPDATE decrees SET hidden = 1 WHERE id = ?'),
    getCounter: db.prepare('SELECT value FROM counters WHERE name = ?'),
    addCounter: db.prepare(
      'INSERT INTO counters (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = value + excluded.value'
    ),
  };

  return {
    raw: db,
    listDecrees(limit = 20) {
      return st.listVisible.all(Math.min(Math.max(limit, 1), 50));
    },
    insertDecree({ author, text, ipHash }) {
      const createdAt = Date.now();
      const info = st.insert.run(author, text, ipHash, createdAt);
      return { id: Number(info.lastInsertRowid), author, text, createdAt };
    },
    countDecreesSince(ipHash, since) {
      return st.countSince.get(ipHash, since).n;
    },
    report(decreeId, ipHash, threshold = 3) {
      st.addReport.run(decreeId, ipHash);
      st.bumpReports.run(decreeId, decreeId, threshold, decreeId);
    },
    hideDecree(id) {
      return st.hide.run(id).changes > 0;
    },
    getCounter(name) {
      return st.getCounter.get(name)?.value ?? 0;
    },
    addCounter(name, delta) {
      st.addCounter.run(name, delta);
    },
    close() {
      db.close();
    },
  };
}
