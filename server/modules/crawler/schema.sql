CREATE TABLE IF NOT EXISTS crawler_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'rss' | 'json' | 'page'
  interval_seconds INTEGER DEFAULT 0,
  last_checked_at TIMESTAMP,
  last_result TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crawler_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id INTEGER NOT NULL,
  external_id TEXT,
  title TEXT,
  content TEXT,
  raw TEXT,
  published_at TIMESTAMP,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(target_id) REFERENCES crawler_targets(id)
);