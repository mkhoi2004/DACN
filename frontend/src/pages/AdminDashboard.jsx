// src/pages/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredUser } from '../api';
import CrudTable from '../components/CrudTable';
import ChangePasswordSection from './ChangePasswordSection';

export default function AdminDashboard() {
  const [user] = useState(() => getStoredUser());
  const [tab, setTab] = useState('logins'); // 'logins' | 'gmail' | 'password'
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (user.role !== 'ADMIN') {
      navigate('/user');
    }
  }, [user, navigate]);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  if (!user || user.role !== 'ADMIN') return null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1 className="app-title">Smart Parking – Quản lý (ADMIN)</h1>
          <div className="subtitle">
            Xem và quản lý lịch sử đăng nhập + lịch sử gửi email cảnh báo.
          </div>
        </div>
        <div className="top-right">
          <div className="user-info">
            Xin chào, {user.username} ({user.email}) – role {user.role}
          </div>
          <button onClick={handleLogout}>Đăng xuất</button>
        </div>
      </header>

      {/* NAV */}
      <div className="nav">
        <button
          className={tab === 'logins' ? 'primary' : ''}
          onClick={() => setTab('logins')}
        >
          Lịch sử đăng nhập
        </button>
        <button
          className={tab === 'gmail' ? 'primary' : ''}
          onClick={() => setTab('gmail')}
        >
          Lịch sử gửi Gmail
        </button>
        <button
          className={tab === 'password' ? 'primary' : ''}
          onClick={() => setTab('password')}
        >
          Đổi mật khẩu
        </button>
      </div>

      {/* TAB: Lịch sử đăng nhập */}
      {tab === 'logins' && (
        <CrudTable
          title="Lịch sử đăng nhập (ADMIN)"
          endpoint="/api/admin/login-history"
          columns={[
            { key: 'id', label: 'ID', readOnly: true },
            { key: 'username', label: 'Username', readOnly: true },
            { key: 'email', label: 'Email', readOnly: true },
            { key: 'success', label: 'Thành công', type: 'boolean' },
            { key: 'ip_address', label: 'IP' },
            { key: 'user_agent', label: 'User Agent' },
            { key: 'login_time', label: 'Thời gian', type: 'datetime', readOnly: true },
          ]}
        />
      )}

      {/* TAB: Gmail logs */}
      {tab === 'gmail' && (
        <CrudTable
          title="Lịch sử gửi email cảnh báo (gmail_logs)"
          endpoint="/api/gmail-logs"
          columns={[
            { key: 'id', label: 'ID', readOnly: true },
            { key: 'alert_id', label: 'Alert ID', readOnly: true },
            { key: 'message_id', label: 'Message ID', readOnly: true },
            { key: 'to_email', label: 'Gửi tới', readOnly: true },
            { key: 'subject', label: 'Tiêu đề', readOnly: true },
            { key: 'body', label: 'Nội dung', readOnly: true },
            { key: 'success', label: 'Thành công', type: 'boolean', readOnly: true },
            { key: 'error', label: 'Lỗi', readOnly: true },
            { key: 'created_at', label: 'Thời gian', type: 'datetime', readOnly: true },
          ]}
        />
      )}

      {/* TAB: Đổi mật khẩu */}
      {tab === 'password' && <ChangePasswordSection />}
    </div>
  );
}
