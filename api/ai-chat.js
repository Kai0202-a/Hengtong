import { MongoClient } from 'mongodb';

// MongoDB 連接配置
const uri = process.env.MONGODB_URI || 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = process.env.DB_NAME || 'hengtong';

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

// 分析用戶問題並決定需要什麼數據
function analyzeUserQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('庫存') || lowerMessage.includes('商品') || lowerMessage.includes('產品')) {
    return 'inventory';
  }
  if (lowerMessage.includes('通路商') || lowerMessage.includes('經銷商') || lowerMessage.includes('代理商')) {
    return 'dealers';
  }
  if (lowerMessage.includes('訂單') || lowerMessage.includes('出貨')) {
    return 'orders';
  }
  return 'general';
}

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
    console.log('=== AI Chat API Called ===');
    console.log('Request method:', req.method);
    console.log('Request body:', req.body);
    
    const { message } = req.body;
    
    if (!message) {
      console.log('ERROR: No message provided');
      return res.status(400).json({ error: 'Message is required' });
    }

    // 從環境變數獲取 API Key
    const apiKey = process.env.OPENAI_API_KEY;
    
    // 詳細的調試信息
    console.log('Environment variables check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- VERCEL_ENV:', process.env.VERCEL_ENV);
    console.log('- API Key exists:', !!apiKey);
    console.log('- API Key length:', apiKey ? apiKey.length : 0);
    console.log('- API Key starts with sk-:', apiKey ? apiKey.startsWith('sk-') : false);
    
    if (!apiKey) {
      console.error('CRITICAL ERROR: OPENAI_API_KEY not found in environment variables');
      console.log('Available env vars:', Object.keys(process.env).filter(key => key.includes('OPENAI')));
      return res.status(500).json({ 
        error: 'OpenAI API key not configured',
        debug: {
          env: process.env.NODE_ENV,
          vercelEnv: process.env.VERCEL_ENV,
          hasApiKey: !!apiKey
        }
      });
    }

    let client;
    let contextData = '';
    
    // 根據用戶問題獲取相關數據
    const queryType = analyzeUserQuery(message);
    
    if (queryType !== 'general') {
      client = await connectToDatabase();
      
      if (queryType === 'inventory') {
        const { inventory, products } = await getInventoryData(client);
        contextData = `\n\n當前庫存數據：\n${JSON.stringify(inventory.slice(0, 10), null, 2)}\n\n商品資料：\n${JSON.stringify(products.slice(0, 10), null, 2)}`;
      } else if (queryType === 'dealers') {
        const dealers = await getDealersData(client);
        contextData = `\n\n通路商數據：\n${JSON.stringify(dealers.map(d => ({name: d.name, company: d.company, status: d.status})), null, 2)}`;
      }
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
            content: `你是恆通公司的AI助手，專門協助處理公司相關業務問題。請用繁體中文回答。\n\n你可以協助：\n1. 庫存查詢和管理\n2. 商品信息查詢\n3. 通路商管理\n4. 數據分析\n\n${contextData ? '以下是相關的實時數據，請根據這些數據回答用戶問題：' + contextData : ''}`
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
    
    // 記得關閉數據庫連接
    if (client) {
      await client.close();
    }
    
  } catch (error) {
    console.error('=== AI Chat Error ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      type: error.constructor.name
    });
  }
}