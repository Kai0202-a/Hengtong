import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

const uri = 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

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

// 輸入驗證函數
function validateDealerData(data) {
  const { username, password, name, company, email, phone } = data;
  
  if (!username || username.length < 3) {
    return '用戶名至少需要3個字符';
  }
  
  if (!password || password.length < 6) {
    return '密碼至少需要6個字符';
  }
  
  if (!name || name.trim().length === 0) {
    return '姓名不能為空';
  }
  
  if (!company || company.trim().length === 0) {
    return '公司名稱不能為空';
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return '請輸入有效的電子郵件地址';
  }
  
  const phoneRegex = /^[0-9-+()\s]+$/;
  if (!phone || !phoneRegex.test(phone)) {
    return '請輸入有效的電話號碼';
  }
  
  return null;
}

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

  let client;
  try {
    client = await connectToDatabase();
    const db = client.db('hengtong');
    const collection = db.collection('dealers');

    if (req.method === 'GET') {
      // 获取所有通路商数据
      const dealers = await collection.find({}).toArray();
      res.status(200).json({ success: true, data: dealers });
    }
    else if (req.method === 'POST') {
      // 新增通路商申请
      const { username, password, name, company, taxId, address, email, phone } = req.body;
      
      // 輸入驗證
      const validationError = validateDealerData(req.body);
      if (validationError) {
        res.status(400).json({ success: false, error: validationError });
        return;
      }
      
      // 檢查帳號是否已存在
      const existingDealer = await collection.findOne({ 
        $or: [
          { username: username.trim().toLowerCase() },
          { email: email.trim().toLowerCase() }
        ]
      });
      
      if (existingDealer) {
        const conflictField = existingDealer.username === username.trim().toLowerCase() ? '帳號' : '電子郵件';
        res.status(400).json({ success: false, error: `${conflictField}已存在，請更換` });
        return;
      }
      
      // 密碼加密
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      const newDealer = {
        username: username.trim().toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
        company: company.trim(),
        taxId: taxId?.trim() || '',
        address: address?.trim() || '',
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        id: Date.now()
      };
      
      const result = await collection.insertOne(newDealer);
      
      // 不返回密碼
      const { password: _, ...dealerResponse } = newDealer;
      res.status(201).json({ 
        success: true, 
        message: '申請成功，請等待審核', 
        data: dealerResponse 
      });
    }
    else if (req.method === 'PUT') {
      // 更新通路商狀態
      const { id, status } = req.body;
      
      if (!id || !status) {
        res.status(400).json({ success: false, error: '缺少必要參數' });
        return;
      }
      
      // 驗證狀態值
      const validStatuses = ['pending', 'active', 'suspended'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, error: '無效的狀態值' });
        return;
      }
      
      // 驗證 ObjectId 格式
      if (!ObjectId.isValid(id)) {
        res.status(400).json({ success: false, error: '無效的 ID 格式' });
        return;
      }
      
      const result = await collection.updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: { 
            status: status, 
            updatedAt: new Date() 
          } 
        }
      );
      
      if (result.matchedCount === 0) {
        res.status(404).json({ success: false, error: '找不到該通路商' });
        return;
      }
      
      res.status(200).json({ success: true, message: '狀態更新成功' });
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
  // 注意：不要在這裡關閉連線，讓連線池管理
}