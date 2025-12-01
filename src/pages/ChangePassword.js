import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../UserContext';

const ChangePassword = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const AUTH_BASE_URL = process.env.REACT_APP_AUTH_BASE_URL || '';

  useEffect(() => {
    const localUser = user || JSON.parse(localStorage.getItem('user'));
    if (!localUser) {
      navigate('/home');
      return;
    }
    if (localUser.role !== 'admin' && localUser.role !== 'dealer') {
      navigate('/home');
    }
  }, [user, navigate]);

  const handleSubmit = async () => {
    setMsg('');
    if (!newPassword || newPassword.length < 6) {
      setMsg('新密碼至少 6 碼');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg('新密碼與確認密碼不一致');
      return;
    }
    setSubmitting(true);
    try {
      const localUser = user || JSON.parse(localStorage.getItem('user'));
      const payload = {
        username: localUser.username,
        currentPassword,
        newPassword
      };
      const token = localStorage.getItem('authToken');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const resp = await fetch(`${AUTH_BASE_URL}/api/change-password`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const result = await resp.json().catch(() => ({}));
      if (resp.ok && result && result.success) {
        setMsg('密碼已更新');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMsg((result && (result.message || result.error)) || `更新失敗 (HTTP ${resp.status})`);
      }
    } catch (e) {
      setMsg('網路錯誤，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 500, margin: '0 auto', background: '#23272f', minHeight: '100vh' }}>
      <div style={{ background: '#2c3e50', padding: 24, borderRadius: 12, color: '#f5f6fa', boxShadow: '0 2px 12px #0002' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#f5f6fa' }}>變更密碼</h3>
          <button onClick={() => navigate('/shipping')} style={{ padding: '8px 16px', background: '#666', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}>返回</button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <input
            type="password"
            placeholder="目前密碼"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={submitting}
            style={{ padding: '10px 12px', border: 'none', borderRadius: 6, background: '#34495e', color: '#f5f6fa' }}
          />
          <input
            type="password"
            placeholder="新密碼（至少 6 碼）"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submitting}
            style={{ padding: '10px 12px', border: 'none', borderRadius: 6, background: '#34495e', color: '#f5f6fa' }}
          />
          <input
            type="password"
            placeholder="確認新密碼"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            style={{ padding: '10px 12px', border: 'none', borderRadius: 6, background: '#34495e', color: '#f5f6fa' }}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '10px 16px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 6, cursor: submitting ? 'not-allowed' : 'pointer' }}
          >
            {submitting ? '送出中...' : '更新密碼'}
          </button>
          {msg && (
            <div style={{ marginTop: 8, color: msg.includes('已更新') ? '#4CAF50' : '#ff6b6b' }}>{msg}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;