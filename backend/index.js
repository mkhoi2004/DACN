// index.js (FULL, có WebSocket + reset-from-ui + validate password length)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('./db');
const { sendAlertEmail } = require('./mailer');

// ===== Cấu hình JWT =====
const JWT_SECRET = process.env.JWT_SECRET || 'dev-smart-parking-secret';
const JWT_EXPIRES_IN = '7d';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden (ADMIN only)' });
  }
  next();
}

function getPagination(req) {
  const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit || '10', 10) || 10, 1);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ===== 1. SerialPort cho Arduino =====
const ARDUINO_PORT = 'COM5'; // nhớ chỉnh đúng COM
const BAUD_RATE = 9600;

let port;
try {
  port = new SerialPort({ path: ARDUINO_PORT, baudRate: BAUD_RATE });
} catch (err) {
  console.error('Serial init error:', err.message);
}

let parser;
if (port) {
  parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  port.on('open', () => {
    console.log('Serial port opened:', ARDUINO_PORT);
  });

  port.on('error', (err) => {
    console.error('Serial error:', err.message);
  });
} else {
  console.error('Serial port not created. Arduino sẽ không được đọc.');
}

// ===== 2. Express + HTTP + WebSocket =====
const app = express();
const allowedOrigins = [
  'https://dacn-orcin.vercel.app',
  'https://awaited-easy-marten.ngrok-free.app',
];

app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true); // Flutter/Postman thường không có origin
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
}));
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function broadcast(message) {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
});

// ===== 3. Hàm ghi DB (có broadcast) =====

