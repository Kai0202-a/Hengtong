export default function handler(req, res) {
  // 設定 CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://hengtong.vercel.app');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // 處理 preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 這裡寫你的 API 處理邏輯
  res.status(200).json({ message: 'API 正常運作' });
}
