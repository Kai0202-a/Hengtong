export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://hengtong.vercel.app');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 這裡寫你的 API 處理邏輯
  res.status(200).json({ message: 'API 正常運作' });
}
