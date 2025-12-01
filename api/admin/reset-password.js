const bcrypt = require('bcryptjs');
const { getDb } = require('../_mongo');
const { ObjectId } = require('mongodb');
const { check } = require('../_rate');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
    if (!check(req, 'admin-reset', 10, 60_000)) return res.status(429).json({ success: false, error: 'Too Many Requests' });
    const { username, userId, newPassword, adminUsername, adminPassword, company } = req.body || {};
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ success: false, error: '操作失敗' });
    const envAdminUser = process.env.ADMIN_USERNAME;
    const envAdminPass = process.env.ADMIN_PASSWORD;
    const db = await getDb();
    const users = db.collection('users');
    let authorized = false;
    if (envAdminUser && envAdminPass) {
      authorized = (adminUsername === envAdminUser && adminPassword === envAdminPass);
    } else {
      const adminDoc = await users.findOne({ username: adminUsername, role: 'admin', status: 'active' });
      if (adminDoc) {
        authorized = await bcrypt.compare(adminPassword || '', adminDoc.passwordHash || '');
      }
    }
    if (!authorized) return res.status(401).json({ success: false, error: '操作失敗' });
    let target = null;
    if (username) {
      target = await users.findOne({ username });
    } else if (userId) {
      try { target = await users.findOne({ _id: new ObjectId(String(userId)) }); } catch {}
    }
    const hash = await bcrypt.hash(newPassword, 10);
    if (!target) {
      const doc = {
        username: username || String(userId),
        role: 'dealer',
        status: 'active',
        company: company || '',
        passwordHash: hash,
        createdAt: new Date()
      };
      await users.insertOne(doc);
    } else {
      const set = { passwordHash: hash };
      if (!target.company && company) set.company = company;
      await users.updateOne({ _id: target._id }, { $set: set });
    }
    try {
      const dealers = db.collection('dealers');
      if (username) {
        await dealers.updateOne({ username }, { $set: { password: hash } });
      } else if (userId && target && target.username) {
        await dealers.updateOne({ username: target.username }, { $set: { password: hash } });
      }
    } catch {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: '操作失敗' });
  }
};