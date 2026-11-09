// Minimalna zamjena za Cloudflare D1 na node:sqlite, samo za lokalne testove.
import { DatabaseSync } from 'node:sqlite';
export function makeDB() {
  const db = new DatabaseSync(':memory:');
  const prepare = (sql) => ({
    _b: [], bind(...a) { this._b = a; return this; },
    async first() { return db.prepare(sql).get(...this._b) ?? null; },
    async all() { return { results: db.prepare(sql).all(...this._b) }; },
    async run() { const r = db.prepare(sql).run(...this._b); return { meta: { changes: Number(r.changes) } }; }
  });
  return { prepare, exec: (s) => db.exec(s), batch: async (st) => Promise.all(st.map((s) => s.all())) };
}
