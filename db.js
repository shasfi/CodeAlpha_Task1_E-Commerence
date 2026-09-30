'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.resolve(process.env.DB_PATH || path.join(__dirname, 'data', 'store.sqlite'));
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price >= 0),
    compare_price INTEGER,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image TEXT NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0,
    badge TEXT,
    accent TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total INTEGER NOT NULL,
    shipping_name TEXT NOT NULL,
    shipping_email TEXT NOT NULL,
    shipping_phone TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Placed',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_order_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_session_exp ON sessions(expires_at);
`);

const catalog = [
  ['arc-wireless-headphones', 'Arc Wireless Headphones', 'Audio', 'Immersive sound, all-day comfort. Designed to make your listening ritual feel a little more special.', 15900, 18900, 30, '/assets/headphones.svg', 1, 'Bestseller', '#e5ebeb'],
  ['type-mechanical-keyboard', 'Type Mechanical Keyboard', 'Workspace', 'A satisfying tactile feel with a clean, considered silhouette for your everyday setup.', 11900, null, 22, '/assets/keyboard.svg', 1, 'New arrival', '#efe9e1'],
  ['orbit-bluetooth-speaker', 'Orbit Bluetooth Speaker', 'Audio', 'Rich, room-filling sound in a compact form you will want to leave out on display.', 8900, 10900, 25, '/assets/speaker.svg', 1, null, '#e8e4da'],
  ['beam-desk-lamp', 'Beam Desk Lamp', 'Workspace', 'Warm, adjustable light with a minimal profile that feels at home on any desk.', 7900, null, 18, '/assets/lamp.svg', 0, null, '#eee8df'],
  ['everyday-tech-tote', 'Everyday Tech Tote', 'Carry', 'A thoughtful carry-all with a padded laptop section and space for the essentials.', 6500, 7800, 20, '/assets/bag.svg', 0, 'Limited', '#e2e8de'],
  ['dock-wireless-charger', 'Dock Wireless Charger', 'Mobile', 'Clear the cable clutter with a beautifully simple charging stand.', 4900, null, 35, '/assets/charger.svg', 0, null, '#e4eaf0'],
  ['flow-ergonomic-mouse', 'Flow Ergonomic Mouse', 'Workspace', 'Smooth, precise movement and a soft-touch finish shaped for effortless workdays.', 5900, 6900, 26, '/assets/mouse.svg', 0, null, '#eee5e1'],
  ['pulse-portable-powerbank', 'Pulse Portable Power Bank', 'Mobile', 'Reliable power with a compact profile built for your everyday adventures.', 6900, null, 24, '/assets/powerbank.svg', 0, 'Popular', '#eae8e5']
];
const insert = db.prepare(`INSERT OR IGNORE INTO products
  (slug,name,category,description,price,compare_price,stock,image,featured,badge,accent)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
for (const p of catalog) insert.run(...p);

module.exports = db;
