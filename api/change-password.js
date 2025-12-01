const bcrypt = require('bcryptjs');
const { getDb } = require('./_mongo');
const { check } = require('./_rate');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
    if (!check(req, 'change-password', 10, 60_000)) return res.status(429).json({ success: false, error: 'Too Many Requests' });
    const { username, currentPassword, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, error: '操作失敗' });
    const db = await getDb();
    const users = db.collection('users');
    const target = await users.findOne({ username });
    if (!target) return res.status(404).json({ success: false, error: '操作失敗' });
    const ok = await bcrypt.compare(currentPassword || '', target.passwordHash || '');
    if (!ok) return res.status(401).json({ success: false, error: '操作失敗' });
    const hash = await bcrypt.hash(newPassword, 10);
    await users.updateOne({ _id: target._id }, { $set: { passwordHash: hash } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: '操作失敗' });
  }
};