async function insertGateEvent(eventType, data) {
  const { freeSlots, gateAngle, state } = data;
  const result = await pool.query(
    `INSERT INTO gate_events (event_type, free_slots, gate_angle, state)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [eventType, freeSlots, gateAngle, state]
  );
  const row = result.rows[0];
  broadcast({ type: 'GATE_EVENT_CREATED', payload: row });
}

async function insertAlert(alertType, message, isHandled = false) {
  // 1) Ghi vào bảng alerts như cũ
  const result = await pool.query(
    `INSERT INTO alerts (alert_type, message, is_handled)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [alertType, message, isHandled]
  );
  const row = result.rows[0];

  // Broadcast mọi alert mới (kể cả STAFF_RESET)
  broadcast({ type: 'ALERT_CREATED', payload: row });

  // 2) Nếu alert chưa handled => gửi email + ghi log gmail_logs
  if (!isHandled) {
    try {
      const emailResult = await sendAlertEmail(alertType, message);

          if (emailResult) {
      await pool.query(
        `INSERT INTO email_logs (
           alert_id,
           message_id,
           to_email,
           subject,
           body,
           sent_at,
           status,
           error_message
         )
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
        [
          row.id,
          emailResult.messageId || null,
          emailResult.to || null,
          emailResult.subject || null,
          emailResult.body || null,
          emailResult.success === true ? 'SUCCESS' : 'FAILED',
          emailResult.error || null,
        ]
      );
    }

    } catch (e) {
      console.error('INSERT gmail_logs error:', e.message);
    }
  }
}


async function insertSnapshot(data) {
  const { slot1, slot2, freeSlots } = data;
  const result = await pool.query(
    `INSERT INTO slot_snapshots (slot1_occupied, slot2_occupied, free_slots)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [slot1, slot2, freeSlots]
  );
  const row = result.rows[0];
  broadcast({ type: 'SNAPSHOT_CREATED', payload: row });
}

// Đăng nhập: lưu lịch sử
async function insertLoginHistory(tai_khoan_id, success, req) {
  const ip =
    req.headers['x-forwarded-for'] ||
    req.socket?.remoteAddress ||
    req.ip ||
    '';
  const ua = req.headers['user-agent'] || '';
  const result = await pool.query(
    `INSERT INTO lich_su_dang_nhap (tai_khoan_id, login_time, ip_address, user_agent, success)
     VALUES ($1, NOW(), $2, $3, $4)
     RETURNING *`,
    [tai_khoan_id, ip, ua, success]
  );
  const row = result.rows[0];
  broadcast({ type: 'LOGIN_HISTORY_CREATED', payload: row });
}

// Lấy user theo username
async function getUserByUsername(username) {
  const result = await pool.query(
    `SELECT * FROM tai_khoan WHERE username = $1 AND is_active = TRUE`,
    [username]
  );
  return result.rows[0];
}

// Lấy user theo id
async function getUserById(id) {
  const result = await pool.query(
    `SELECT id, username, email, role, is_active, created_at
     FROM tai_khoan WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

// ===== 4. Xử lý Serial từ Arduino (EV / ALERT / SNAP) =====

if (parser) {
  parser.on('data', async (rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    console.log('Serial:', line);

    try {
      // EV:...
      if (line.startsWith('EV:')) {
        const [head, ...rest] = line.split('|');
        const eventType = head.substring(3);

        let freeSlots = null;
        let gateAngle = null;
        let state = null;

        for (const seg of rest) {
          const [k, v] = seg.split('=');
          if (k === 'freeSlots') freeSlots = parseInt(v, 10);
          else if (k === 'gate') gateAngle = parseInt(v, 10);
          else if (k === 'state') state = v;
        }

        await insertGateEvent(eventType, { freeSlots, gateAngle, state });
        return;
      }

      // ALERT:...
      if (line.startsWith('ALERT:')) {
        const [head, ...rest] = line.split('|');
        const alertType = head.substring(6);

        let msg = '';
        for (const seg of rest) {
          const [k, v] = seg.split('=');
          if (k === 'msg') {
            // phần sau "msg="
            msg = seg.substring(4);
          }
        }
        if (!msg) msg = `Alert: ${alertType}`;

        if (alertType === 'STAFF_RESET') {
          // ghi log reset (đã xử lý)
          await insertAlert(alertType, msg, true);
          // đồng thời set tất cả alert chưa xử lý trước đó thành handled
          await pool.query(
            `UPDATE alerts
             SET is_handled = TRUE
             WHERE is_handled = FALSE
               AND alert_type <> 'STAFF_RESET'`
          );
          // thông báo client nên reload alerts
          broadcast({ type: 'ALERTS_RESET' });
        } else {
          // cảnh báo thường
          await insertAlert(alertType, msg, false);
        }
        return;
      }

      // SNAP:...
      if (line.startsWith('SNAP:')) {
        const body = line.substring(5);
        const segs = body.split('|');

        let slot1 = null;
        let slot2 = null;
        let freeSlots = null;

        for (const seg of segs) {
          const [k, v] = seg.split('=');
          if (k === 'slot1') slot1 = v === '1';
          else if (k === 'slot2') slot2 = v === '1';
          else if (k === 'freeSlots') freeSlots = parseInt(v, 10);
        }

        await insertSnapshot({ slot1, slot2, freeSlots });
        return;
      }
    } catch (err) {
      console.error('Error handling line:', err.message);
    }
  });
}

// ===== 5. AUTH ROUTES =====

// Đăng ký: luôn tạo role USER (tài khoản thường)
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Thiếu username, email hoặc password' });
  }

  // ✅ RÀNG BUỘC: mật khẩu tối thiểu 8 ký tự
  if (password.length < 8) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự.' });
  }

  try {
    const existed = await pool.query(
      'SELECT id FROM tai_khoan WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existed.rows.length > 0) {
      return res.status(400).json({ error: 'Username hoặc email đã tồn tại' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO tai_khoan (username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'USER', TRUE)
       RETURNING id, username, email, role, is_active, created_at`,
      [username, email, hash]
    );
    const user = result.rows[0];

    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error('POST /api/auth/register error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Thiếu username hoặc password' });
  }

  try {
    const user = await getUserByUsername(username);
    if (!user) {
      return res.status(400).json({ error: 'Sai username hoặc password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    const success = !!match;

    // lưu lịch sử đăng nhập
    try {
      await insertLoginHistory(user.id, success, req);
    } catch (eLog) {
      console.error('insertLoginHistory error:', eLog.message);
    }

    if (!match) {
      return res.status(400).json({ error: 'Sai username hoặc password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at
    };

    const token = signToken(safeUser);
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('POST /api/auth/login error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Đổi mật khẩu (user + admin)
app.patch('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Thiếu currentPassword hoặc newPassword' });
  }

  // ✅ RÀNG BUỘC: mật khẩu mới tối thiểu 8 ký tự
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
  }

  try {
    const userResult = await pool.query(
      'SELECT * FROM tai_khoan WHERE id = $1',
      [req.user.id]
    );
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User không tồn tại' });
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE tai_khoan SET password_hash = $1 WHERE id = $2',
      [newHash, user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/auth/change-password error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Lấy thông tin user hiện tại
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User không tồn tại' });
    res.json({ user });
  } catch (err) {
    console.error('GET /api/auth/me error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Lịch sử đăng nhập của chính user
app.get('/api/auth/login-history', authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM lich_su_dang_nhap WHERE tai_khoan_id = $1',
      [req.user.id]
    );
    const dataResult = await pool.query(
      `SELECT *
       FROM lich_su_dang_nhap
       WHERE tai_khoan_id = $1
       ORDER BY login_time DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json({
      items: dataResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit
    });
  } catch (err) {
    console.error('GET /api/auth/login-history error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// Lịch sử đăng nhập (ADMIN xem toàn bộ)
app.get('/api/admin/login-history', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const countResult = await pool.query('SELECT COUNT(*) FROM lich_su_dang_nhap');

    const dataResult = await pool.query(
      `SELECT l.*, t.username, t.email
       FROM lich_su_dang_nhap l
       JOIN tai_khoan t ON l.tai_khoan_id = t.id
       ORDER BY l.login_time DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      items: dataResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit
    });
  } catch (err) {
    console.error('GET /api/admin/login-history error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

app.delete('/api/admin/login-history/:id', authMiddleware, adminOnly, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    await pool.query('DELETE FROM lich_su_dang_nhap WHERE id = $1', [id]);
    broadcast({ type: 'LOGIN_HISTORY_DELETED', payload: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admin/login-history/:id error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ===== 6. API GIÁM SÁT BÃI XE =====

// Gate events
app.get('/api/gate-events', authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const countResult = await pool.query('SELECT COUNT(*) FROM gate_events');
    const dataResult = await pool.query(
      `SELECT * FROM gate_events
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({
      items: dataResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit
    });
  } catch (err) {
    console.error('GET /api/gate-events error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/gate-events', authMiddleware, async (req, res) => {
  const { event_type, free_slots, gate_angle, state } = req.body || {};
  if (!event_type) {
    return res.status(400).json({ error: 'Thiếu event_type' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO gate_events (event_type, free_slots, gate_angle, state)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [event_type, free_slots ?? null, gate_angle ?? null, state ?? null]
    );
    const row = result.rows[0];
    broadcast({ type: 'GATE_EVENT_CREATED', payload: row });
    res.json(row);
  } catch (err) {
    console.error('POST /api/gate-events error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/gate-events/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { event_type, free_slots, gate_angle, state } = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE gate_events
       SET event_type = $1,
           free_slots = $2,
           gate_angle = $3,
           state = $4
       WHERE id = $5
       RETURNING *`,
      [event_type, free_slots ?? null, gate_angle ?? null, state ?? null, id]
    );
    const row = result.rows[0];
    broadcast({ type: 'GATE_EVENT_UPDATED', payload: row });
    res.json(row);
  } catch (err) {
    console.error('PUT /api/gate-events/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/gate-events/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    await pool.query('DELETE FROM gate_events WHERE id = $1', [id]);
    broadcast({ type: 'GATE_EVENT_DELETED', payload: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/gate-events/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Alerts
app.get('/api/alerts', authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const countResult = await pool.query('SELECT COUNT(*) FROM alerts');
    const dataResult = await pool.query(
      `SELECT * FROM alerts
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({
      items: dataResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit
    });
  } catch (err) {
    console.error('GET /api/alerts error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Thêm alert thủ công (không gửi email để khỏi spam)
app.post('/api/alerts', authMiddleware, async (req, res) => {
  const { alert_type, message, is_handled } = req.body || {};
  if (!alert_type) {
    return res.status(400).json({ error: 'Thiếu alert_type' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO alerts (alert_type, message, is_handled)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [alert_type, message ?? '', !!is_handled]
    );
    const row = result.rows[0];
    broadcast({ type: 'ALERT_CREATED', payload: row });
    res.json(row);
  } catch (err) {
    console.error('POST /api/alerts error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Cập nhật alert
app.put('/api/alerts/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { alert_type, message, is_handled } = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE alerts
       SET alert_type = $1,
           message = $2,
           is_handled = $3
       WHERE id = $4
       RETURNING *`,
      [alert_type, message ?? '', !!is_handled, id]
    );
    const row = result.rows[0];
    broadcast({ type: 'ALERT_UPDATED', payload: row });
    res.json(row);
  } catch (err) {
    console.error('PUT /api/alerts/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Xoá alert
app.delete('/api/alerts/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    await pool.query('DELETE FROM alerts WHERE id = $1', [id]);
    broadcast({ type: 'ALERT_DELETED', payload: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/alerts/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Đánh dấu alert đã xử lý (theo id)
app.patch('/api/alerts/:id/handle', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  try {
    const result = await pool.query(
      `UPDATE alerts SET is_handled = TRUE WHERE id = $1 RETURNING *`,
      [id]
    );
    const row = result.rows[0];
    broadcast({ type: 'ALERT_UPDATED', payload: row });
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/alerts/:id/handle error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 👉 API mới: reset từ UI (gửi lệnh CMD_RESET cho Arduino)
app.post('/api/alerts/reset-from-ui', authMiddleware, async (req, res) => {
  try {
    if (!port || !port.isOpen) {
      return res.status(500).json({ error: 'Arduino không kết nối (serial chưa open)' });
    }
    port.write('CMD_RESET\n', (err) => {
      if (err) {
        console.error('Serial write error:', err.message);
      }
    });
    // DB sẽ được cập nhật khi Arduino log ALERT:STAFF_RESET
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/alerts/reset-from-ui error:', err.message);
    res.status(500).json({ error: 'Lỗi gửi lệnh reset' });
  }
});

// Snapshots
app.get('/api/slot-snapshots', authMiddleware, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const countResult = await pool.query('SELECT COUNT(*) FROM slot_snapshots');
    const dataResult = await pool.query(
      `SELECT * FROM slot_snapshots
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({
      items: dataResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit
    });
  } catch (err) {
    console.error('GET /api/slot-snapshots error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/slot-snapshots', authMiddleware, async (req, res) => {
  const { slot1_occupied, slot2_occupied, free_slots } = req.body || {};
  try {
    const result = await pool.query(
      `INSERT INTO slot_snapshots (slot1_occupied, slot2_occupied, free_slots)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [!!slot1_occupied, !!slot2_occupied, free_slots ?? null]
    );
    const row = result.rows[0];
    broadcast({ type: 'SNAPSHOT_CREATED', payload: row });
    res.json(row);
  } catch (err) {
    console.error('POST /api/slot-snapshots error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/slot-snapshots/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { slot1_occupied, slot2_occupied, free_slots } = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE slot_snapshots
       SET slot1_occupied = $1,
           slot2_occupied = $2,
           free_slots = $3
       WHERE id = $4
       RETURNING *`,
      [!!slot1_occupied, !!slot2_occupied, free_slots ?? null, id]
    );
    const row = result.rows[0];
    broadcast({ type: 'SNAPSHOT_UPDATED', payload: row });
    res.json(row);
  } catch (err) {
    console.error('PUT /api/slot-snapshots/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/slot-snapshots/:id', authMiddleware, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    await pool.query('DELETE FROM slot_snapshots WHERE id = $1', [id]);
    broadcast({ type: 'SNAPSHOT_DELETED', payload: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/slot-snapshots/:id error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// ===== Gmail logs (ADMIN) =====

// GET /api/gmail-logs  (ADMIN xem lịch sử gửi email cảnh báo)
// /api/gmail-logs  (ADMIN xem lịch sử gửi email cảnh báo)
app.get('/api/gmail-logs', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page, limit, offset } = getPagination(req);

    const countResult = await pool.query('SELECT COUNT(*) FROM email_logs');

    const dataResult = await pool.query(
      `SELECT
         id,
         alert_id,
         message_id,
         to_email,
         subject,
         body,
         sent_at AS created_at,              -- map sang field cũ cho frontend
         (status = 'SUCCESS') AS success,    -- boolean
         error_message AS error
       FROM email_logs
       ORDER BY sent_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      items: dataResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    });
  } catch (err) {
    console.error('GET /api/gmail-logs error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// DELETE /api/gmail-logs/:id
app.delete('/api/gmail-logs/:id', authMiddleware, adminOnly, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  try {
    await pool.query('DELETE FROM gmail_logs WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/gmail-logs/:id error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// ===== 7. Start server =====
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  console.log('WebSocket server ready at ws://localhost:' + PORT);
  console.log('Nhớ chỉnh ARDUINO_PORT cho đúng.');
});
