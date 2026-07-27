import jwt from 'jsonwebtoken';

const DEV_SECRET = 'embeauty_dev_only_secret';
const DEV_REFRESH_SECRET = 'embeauty_dev_only_refresh';

const isProduction = () => process.env.NODE_ENV === 'production';

const JWT_SECRET = () => (process.env.JWT_SECRET || '').trim() || DEV_SECRET;
const JWT_REFRESH_SECRET = () => (process.env.JWT_REFRESH_SECRET || '').trim() || DEV_REFRESH_SECRET;

/**
 * Refuses to boot in production without real signing secrets — a fallback
 * committed to the repo would let anyone forge an admin token.
 */
export const assertAuthConfig = () => {
  if (!isProduction()) return;

  const missing = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter(
    (name) => !(process.env[name] || '').trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `Thiếu biến môi trường bắt buộc khi NODE_ENV=production: ${missing.join(', ')}. ` +
      'Sinh khóa mới: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
  if (JWT_SECRET() === JWT_REFRESH_SECRET()) {
    throw new Error('JWT_SECRET và JWT_REFRESH_SECRET phải khác nhau.');
  }
};

// ─── Generate Tokens ──────────────────────────────────────────────────────────
export const generateAccessToken = (employee) => {
  return jwt.sign(
    { id: employee._id.toString(), name: employee.name, role: employee.role },
    JWT_SECRET(),
    { expiresIn: '2h' }
  );
};

export const generateRefreshToken = (employee) => {
  return jwt.sign(
    { id: employee._id.toString() },
    JWT_REFRESH_SECRET(),
    { expiresIn: '30d' }
  );
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET());
};

// ─── Middleware: Require Authenticated Employee ───────────────────────────────
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 'NO_TOKEN', message: 'Vui lòng đăng nhập' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET());
    req.user = decoded; // { id, name, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Phiên đăng nhập đã hết hạn' });
    }
    return res.status(401).json({ code: 'INVALID_TOKEN', message: 'Token không hợp lệ' });
  }
};

// ─── Middleware: Require Admin Role ───────────────────────────────────────────
export const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Chỉ quản trị viên mới có quyền thực hiện' });
    }
    next();
  });
};

/** True when the caller may read or modify data belonging to another employee. */
export const isAdmin = (req) => req.user?.role === 'admin';
