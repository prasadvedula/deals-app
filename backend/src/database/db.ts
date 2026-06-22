import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'deals.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    runMigrations(db);
  }
  return db;
}

function runMigrations(db: Database.Database): void {
  const cols = db.prepare("PRAGMA table_info(products)").all() as { name: string }[];
  if (!cols.some((c) => c.name === 'embedding')) {
    db.exec('ALTER TABLE products ADD COLUMN embedding TEXT');
  }
  if (!cols.some((c) => c.name === 'import_source')) {
    db.exec("ALTER TABLE products ADD COLUMN import_source TEXT");
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'General',
      current_price REAL NOT NULL,
      original_price REAL NOT NULL,
      image_url TEXT DEFAULT '',
      platform TEXT DEFAULT 'DealsApp',
      platform_url TEXT DEFAULT '',
      trending_score INTEGER DEFAULT 0,
      import_source TEXT,
      embedding TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );


    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      price REAL NOT NULL,
      platform TEXT DEFAULT 'DealsApp',
      recorded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'default_user',
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      price_alert_threshold REAL DEFAULT 0.15,
      added_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'default_user',
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cross_platform_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      price REAL NOT NULL,
      url TEXT DEFAULT '',
      last_checked TEXT DEFAULT (datetime('now')),
      UNIQUE(product_id, platform)
    );

    CREATE TABLE IF NOT EXISTS agent_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      payload TEXT DEFAULT '{}',
      result TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS deal_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT 'default_user',
      query TEXT NOT NULL,
      max_price REAL,
      target_platforms TEXT DEFAULT '[]',
      status TEXT DEFAULT 'watching',
      best_match_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      best_price REAL,
      notes TEXT DEFAULT '',
      last_checked TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      rating REAL,
      review_count INTEGER DEFAULT 0,
      pros TEXT DEFAULT '[]',
      cons TEXT DEFAULT '[]',
      summary TEXT DEFAULT '',
      trust_score REAL DEFAULT 0,
      fetched_at TEXT DEFAULT (datetime('now')),
      UNIQUE(product_id, platform)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_initials TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weekly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL,
      total_products INTEGER DEFAULT 0,
      price_drops INTEGER DEFAULT 0,
      new_products INTEGER DEFAULT 0,
      top_deals TEXT DEFAULT '[]',
      category_insights TEXT DEFAULT '[]',
      ai_summary TEXT DEFAULT '',
      generated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
      product_id UNINDEXED,
      name,
      description,
      category,
      content=products,
      content_rowid=id
    );

    -- Performance indexes for 100k+ products
    CREATE INDEX IF NOT EXISTS idx_products_price       ON products(current_price);
    CREATE INDEX IF NOT EXISTS idx_products_trending    ON products(trending_score DESC);
    CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_platform    ON products(platform);
    CREATE INDEX IF NOT EXISTS idx_products_cat_price   ON products(category, current_price);
    CREATE INDEX IF NOT EXISTS idx_price_history_pid    ON price_history(product_id, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_products_created     ON products(created_at DESC);

    CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
      INSERT INTO products_fts(rowid, product_id, name, description, category)
      VALUES (new.id, new.id, new.name, new.description, new.category);
    END;

    CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid, product_id, name, description, category)
      VALUES ('delete', old.id, old.id, old.name, old.description, old.category);
      INSERT INTO products_fts(rowid, product_id, name, description, category)
      VALUES (new.id, new.id, new.name, new.description, new.category);
    END;

    CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
      INSERT INTO products_fts(products_fts, rowid, product_id, name, description, category)
      VALUES ('delete', old.id, old.id, old.name, old.description, old.category);
    END;
  `);
}

export default getDb;
