const bcrypt = require('bcryptjs');
const { getDb } = require('../_mongo');
const { check } = require('../_rate');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
    if (!check(req, 'admin-import', 3, 60000)) return res.status(429).json({ success: false, error: 'Too Many Requests' });
    const { adminUsername, adminPassword, overwrite } = req.body || {};
    const envAdminUser = process.env.ADMIN_USERNAME;
    const envAdminPass = process.env.ADMIN_PASSWORD;
    const db = await getDb();
    const usersCol = db.collection('users');
    let authorized = false;
    if (envAdminUser && envAdminPass) {
      authorized = (adminUsername === envAdminUser && adminPassword === envAdminPass);
    } else {
      const adminDoc = await usersCol.findOne({ username: adminUsername, role: 'admin', status: 'active' });
      if (adminDoc) {
        authorized = await bcrypt.compare(adminPassword || '', adminDoc.passwordHash || '');
      }
    }
    if (!authorized) return res.status(401).json({ success: false, error: '操作失敗' });
    const dealersCol = db.collection('dealers');
    const usersCol2 = usersCol;
    const dealers = await dealersCol.find({}).toArray();
    let imported = 0, updated = 0, skipped = 0;
    for (const d of dealers) {
      const username = (d.username || '').trim();
      if (!username) { skipped++; continue; }
      const company = d.company || d.name || '';
      const passRaw = d.password || '';
      let hash = '';
      if (typeof passRaw === 'string' && /^\$2[abxy]\$/.test(passRaw)) { hash = passRaw; } else if (passRaw) { hash = await bcrypt.hash(String(passRaw), 10); }
      const u = await usersCol2.findOne({ username });
      if (!u) {
        if (!hash) { skipped++; continue; }
        await usersCol2.insertOne({ username, passwordHash: hash, role: 'dealer', status: 'active', company, createdAt: new Date() });
        imported++;
      } else {
        const set = {};
        if (!u.company && company) set.company = company;
        if (!u.passwordHash && hash) set.passwordHash = hash;
        if (overwrite && hash) set.passwordHash = hash;
        if (Object.keys(set).length) { await usersCol2.updateOne({ _id: u._id }, { $set: set }); updated++; } else { skipped++; }
      }
    }
    res.json({ success: true, imported, updated, skipped, total: dealers.length });
  } catch (e) {
    res.status(500).json({ success: false, error: '操作失敗' });
  }
};