import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Customer from './src/models/Customer.js';
import Employee from './src/models/Employee.js';
import Settings from './src/models/Settings.js';
import Service from './src/models/Service.js';
import BankAccount from './src/models/BankAccount.js';
import Invoice from './src/models/Invoice.js';
import Category from './src/models/Category.js';

dotenv.config();

const seed = async () => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://localhost:27017/embeauty';
    await mongoose.connect(connStr);
    console.log('MongoDB Connected for Seeding...');

    // Clear all collections
    await Customer.deleteMany({});
    await Employee.deleteMany({});
    await Settings.deleteMany({});
    await Service.deleteMany({});
    await BankAccount.deleteMany({});
    await Invoice.deleteMany({});
    await Category.deleteMany({});
    console.log('Cleared existing data.');

    // ── 1. Settings ──────────────────────────────────────────────────────────
    // Rank thresholds and benefits come from the schema defaults; the migration
    // flag is pre-set because a fresh database has nothing to backfill.
    await new Settings({
      pointRewardRate: 10,
      salonName: 'EM Beauty Nails & Makeup',
      salonPhone: '035 836 7919',
      migrations: { lifetimePointsBackfill: true }
    }).save();
    console.log('Seeded default settings.');

    // ── 1b. Service categories ───────────────────────────────────────────────
    // Services reference these by `key`, so they must exist first.
    await Category.insertMany([
      { key: 'nails', name: 'Nails (Móng)', icon: '💅', order: 1 },
      { key: 'eyelashes', name: 'Nối Mi', icon: '✨', order: 2 },
      { key: 'washing', name: 'Gội Đầu & Massage', icon: '🧴', order: 3 },
      { key: 'makeup', name: 'Makeup', icon: '💄', order: 4 }
    ]);
    console.log('Seeded 4 service categories.');

    // ── 2. Bank Accounts ─────────────────────────────────────────────────────
    await new BankAccount({
      bankId: 'mbbank',
      bankName: 'MB Bank',
      accountNumber: '0358367919',
      accountHolder: 'THAI NGOC QUYNH NHU',
      displayName: 'MB Bank (Quỳnh Như)',
      qrImageBase64: ''
    }).save();
    await new BankAccount({
      bankId: 'techcombank',
      bankName: 'Techcombank',
      accountNumber: '19033456789012',
      accountHolder: 'EMBEAUTY NAILS',
      displayName: 'Techcombank (Boutique)',
      qrImageBase64: ''
    }).save();
    console.log('Seeded Bank Accounts.');

    // ── 3. Services — 4 categories ────────────────────────────────────────────
    const services = [
      // 💅 Nails
      { name: "Cắt da định hình móng tự nhiên", price: 50000, category: "nails" },
      { name: "Sơn gel cao cấp Hàn/Nhật", price: 120000, category: "nails" },
      { name: "Úp móng gel mỏng nhẹ", price: 250000, category: "nails" },
      { name: "Ẩn hoa khô / Xà cừ thiết kế", price: 180000, category: "nails" },
      { name: "Vẽ móng nghệ thuật (1 móng)", price: 20000, category: "nails" },
      { name: "Tháo gel / Tháo bột", price: 50000, category: "nails" },
      { name: "Đắp bột acrylic toàn bộ", price: 200000, category: "nails" },

      // ✨ Nối mi (Eyelashes)
      { name: "Nối mi Classic tự nhiên", price: 180000, category: "eyelashes" },
      { name: "Nối mi Volume 3D thiết kế", price: 240000, category: "eyelashes" },
      { name: "Nối mi Wispy nhẹ nhàng", price: 210000, category: "eyelashes" },
      { name: "Uốn mi Collagen dưỡng ẩm", price: 150000, category: "eyelashes" },
      { name: "Nhuộm mi đen/nâu", price: 120000, category: "eyelashes" },
      { name: "Bấm mi tự nhiên", price: 80000, category: "eyelashes" },

      // 🧴 Gội đầu & Massage (Washing)
      { name: "Gội đầu thảo dược phục hồi", price: 80000, category: "washing" },
      { name: "Gội đầu dưỡng sinh Trung Hoa", price: 150000, category: "washing" },
      { name: "Massage đầu & vai cổ gáy", price: 120000, category: "washing" },
      { name: "Ủ tóc keratin phục hồi", price: 200000, category: "washing" },

      // 💄 Makeup
      { name: "Trang điểm cô dâu (full)", price: 500000, category: "makeup" },
      { name: "Trang điểm dự tiệc / sự kiện", price: 300000, category: "makeup" },
      { name: "Trang điểm nhẹ tự nhiên (daily)", price: 200000, category: "makeup" },
      { name: "Phun môi thẩm mỹ", price: 800000, category: "makeup" },
      { name: "Phun mày Ombre thiết kế", price: 700000, category: "makeup" },
    ];

    for (const s of services) {
      await new Service(s).save();
    }
    console.log(`Seeded ${services.length} services (Nails / Nối mi / Gội đầu / Makeup).`);

    // ── 4. Employees ─────────────────────────────────────────────────────────
    await new Employee({ name: 'Quỳnh Như (Admin)', phone: '0358367919', pin: '1234', role: 'admin', status: 'active', bio: 'Chủ tiệm EM Beauty Nails & Makeup' }).save();
    await new Employee({ name: 'Nhi', phone: '0911111111', pin: '1111', role: 'staff', status: 'active', bio: 'Chuyên viên Nails & Nối mi' }).save();
    await new Employee({ name: 'Hà', phone: '0922222222', pin: '2222', role: 'staff', status: 'active', bio: 'Chuyên viên Makeup & Gội đầu' }).save();
    await new Employee({ name: 'Tiên', phone: '0933333333', pin: '3333', role: 'staff', status: 'active', bio: 'Chuyên viên Nails & Makeup' }).save();
    console.log('Seeded employees.');

    // ── 5. Loyalty Customers ─────────────────────────────────────────────────
    // totalPointsEarned drives the membership tier, so it is seeded explicitly
    // rather than left at 0 — otherwise these three would all rank as new.
    await new Customer({ name: 'Lê Thị Lan', phone: '0901234567', points: 120, totalPointsEarned: 220 }).save();
    await new Customer({ name: 'Phạm Hồng Ngọc', phone: '0911223344', points: 80, totalPointsEarned: 105 }).save();
    await new Customer({ name: 'Nguyễn Thị Bích', phone: '0933445566', points: 45, totalPointsEarned: 45 }).save();
    console.log('Seeded 3 loyalty customers.');

    console.log('\n✅ Seeding Completed!');
    console.log('   Admin PIN: 1234 | Nhi: 1111 | Hà: 2222 | Tiên: 3333');
    console.log('   Login → /staff');
    process.exit(0);
  } catch (error) {
    console.error(`Seed error: ${error.message}`);
    process.exit(1);
  }
};

seed();
