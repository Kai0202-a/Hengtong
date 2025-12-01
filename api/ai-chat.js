import { MongoClient } from 'mongodb';

// MongoDB 連接配置（僅環境變數）
const uri = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || process.env.MONGODB_DB || 'hengtong';

// OpenAI API 金鑰配置
const apiKey = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';

// 數據庫連接函數
async function connectToDatabase() {
  if (!uri) throw new Error('MONGODB_URI not configured');
  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

// 獲取庫存數據
async function getInventoryData(client) {
  const db = client.db(DB_NAME);
  const inventory = await db.collection('inventory').find({}).toArray();
  const products = await db.collection('products').find({}).toArray();
  return { inventory, products };
}

// 獲取通路商數據
async function getDealersData(client) {
  const db = client.db(DB_NAME);
  const dealers = await db.collection('dealers').find({}).toArray();
  return dealers;
}

// 獲取特定通路商的庫存數據
async function getDealerInventoryData(client, dealerName) {
  const db = client.db(DB_NAME);
  
  // 先查找通路商資料
  const dealer = await db.collection('dealers').findOne({
    $or: [
      { name: { $regex: dealerName, $options: 'i' } },
      { company: { $regex: dealerName, $options: 'i' } },
      { username: { $regex: dealerName, $options: 'i' } }
    ]
  });
  
  if (!dealer) {
    return null;
  }
  
  // 查詢該通路商的庫存
  const dealerInventory = await db.collection('dealer_inventory').findOne({
    dealerUsername: dealer.username
  });
  
  // 獲取所有商品資料
  const products = await db.collection('products').find({}).toArray();
  
  // 統計庫存信息
  const inventory = dealerInventory?.inventory || {};
  const totalProducts = products.length;
  const productsWithStock = Object.keys(inventory).filter(id => inventory[id] > 0).length;
  const productsWithoutStock = totalProducts - productsWithStock;
  
  // 新增：庫存異常檢測
  const stockValues = Object.values(inventory).filter(stock => stock > 0);
  const uniqueStockValues = [...new Set(stockValues)];
  const isUniformStock = uniqueStockValues.length === 1 && stockValues.length > 0;
  const averageStock = stockValues.length > 0 ? stockValues.reduce((a, b) => a + b, 0) / stockValues.length : 0;
  
  // 檢查商品ID連續性
  const productIds = products.map(p => parseInt(p.id)).sort((a, b) => a - b);
  const inventoryIds = Object.keys(inventory).map(id => parseInt(id)).sort((a, b) => a - b);
  const missingIds = productIds.filter(id => !inventoryIds.includes(id));
  
  // 庫存分析報告
  const analysis = {
    isUniformStock,
    uniformValue: isUniformStock ? uniqueStockValues[0] : null,
    averageStock: Math.round(averageStock * 100) / 100,
    stockDistribution: uniqueStockValues,
    missingProductCount: missingIds.length,
    missingProductIds: missingIds,
    suspiciousPatterns: [],
    recommendations: []
  };
  
  // 異常模式檢測
  if (isUniformStock) {
    analysis.suspiciousPatterns.push('所有商品庫存數量完全相同');
    analysis.recommendations.push('檢查是否為批次設定或系統預設值');
  }
  
  if (missingIds.length > totalProducts * 0.3) {
    analysis.suspiciousPatterns.push('超過30%的商品沒有庫存記錄');
    analysis.recommendations.push('檢查商品同步機制和進貨記錄');
  }
  
  if (stockValues.length > 0 && Math.max(...stockValues) === Math.min(...stockValues)) {
    analysis.suspiciousPatterns.push('庫存數量缺乏變化，可能非實際銷售結果');
    analysis.recommendations.push('確認庫存更新機制是否正常運作');
  }
  
  return {
    dealer,
    inventory,
    products,
    stats: {
      totalProducts,
      productsWithStock,
      productsWithoutStock
    },
    analysis
  };
}

// 分析用戶問題並決定需要什麼數據
// 修改 analyzeUserQuery 函數以支援帳單查詢和數據庫概覽
function analyzeUserQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  // 檢查是否為數據庫概覽查詢
  const dbOverviewKeywords = ['數據庫', '資料庫', '集合', '概覽', '結構', '所有數據', '完整數據'];
  const hasDbOverviewKeyword = dbOverviewKeywords.some(keyword => 
    lowerMessage.includes(keyword)
  );
  
  if (hasDbOverviewKeyword) {
    return { type: 'database_overview' };
  }
  
  // 檢查特定集合查詢
  const collectionKeywords = {
    'dealers': ['通路商資料', '經銷商資料'],
    'dealer_inventory': ['店家庫存資料', '通路商庫存資料'],
    'inventory': ['總庫存資料', '雲端庫存資料'],
    'products': ['商品資料', '產品資料', '零件資料'],
    'shipments': ['出貨資料', '訂單資料', '交易資料'],
    'user_sessions': ['用戶資料', '會話資料', '登入資料']
  };
  
  for (const [collection, keywords] of Object.entries(collectionKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      return { type: 'collection_query', collection };
    }
  }
  
  // 檢查是否為帳單查詢
  const billingKeywords = ['帳單', '出貨', '月份', '營收', '銷售'];
  const hasBillingKeyword = billingKeywords.some(keyword => 
    lowerMessage.includes(keyword)
  );
  
  if (hasBillingKeyword) {
    return { type: 'billing' };
  }
  
  // 檢查是否詢問特定通路商的庫存
  const dealerKeywords = ['諾林國際', '諾林', '國際', '店家', '通路商'];
  const inventoryKeywords = ['庫存', '商品', '產品', '零件'];
  
  const hasDealerKeyword = dealerKeywords.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );
  const hasInventoryKeyword = inventoryKeywords.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );
  
  if (hasDealerKeyword && hasInventoryKeyword) {
    // 提取通路商名稱
    const dealerName = extractDealerName(message);
    return { type: 'dealer_inventory', dealerName };
  }
  
  if (lowerMessage.includes('庫存') || lowerMessage.includes('商品') || lowerMessage.includes('產品')) {
    return { type: 'inventory' };
  }
  if (lowerMessage.includes('通路商') || lowerMessage.includes('經銷商') || lowerMessage.includes('代理商')) {
    return { type: 'dealers' };
  }
  if (lowerMessage.includes('訂單') || lowerMessage.includes('出貨')) {
    return { type: 'orders' };
  }
  return { type: 'general' };
}

