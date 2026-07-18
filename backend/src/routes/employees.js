import express from 'express';
import Employee from '../models/Employee.js';

const router = express.Router();

// Public route to list employees for the login/stylist selection screen (no avatar for perf)
router.get('/list', async (req, res) => {
  try {
    const list = await Employee.find({ status: 'active' }, 'name role avatar bio');
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Employee Login (verify PIN)
router.post('/login', async (req, res) => {
  const { employeeId, pin } = req.body;

  if (!employeeId || !pin) {
    return res.status(400).json({ message: 'Employee and PIN are required' });
  }

  try {
    const employee = await Employee.findById(employeeId);
    if (!employee || employee.status !== 'active') {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên hoặc tài khoản đã bị vô hiệu hoá' });
    }

    if (employee.pin !== pin.trim()) {
      return res.status(401).json({ message: 'Mã PIN không đúng. Vui lòng thử lại.' });
    }

    // Success - return session data
    res.json({
      _id: employee._id,
      name: employee.name,
      role: employee.role,
      phone: employee.phone,
      avatar: employee.avatar || '',
      bio: employee.bio || ''
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all employees (Admin view)
router.get('/', async (req, res) => {
  try {
    // Exclude avatar from list view for performance; only fetch when needed
    const list = await Employee.find({}, '-avatar');
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single employee (for avatar edit)
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new employee (Admin)
router.post('/', async (req, res) => {
  const { name, phone, pin, role, avatar, bio } = req.body;

  if (!name || !phone || !pin) {
    return res.status(400).json({ message: 'Name, phone, and PIN are required' });
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
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update employee (Admin or self for avatar/bio)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, pin, role, status, avatar, bio } = req.body;

  try {
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    if (name !== undefined) employee.name = name.trim();
    if (phone !== undefined) employee.phone = phone.trim();
    if (pin !== undefined && pin.trim()) employee.pin = pin.trim();
    if (role !== undefined) employee.role = role;
    if (status !== undefined) employee.status = status;
    if (avatar !== undefined) employee.avatar = avatar;
    if (bio !== undefined) employee.bio = bio;

    await employee.save();
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH self avatar (employee updates own photo — no admin needed)
router.patch('/:id/avatar', async (req, res) => {
  const { id } = req.params;
  const { avatar } = req.body;

  if (!avatar) {
    return res.status(400).json({ message: 'Avatar image data is required' });
  }

  try {
    const employee = await Employee.findByIdAndUpdate(
      id,
      { avatar },
      { new: true }
    );
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json({ message: 'Avatar updated successfully', avatar: employee.avatar });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete employee/mark inactive
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    employee.status = 'inactive';
    await employee.save();
    res.json({ message: 'Employee marked as inactive' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
