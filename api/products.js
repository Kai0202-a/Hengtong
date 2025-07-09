import { MongoClient } from 'mongodb';

// MongoDB 連接字串
const uri = process.env.MONGODB_URI || 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// 直接在這裡定義 partsData，避免引入問題
const partsData = [
  // 將您的 partsData.js 內容複製到這裡
  // 或者使用動態引入
];

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
    const productsCollection = db.collection('products');
    const inventoryCollection = db.collection('inventory');

    if (req.method === 'GET') {
      // 優先從 MongoDB products 集合獲取數據
      const products = await productsCollection.find({}).toArray();
      
      if (products.length > 0) {
        // 如果 MongoDB 中有商品數據，合併庫存資訊
        const inventory = await inventoryCollection.find({}).toArray();
        const inventoryMap = new Map(inventory.map(item => [item.id, item.stock]));
        
        const productsWithStock = products.map(product => ({
          ...product,
          stock: inventoryMap.get(product.id) || 0
        }));
        
        res.status(200).json({ success: true, data: productsWithStock });
      } else {
        // 如果 MongoDB 中沒有商品數據，使用 partsData 並合併庫存
        const inventory = await inventoryCollection.find({}).toArray();
        const inventoryMap = new Map(inventory.map(item => [item.id, item.stock]));
        
        const productsWithStock = partsData.map(part => ({
          ...part,
          stock: inventoryMap.get(part.id) || 0
        }));
        
        res.status(200).json({ success: true, data: productsWithStock });
      }
    } else if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      if (body.action === 'sync_partsdata') {
        // 同步 partsData 到 MongoDB products 集合
        await productsCollection.deleteMany({}); // 清空現有數據
        await productsCollection.insertMany(partsData);
        res.status(200).json({ 
          success: true, 
          message: '商品數據同步成功',
          count: partsData.length 
        });
      } else {
        // 新增單個商品
        const newProduct = body;
        await productsCollection.insertOne(newProduct);
        
        // 同時在庫存集合中創建記錄
        await inventoryCollection.insertOne({
          id: newProduct.id,
          stock: newProduct.stock || 0
        });
        
        res.status(200).json({ success: true, message: '商品新增成功' });
      }
      
    } else if (req.method === 'PUT') {
      const body = req.body && typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, stock, ...productData } = body;
      
      // 更新商品基本資訊
      if (Object.keys(productData).length > 0) {
        await productsCollection.updateOne(
          { id }, 
          { $set: productData },
          { upsert: true }
        );
      }
      
      // 更新庫存（如果提供）
      if (typeof stock === 'number') {
        await inventoryCollection.updateOne(
          { id },
          { $set: { stock } },
          { upsert: true }
        );
      }
      
      res.status(200).json({ success: true, message: '商品更新成功' });
      
    } else if (req.method === 'DELETE') {
      const { id } = req.body && typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      // 刪除商品和對應庫存
      await productsCollection.deleteOne({ id });
      await inventoryCollection.deleteOne({ id });
      
      res.status(200).json({ success: true, message: '商品刪除成功' });
    }
    
  } catch (error) {
    console.error('API 錯誤:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) await client.close();
  }
}