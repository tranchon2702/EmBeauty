const toInt = (value, fallback = 0) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : fallback;
};

const optionalObjectId = (value, label) => {
  const raw = value?._id ?? value;
  if (raw === undefined || raw === null || raw === '') return null;

  const id = String(raw);
  if (!/^[a-f\d]{24}$/i.test(id)) {
    throw new Error(`${label} không hợp lệ`);
  }
  return id;
};

/**
 * Derives every money field on an invoice from its line items.
 *
 * The client sends services/discount/surcharge but NEVER a trustworthy total —
 * revenue reports, staff performance and loyalty points all read totalAmount,
 * so it is always recomputed here and the client's value is discarded.
 */
export const computeInvoiceTotals = ({ services, discount, surcharge }) => {
  if (!Array.isArray(services) || services.length === 0) {
    throw new Error('Hóa đơn phải có ít nhất 1 dịch vụ');
  }

  const lines = services.map((item) => {
    const name = String(item?.name ?? '').trim();
    if (!name) throw new Error('Tên dịch vụ không được để trống');

    const price = toInt(item?.price);
    if (price < 0) throw new Error(`Giá của "${name}" không hợp lệ`);

    const quantity = Math.max(1, toInt(item?.quantity, 1));
    const serviceId = optionalObjectId(item?.serviceId, 'Mã dịch vụ');
    const employeeId = optionalObjectId(item?.employeeId, 'Mã nhân viên thực hiện');

    return { serviceId, name, price, quantity, employeeId };
  });

  const subTotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const normalizedSurcharge = Math.max(0, toInt(surcharge));
  // A discount can never exceed what is actually owed.
  const normalizedDiscount = Math.min(
    Math.max(0, toInt(discount)),
    subTotal + normalizedSurcharge
  );

  return {
    services: lines,
    subTotal,
    surcharge: normalizedSurcharge,
    discount: normalizedDiscount,
    totalAmount: subTotal + normalizedSurcharge - normalizedDiscount,
  };
};
