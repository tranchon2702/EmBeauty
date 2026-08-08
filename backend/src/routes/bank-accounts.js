import express from 'express';
import BankAccount from '../models/BankAccount.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// GET all bank accounts — requires auth (staff needs for invoices)
router.get('/', requireAuth, async (req, res) => {
  try {
    const list = await BankAccount.find();
    res.json(list);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST create bank account
router.post('/', requireAdmin, async (req, res) => {
  const { accountType, bankId, bankName, accountNumber, accountHolder, displayName, qrImageBase64 } = req.body;
  const normalizedType = accountType === 'momo' ? 'momo' : 'bank';

  if (!bankId || !bankName || !accountNumber || !accountHolder || !displayName) {
    return res.status(400).json({ message: 'bankId, bankName, accountNumber, accountHolder, displayName are all required' });
  }
  if (normalizedType === 'momo' && !qrImageBase64?.startsWith('data:image/')) {
    return res.status(400).json({ message: 'Ví MoMo cần ảnh mã QR để nhận thanh toán' });
  }

  try {
    const account = new BankAccount({
      accountType: normalizedType,
      bankId: bankId.trim(),
      bankName: bankName.trim(),
      accountNumber: accountNumber.trim(),
      accountHolder: accountHolder.trim().toUpperCase(),
      displayName: displayName.trim(),
      qrImageBase64: qrImageBase64 || ''
    });

    await account.save();
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT update bank account
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { accountType, bankId, bankName, accountNumber, accountHolder, displayName, qrImageBase64 } = req.body;

  try {
    const account = await BankAccount.findById(id);
    if (!account) {
      return res.status(404).json({ message: 'Bank account not found' });
    }

    if (accountType !== undefined) account.accountType = accountType === 'momo' ? 'momo' : 'bank';
    if (bankId !== undefined) account.bankId = bankId.trim();
    if (bankName !== undefined) account.bankName = bankName.trim();
    if (accountNumber !== undefined) account.accountNumber = accountNumber.trim();
    if (accountHolder !== undefined) account.accountHolder = accountHolder.trim().toUpperCase();
    if (displayName !== undefined) account.displayName = displayName.trim();
    if (qrImageBase64 !== undefined) account.qrImageBase64 = qrImageBase64;

    if (account.accountType === 'momo' && !account.qrImageBase64?.startsWith('data:image/')) {
      return res.status(400).json({ message: 'Ví MoMo cần ảnh mã QR để nhận thanh toán' });
    }

    await account.save();
    res.json(account);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE bank account
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const account = await BankAccount.findByIdAndDelete(id);
    if (!account) {
      return res.status(404).json({ message: 'Bank account not found' });
    }
    res.json({ message: 'Bank account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
