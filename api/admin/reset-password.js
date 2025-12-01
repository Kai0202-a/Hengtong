const bcrypt = require('bcryptjs');
const { getDb } = require('../_mongo');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
    const { username, userId, newPassword, adminUsername, adminPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: '新密碼至少 6 碼' });
    const envAdminUser = process.env.ADMIN_USERNAME || 'admin';
    const envAdminPass = process.env.ADMIN_PASSWORD || 'admin123';
    if (!(adminUsername === envAdminUser && adminPassword === envAdminPass)) return res.status(401).json({ success: false, error: '未授權' });
    const db = await getDb();
    const users = db.collection('users');
    const target = username ? await users.findOne({ username }) : (userId ? await users.findOne({ _id: userId }) : null);
    if (!target) return res.status(404).json({ success: false, message: '使用者不存在' });
    const hash = await bcrypt.hash(newPassword, 10);
    await users.updateOne({ _id: target._id }, { $set: { passwordHash: hash } });
    res.json({ success: true });
  } catch (e) {
    const msg = e.message || 'Server error';
    const code = /未授權/.test(msg) ? 401 : 500;
    res.status(code).json({ success: false, error: msg });
  }
};