import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
  // CORS 設置
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // 獲取所有用戶的上線狀態
    try {
      await client.connect();
      const db = client.db('hengtong');
      const collection = db.collection('user_sessions');
      
      const sessions = await collection.find({}).toArray();
      const statusMap = {};
      
      sessions.forEach(session => {
        const now = new Date();
        const lastActivity = new Date(session.lastActivity);
        const diffMinutes = (now - lastActivity) / (1000 * 60);
        
        statusMap[session.username] = {
          isOnline: diffMinutes < 5, // 5分鐘內算在線
          lastSeen: session.lastActivity,
          sessionCount: session.sessionCount || 0
        };
      });
      
      res.status(200).json({
        success: true,
        data: statusMap
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      await client.close();
    }
  }
  
  else if (req.method === 'POST') {
    // 更新用戶活動狀態
    try {
      await client.connect();
      const db = client.db('hengtong');
      const collection = db.collection('user_sessions');
      
      const { username, action } = req.body; // action: 'login', 'logout', 'activity'
      
      if (!username) {
        res.status(400).json({
          success: false,
          error: '缺少用戶名'
        });
        return;
      }
      
      const now = new Date();
      
      if (action === 'login') {
        await collection.updateOne(
          { username },
          { 
            $set: { 
              lastActivity: now,
              loginTime: now
            },
            $inc: { sessionCount: 1 }
          },
          { upsert: true }
        );
      } else if (action === 'logout') {
        await collection.updateOne(
          { username },
          { 
            $set: { 
              lastActivity: now,
              logoutTime: now
            }
          }
        );
      } else {
        // 一般活動更新
        await collection.updateOne(
          { username },
          { 
            $set: { 
              lastActivity: now
            }
          },
          { upsert: true }
        );
      }
      
      res.status(200).json({
        success: true,
        message: '狀態更新成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      await client.close();
    }
  }
  
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}