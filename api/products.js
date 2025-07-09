import { MongoClient } from 'mongodb';

// MongoDB 連接字串
const uri = process.env.MONGODB_URI || 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// 商品數據
const partsData = [
  { id: 1, name: "PO-9001", stock: 50, cost: 170, price: 260, image: "images/PO-9001.jpg" },
  { id: 2, name: "PO-9002", stock: 50, cost: 170, price: 260, image: "images/PO-9002.jpg" },
  { id: 3, name: "PO-9003", stock: 50, cost: 170, price: 260, image: "images/PO-9003.jpg" },
  { id: 4, name: "PO-9004", stock: 50, cost: 170, price: 260, image: "images/PO-9004.jpg" },
  { id: 5, name: "PO-9005", stock: 50, cost: 170, price: 260, image: "images/PO-9005.jpg" },
  { id: 6, name: "PO-9006", stock: 50, cost: 170, price: 260, image: "images/PO-9006.jpg" },
  { id: 7, name: "PO-9008", stock: 50, cost: 130, price: 220, image: "images/PO-9008.jpg" },
  { id: 8, name: "PO-9009", stock: 50, cost: 170, price: 260, image: "images/PO-9009.jpg" },
  { id: 9, name: "PO-9010", stock: 50, cost: 170, price: 260, image: "images/PO-9010.jpg" },
  { id: 10, name: "PO-9011", stock: 50, cost: 130, price: 220, image: "images/PO-9011.jpg" },
  { id: 11, name: "PO-9013", stock: 50, cost: 170, price: 260, image: "images/PO-9013.jpg" },
  { id: 12, name: "PO-9015", stock: 50, cost: 170, price: 260, image: "images/PO-9015.jpg" },
  { id: 13, name: "PO-9016", stock: 50, cost: 130, price: 220, image: "images/PO-9016.jpg" },
  { id: 14, name: "PO-9018", stock: 50, cost: 130, price: 220, image: "images/PO-9018.jpg" },
  { id: 15, name: "PO-9021", stock: 50, cost: 130, price: 220, image: "images/PO-9021.jpg" },
  { id: 16, name: "PO-9022", stock: 50, cost: 130, price: 220, image: "images/PO-9022.jpg" },
  { id: 17, name: "PO-9024", stock: 50, cost: 130, price: 220, image: "images/PO-9024.jpg" },
  { id: 18, name: "PO-9025", stock: 50, cost: 130, price: 220, image: "images/PO-9025.png" },
  { id: 19, name: "PO-9026", stock: 50, cost: 130, price: 220, image: "images/PO-9026.jpg" },
  { id: 20, name: "PO-9027", stock: 50, cost: 130, price: 220, image: "images/PO-9027.jpg" },
  { id: 21, name: "PO-9028", stock: 50, cost: 130, price: 220, image: "images/PO-9028.jpg" },
  { id: 22, name: "PO-9029", stock: 50, cost: 130, price: 220, image: "images/PO-9029.png" },
  { id: 23, name: "PO-9030", stock: 50, cost: 130, price: 220, image: "images/PO-9030.jpg" },
  { id: 24, name: "PO-9031", stock: 50, cost: 130, price: 220, image: "images/PO-9031.jpg" },
  { id: 25, name: "PO-9032", stock: 50, cost: 130, price: 220, image: "images/PO-9032.jpg" },
  { id: 26, name: "PO-9033", stock: 50, cost: 130, price: 220, image: "images/PO-9033.jpg" },
  { id: 27, name: "PO-9034", stock: 50, cost: 130, price: 220, image: "images/PO-9034.jpg" },
  { id: 28, name: "5W30賽用機油", stock: 50, cost: 300, price: 370, image: "" },
  { id: 29, name: "5W40賽用機油", stock: 50, cost: 330, price: 400, image: "" },
  { id: 30, name: "20W50賽用機油", stock: 50, cost: 370, price: 430, image: "" },
  { id: 31, name: "K&N辛烷值提升劑99-2020", stock: 50, cost: 350, price: 400, image: "" },
  { id: 32, name: "K&N燃油系統清潔99-2050", stock: 50, cost: 350, price: 400, image: "" },
  { id: 33, name: "K&N柴油辛烷值提升劑99-2030", stock: 50, cost: 350, price: 400, image: "" },
  { id: 34, name: "EI賽用級全取代水箱精", stock: 50, cost: 480, price: 600, image: "" }
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