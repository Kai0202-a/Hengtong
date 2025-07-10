import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'hengtong';
const COLLECTION_NAME = 'shipments';

export default async function handler(req, res) {
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let client;
  try {
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    if (req.method === 'POST') {
      // 檢查是否為批次處理
      if (req.body.batchShipments && Array.isArray(req.body.batchShipments)) {
        // 批次處理出貨記錄
        const shipmentData = req.body.batchShipments.map(item => ({
          ...item,
          quantity: parseInt(item.quantity),
          price: parseFloat(item.price),
          amount: parseFloat(item.amount),
          createdAt: new Date()
        }));
        
        const result = await collection.insertMany(shipmentData);
        res.status(200).json({ 
          success: true, 
          message: '批次出貨資料儲存成功', 
          count: result.insertedCount 
        });
      } else {
        // 原有的單筆處理邏輯
        const { company, partId, partName, quantity, price, amount, time } = req.body;
        if (!company || !partId || !partName || !quantity || !price || !amount || !time) {
          return res.status(400).json({ success: false, error: '缺少必要欄位', received: req.body });
        }
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
        res.status(200).json({ success: true, message: '出貨資料儲存成功', id: result.insertedId, data: shipmentData });
      }
    } else if (req.method === 'GET') {
      const { company, startDate, endDate, page = 1, limit } = req.query;
      const actualLimit = limit ? parseInt(limit) : undefined; // 沒有指定時不限制
      let query = {};
      if (company) query.company = company;
      if (startDate || endDate) {
        query.time = {};
        if (startDate) query.time.$gte = startDate;
        if (endDate) query.time.$lte = endDate;
      }
      
      // 計算總記錄數
      const total = await collection.countDocuments(query);
      
      // 計算分頁
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const shipments = await collection.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(actualLimit || 0) // 0 表示不限制
        .toArray();
        
      res.status(200).json({ 
        success: true, 
        data: shipments, 
        count: shipments.length,
        total: total,  // 添加總記錄數
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit))
      });
    } else {
      res.status(405).json({ error: '不支援的請求方法' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: '資料庫操作失敗', message: error.message });
  } finally {
    if (client) await client.close();
  }
}
