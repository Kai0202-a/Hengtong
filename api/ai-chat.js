import { MongoClient } from 'mongodb';

// MongoDB 連接配置
const uri = process.env.MONGODB_URI || 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = process.env.DB_NAME || 'hengtong';

// OpenAI API 金鑰配置
const apiKey = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';

// 數據庫連接函數
async function connectToDatabase() {
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
// 在 getDealerInventoryData 函數中增強邏輯
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
  
  return {
    dealer,
    inventory,
    products,
    stats: {
      totalProducts,
      productsWithStock,
      productsWithoutStock
    }
  };
}

// 分析用戶問題並決定需要什麼數據
// 修改 analyzeUserQuery 函數以支援帳單查詢
function analyzeUserQuery(message) {
  const lowerMessage = message.toLowerCase();
  
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
    if (billingAnalysis.isBillingQuery || queryAnalysis.type === 'billing') {
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
        contextData = `\n\n${dealerData.dealer.name} 的店家庫存數據：\n${JSON.stringify(dealerData.inventory, null, 2)}\n\n商品資料：\n${JSON.stringify(dealerData.products.slice(0, 10), null, 2)}`;
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
            content: `你是恆通公司的AI助手，專門協助處理公司相關業務問題。請用繁體中文回答。\n\n你可以協助：\n1. 庫存查詢和管理（包括總庫存和各店家庫存）\n2. 商品信息查詢\n3. 通路商管理\n4. 數據分析\n\n重要提醒：\n- 當用戶詢問特定通路商（如諾林國際）的庫存時，請回答該店家的實際在店庫存\n- 當用戶詢問總庫存時，請回答雲端總庫存\n- 請明確區分這兩種庫存類型\n\n${contextData ? '以下是相關的實時數據，請根據這些數據回答用戶問題：' + contextData : ''}`
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
