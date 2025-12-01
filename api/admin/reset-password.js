const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../_mongo');

function auth(req) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) throw new Error('未授權');
  try { return jwt.verify(token, process.env.JWT_SECRET || 'dev-secret'); } catch { throw new Error('權杖無效'); }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
    const user = auth(req);
    if (user.role !== 'admin') return res.status(403).json({ success: false, error: '需要管理者權限' });
    const { username, userId, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, message: '新密碼至少 6 碼' });
    const db = await getDb();
    const users = db.collection('users');
    const target = username ? await users.findOne({ username }) : (userId ? await users.findOne({ _id: userId }) : null);
    if (!target) return res.status(404).json({ success: false, message: '使用者不存在' });
    const hash = await bcrypt.hash(newPassword, 10);
    await users.updateOne({ _id: target._id }, { $set: { passwordHash: hash } });
    res.json({ success: true });
  } catch (e) {
    const msg = e.message || 'Server error';
    const code = /未授權|權杖無效/.test(msg) ? 401 : 500;
    res.status(code).json({ success: false, error: msg });
  }
};