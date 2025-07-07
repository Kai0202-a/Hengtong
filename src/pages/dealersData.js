// 通路商帳號資料，後期可直接轉為 JSON 匯入後端
export const dealersData = [
  {
    "id": 1,
    "username": "dealer001",
    "password": "dealer001", // 實際應用請加密
    "name": "台北經銷商測試",
    "email": "dealer001@example.com",
    "phone": "0912345678",
    "status": "active" // active, suspended, deleted
  },
  {
    "id": 2,
    "username": "dealer002",
    "password": "dealer002",
    "name": "高雄經銷商",
    "email": "dealer002@example.com",
    "phone": "0987654321",
    "status": "active"
  }
  // ...可繼續新增更多通路商
];