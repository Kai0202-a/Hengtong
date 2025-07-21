import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

// 使用環境變數替換硬編碼的連線字串
const uri = process.env.MONGODB_URI || 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = process.env.DB_NAME || 'hengtong';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;

// 連線池配置
const clientOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }
  
  const client = new MongoClient(uri, clientOptions);
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  let client;
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      res.status(400).json({ success: false, error: '請輸入帳號和密碼' });
      return;
    }

    client = await connectToDatabase();
    const db = client.db(DB_NAME);
    const collection = db.collection('dealers');

    // 查找用戶
    const dealer = await collection.findOne({ 
      username: username.trim().toLowerCase() 
    });

    if (!dealer) {
      res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
      return;
    }

    // 驗證密碼
    const isPasswordValid = await bcrypt.compare(password, dealer.password);
    
    if (!isPasswordValid) {
      res.status(401).json({ success: false, error: '帳號或密碼錯誤' });
      return;
    }

    // 檢查帳號狀態
    if (dealer.status === 'pending') {
      res.status(403).json({ 
        success: false, 
        error: '帳號審核中', 
        status: 'pending',
        message: '您的帳號正在審核中，請等待管理員審核通過後再登入。'
      });
      return;
    }

    if (dealer.status === 'suspended') {
      res.status(403).json({ 
        success: false, 
        error: '帳號已停用', 
        status: 'suspended',
        message: '您的帳號已被停用，請聯繫管理員。'
      });
      return;
    }

    if (dealer.status !== 'active') {
      res.status(403).json({ 
        success: false, 
        error: '帳號狀態異常', 
        status: dealer.status,
        message: '帳號狀態異常，請聯繫管理員。'
      });
      return;
    }

    // 登入成功，返回用戶資料（不包含密碼）
    const { password: _, ...userInfo } = dealer;
    res.status(200).json({ 
      success: true, 
      message: '登入成功',
      data: {
        username: dealer.username,
        name: dealer.name,
        company: dealer.company,
        status: dealer.status,
        role: 'dealer'
      }
    });

  } catch (error) {
    console.error('登入 API 錯誤:', error);
    res.status(500).json({ 
      success: false, 
      error: process.env.NODE_ENV === 'production' ? '伺服器內部錯誤' : error.message 
    });
  }
}