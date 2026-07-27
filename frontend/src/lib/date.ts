// The API interprets every date parameter in Vietnam time (UTC+7). Deriving
// these client-side with toISOString() would use UTC and silently shift the
// reporting day for anyone whose device clock is not on +07.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

const toVnParts = (date: Date) => {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
};

const format = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

/** "YYYY-MM-DD" for today in Vietnam. */
export const vnToday = (): string => {
  const { year, month, day } = toVnParts(new Date());
  return format(year, month, day);
};

/** "YYYY-MM-DD" for `days` days before today in Vietnam. */
export const vnDaysAgo = (days: number): string => {
  const { year, month, day } = toVnParts(new Date());
  return format(year, month, day - days);
};

/** Monday of the current week, in Vietnam time. */
export const vnWeekStart = (): string => {
  const { year, month, day, weekday } = toVnParts(new Date());
  const daysSinceMonday = (weekday + 6) % 7; // Sunday (0) is 6 days after Monday
  return format(year, month, day - daysSinceMonday);
};

/** First day of the current month, in Vietnam time. */
export const vnMonthStart = (): string => {
  const { year, month } = toVnParts(new Date());
  return format(year, month, 1);
};

/** "DD/MM" — compact label for filter chips and headers. */
export const formatDayMonth = (isoDate: string): string => {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
};
