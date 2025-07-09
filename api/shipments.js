import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'hengtong';
const COLLECTION_NAME = 'shipments';

export default async function handler(req, res) {
  // 修改 CORS headers - 允許所有 Vercel 域名
  const allowedOrigins = [
    'https://hengtong.vercel.app',
    'https://hengtong-1cac747lk-kais-projects-975b317e.vercel.app',
    /^https:\/\/hengtong.*\.vercel\.app$/
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.some(allowed => 
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // 處理 preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 檢查環境變數
  if (!MONGODB_URI) {
    console.error('MONGODB_URI 未設置');
    return res.status(500).json({ 
      success: false, 
      error: '服務器配置錯誤：資料庫連接字串未設置' 
    });
  }

  try {
    console.log('嘗試連接資料庫...');
    const { db } = await connectToDatabase();
    const collection = db.collection(COLLECTION_NAME);

    if (req.method === 'POST') {
      console.log('處理 POST 請求，請求體:', req.body);
      
      // 添加資料驗證
      const { company, partId, partName, quantity, price, amount, time } = req.body;
      
      if (!company || !partId || !partName || !quantity || !price || !amount || !time) {
        console.log('缺少必要欄位');
        return res.status(400).json({ 
          success: false, 
          error: '缺少必要欄位',
          received: req.body
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
      
      console.log('準備儲存資料:', shipmentData);
      const result = await collection.insertOne(shipmentData);
      console.log('資料儲存成功，ID:', result.insertedId);
      
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
    console.error('詳細錯誤信息:', {
      message: error.message,
      stack: error.stack,
      mongoUri: MONGODB_URI ? '已設置' : '未設置'
    });
    
    res.status(500).json({ 
      success: false,
      error: '資料庫操作失敗',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : '請檢查服務器日誌'
    });
  }
  await client.close();
}
