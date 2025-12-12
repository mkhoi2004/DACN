// src/components/CrudTable.jsx
import { useEffect, useState, useCallback } from 'react';
import { api, WS_URL } from '../api';

function getEntityKey(endpoint) {
  if (endpoint.includes('alerts')) return 'ALERT';
  if (endpoint.includes('gate-events')) return 'GATE_EVENT';
  if (endpoint.includes('slot-snapshots')) return 'SNAPSHOT';
  if (endpoint.includes('login-history')) return 'LOGIN_HISTORY';
  return null;
}

export default function CrudTable({ title, endpoint, columns }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const entityKey = getEntityKey(endpoint);

  // ✅ KHÔNG phụ thuộc vào `page` nữa
  const fetchData = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      setError('');
      try {
        const data = await api.get(`${endpoint}?page=${pageToLoad}&limit=${limit}`);
        setItems(data.items || []);
        setTotal(data.total || 0);
        setPage(data.page || pageToLoad);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [endpoint, limit]
  );

  // chỉ load lần đầu hoặc khi endpoint/limit đổi
  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  // WebSocket: khi có thay đổi thì reload trang hiện tại
  useEffect(() => {
    if (!entityKey) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WS connected (CrudTable)', endpoint);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (!msg.type) return;

        const type = msg.type;
        if (type.startsWith(entityKey)) {
          fetchData(page);
        }
        if (entityKey === 'ALERT' && type === 'ALERTS_RESET') {
          fetchData(page);
        }
      } catch (e) {
        console.error('WS CrudTable parse error:', e);
      }
    };

    ws.onerror = (e) => {
      console.error('WS error (CrudTable):', e);
    };

    ws.onclose = () => {
      console.log('WS closed (CrudTable)', endpoint);
    };

    return () => {
      ws.close();
    };
  }, [endpoint, entityKey, fetchData, page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  async function handleDelete(id) {
    if (!window.confirm('Xoá bản ghi này?')) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      // reload lại trang hiện tại
      fetchData(page);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="card">
      <h2>{title}</h2>
      {error && <div className="error">{error}</div>}
      {loading && <div className="small">Đang tải...</div>}

      <table className="crud-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => {
                const val = row[c.key];
                if (c.type === 'boolean') {
                  return <td key={c.key}>{val ? '✔' : ''}</td>;
                }
                if (c.type === 'datetime' && val) {
                  const dt = new Date(val);
                  return <td key={c.key}>{dt.toLocaleString()}</td>;
                }
                return <td key={c.key}>{String(val ?? '')}</td>;
              })}
              <td>
                <button className="small-btn" onClick={() => handleDelete(row.id)}>
                  Xoá
                </button>
              </td>
            </tr>
          ))}
          {!items.length && !loading && (
            <tr>
              <td colSpan={columns.length + 1} style={{ textAlign: 'center' }}>
                Không có dữ liệu.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => fetchData(page - 1)}>
          « Trước
        </button>
        <span>
          Trang {page}/{totalPages}
        </span>
        <button disabled={page >= totalPages} onClick={() => fetchData(page + 1)}>
          Sau »
        </button>
      </div>
    </div>
  );
}
