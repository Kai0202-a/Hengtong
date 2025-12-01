const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('./_mongo');
const { check } = require('./_rate');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
    if (!check(req, 'login', 15, 60_000)) return res.status(429).json({ success: false, error: 'Too Many Requests' });
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ success: false, error: '操作失敗' });
    const db = await getDb();
    const users = db.collection('users');
    let user = await users.findOne({ username });

    if (!user) {
      const adminUser = process.env.ADMIN_USERNAME || 'admin';
      const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
      if (username === adminUser && password === adminPass) {
        const hash = await bcrypt.hash(adminPass, 10);
        user = { username: adminUser, role: 'admin', status: 'active', company: process.env.REACT_APP_COMPANY_NAME || '恆通公司', passwordHash: hash, createdAt: new Date() };
        await users.insertOne(user);
      }
    }

    if (!user) return res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
    if (user.status === 'suspended') return res.status(403).json({ success: false, error: '操作失敗' });
    if (user.status === 'pending') return res.status(403).json({ success: false, error: '操作失敗' });

    const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '12h' });
    res.json({ success: true, data: { username: user.username, role: user.role, company: user.company || user.name }, token });
  } catch (e) {
    res.status(500).json({ success: false, error: '操作失敗' });
  }
};