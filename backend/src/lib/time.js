// Vietnam sits at a fixed UTC+7 with no daylight saving, so day boundaries can
// be derived arithmetically. Doing it here — instead of relying on the server's
// local timezone — keeps reports correct no matter how the VPS is configured.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

const parts = (dateStr) => {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
};

/** "YYYY-MM-DD" for the current moment in Vietnam. */
export const vnToday = () => {
  const shifted = new Date(Date.now() + VN_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

/** UTC instant matching 00:00:00.000 Vietnam time on the given "YYYY-MM-DD". */
export const vnStartOfDay = (dateStr) => {
  const p = parts(dateStr);
  if (!p) return null;
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 0, 0, 0, 0) - VN_OFFSET_MS);
};

/** UTC instant matching 23:59:59.999 Vietnam time on the given "YYYY-MM-DD". */
export const vnEndOfDay = (dateStr) => {
  const p = parts(dateStr);
  if (!p) return null;
  return new Date(Date.UTC(p.y, p.m - 1, p.d, 23, 59, 59, 999) - VN_OFFSET_MS);
};

/** "YYYYMMDD" in Vietnam time — used as the invoice number prefix. */
export const vnDateCompact = () => vnToday().replace(/-/g, '');
