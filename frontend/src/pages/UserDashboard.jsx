// src/pages/UserDashboard.jsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getStoredUser, WS_URL } from '../api';
import CrudTable from '../components/CrudTable';
import ChangePasswordSection from './ChangePasswordSection';

export default function UserDashboard() {
  const [user] = useState(() => getStoredUser());

  const [overview, setOverview] = useState({
    alerts: 0,
    tailgating: 0,
    snapshots: 0,
  });

  const [tab, setTab] = useState('overview');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [resetErr, setResetErr] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // ==========================
  // 📌 LOAD OVERVIEW
  // ==========================
  const fetchOverview = useCallback(async () => {
    try {
      const alerts = await api.get('/api/alerts?page=1&limit=100');
      const snapshots = await api.get('/api/slot-snapshots?page=1&limit=1');

      const tail = (alerts.items || []).filter((a) =>
        (a.alert_type || '').includes('TAIL')
      ).length;

      setOverview({
        alerts: alerts.total || 0,
        tailgating: tail,
        snapshots: snapshots.total || 0,
      });
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // ==========================
  // 📌 WebSocket real-time
  // ==========================
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WS connected (UserDashboard)');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // bất kỳ event nào liên quan đến alerts / snapshots đều refetch overview
        if (
          msg.type === 'ALERT_CREATED' ||
          msg.type === 'ALERT_UPDATED' ||
          msg.type === 'ALERT_DELETED' ||
          msg.type === 'ALERTS_RESET' ||
          msg.type === 'SNAPSHOT_CREATED' ||
          msg.type === 'SNAPSHOT_UPDATED' ||
          msg.type === 'SNAPSHOT_DELETED'
        ) {
          fetchOverview();
        }
      } catch (e) {
        console.error('WS message parse error:', e);
      }
    };

    ws.onerror = (e) => {
      console.error('WS error:', e);
    };

    ws.onclose = () => {
      console.log('WS closed (UserDashboard)');
    };

    return () => {
      ws.close();
    };
  }, [fetchOverview]);

  // ==========================
  // 📌 Đăng xuất
  // ==========================
  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  // ==========================
  // 📌 Nút reset cảnh báo (tương đương BTN)
  // ==========================
  async function handleResetAlerts() {
    setResetErr('');
    setResetMsg('');
    setResetLoading(true);
    try {
      await api.post('/api/alerts/reset-from-ui', {});
      setResetMsg('Đã gửi lệnh reset tới Arduino. Vui lòng chờ vài giây để cảnh báo cập nhật.');
    } catch (err) {
      setResetErr(err.message);
    } finally {
      setResetLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1 className="app-title">Smart Parking – Người dùng</h1>
          <div className="subtitle">
            Xem tổng quan + Alerts + Gate events + Slot snapshots (real-time)
          </div>
        </div>

        <div className="top-right">
          <div className="user-info">
            Xin chào, {user.username} ({user.email}) – role {user.role}
          </div>
          <button onClick={handleLogout}>Đăng xuất</button>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <div className="nav">
        <button className={tab === 'overview' ? 'primary' : ''} onClick={() => setTab('overview')}>
          Bảng tổng quan
        </button>
        <button className={tab === 'alerts' ? 'primary' : ''} onClick={() => setTab('alerts')}>
          Alerts
        </button>
        <button className={tab === 'gate' ? 'primary' : ''} onClick={() => setTab('gate')}>
          Gate events
        </button>
        <button className={tab === 'snap' ? 'primary' : ''} onClick={() => setTab('snap')}>
          Slot snapshots
        </button>
        <button className={tab === 'password' ? 'primary' : ''} onClick={() => setTab('password')}>
          Đổi mật khẩu
        </button>
      </div>

      {/* ====================== */}
      {/* TAB: OVERVIEW */}
      {/* ====================== */}
      {tab === 'overview' && (
        <div className="grid">
          <div className="card">
            <h2>Tổng quan bằng “biểu đồ”</h2>
            <div className="small">
              Minh hoạ số lượng alerts / tailgating / snapshots bằng cột đơn giản.
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'flex-end' }}>
              {[
                { label: 'Tổng alerts', value: overview.alerts, color: '#2563eb' },
                { label: 'Tailgating', value: overview.tailgating, color: '#b91c1c' },
                { label: 'Snapshots', value: overview.snapshots, color: '#16a34a' },
              ].map((b) => (
                <div key={b.label} style={{ textAlign: 'center', flex: 1 }}>
                  <div
                    style={{
                      height: Math.min(120, (b.value || 0) * 6 + 10),
                      background: b.color,
                      borderRadius: 6,
                      transition: 'height 0.2s',
                    }}
                  />
                  <div className="small" style={{ marginTop: 4 }}>
                    {b.label}: <b>{b.value}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Thông tin nhanh + Nút xử lý cảnh báo</h2>
            <div className="summary-row">
              <span className="pill blue">Tổng alerts: {overview.alerts}</span>
              <span className="pill red">Tailgating: {overview.tailgating}</span>
              <span className="pill green">Snapshots: {overview.snapshots}</span>
            </div>
            <div className="small">
              Dữ liệu lấy trực tiếp từ bảng <b>alerts</b> và <b>slot_snapshots</b>.
            </div>

            <div style={{ marginTop: 16 }}>
              <button onClick={handleResetAlerts} disabled={resetLoading}>
                {resetLoading ? 'Đang gửi lệnh reset...' : 'Đã xử lý cảnh báo (tắt còi / đóng cổng)'}
              </button>
              {resetMsg && (
                <div className="small" style={{ color: '#16a34a', marginTop: 8 }}>
                  {resetMsg}
                </div>
              )}
              {resetErr && (
                <div className="error" style={{ marginTop: 8 }}>
                  {resetErr}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: ALERTS CRUD */}
      {tab === 'alerts' && (
        <CrudTable
          title="Alerts (thêm / sửa / xóa + phân trang)"
          endpoint="/api/alerts"
          columns={[
            { key: 'id', label: 'ID', readOnly: true },
            { key: 'alert_type', label: 'Loại cảnh báo' },
            { key: 'message', label: 'Nội dung' },
            { key: 'is_handled', label: 'Đã xử lý', type: 'boolean' },
            { key: 'created_at', label: 'Thời gian', type: 'datetime', readOnly: true },
          ]}
        />
      )}

      {/* TAB: GATE EVENTS CRUD */}
      {tab === 'gate' && (
        <CrudTable
          title="Gate events (thêm / sửa / xóa + phân trang)"
          endpoint="/api/gate-events"
          columns={[
            { key: 'id', label: 'ID', readOnly: true },
            { key: 'event_type', label: 'Event type' },
            { key: 'free_slots', label: 'Free slots' },
            { key: 'gate_angle', label: 'Góc cổng' },
            { key: 'state', label: 'State' },
            { key: 'created_at', label: 'Thời gian', type: 'datetime', readOnly: true },
          ]}
        />
      )}

      {/* TAB: SLOT SNAPSHOTS CRUD */}
      {tab === 'snap' && (
        <CrudTable
          title="Slot snapshots (thêm / sửa / xóa + phân trang)"
          endpoint="/api/slot-snapshots"
          columns={[
            { key: 'id', label: 'ID', readOnly: true },
            { key: 'slot1_occupied', label: 'Slot 1 có xe', type: 'boolean' },
            { key: 'slot2_occupied', label: 'Slot 2 có xe', type: 'boolean' },
            { key: 'free_slots', label: 'Free slots' },
            { key: 'created_at', label: 'Thời gian', type: 'datetime', readOnly: true },
          ]}
        />
      )}

      {tab === 'password' && <ChangePasswordSection />}
    </div>
  );
}
