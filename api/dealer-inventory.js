import { MongoClient } from 'mongodb';

// 使用環境變數替換硬編碼的連線字串
const uri = process.env.MONGODB_URI || 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = process.env.DB_NAME || 'hengtong';

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  // CORS 設置 - 使用環境變數
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').concat([
        /^https:\/\/hengtong.*\.vercel\.app$/
      ])
    : [
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

  let client;
  try {
    client = await connectToDatabase();
    const db = client.db(DB_NAME);
    const collection = db.collection('dealer_inventory');

    if (req.method === 'GET') {
      // 獲取特定通路商的在店庫存
      const { dealerUsername } = req.query;
      
      if (!dealerUsername) {
        res.status(400).json({ success: false, error: '缺少通路商帳號' });
        return;
      }

      const inventory = await collection.findOne({ dealerUsername });
      
      if (!inventory) {
        // 如果沒有記錄，返回空庫存
        res.status(200).json({ 
          success: true, 
          data: { dealerUsername, inventory: {} } 
        });
        return;
      }

      res.status(200).json({ success: true, data: inventory });
    }
    else if (req.method === 'POST') {
      // 初始化或更新通路商庫存
      const { dealerUsername, productId, quantity, action } = req.body;
      
      if (!dealerUsername || !productId || quantity === undefined) {
        res.status(400).json({ success: false, error: '缺少必要參數' });
        return;
      }

      const filter = { dealerUsername };
      const now = new Date();
      
      let updateOperation;
      
      if (action === 'set') {
        // 設置庫存
        updateOperation = {
          $set: {
            [`inventory.${productId}`]: parseInt(quantity),
            updatedAt: now
          },
          $setOnInsert: {
            dealerUsername,
            createdAt: now
          }
        };
      } else if (action === 'add') {
        // 增加庫存
        updateOperation = {
          $inc: {
            [`inventory.${productId}`]: parseInt(quantity)
          },
          $set: {
            updatedAt: now
          },
          $setOnInsert: {
            dealerUsername,
            createdAt: now
          }
        };
      } else if (action === 'subtract') {
        // 減少庫存
        updateOperation = {
          $inc: {
            [`inventory.${productId}`]: -parseInt(quantity)
          },
          $set: {
            updatedAt: now
          },
          $setOnInsert: {
            dealerUsername,
            createdAt: now
          }
        };
      } else {
        res.status(400).json({ success: false, error: '無效的操作類型' });
        return;
      }

      const result = await collection.updateOne(
        filter,
        updateOperation,
        { upsert: true }
      );

      res.status(200).json({ success: true, message: '庫存更新成功' });
    }
    else {
      res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API 錯誤:', error);
    res.status(500).json({ 
      success: false, 
      error: process.env.NODE_ENV === 'production' ? '伺服器內部錯誤' : error.message 
    });
  }
}