// GATES — pure functions of the register. Both branches (stated / absent) are live from day one.
import { isStated, handleOf } from './register.js';

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM = /^0x[0-9a-fA-F]{40}$/;

export function caSlot(reg) {
  const live = isStated(reg.ca) && !!reg.ca.value;
  return { live, inert: !live, text: live ? reg.ca.value : null, copyable: live };
}
export function socialLink(rec) {
  const live = isStated(rec) && !!rec.url;
  return { live, href: live ? rec.url : null, handle: handleOf(rec) };
}
export function ownRowPlan(reg) {
  if (!(isStated(reg.ca) && reg.ca.value)) return { mode: 'placeholder', fetches: [] };
  const ca = reg.ca.value;
  const fetches = [];
  if (isStated(reg.marketSource)) fetches.push(reg.marketSource.pairsUrl(ca));
  if (isStated(reg.pump)) fetches.push(reg.pump.coinUrl(ca)); // parallel, never chained
  return { mode: 'live', fetches };
}
export function marketPlan(reg) {            // market follows its own record only
  if (!isStated(reg.marketSource)) return { active: false, boostsUrl: null };
  return { active: true, boostsUrl: reg.marketSource.boostsUrl };
}
export function dedupeTrending(rows, reg) {   // own token leaves rows 2-10
  if (!(isStated(reg.ca) && reg.ca.value)) return rows;
  return rows.filter((r) => r.address !== reg.ca.value);
}
// GATE WARNING: never blanket-reject 0x hex; match address-shaped strings to the stated registry.
export function scanAddress(input, reg) {
  const v = (input || '').trim();
  if (!v) return { kind: 'empty', message: 'Paste an address to compare it with what is stated here.' };
  const shape = EVM.test(v) ? 'evm' : B58.test(v) ? 'solana' : 'unknown';
  const stated = isStated(reg.ca) && !!reg.ca.value;
  if (stated && v === reg.ca.value) return { kind: 'match', shape, message: 'Exact match with the stated Solature contract.' };
  if (shape === 'unknown') return { kind: 'unshaped', shape, message: 'That string is not shaped like a Solana or EVM address.' };
  if (!stated) return { kind: 'no-record', shape, message: `${shape === 'evm' ? 'EVM-shaped' : 'Solana-shaped'} address. No contract is stated yet, so there is nothing to match it against.` };
  return { kind: 'mismatch', shape, message: `${shape === 'evm' ? 'EVM-shaped' : 'Solana-shaped'} address. It does not match the stated Solature contract.` };
}
