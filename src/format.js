export const DASH = '—';
export function fmtPrice(n) {
  if (!Number.isFinite(n)) return DASH;
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return '$' + n.toFixed(n >= 100 ? 2 : 3);
  if (n === 0) return '$0';
  const dec = Math.min(12, Math.max(4, 3 - Math.floor(Math.log10(n))));
  return '$' + n.toFixed(dec);
}
export function fmtUsd(n) {
  if (!Number.isFinite(n)) return DASH;
  const a = Math.abs(n);
  const u = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']].find(([v]) => a >= v);
  return u ? '$' + (n / u[0]).toFixed(2) + u[1] : '$' + n.toFixed(0);
}
export function fmtPct(n) {
  if (!Number.isFinite(n)) return DASH;
  return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
}
export const FORMATS = { price: fmtPrice, usd: fmtUsd, pct: fmtPct };
