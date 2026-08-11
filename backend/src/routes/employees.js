import express from 'express';
import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import { requireAuth, requireAdmin, generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.js';
import { rateLimit, clearRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();

// A PIN is only 4 digits, and the employee list is public so the login screen
// can show faces — without throttling, all 10.000 combinations are walkable.
const loginKey = (req) => `login:${req.body?.employeeId || 'unknown'}`;

const throttleLoginPerAccount = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  keyFn: loginKey,
  message: 'Bạn đã nhập sai mã PIN quá nhiều lần. Vui lòng thử lại sau 10 phút hoặc nhờ quản lý đặt lại PIN.',
});

const throttleLoginPerDevice = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyFn: (req) => `login-ip:${req.ip}`,
  message: 'Quá nhiều lần đăng nhập từ thiết bị này. Vui lòng thử lại sau ít phút.',
});

// ─── PUBLIC: List employees for login screen ─────────────────────────────────
router.get('/list', async (req, res) => {
  try {
    const list = await Employee.find({ status: 'active' }, 'name role avatar bio');
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── PUBLIC: Employee Login (verify PIN → return JWT) ────────────────────────
router.post('/login', throttleLoginPerDevice, throttleLoginPerAccount, async (req, res) => {
  const { employeeId, pin } = req.body;

  if (!employeeId || !pin) {
    return res.status(400).json({ message: 'Vui lòng chọn nhân viên và nhập mã PIN' });
  }
  if (!mongoose.Types.ObjectId.isValid(employeeId)) {
    return res.status(400).json({ message: 'Nhân viên không hợp lệ' });
  }

  try {
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.status !== 'active') {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên hoặc tài khoản đã bị vô hiệu hoá' });
    }

    const pinMatch = await employee.comparePin(pin.trim());
    if (!pinMatch) {
      return res.status(401).json({ message: 'Mã PIN không đúng. Vui lòng thử lại.' });
    }

    // A correct PIN clears the failure counter so a staff member who fat-fingers
    // it a few times is not locked out for the rest of their shift.
    clearRateLimit(loginKey(req));

    const accessToken = generateAccessToken(employee);
    const refreshToken = generateRefreshToken(employee);

    res.json({
      accessToken,
      refreshToken,
      user: {
        _id: employee._id,
        name: employee.name,
        role: employee.role,
        phone: employee.phone,
        avatar: employee.avatar || '',
        bio: employee.bio || '',
        mustChangePin: employee.mustChangePin || false
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── PUBLIC: Refresh access token ────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token là bắt buộc' });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const employee = await Employee.findById(decoded.id);
    if (!employee || employee.status !== 'active') {
      return res.status(401).json({ code: 'INVALID_REFRESH', message: 'Tài khoản không hợp lệ' });
    }

    const newAccessToken = generateAccessToken(employee);
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(401).json({ code: 'REFRESH_EXPIRED', message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
  }
});

// ─── AUTH: Change own PIN (employee self-service) ────────────────────────────
router.patch('/:id/change-pin', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { currentPin, newPin } = req.body;

  // Only allow changing own PIN
  if (req.user.id !== id) {
    return res.status(403).json({ message: 'Bạn chỉ có thể đổi mã PIN của chính mình' });
  }

  if (!newPin || newPin.trim().length !== 4 || !/^\d{4}$/.test(newPin.trim())) {
    return res.status(400).json({ message: 'Mã PIN mới phải là 4 chữ số' });
  }

  try {
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });

    // If mustChangePin is true (after admin reset), currentPin is not required
    if (!employee.mustChangePin) {
      if (!currentPin) {
        return res.status(400).json({ message: 'Vui lòng nhập mã PIN hiện tại' });
      }
      const pinMatch = await employee.comparePin(currentPin.trim());
      if (!pinMatch) {
        return res.status(401).json({ message: 'Mã PIN hiện tại không đúng' });
      }
    }

    employee.pin = newPin.trim();
    employee.mustChangePin = false;
    await employee.save();

    res.json({ message: 'Đã đổi mã PIN thành công! 🎉' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── AUTH: Update own profile (name and avatar) ──────────────────────────────
router.patch('/:id/profile', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, avatar } = req.body;

  if (req.user.id !== id) {
    return res.status(403).json({ message: 'Bạn chỉ có thể cập nhật hồ sơ của chính mình' });
  }

  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!normalizedName) {
    return res.status(400).json({ message: 'Tên nhân viên không được để trống' });
  }
  if (normalizedName.length > 80) {
    return res.status(400).json({ message: 'Tên nhân viên không được dài quá 80 ký tự' });
  }
  if (typeof avatar !== 'string') {
    return res.status(400).json({ message: 'Dữ liệu ảnh không hợp lệ' });
  }
  if (avatar && !/^data:image\/(jpeg|png|webp);base64,/i.test(avatar)) {
    return res.status(400).json({ message: 'Ảnh đại diện phải là ảnh JPEG, PNG hoặc WebP' });
  }
  // Client compresses avatars to 400x400 first. Keep a server-side ceiling too
  // so a staff account cannot fill the database with oversized data URLs.
  if (avatar.length > 1_500_000) {
    return res.status(413).json({ message: 'Ảnh đại diện quá lớn, vui lòng chọn ảnh khác' });
  }

  try {
    const employee = await Employee.findById(id);
    if (!employee || employee.status !== 'active') {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    employee.name = normalizedName;
    employee.avatar = avatar;
    await employee.save();

    res.json({
      message: 'Đã cập nhật hồ sơ cá nhân',
      user: {
        _id: employee._id,
        name: employee.name,
        role: employee.role,
        phone: employee.phone,
        avatar: employee.avatar || '',
        bio: employee.bio || '',
        mustChangePin: employee.mustChangePin || false
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── ADMIN: Reset PIN for any employee ───────────────────────────────────────
router.patch('/:id/reset-pin', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { newPin } = req.body;

  if (!newPin || newPin.trim().length !== 4 || !/^\d{4}$/.test(newPin.trim())) {
    return res.status(400).json({ message: 'Mã PIN mới phải là 4 chữ số' });
  }

  try {
    const employee = await Employee.findById(id);
    if (!employee) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });

    employee.pin = newPin.trim();
    employee.mustChangePin = true; // Force change on next login
    await employee.save();

    res.json({ message: `Đã đặt lại PIN cho ${employee.name}. Nhân viên sẽ phải đổi PIN khi đăng nhập lần sau.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── ADMIN: Get all employees ────────────────────────────────────────────────
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Exclude avatar and pin from list view for performance/security
    const list = await Employee.find({}, '-avatar -pin');
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── AUTH: Get single employee ───────────────────────────────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select('-pin');
    if (!employee) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── ADMIN: Create new employee ──────────────────────────────────────────────
router.post('/', requireAdmin, async (req, res) => {
  const { name, phone, pin, role, avatar, bio } = req.body;

  if (!name || !phone || !pin) {
    return res.status(400).json({ message: 'Tên, số điện thoại và mã PIN là bắt buộc' });
  }

  if (pin.trim().length !== 4 || !/^\d{4}$/.test(pin.trim())) {
    return res.status(400).json({ message: 'Mã PIN phải là 4 chữ số' });
  }

  try {
    const employee = new Employee({
      name: name.trim(),
      phone: phone.trim(),
      pin: pin.trim(),
      role: role || 'staff',
      avatar: avatar || '',
      bio: bio || ''
    });

    await employee.save();

    // Return without pin hash
    const result = employee.toObject();
    delete result.pin;
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── ADMIN: Update employee ──────────────────────────────────────────────────
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, phone, role, status, avatar, bio } = req.body;

  try {
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    if (name !== undefined) employee.name = name.trim();
    if (phone !== undefined) employee.phone = phone.trim();
    // PIN is NOT updatable via PUT — use reset-pin or change-pin instead
    if (role !== undefined) employee.role = role;
    if (status !== undefined) employee.status = status;
    if (avatar !== undefined) employee.avatar = avatar;
    if (bio !== undefined) employee.bio = bio;

    await employee.save();

    const result = employee.toObject();
    delete result.pin;
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── AUTH: Update own avatar ─────────────────────────────────────────────────
router.patch('/:id/avatar', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { avatar } = req.body;

  // Only allow updating own avatar (or admin)
  if (req.user.id !== id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Bạn chỉ có thể cập nhật ảnh của chính mình' });
  }

  if (!avatar) {
    return res.status(400).json({ message: 'Dữ liệu ảnh là bắt buộc' });
  }

  try {
    const employee = await Employee.findByIdAndUpdate(
      id,
      { avatar },
      { new: true }
    ).select('-pin');
    if (!employee) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    res.json({ message: 'Cập nhật ảnh thành công', avatar: employee.avatar });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── ADMIN: Delete/deactivate employee ───────────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }
    employee.status = 'inactive';
    await employee.save();
    res.json({ message: 'Đã vô hiệu hóa nhân viên' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