// 提取通路商名稱的函數
function extractDealerName(message) {
  // 常見的通路商名稱模式
  const patterns = [
    /諾林國際/,
    /諾林/,
    /(\w+)國際/,
    /(\w+)公司/,
    /(\w+)企業/
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

// 新增：獲取帳單數據的函數
async function getBillingData(db, company = null, month = null, year = null) {
  try {
    const shipmentsCollection = db.collection('shipments');
    let query = {};
    
    // 如果指定公司
    if (company) {
      query.company = new RegExp(company, 'i'); // 不區分大小寫搜尋
    }
    
    // 如果指定月份和年份
    if (year && month) {
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
      query.time = {
        $gte: startDate,
        $lte: endDate
      };
    } else if (year) {
      // 只指定年份
      query.time = {
        $gte: `${year}-01-01`,
        $lte: `${year}-12-31`
      };
    }
    
    const shipments = await shipmentsCollection.find(query)
      .sort({ time: -1 })
      .limit(100) // 限制返回數量
      .toArray();
    
    // 按公司和月份分組統計
    const billingData = {};
    shipments.forEach(shipment => {
      const date = new Date(shipment.time);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const company = shipment.company;
      
      if (!billingData[company]) {
        billingData[company] = {};
      }
      if (!billingData[company][monthKey]) {
        billingData[company][monthKey] = {
          items: [],
          totalQuantity: 0,
          totalAmount: 0,
          itemCount: 0
        };
      }
      
      billingData[company][monthKey].items.push({
        partName: shipment.partName,
        quantity: shipment.quantity,
        price: shipment.price,
        amount: shipment.amount,
        time: shipment.time
      });
      billingData[company][monthKey].totalQuantity += shipment.quantity;
      billingData[company][monthKey].totalAmount += shipment.amount;
      billingData[company][monthKey].itemCount += 1;
    });
    
    return { shipments, billingData };
  } catch (error) {
    console.error('獲取帳單數據失敗:', error);
    return { shipments: [], billingData: {} };
  }
}

// 新增：分析帳單查詢類型
function analyzeBillingQuery(userMessage) {
  const message = userMessage.toLowerCase();
  
  // 提取月份
  const monthMatch = message.match(/(\d{1,2})月|([一二三四五六七八九十]+)月/);
  let month = null;
  if (monthMatch) {
    if (monthMatch[1]) {
      month = parseInt(monthMatch[1]);
    } else if (monthMatch[2]) {
      // 中文數字轉換
      const chineseNumbers = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
        '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12
      };
      month = chineseNumbers[monthMatch[2]];
    }
  }
  
  // 提取年份
  const yearMatch = message.match(/(\d{4})年?/);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
  
  // 提取公司名稱
  let company = null;
  const companyKeywords = ['諾林', '國際', '恆通', '公司'];
  for (const keyword of companyKeywords) {
    if (message.includes(keyword)) {
      company = keyword;
      break;
    }
  }
  
  return {
    isBillingQuery: message.includes('帳單') || message.includes('出貨') || message.includes('月份'),
    month,
    year,
    company
  };
}

// 修改主要處理函數
export default async function handler(req, res) {
  // 設定 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '訊息不能為空' });
    }
    
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(DB_NAME);
    
    // 分析用戶查詢類型
    const queryAnalysis = analyzeUserQuery(message);
    const billingAnalysis = analyzeBillingQuery(message);
    
    let contextData = '';
    
    // 根據查詢類型獲取相關數據
    if (queryAnalysis.type === 'database_overview') {
      const overview = await getDatabaseOverview(client);
      contextData = `\n\n完整數據庫概覽：\n${JSON.stringify(overview, null, 2)}`;
    } else if (queryAnalysis.type === 'collection_query') {
      const collectionData = await getCollectionData(client, queryAnalysis.collection);
      if (collectionData) {
        contextData = `\n\n${queryAnalysis.collection} 集合數據（共 ${collectionData.documentCount} 筆，顯示前 20 筆）：\n${JSON.stringify(collectionData, null, 2)}`;
      } else {
        contextData = `\n\n無法獲取 ${queryAnalysis.collection} 集合數據。`;
      }
    } else if (billingAnalysis.isBillingQuery || queryAnalysis.type === 'billing') {
      const { shipments, billingData } = await getBillingData(
        db, 
        billingAnalysis.company, 
        billingAnalysis.month, 
        billingAnalysis.year
      );
      
      if (Object.keys(billingData).length > 0) {
        contextData = `帳單數據：\n${JSON.stringify(billingData, null, 2)}\n\n最近出貨記錄：\n${JSON.stringify(shipments.slice(0, 10), null, 2)}`;
      } else {
        contextData = '未找到符合條件的帳單數據。';
      }
    } else if (queryAnalysis.type === 'dealer_inventory') {
      const dealerData = await getDealerInventoryData(client, queryAnalysis.dealerName);
      if (dealerData) {
        contextData = `\n\n=== ${dealerData.dealer.name} 庫存分析報告 ===\n\n` +
          `基本統計：\n` +
          `- 總商品數：${dealerData.stats.totalProducts}\n` +
          `- 有庫存商品：${dealerData.stats.productsWithStock}\n` +
          `- 無庫存商品：${dealerData.stats.productsWithoutStock}\n\n` +
          `異常檢測結果：\n` +
          `- 庫存統一性：${dealerData.analysis.isUniformStock ? '是（異常）' : '否（正常）'}\n` +
          `- 平均庫存：${dealerData.analysis.averageStock}\n` +
          `- 庫存分布：${JSON.stringify(dealerData.analysis.stockDistribution)}\n` +
          `- 缺失商品數：${dealerData.analysis.missingProductCount}\n\n` +
          `發現的異常模式：\n${dealerData.analysis.suspiciousPatterns.map(p => '- ' + p).join('\n')}\n\n` +
          `建議措施：\n${dealerData.analysis.recommendations.map(r => '- ' + r).join('\n')}\n\n` +
          `詳細庫存數據：\n${JSON.stringify(dealerData.inventory, null, 2)}`;
      } else {
        contextData = `\n\n未找到 "${queryAnalysis.dealerName}" 的店家資料。`;
      }
    } else if (queryAnalysis.type === 'inventory') {
      const { inventory, products } = await getInventoryData(client);
      contextData = `\n\n雲端總庫存數據：\n${JSON.stringify(inventory.slice(0, 10), null, 2)}\n\n商品資料：\n${JSON.stringify(products.slice(0, 10), null, 2)}`;
    } else if (queryAnalysis.type === 'dealers') {
      const dealers = await getDealersData(client);
      contextData = `\n\n通路商數據：\n${JSON.stringify(dealers.map(d => ({name: d.name, company: d.company, status: d.status})), null, 2)}`;
    }
    
    console.log('Calling OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `你是恆通公司的專業AI助手，具備深度數據分析能力。請用繁體中文回答。\n\n你的核心能力：\n1. 庫存異常檢測和分析\n2. 商品數據深度洞察\n3. 業務問題診斷和建議\n4. 數據趨勢分析\n\n分析規則：\n- 當發現庫存數據異常時，必須主動指出問題\n- 如果所有商品庫存數量相同，這通常表示系統設定問題\n- 如果商品ID不連續，需要分析缺失原因\n- 提供具體的改善建議和後續行動方案\n\n數據庫集合說明：\n- dealers: 通路商基本資料\n- dealer_inventory: 各通路商庫存數據\n- inventory: 公司總庫存\n- products: 商品基本資料\n- shipments: 出貨交易記錄\n\n重要：當分析庫存數據時，請執行以下檢查：\n1. 檢查庫存數量是否過於統一\n2. 分析商品ID的連續性\n3. 計算庫存分布和異常值\n4. 提供業務層面的解釋和建議\n\n${contextData ? '以下是相關的實時數據，請進行深度分析並提供專業見解：' + contextData : ''}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    console.log('OpenAI response status:', response.status);
    console.log('OpenAI response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error details:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenAI response data:', data);
    
    const aiMessage = data.choices[0]?.message?.content || '抱歉，我無法處理您的請求。';

    console.log('AI response sent successfully');
    res.status(200).json({ message: aiMessage });
    
    await client.close();
  } catch (error) {
    console.error('AI 聊天處理失敗:', error);
    res.status(500).json({ error: '處理請求時發生錯誤' });
  }
}

