import React, { useState } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "../UserContext";

function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginMsg, setLoginMsg] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);
  const LOGO_VERSION = '20251121';
  const LOGO_URL = process.env.REACT_APP_LOGO_URL || `/images/logo%20ht.png?v=${LOGO_VERSION}`;

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
      // 這裡不需要 navigate("/login")，直接留空或移除即可
      // 或者根本不需要這段 useEffect，因為 Home 就是登入頁
    }
  }, [navigate]);

  const handleLogin = async () => {
    const adminUsername = process.env.REACT_APP_ADMIN_USERNAME || "admin";
    const adminPassword = process.env.REACT_APP_ADMIN_PASSWORD || "admin123";

    if (username === adminUsername && password === adminPassword) {
      const userObj = { username: "admin", role: "admin" };
      localStorage.setItem("user", JSON.stringify(userObj));
      setUser(userObj);
      setLoginMsg("管理者登入成功！");
      setTimeout(() => navigate("/admin"), 800);
      return;
    }

    setIsLoggingIn(true);
    setLoginMsg("");

    try {
      // 使用環境變數替換硬編碼的 URL
      const AUTH_BASE_URL = process.env.REACT_APP_AUTH_BASE_URL || '';
      
      const response = await fetch(`${AUTH_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const userObj = {
          username: result.data.username,
          role: "dealer",
          status: "active",
          company: result.data.company || result.data.name
        };
        if (result.token) {
          try { localStorage.setItem('authToken', result.token); } catch {}
        }
        localStorage.setItem("user", JSON.stringify(userObj));
        setUser(userObj);
        
        // 更新用戶上線狀態
        try {
          await fetch(`${API_BASE_URL}/api/user-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              username: result.data.username, 
              action: 'login' 
            })
          });
          console.log('上線狀態更新成功');
        } catch (statusError) {
          console.error('上線狀態更新失敗:', statusError);
        }
        
        setLoginMsg("登入成功！");
        setTimeout(() => navigate("/shipping"), 800);
      } else {
        if (result.status === 'pending') {
          setLoginMsg(result.message || "您的帳號正在審核中，請等待管理員審核通過後再登入。");
        } else if (result.status === 'suspended') {
          setLoginMsg(result.message || "您的帳號已被停用，請聯繫管理員。");
        } else {
          setLoginMsg(result.error || "登入失敗");
        }
      }
    } catch (error) {
      console.error('登入錯誤:', error);
      setLoginMsg("網路錯誤，請稍後再試");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      setForgotMsg("請輸入信箱");
      return;
    }
    setIsSendingReset(true);
    setForgotMsg("");
    try {
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://hengtong.vercel.app';
      const resp = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const result = await resp.json().catch(() => ({}));
      if (resp.ok && result && result.success) {
        setForgotMsg("重設連結已寄送至您的信箱");
      } else {
        setForgotMsg(result.message || "發送失敗，請稍後再試");
      }
    } catch (e) {
      setForgotMsg("網路錯誤，請稍後再試");
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 0 }}>
      <img src={LOGO_URL} alt="logo" style={{ width: 200, height: 200, marginBottom: 16 }} onError={(e) => { e.currentTarget.src = `/images/logo2.png?v=${LOGO_VERSION}`; }} />
      <div>
        <div style={{ background: "#222", color: "#fff", padding: 24, borderRadius: 8, width: 320 }}>
          <h3>登入</h3>
          <div>
            <input
              type="text"
              id="username"
              name="username"
              placeholder="帳號"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ marginBottom: 8, width: "100%" }}
              disabled={isLoggingIn}
            />
          </div>
          <div>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="密碼"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ marginBottom: 8, width: "100%" }}
              disabled={isLoggingIn}
            />
          </div>
          <button 
            onClick={handleLogin} 
            disabled={isLoggingIn}
            style={{ width: "100%", opacity: isLoggingIn ? 0.6 : 1 }}
          >
            {isLoggingIn ? "登入中..." : "登入"}
          </button>
          
          {/* 改進的訊息顯示區域 */}
          <div style={{ 
            marginTop: 12, 
            padding: loginMsg.includes("審核中") ? 12 : 0,
            background: loginMsg.includes("審核中") ? "#fff3cd" : "transparent",
            border: loginMsg.includes("審核中") ? "1px solid #ffeaa7" : "none",
            borderRadius: loginMsg.includes("審核中") ? 6 : 0,
            color: loginMsg.includes("成功") ? "green" : 
                   loginMsg.includes("審核中") ? "#856404" : "red",
            fontSize: loginMsg.includes("審核中") ? 14 : 16,
            lineHeight: loginMsg.includes("審核中") ? 1.4 : 1
          }}>
            {loginMsg && (
              <>
                {loginMsg.includes("審核中") && (
                  <div style={{ fontWeight: "bold", marginBottom: 4 }}>📋 帳號審核中</div>
                )}
                {loginMsg}
              </>
            )}
          </div>
          
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <button onClick={() => navigate('/register')}>申請帳號</button>
            <div style={{ marginTop: 12 }}>
              <button onClick={() => setShowForgot(v => !v)} style={{ background: 'transparent', color: '#4FC3F7', border: 'none', cursor: 'pointer' }}>忘記密碼</button>
            </div>
            {showForgot && (
              <div style={{ marginTop: 12, textAlign: 'left' }}>
                <input
                  type="email"
                  placeholder="請輸入註冊信箱"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  style={{ width: '100%', marginBottom: 8 }}
                  disabled={isSendingReset}
                />
                <button
                  onClick={handleForgotPassword}
                  disabled={isSendingReset}
                  style={{ width: '100%', opacity: isSendingReset ? 0.6 : 1 }}
                >
                  {isSendingReset ? '寄送中...' : '寄送重設連結'}
                </button>
                {forgotMsg && (
                  <div style={{ marginTop: 8, color: forgotMsg.includes('已寄送') ? '#4CAF50' : '#ff6b6b' }}>{forgotMsg}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default Home;