export const parseVndInput = (value: string | number) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
};

export const formatVndInput = (value: string | number) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
};

export const formatVnd = (value: number) =>
  `${Math.max(0, Math.round(Number(value) || 0)).toLocaleString("vi-VN")}đ`;

export const formatPercent = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
