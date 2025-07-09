import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 設置 SSE 標頭
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Access-Control-Allow-Methods': 'GET'
  });

  let client;
  let changeStream;
  let heartbeat;
  let isConnected = false;

  const cleanup = async () => {
    console.log('清理 SSE 連接資源...');
    if (heartbeat) {
      clearInterval(heartbeat);
    }
    if (changeStream) {
      try {
        await changeStream.close();
      } catch (error) {
        console.error('關閉 changeStream 錯誤:', error);
      }
    }
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error('關閉 MongoDB 連接錯誤:', error);
      }
    }
    isConnected = false;
  };

  try {
    // 連接 MongoDB
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    await client.connect();
    console.log('MongoDB 連接成功');
    
    const db = client.db('hengtong');
    const collection = db.collection('shipments');
    
    // 建立變更流
    changeStream = collection.watch([
      { $match: { operationType: { $in: ['insert', 'update', 'replace'] } } }
    ], { fullDocument: 'updateLookup' });
    
    console.log('變更流建立成功');
    
    // 發送初始數據
    const initialData = await collection.find({}).sort({ createdAt: -1 }).toArray();
    res.write(`data: ${JSON.stringify({ type: 'initial', data: initialData })}\n\n`);
    
    isConnected = true;
    
    // 監聽變更
    changeStream.on('change', (change) => {
      if (isConnected) {
        try {
          res.write(`data: ${JSON.stringify({ 
            type: 'change', 
            operationType: change.operationType, 
            documentKey: change.documentKey, 
            fullDocument: change.fullDocument 
          })}\n\n`);
        } catch (error) {
          console.error('發送變更數據錯誤:', error);
        }
      }
    });
    
    changeStream.on('error', (error) => {
      console.error('變更流錯誤:', error);
      if (isConnected) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: '數據庫連接中斷' })}\n\n`);
      }
      cleanup();
    });
    
    // 心跳機制
    heartbeat = setInterval(() => {
      if (isConnected) {
        try {
          res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
        } catch (error) {
          console.error('發送心跳錯誤:', error);
          cleanup();
        }
      }
    }, 30000);
    
    // 監聽客戶端斷開
    req.on('close', () => {
      console.log('客戶端斷開連接');
      cleanup();
    });
    
    req.on('end', () => {
      console.log('請求結束');
      cleanup();
    });
    
  } catch (error) {
    console.error('SSE 初始化錯誤:', error);
    
    // 發送錯誤訊息
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    } catch (writeError) {
      console.error('寫入錯誤訊息失敗:', writeError);
    }
    
    // 清理資源
    await cleanup();
    
    // 結束響應
    try {
      res.end();
    } catch (endError) {
      console.error('結束響應錯誤:', endError);
    }
  }
}