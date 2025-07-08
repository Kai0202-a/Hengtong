import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../UserContext";

function Pending() {
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);
  const [userInfo, setUserInfo] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "dealer") {
      navigate("/");
      return;
    }
    setUserInfo(user);
    
    // 每30秒檢查一次審核狀態
    const interval = setInterval(checkApprovalStatus, 30000);
    return () => clearInterval(interval);
  }, [navigate]);

  const checkApprovalStatus = async () => {
    try {
      setIsChecking(true);
      const user = JSON.parse(localStorage.getItem("user"));
      if (!user) return;
      
      const response = await fetch('https://hengtong.vercel.app/api/dealers');
      const result = await response.json();
      
      if (result.success) {
        const dealer = result.data.find(d => d.username === user.username);
        if (dealer && dealer.status === 'active') {
          // 帳號已被審核通過
          const updatedUser = { ...user, status: 'active' };
          localStorage.setItem("user", JSON.stringify(updatedUser));
          setUser(updatedUser);
          alert('您的帳號已審核通過！即將跳轉到系統...');
          setTimeout(() => navigate("/shipping"), 1000);
        } else if (dealer && dealer.status === 'suspended') {
          // 帳號被拒絕
          alert('很抱歉，您的帳號申請未通過審核');
          handleLogout();
        }
      }
    } catch (error) {
      console.error('檢查審核狀態失敗:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  const handleManualCheck = () => {
    checkApprovalStatus();
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f5f5f5',
      padding: 20
    }}>
      <img src="images/logo2.png" alt="logo" style={{ width: 200, height: 200, marginBottom: 32 }} />
      
      <div style={{
        background: '#fff',
        padding: 40,
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: 500,
        width: '100%'
      }}>
        <div style={{
          fontSize: 24,
          fontWeight: 'bold',
          color: '#333',
          marginBottom: 16
        }}>
          帳號審核中
        </div>
        
        <div style={{
          fontSize: 16,
          color: '#666',
          marginBottom: 24,
          lineHeight: 1.6
        }}>
          您好，{userInfo?.company || userInfo?.username}！<br/>
          您的帳號申請已提交，目前正在審核中。<br/>
          請耐心等待管理員審核，審核通過後即可使用系統功能。
        </div>
        
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
          fontSize: 14,
          color: '#856404'
        }}>
          <strong>📋 審核狀態：</strong>待審核<br/>
          <strong>⏰ 預計時間：</strong>1-2個工作天<br/>
          <strong>🔄 自動檢查：</strong>每30秒檢查一次
        </div>
        
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={handleManualCheck}
            disabled={isChecking}
            style={{
              padding: '12px 24px',
              fontSize: 16,
              background: isChecking ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: isChecking ? 'not-allowed' : 'pointer',
              opacity: isChecking ? 0.6 : 1
            }}
          >
            {isChecking ? '檢查中...' : '手動檢查狀態'}
          </button>
          
          <button
            onClick={handleLogout}
            style={{
              padding: '12px 24px',
              fontSize: 16,
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            登出
          </button>
        </div>
        
        <div style={{
          marginTop: 24,
          fontSize: 12,
          color: '#999'
        }}>
          如有疑問，請聯繫系統管理員
        </div>
      </div>
    </div>
  );
}

export default Pending;