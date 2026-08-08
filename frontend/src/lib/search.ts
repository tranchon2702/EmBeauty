/**
 * Normalize Vietnamese text for user-facing search.
 * `sơn`, `son`, `Đồng`, and `dong` are treated as equivalent.
 */
export const normalizeVietnameseSearch = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Match every query word, regardless of Vietnamese diacritics or word order. */
export const matchesVietnameseSearch = (
  query: string,
  ...searchableValues: Array<string | null | undefined>
) => {
  const tokens = normalizeVietnameseSearch(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return true;

  const searchableText = searchableValues
    .map(normalizeVietnameseSearch)
    .join(" ");

  return tokens.every(token => searchableText.includes(token));
};
