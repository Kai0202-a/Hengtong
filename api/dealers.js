import { MongoClient, ObjectId } from 'mongodb';

const uri = 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

export default async function handler(req, res) {
  // CORS 设置
  const allowedOrigins = [
    'https://hengtong.vercel.app',
    'https://hengtong-1cac747lk-kais-projects-975b317e.vercel.app',
    /^https:\/\/hengtong.*\.vercel\.app$/
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.some(allowed => typeof allowed === 'string' ? allowed === origin : allowed.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // 获取所有通路商数据
    let client;
    try {
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db('hengtong');
      const collection = db.collection('dealers');
      const dealers = await collection.find({}).toArray();
      res.status(200).json({ success: true, data: dealers });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    } finally {
      if (client) await client.close();
    }
  }
  else if (req.method === 'POST') {
    // 新增通路商申请
    let client;
    try {
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db('hengtong');
      const collection = db.collection('dealers');
      const { username, password, name, company, taxId, address, email, phone } = req.body;
      const existingDealer = await collection.findOne({ username });
      if (existingDealer) {
        res.status(400).json({ success: false, error: '帐号已存在，请更换账号' });
        return;
      }
      const newDealer = {
        username,
        password, // 实际应用中应该加密
        name,
        company,
        taxId,
        address,
        email,
        phone,
        status: 'pending',
        createdAt: new Date(),
        id: Date.now()
      };
      await collection.insertOne(newDealer);
      res.status(201).json({ success: true, message: '申请成功，请等待审核', data: newDealer });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    } finally {
      if (client) await client.close();
    }
  }
  else if (req.method === 'PUT') {
    // 更新通路商狀態
    let client;
    try {
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db('hengtong');
      const collection = db.collection('dealers');
      const { id, status } = req.body;
      if (!id || !status) {
        res.status(400).json({ success: false, error: '缺少必要參數' });
        return;
      }
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: status, updatedAt: new Date() } }
      );
      if (result.matchedCount === 0) {
        res.status(404).json({ success: false, error: '找不到該通路商' });
        return;
      }
      res.status(200).json({ success: true, message: '狀態更新成功' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    } finally {
      if (client) await client.close();
    }
  }
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}