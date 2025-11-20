import { MongoClient } from 'mongodb';

// 使用環境變數替換硬編碼的連線字串
const uri = process.env.MONGODB_URI || 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = process.env.DB_NAME || 'hengtong';
const COLLECTION_NAME = 'shipments';

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
          cost: parseFloat(item.cost || 0),  // 加入成本欄位處理
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
        // 在第65行附近，修改單筆處理邏輯
        const { company, partId, partName, quantity, price, amount, time } = req.body;
        if (!company || !partId || !partName || !quantity || !price || !amount || !time) {
          return res.status(400).json({ success: false, error: '缺少必要欄位', received: req.body });
        }
        
        // 加入金額驗證
        const calculatedAmount = parseInt(quantity) * parseFloat(price);
        if (Math.abs(parseFloat(amount) - calculatedAmount) > 0.01) {
          console.warn(`金額計算不符：傳入 ${amount}，計算值 ${calculatedAmount}`);
          // 可以選擇使用計算值覆蓋傳入值
          // amount = calculatedAmount;
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
      const { company, startDate, endDate, page = 1, limit, summary, month, groupBy, startMonth, endMonth } = req.query;
      const actualLimit = limit ? parseInt(limit) : undefined; // 沒有指定時不限制
      let query = {};
      if (company) query.company = company;
      if (startDate || endDate) {
        query.time = {};
        if (startDate) query.time.$gte = startDate;
        if (endDate) query.time.$lte = endDate;
      }

      if (summary === 'true') {
        let match = {};
        if (company) match.company = company;
        if (month) {
          const [y, m] = String(month).split('-');
          const start = new Date(parseInt(y), parseInt(m) - 1, 1);
          const end = new Date(parseInt(y), parseInt(m), 1);
          match.createdAt = { $gte: start, $lt: end };
        } else if (startMonth || endMonth) {
          const [sy, sm] = startMonth ? String(startMonth).split('-') : [];
          const [ey, em] = endMonth ? String(endMonth).split('-') : [];
          const sDate = startMonth ? new Date(parseInt(sy), parseInt(sm) - 1, 1) : undefined;
          const eDate = endMonth ? new Date(parseInt(ey), parseInt(em), 1) : undefined;
          if (sDate && eDate) match.createdAt = { $gte: sDate, $lt: eDate };
          else if (sDate) match.createdAt = { $gte: sDate };
          else if (eDate) match.createdAt = { $lt: eDate };
        } else if (startDate || endDate) {
          const start = startDate ? new Date(startDate) : undefined;
          const end = endDate ? new Date(endDate) : undefined;
          if (start && end) match.createdAt = { $gte: start, $lte: end };
          else if (start) match.createdAt = { $gte: start };
          else if (end) match.createdAt = { $lte: end };
        }
        if (groupBy === 'company' || groupBy === 'month') {
          const proj = {
            company: 1,
            quantity: 1,
            amount: 1,
            cost: 1,
            createdAt: 1,
            monthKey: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
          };
          const groupField = groupBy === 'company' ? '$company' : '$monthKey';
          const pipeline = [
            { $match: match },
            { $project: proj },
            { $group: { _id: groupField, totalQuantity: { $sum: { $ifNull: [ '$quantity', 0 ] } }, totalAmount: { $sum: { $ifNull: [ '$amount', 0 ] } }, totalCost: { $sum: { $ifNull: [ '$cost', 0 ] } } } },
            { $sort: { _id: 1 } }
          ];
          const groups = await collection.aggregate(pipeline).toArray();
          const totalsPipeline = [
            { $match: match },
            { $group: { _id: null, totalQuantity: { $sum: { $ifNull: [ '$quantity', 0 ] } }, totalAmount: { $sum: { $ifNull: [ '$amount', 0 ] } }, totalCost: { $sum: { $ifNull: [ '$cost', 0 ] } } } }
          ];
          const totalsAgg = await collection.aggregate(totalsPipeline).toArray();
          const totals = totalsAgg[0] || { totalQuantity: 0, totalAmount: 0, totalCost: 0 };
          res.status(200).json({ success: true, data: { groups, totalQuantity: totals.totalQuantity, totalAmount: totals.totalAmount, totalCost: totals.totalCost, groupBy } });
          return;
        } else {
          const pipeline = [
            { $match: match },
            { $facet: {
              items: [
                { $sort: { createdAt: -1 } },
                { $project: { company: 1, partName: 1, quantity: 1, amount: 1, price: 1, cost: 1, time: 1, createdAt: 1 } }
              ],
              totals: [
                { $group: { _id: null, totalQuantity: { $sum: { $ifNull: [ '$quantity', 0 ] } }, totalAmount: { $sum: { $ifNull: [ '$amount', 0 ] } }, totalCost: { $sum: { $ifNull: [ '$cost', 0 ] } } } }
              ]
            } }
          ];
          const resultAgg = await collection.aggregate(pipeline).toArray();
          const facet = resultAgg[0] || { items: [], totals: [] };
          const totals = (facet.totals[0]) || { totalQuantity: 0, totalAmount: 0, totalCost: 0 };
          res.status(200).json({ success: true, data: { company: company || null, month: month || null, items: facet.items, totalQuantity: totals.totalQuantity, totalAmount: totals.totalAmount, totalCost: totals.totalCost } });
          return;
        }
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
