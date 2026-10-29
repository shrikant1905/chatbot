import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseSqlStatements(sqlContent) {
  // Strip block comments /* ... */
  const noBlockComments = sqlContent.replace(/\/\*[\s\S]*?\*\//g, '');

  // Strip single line comments -- ...
  const lines = noBlockComments.split('\n');
  const cleanedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('--') || trimmed.startsWith('#')) {
      return '';
    }
    return line;
  });

  const cleanedSql = cleanedLines.join('\n');

  // Split by semicolon
  return cleanedSql
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

export async function runMigrations(customPool = null) {
  const pool = customPool || getPool();

  // Ensure migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = await fs.readdir(migrationsDir);
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort();

  const [appliedRows] = await pool.query('SELECT name FROM _migrations');
  const appliedNames = new Set(appliedRows.map((r) => r.name));

  for (const file of sqlFiles) {
    if (!appliedNames.has(file)) {
      console.log(`[Migration] Applying ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = await fs.readFile(filePath, 'utf8');

      const statements = parseSqlStatements(sqlContent);

      for (const statement of statements) {
        if (statement) {
          await pool.query(statement);
        }
      }

      await pool.query('INSERT INTO _migrations (name) VALUES (?)', [file]);
      console.log(`[Migration] Applied ${file} successfully.`);
    }
  }
}

// If executed directly: node src/db/migrate.js
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => {
      console.log('[Migration] All migrations completed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] Failed to run migrations:', err);
      process.exit(1);
    });
}
