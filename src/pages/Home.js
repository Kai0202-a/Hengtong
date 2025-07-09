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
  const navigate = useNavigate();
  const { setUser } = useContext(UserContext);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
      // 這裡不需要 navigate("/login")，直接留空或移除即可
      // 或者根本不需要這段 useEffect，因為 Home 就是登入頁
    }
  }, [navigate]);

  const handleLogin = async () => {
    if (username === "admin" && password === "admin123") {
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
      // 使用新的登入 API
      const response = await fetch('https://hengtong.vercel.app/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 登入成功
        const userObj = {
          username: result.data.username,
          role: "dealer",
          status: "active",
          company: result.data.company || result.data.name
        };
        localStorage.setItem("user", JSON.stringify(userObj));
        setUser(userObj);
        
        // 新增：更新用戶上線狀態
        try {
          await fetch('https://hengtong.vercel.app/api/user-status', {
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
          // 不影響登入流程，只記錄錯誤
        }
        
        setLoginMsg("登入成功！");
        setTimeout(() => navigate("/shipping"), 800);
      } else {
        // 根據不同狀態顯示不同訊息
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 0 }}>
      <img src="images/logo2.png" alt="logo" style={{ width: 200, height: 200, marginBottom: 16 }} />
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
          </div>
        </div>
      </div>
    </div>
  );
}
export default Home;