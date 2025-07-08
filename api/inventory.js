import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // 獲取庫存數據
    try {
      await client.connect();
      const db = client.db('hengtong');
      const collection = db.collection('inventory');
      
      const inventory = await collection.find({}).toArray();
      
      res.status(200).json({
        success: true,
        data: inventory
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      await client.close();
    }
  } else if (req.method === 'PUT') {
    // 更新庫存數據
    try {
      const { partId, newStock } = req.body;
      
      await client.connect();
      const db = client.db('hengtong');
      const collection = db.collection('inventory');
      
      await collection.updateOne(
        { id: partId },
        { $set: { stock: newStock, updatedAt: new Date() } },
        { upsert: true }
      );
      
      res.status(200).json({
        success: true,
        message: '庫存更新成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      await client.close();
    }
  }
}