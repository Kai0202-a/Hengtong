import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb+srv://cow7353202th:cow7353202th@cluster0.mongodb.net/car-parts?retryWrites=true&w=majority';

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
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  let client;
  let changeStream;

  try {
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db('car-parts');
    const collection = db.collection('shipments');

    // 監聽 MongoDB 變更流
    changeStream = collection.watch([
      {
        $match: {
          operationType: { $in: ['insert', 'update', 'replace'] }
        }
      }
    ]);

    // 發送初始數據
    const initialData = await collection.find({}).sort({ createdAt: -1 }).toArray();
    res.write(`data: ${JSON.stringify({ type: 'initial', data: initialData })}\n\n`);

    // 監聽變更
    changeStream.on('change', (change) => {
      console.log('MongoDB 變更檢測到:', change.operationType);
      
      // 發送變更通知
      res.write(`data: ${JSON.stringify({ 
        type: 'change', 
        operationType: change.operationType,
        documentKey: change.documentKey,
        fullDocument: change.fullDocument 
      })}\n\n`);
    });

    // 保持連接活躍
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);

    // 清理函數
    const cleanup = () => {
      clearInterval(heartbeat);
      if (changeStream) {
        changeStream.close();
      }
      if (client) {
        client.close();
      }
    };

    // 處理連接關閉
    req.on('close', cleanup);
    req.on('end', cleanup);

  } catch (error) {
    console.error('SSE 錯誤:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
}