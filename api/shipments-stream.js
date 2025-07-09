import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb+srv://a85709820:zZ_7392786@cluster0.aet0edn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const options = {};
let client;
let clientPromise;

if (!global._mongoClientPromise_shipments) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise_shipments = client.connect();
}
clientPromise = global._mongoClientPromise_shipments;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  let changeStream;
  try {
    client = await clientPromise;
    const db = client.db('car-parts');
    const collection = db.collection('shipments');

    changeStream = collection.watch([
      {
        $match: {
          operationType: { $in: ['insert', 'update', 'replace'] }
        }
      }
    ]);

    const initialData = await collection.find({}).sort({ createdAt: -1 }).toArray();
    res.write(`data: ${JSON.stringify({ type: 'initial', data: initialData })}\n\n`);

    changeStream.on('change', (change) => {
      res.write(`data: ${JSON.stringify({ 
        type: 'change', 
        operationType: change.operationType,
        documentKey: change.documentKey,
        fullDocument: change.fullDocument 
      })}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);

    const cleanup = () => {
      clearInterval(heartbeat);
      if (changeStream) {
        changeStream.close();
      }
      // 不要關閉 client，因為是全域共用
    };

    req.on('close', cleanup);
    req.on('end', cleanup);

  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
}