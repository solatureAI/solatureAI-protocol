import { register, isStated } from './register.js';
import { marketPlan, ownRowPlan, dedupeTrending } from './gates.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

export async function getJSON(url, { tries = 4, base = 600, timeout = 9000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) { clearTimeout(t); last = e; if (i < tries - 1) await sleep(base * 2 ** i + Math.random() * 200); }
  }
  throw last;
}

function bestPair(pairs, addr) {
  const mine = (pairs || []).filter((p) => p && p.chainId === 'solana' && p.baseToken && (!addr || p.baseToken.address === addr));
  const list = mine.length ? mine : (pairs || []).filter(Boolean);
  return list.slice().sort((a, b) => (num(b.volume?.h24) || 0) - (num(a.volume?.h24) || 0))[0] || null;
}
function rowFromPair(pair, addr, extra = {}) {
  if (!pair) return { address: addr, ok: false, ...extra };
  return {
    address: addr, ok: true,
    symbol: pair.baseToken?.symbol || null, name: pair.baseToken?.name || null,
    logos: [pair.info?.imageUrl].filter(Boolean),
    price: num(pair.priceUsd), change: num(pair.priceChange?.h24),
    volume: num(pair.volume?.h24), liquidity: num(pair.liquidity?.usd),
    url: pair.url || null, ...extra,
  };
}

export async function loadTrending() {
  const plan = marketPlan(register);
  if (!plan.active) throw new Error('market source not stated');
  const boosts = await getJSON(plan.boostsUrl);
  const seen = new Set();
  const top = (Array.isArray(boosts) ? boosts : [])
    .filter((b) => b && b.chainId === 'solana' && b.tokenAddress && !seen.has(b.tokenAddress) && seen.add(b.tokenAddress))
    .sort((a, b) => (num(b.totalAmount) || 0) - (num(a.totalAmount) || 0))
    .slice(0, 10);
  const rows = await Promise.all(top.map(async (b) => {
    try {
      const pairs = await getJSON(register.marketSource.tokensUrl(b.tokenAddress), { tries: 3 });
      const row = rowFromPair(bestPair(pairs, b.tokenAddress), b.tokenAddress);
      if (row.ok && b.icon) row.logos.push(b.icon);
      return row;
    } catch { return { address: b.tokenAddress, ok: false }; }
  }));
  return rows;
}

// Own token: DexScreener and pump.fun are fired together, never one behind the other.
export async function loadOwn() {
  const plan = ownRowPlan(register);
  if (plan.mode !== 'live') return null;
  const ca = register.ca.value;
  const [dex, pump] = await Promise.allSettled([
    isStated(register.marketSource) ? getJSON(register.marketSource.pairsUrl(ca), { tries: 3 }) : Promise.reject(new Error('off')),
    isStated(register.pump) ? getJSON(register.pump.coinUrl(ca), { tries: 2 }) : Promise.reject(new Error('off')),
  ]);
  const pair = dex.status === 'fulfilled' ? bestPair(dex.value?.pairs, ca) : null; // sort volume.h24 desc → pairs[0]
  const coin = pump.status === 'fulfilled' ? pump.value : null;
  const row = rowFromPair(pair, ca, { own: true });
  row.logos = [coin?.image_uri, pair?.info?.imageUrl].filter(Boolean);
  if (coin) { row.symbol = row.symbol || coin.symbol; row.name = row.name || coin.name; row.ok = row.ok || !!coin; }
  if (!pair && !coin) row.ok = false;
  return row;
}

export { dedupeTrending };
