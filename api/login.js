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
    const uname = String(username).trim();
    const unameLower = uname.toLowerCase();
    let user = await users.findOne({ username: { $in: [uname, unameLower] } });

    if (!user) {
      const adminUser = process.env.ADMIN_USERNAME;
      const adminPass = process.env.ADMIN_PASSWORD;
      if (adminUser && adminPass && username === adminUser && password === adminPass) {
        const hash = await bcrypt.hash(adminPass, 10);
        user = { username: adminUser, role: 'admin', status: 'active', company: process.env.REACT_APP_COMPANY_NAME || '恆通公司', passwordHash: hash, createdAt: new Date() };
        await users.insertOne(user);
      }
    }

    if (!user) {
      try {
        const dealers = db.collection('dealers');
        const d = await dealers.findOne({ username: { $in: [uname, unameLower] } });
        if (d) {
          if (d.status === 'suspended') return res.status(403).json({ success: false, error: '操作失敗' });
          if (d.status === 'pending') return res.status(403).json({ success: false, error: '操作失敗' });
          const passRaw = d.password || '';
          let okDealer = false;
          try {
            if (typeof passRaw === 'string' && /^\$2[abxy]\$/.test(passRaw)) {
              okDealer = await bcrypt.compare(password, passRaw);
            } else {
              okDealer = password === String(passRaw);
            }
          } catch {}
          if (!okDealer) return res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
          const hashToUse = (typeof passRaw === 'string' && /^\$2[abxy]\$/.test(passRaw)) ? passRaw : await bcrypt.hash(String(password), 10);
          const setDoc = {
            username: d.username,
            passwordHash: hashToUse,
            role: 'dealer',
            status: d.status || 'active',
            company: d.company || d.name || '',
            updatedAt: new Date()
          };
          await users.updateOne({ username: d.username }, { $set: setDoc, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
          if (!(typeof passRaw === 'string' && /^\$2[abxy]\$/.test(passRaw))) {
            await dealers.updateOne({ _id: d._id }, { $set: { password: hashToUse } });
          }
          user = await users.findOne({ username: d.username });
        }
      } catch {}
    }
    if (!user) return res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
    if (user.status === 'suspended') return res.status(403).json({ success: false, error: '操作失敗' });
    if (user.status === 'pending') return res.status(403).json({ success: false, error: '操作失敗' });

    let company = user.company || user.name;
    try {
      const dealers = db.collection('dealers');
      const d = await dealers.findOne({ username: user.username });
      if (d && (d.company || d.name)) company = d.company || d.name;
    } catch {}
    try {
      if (company && !user.company) {
        await db.collection('users').updateOne({ _id: user._id }, { $set: { company } });
      }
    } catch {}
    const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '12h' });
    res.json({ success: true, data: { username: user.username, role: user.role, company }, token });
  } catch (e) {
    res.status(500).json({ success: false, error: '操作失敗' });
  }
};