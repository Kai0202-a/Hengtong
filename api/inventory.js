import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
  // 添加 CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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
  } else if (req.method === 'POST') {
    // 批量初始化庫存數據
    try {
      const { partsData } = req.body;
      
      if (!partsData || !Array.isArray(partsData)) {
        return res.status(400).json({
          success: false,
          error: '需要提供 partsData 陣列'
        });
      }
      
      await client.connect();
      const db = client.db('hengtong');
      const collection = db.collection('inventory');
      
      // 清空現有數據（可選）
      await collection.deleteMany({});
      
      // 批量插入新數據
      const inventoryData = partsData.map(part => ({
        id: part.id,
        name: part.name,
        stock: part.stock,
        cost: part.cost,
        price: part.price,
        image: part.image,
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      
      const result = await collection.insertMany(inventoryData);
      
      res.status(200).json({
        success: true,
        message: `成功初始化 ${result.insertedCount} 個庫存項目`,
        insertedCount: result.insertedCount
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
      const { partId, newStock, name, batchUpdates } = req.body;
      
      await client.connect();
      const db = client.db('hengtong');
      const collection = db.collection('inventory');
      
      // 批量更新模式
      if (batchUpdates && Array.isArray(batchUpdates)) {
        const bulkOps = batchUpdates.map(update => ({
          updateOne: {
            filter: { id: update.partId },
            update: { 
              $set: { 
                stock: update.newStock, 
                updatedAt: new Date() 
              } 
            },
            upsert: true
          }
        }));
        
        const result = await collection.bulkWrite(bulkOps);
        
        res.status(200).json({
          success: true,
          message: `批量更新成功，更新了 ${result.modifiedCount} 個項目`,
          modifiedCount: result.modifiedCount
        });
      } else {
        // 單個更新模式（保持向後兼容）
        const updateData = { 
          stock: newStock, 
          updatedAt: new Date() 
        };
        
        if (name) {
          updateData.name = name;
        }
        
        await collection.updateOne(
          { id: partId },
          { $set: updateData },
          { upsert: true }
        );
        
        res.status(200).json({
          success: true,
          message: '庫存更新成功'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      await client.close();
    }
  } else {
    res.status(405).json({
      success: false,
      error: '不支援的請求方法'
    });
  }
}