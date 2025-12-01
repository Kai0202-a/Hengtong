import { MongoClient } from 'mongodb';

// 僅使用環境變數連線字串
const uri = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || process.env.MONGODB_DB || 'hengtong';

export default async function handler(req, res) {
  // CORS 設置 - 使用環境變數
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').concat([
        /^https:\/\/hengtong.*\.vercel\.app$/
      ])
    : ['*']; // 如果沒有設定環境變數，保持原有的 * 設定
  
  if (allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    const origin = req.headers.origin;
    if (allowedOrigins.some(allowed => typeof allowed === 'string' ? allowed === origin : allowed.test(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  let client;
  try {
    if (!uri) throw new Error('MONGODB_URI not configured');
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('inventory');

    if (req.method === 'GET') {
      const inventory = await collection.find({}).toArray();
      res.status(200).json({ success: true, data: inventory });
    } else if (req.method === 'PUT') {
      const body = req.body && typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body.batchUpdates) {
        // 批量更新
        const bulkOps = body.batchUpdates.map(({ partId, newStock }) => ({
          updateOne: {
            filter: { id: partId },
            update: { $set: { stock: newStock } }
          }
        }));
        if (bulkOps.length > 0) {
          await collection.bulkWrite(bulkOps);
        }
        res.status(200).json({ success: true, message: '批量庫存更新成功' });
      } else if (body.partId && typeof body.newStock === 'number') {
        // 單筆更新
        await collection.updateOne(
          { id: body.partId },
          { $set: { stock: body.newStock } }
        );
        res.status(200).json({ success: true, message: '庫存已更新' });
      } else {
        res.status(400).json({ success: false, message: '請提供正確的 partId 與 newStock' });
      }
    } else {
      res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) await client.close();
  }
}