// 新增：獲取數據庫概覽的函數
async function getDatabaseOverview(client) {
  const db = client.db(DB_NAME);
  
  try {
    // 獲取所有集合的統計信息
    const collections = await db.listCollections().toArray();
    const overview = {};
    
    for (const collection of collections) {
      const collectionName = collection.name;
      const coll = db.collection(collectionName);
      
      // 獲取文檔數量
      const count = await coll.countDocuments();
      
      // 獲取樣本數據（前3筆）
      const samples = await coll.find({}).limit(3).toArray();
      
      // 獲取集合統計
      const stats = await coll.stats().catch(() => null);
      
      overview[collectionName] = {
        documentCount: count,
        sampleData: samples,
        storageSize: stats?.storageSize || 0,
        avgDocumentSize: stats?.avgObjSize || 0,
        description: getCollectionDescription(collectionName)
      };
    }
    
    return overview;
  } catch (error) {
    console.error('獲取數據庫概覽失敗:', error);
    return {};
  }
}

// 新增：獲取集合描述的函數
function getCollectionDescription(collectionName) {
  const descriptions = {
    'dealers': '通路商基本資料，包含公司名稱、聯絡資訊等',
    'dealer_inventory': '各通路商的庫存數據，記錄每個商品的庫存數量',
    'inventory': '公司總庫存數據，中央倉庫的商品庫存',
    'products': '商品基本資料，包含商品名稱、規格、價格等',
    'shipments': '出貨交易記錄，包含訂單、出貨時間、數量等',
    'user_sessions': '用戶會話管理，記錄登入狀態和會話資訊',
    'hengtong': '系統設定和其他相關數據',
    'parts': '零件資料，商品的詳細零件信息'
  };
  
  return descriptions[collectionName] || '未知集合類型';
}

// 新增：獲取特定集合數據的函數
async function getCollectionData(client, collectionName) {
  const db = client.db(DB_NAME);
  
  try {
    const collection = db.collection(collectionName);
    const data = await collection.find({}).limit(20).toArray();
    const count = await collection.countDocuments();
    const stats = await collection.stats().catch(() => null);
    
    return {
      collectionName,
      documentCount: count,
      data,
      storageSize: stats?.storageSize || 0,
      avgDocumentSize: stats?.avgObjSize || 0,
      description: getCollectionDescription(collectionName)
    };
  } catch (error) {
    console.error(`獲取集合 ${collectionName} 數據失敗:`, error);
    return null;
  }
}
