'use strict';
/* Real Express.js is used after `npm install`. The small local fallback lets the
   downloaded demo run immediately in offline classrooms with Node.js 22+. */
let express;
try { express = require('express'); }
catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND' || !error.message.includes("'express'")) throw error;
  console.warn('Express not installed: using offline preview adapter. Run `npm install` for Express.js.');
  express = require('./lib/offline-express');
}
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const db = require('./db');
const app = express();
const scrypt = promisify(crypto.scrypt);
const PORT = Number(process.env.PORT) || 3000;
const SESSION_MS = 1000 * 60 * 60 * 24 * 7;

app.disable?.('x-powered-by');
app.use(express.json({ limit: '32kb' }));

const getUserById = db.prepare('SELECT id,name,email,created_at FROM users WHERE id = ?');
const getSession = db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?');
const productFields = 'id,slug,name,category,description,price,compare_price,stock,image,featured,badge,accent';
const readCookie = (req, name) => {
  const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(name + '='));
  return cookie ? cookie.slice(name.length + 1) : null;
};
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const sessionCookie = (token, age) => `mono_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
function authenticatedUser(req) {
  const token = readCookie(req, 'mono_session');
  if (!token || !/^[a-f\d]{64}$/.test(token)) return null;
  const session = getSession.get(hashToken(token), Date.now());
  return session ? getUserById.get(session.user_id) : null;
}
function authRequired(req, res, next) {
  req.user = authenticatedUser(req);
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  next();
}
// SameSite cookie is supplemented by Origin validation for state-changing requests.
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || !req.headers.origin) return next();
  let origin;
  try { origin = new URL(req.headers.origin); } catch { return res.status(403).json({ error: 'Invalid request origin.' }); }
  const expectedHost = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin.host !== expectedHost) return res.status(403).json({ error: 'Cross-origin request denied.' });
  next();
});
const cleaned = (val, max=200) => typeof val === 'string' ? val.trim().slice(0, max) : '';
const emailOk = val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) && val.length <= 254;

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/products', (req, res) => {
  let products = db.prepare(`SELECT ${productFields} FROM products ORDER BY id`).all();
  if (req.query.category && req.query.category !== 'All') products = products.filter(p => p.category === req.query.category);
  res.json({ products });
});
app.get('/api/products/:id', (req, res) => {
  const product = db.prepare(`SELECT ${productFields} FROM products WHERE id=? OR slug=?`).get(req.params.id, req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product });
});
app.post('/api/auth/register', async (req, res) => {
  try {
    const name = cleaned(req.body?.name, 70);
    const email = cleaned(req.body?.email, 254).toLowerCase();
    const password = req.body?.password;
    if (name.length < 2 || !emailOk(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'Enter your name, a valid email, and a password of 8–128 characters.' });
    }
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) return res.status(409).json({ error: 'An account with this email already exists.' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = (await scrypt(password, salt, 64)).toString('hex');
    let userId;
    try { userId = db.prepare('INSERT INTO users (name,email,password_salt,password_hash) VALUES (?,?,?,?)').run(name, email, salt, hash).lastInsertRowid; }
    catch (err) { if (err.code?.startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'Email already registered.' }); throw err; }
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(hashToken(token), userId, Date.now() + SESSION_MS);
    res.setHeader('Set-Cookie', sessionCookie(token, Math.floor(SESSION_MS / 1000)));
    res.status(201).json({ user: getUserById.get(userId) });
  } catch (err) { console.error('Registration error:', err); res.status(500).json({ error: 'Unable to register right now.' }); }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = cleaned(req.body?.email, 254).toLowerCase();
    const password = req.body?.password;
    if (!emailOk(email) || typeof password !== 'string') return res.status(400).json({ error: 'Enter your email and password.' });
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    // Equal-cost comparison avoids a quick account-existence timing difference.
    const salt = user?.password_salt || '00000000000000000000000000000000';
    const actual = await scrypt(password, salt, 64);
    const expected = Buffer.from(user?.password_hash || '0'.repeat(128), 'hex');
    if (!user || !crypto.timingSafeEqual(actual, expected)) return res.status(401).json({ error: 'Incorrect email or password.' });
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(hashToken(token), user.id, Date.now() + SESSION_MS);
    res.setHeader('Set-Cookie', sessionCookie(token, Math.floor(SESSION_MS / 1000)));
    res.json({ user: getUserById.get(user.id) });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Unable to sign in right now.' }); }
});
app.post('/api/auth/logout', (req, res) => {
  const token = readCookie(req, 'mono_session');
  if (token && /^[a-f\d]{64}$/.test(token)) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.json({ message: 'Signed out.' });
});
app.get('/api/auth/me', (req, res) => res.json({ user: authenticatedUser(req) }));

app.post('/api/orders', authRequired, (req, res) => {
  const body = req.body || {};
  const shipping = {
    name: cleaned(body.name, 90), email: cleaned(body.email, 254), phone: cleaned(body.phone, 35),
    address: cleaned(body.address, 280), city: cleaned(body.city, 70), notes: cleaned(body.notes, 500)
  };
  if (shipping.name.length < 2 || !emailOk(shipping.email) || shipping.phone.length < 7 || shipping.address.length < 8 || shipping.city.length < 2)
    return res.status(400).json({ error: 'Complete your shipping name, email, phone, address and city.' });
  const items = body.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 25 || items.some(it =>
    !it || !Number.isSafeInteger(it.id) || !Number.isSafeInteger(it.quantity) || it.quantity < 1 || it.quantity > 20
  ) || new Set(items.map(it => it.id)).size !== items.length)
    return res.status(400).json({ error: 'Invalid cart. Please review the items and try again.' });

  // BEGIN IMMEDIATE means the entire stock check + insertion is atomic.
  try {
    db.exec('BEGIN IMMEDIATE');
    const getProduct = db.prepare('SELECT id,name,price,stock FROM products WHERE id=?');
    const ordered = items.map(it => ({ ...getProduct.get(it.id), id: it.id, quantity: it.quantity }));
    if (ordered.some((p, idx) => !p.name || p.stock < items[idx].quantity)) {
      db.exec('ROLLBACK');
      return res.status(409).json({ error: 'A product in your cart is no longer available in the requested quantity.' });
    }
    const total = ordered.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const info = db.prepare(`INSERT INTO orders (user_id,total,shipping_name,shipping_email,shipping_phone,shipping_address,shipping_city,notes)
      VALUES (?,?,?,?,?,?,?,?)`).run(req.user.id, total, shipping.name, shipping.email, shipping.phone, shipping.address, shipping.city, shipping.notes);
    const addItem = db.prepare('INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price) VALUES (?,?,?,?,?)');
    const reduceStock = db.prepare('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?');
    for (const it of ordered) {
      addItem.run(info.lastInsertRowid, it.id, it.name, it.quantity, it.price);
      if (reduceStock.run(it.quantity, it.id, it.quantity).changes !== 1) throw new Error('Stock changed during checkout.');
    }
    db.exec('COMMIT');
    res.status(201).json({ order: { id: Number(info.lastInsertRowid), total, status: 'Placed', items: ordered } });
  } catch (err) {
    if (db.isOpen) { try { db.exec('ROLLBACK'); } catch {} }
    console.error('Order error:', err);
    res.status(500).json({ error: 'Could not place your order. Please try again.' });
  }
});
app.get('/api/orders', authRequired, (req, res) => {
  const orders = db.prepare(`SELECT id,total,status,created_at,shipping_name,shipping_city
    FROM orders WHERE user_id=? ORDER BY id DESC`).all(req.user.id);
  const rows = db.prepare('SELECT product_id,product_name,quantity,unit_price FROM order_items WHERE order_id=?');
  res.json({ orders: orders.map(order => ({ ...order, items: rows.all(order.id) })) });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: '1h' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
const server = app.listen(PORT, () => console.log(`MONO. store ready at http://localhost:${PORT}`));
module.exports = { app, server };
