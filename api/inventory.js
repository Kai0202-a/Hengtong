import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  let client;
  try {
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db('hengtong');
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