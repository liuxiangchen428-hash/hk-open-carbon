// Small CSV helpers shared by scripts (parsing lives in validate.mjs).

/** Quote a field only when needed (comma, quote or newline). */
export function csvField(v) {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Serialise rows (objects) in the given column order, with a trailing newline. */
export function toCsv(columns, rows) {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => csvField(r[c])).join(','))].join('\n') + '\n';
}

/** "20240131235959" -> "2024-01-31" */
export function waybackTimestampToDate(ts) {
  if (!/^\d{8}/.test(ts ?? '')) return '';
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}
