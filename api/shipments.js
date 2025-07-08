import { MongoClient } from 'mongodb';

// MongoDB 連接字串 - 請替換為你的實際連接字串
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'hengtong'; // 資料庫名稱
const COLLECTION_NAME = 'shipments'; // 集合名稱

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export default async function handler(req, res) {
  // 設定 CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://hengtong.vercel.app');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // 處理 preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    if (req.method === 'POST') {
      // 添加資料驗證
      const { company, partId, partName, quantity, price, amount, time } = req.body;
      
      if (!company || !partId || !partName || !quantity || !price || !amount || !time) {
        return res.status(400).json({ 
          success: false, 
          error: '缺少必要欄位' 
        });
      }
      
      // 儲存出貨資料
      const shipmentData = {
        company,
        partId,
        partName,
        quantity: parseInt(quantity),
        price: parseFloat(price),
        amount: parseFloat(amount),
        time,
        createdAt: new Date()
      };
      
      const result = await collection.insertOne(shipmentData);
      
      console.log('出貨資料已儲存:', shipmentData);
      
      res.status(200).json({ 
        success: true,
        message: '出貨資料儲存成功', 
        id: result.insertedId,
        data: shipmentData
      });
    } else if (req.method === 'GET') {
      // 查詢出貨資料
      const { company, startDate, endDate, limit = 50 } = req.query;
      
      let query = {};
      if (company) {
        query.company = company;
      }
      if (startDate || endDate) {
        query.time = {};
        if (startDate) query.time.$gte = startDate;
        if (endDate) query.time.$lte = endDate;
      }

      const shipments = await collection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .toArray();

      res.status(200).json({ 
        success: true,
        data: shipments,
        count: shipments.length
      });
    } else {
      res.status(405).json({ error: '不支援的請求方法' });
    }
  } catch (error) {
    console.error('資料庫操作錯誤:', error);
    res.status(500).json({ 
      success: false,
      error: '資料庫操作失敗',
      message: error.message 
    });
  }
}
