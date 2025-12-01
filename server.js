const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const DATA_PATH = path.join(__dirname, 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function loadUsers() {
  if (!fs.existsSync(DATA_PATH)) {
    const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    const seed = [{ username: ADMIN_USERNAME, role: 'admin', company: '恆通公司', status: 'active', passwordHash: adminHash }];
    fs.writeFileSync(DATA_PATH, JSON.stringify(seed, null, 2));
    return seed;
  }
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}
function saveUsers(users) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2));
}
function findUser(users, username) {
  return users.find(u => u.username === username);
}

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const users = loadUsers();
  const user = findUser(users, username);
  if (!user) return res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) return res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
  if (user.status === 'suspended') return res.status(403).json({ success: false, status: 'suspended', message: '帳號已停用' });
  if (user.status === 'pending') return res.status(403).json({ success: false, status: 'pending', message: '帳號審核中' });
  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ success: true, data: { username: user.username, company: user.company || user.name }, token });
});

function auth(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, error: '未授權' });
  try { req.user = jwt.verify(token, JWT_SECRET); return next(); } catch { return res.status(401).json({ success: false, error: '權杖無效' }); }
}
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, error: '需要管理者權限' });
}

app.post('/api/admin/reset-password', auth, requireAdmin, async (req, res) => {
  const { username, userId, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: '新密碼至少 6 碼' });
  const users = loadUsers();
  const target = username ? findUser(users, username) : null;
  if (!target) return res.status(404).json({ success: false, message: '使用者不存在' });
  target.passwordHash = await bcrypt.hash(newPassword, 10);
  saveUsers(users);
  res.json({ success: true });
});

app.post('/api/change-password', auth, async (req, res) => {
  const { username, currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: '新密碼至少 6 碼' });
  const users = loadUsers();
  const target = findUser(users, username);
  if (!target) return res.status(404).json({ success: false, message: '使用者不存在' });
  const ok = await bcrypt.compare((currentPassword || ''), target.passwordHash);
  if (!ok) return res.status(401).json({ success: false, message: '目前密碼錯誤' });
  target.passwordHash = await bcrypt.hash(newPassword, 10);
  saveUsers(users);
  res.json({ success: true });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
