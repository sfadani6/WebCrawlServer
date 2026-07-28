/**
 * DB 마이그레이션 스크립트
 * P3: 데이터베이스 마이그레이션 스크립트
 * server/migrations/ 디렉토리의 SQL 파일을 순서대로 실행
 */

const fs = require('fs-extra');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../db/helper');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function runMigrations() {
  const db = new sqlite3.Database(DB_PATH);

  await new Promise((resolve, reject) => {
    db.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      module TEXT,
      description TEXT NOT NULL,
      applied_sql TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => err ? reject(err) : resolve());
  });

  const applied = await new Promise((resolve, reject) => {
    db.all(`SELECT migration_id FROM schema_migrations`, (err, rows) => {
      err ? reject(err) : resolve(rows.map(r => r.migration_id));
    });
  });

  const files = await fs.readdir(MIGRATIONS_DIR);
  const migrationFiles = files.filter(f => f.endsWith('.sql')).sort();

  for (const file of migrationFiles) {
    const migrationId = file.replace('.sql', '');
    if (applied.includes(migrationId)) {
      console.log(`[Migrate] 이미 적용됨: ${migrationId}`);
      continue;
    }

    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const description = `마이그레이션: ${file}`;

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(sql, (err) => {
          if (err) { db.run('ROLLBACK'); reject(err); return; }
          db.run(
            `INSERT INTO schema_migrations (migration_id, target_type, description, applied_sql) VALUES (?, ?, ?, ?)`,
            [migrationId, 'table', description, sql],
            (err) => {
              if (err) { db.run('ROLLBACK'); reject(err); return; }
              db.run('COMMIT', () => resolve());
            }
          );
        });
      });
    });
    console.log(`[Migrate] 적용 완료: ${migrationId}`);
  }

  db.close();
  console.log('[Migrate] 모든 마이그레이션 완료');
}

if (require.main === module) {
  runMigrations().catch(err => {
    console.error('[Migrate] 오류:', err);
    process.exit(1);
  });
}

module.exports = { runMigrations };
