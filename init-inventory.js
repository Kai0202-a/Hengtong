import { partsData } from './src/pages/partsData.js';

async function initializeInventory() {
  try {
    const response = await fetch('https://hengtong.vercel.app/api/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ partsData })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ 庫存數據初始化成功:', result.message);
      console.log('📦 插入項目數量:', result.insertedCount);
    } else {
      console.error('❌ 初始化失敗:', result.error);
    }
  } catch (error) {
    console.error('❌ 初始化過程出錯:', error);
  }
}

// 執行初始化
initializeInventory();