// src/pages/ChangePasswordSection.jsx
import { useState } from 'react';
import { api } from '../api';

export default function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [message, setMessage]                 = useState('');
  const [error, setError]                     = useState('');
  const [loading, setLoading]                 = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    // ✅ Ràng buộc mật khẩu mới >= 8 ký tự
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }

    setLoading(true);
    try {
      await api.patch('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setMessage('Đổi mật khẩu thành công.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <h2>Đổi mật khẩu</h2>
      {error && <div className="error">{error}</div>}
      {message && <div className="small" style={{ color: '#16a34a' }}>{message}</div>}
      <form onSubmit={handleChangePassword}>
        <div className="form-field">
          <label>Mật khẩu hiện tại</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="form-field">
          <label>Mật khẩu mới</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Đang đổi...' : 'Đổi mật khẩu'}
        </button>
      </form>
    </div>
  );
}
