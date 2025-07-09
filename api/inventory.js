import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {};
let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, options);
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export default async function handler(req, res) {
  // 添加 CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  try {
    const client = await clientPromise;
    const db = client.db('hengtong');
    const collection = db.collection('inventory');
    
    const inventory = await collection.find({}).toArray();
    
    res.status(200).json({
      success: true,
      data: inventory
    });
    // 不要呼叫 client.close()
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}