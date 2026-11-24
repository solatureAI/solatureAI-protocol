// REGISTER — every external fact is one record: state = stated | absent | unconfirmed.
// Absent / unconfirmed records render inert (no href, no copy, no fetch).
export const register = {
  chain: { state: 'stated', name: 'Solana', cluster: 'mainnet', rpc: 'https://solana-rpc.publicnode.com' },
  ca: { state: 'absent', value: null },
  x: { state: 'stated', url: 'https://x.com/usesolature' },
  github: { state: 'absent', url: null },
  marketSource: {
    state: 'stated',
    boostsUrl: 'https://api.dexscreener.com/token-boosts/top/v1',
    tokensUrl: (addr) => `https://api.dexscreener.com/tokens/v1/solana/${addr}`,
    pairsUrl: (addr) => `https://api.dexscreener.com/latest/dex/tokens/${addr}`,
  },
  pump: { state: 'stated', coinUrl: (addr) => `https://frontend-api.pump.fun/coins/${addr}` },
};

export const isStated = (rec) => !!rec && rec.state === 'stated';
// LINK RULE: store the URL, derive the handle.
export const handleOf = (rec) => {
  if (!isStated(rec) || !rec.url) return null;
  try { return new URL(rec.url).pathname.split('/').filter(Boolean)[0] || null; } catch { return null; }
};
