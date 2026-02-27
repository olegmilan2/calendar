export function formatDuration(ms) {
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const parts = [];
  if (days) parts.push(`${days}д`);
  if (days || hours) parts.push(`${hours}ч`);
  parts.push(`${minutes}м`);
  parts.push(`${seconds}с`);

  return parts.join(' ');
}

export function makeId(year, month, day) {
  return `${year}-${month}-${day}`;
}

export function pad(n) {
  return String(n).padStart(2, '0');
}

export function escapeHtml(v) {
  return String(v || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
