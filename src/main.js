import { register, isStated } from './register.js';
import { caSlot, socialLink, scanAddress, dedupeTrending, ownRowPlan } from './gates.js';
import { loadTrending, loadOwn } from './market.js';
import { FORMATS, DASH } from './format.js';
import { initReveal, initParallax, initSpotlight, initProgress, countTo, flash, reduced } from './motion.js';

const $ = (s, r = document) => r.querySelector(s);
const LOGO = 'assets/solature-logo-128.png';

/* ---------- CA slot ---------- */
function initCA() {
  const slot = $('#ca'), val = $('#ca-value'), hint = $('#ca-hint');
  const g = caSlot(register);
  if (g.inert) {
    slot.setAttribute('aria-disabled', 'true'); slot.disabled = true; slot.dataset.state = 'absent';
    val.textContent = 'Contract address not stated yet'; hint.textContent = 'inert';
    return;
  }
  slot.dataset.state = 'stated'; val.textContent = g.text; hint.textContent = 'tap to copy';
  slot.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(g.text); }
    catch { const t = document.createElement('textarea'); t.value = g.text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
    slot.classList.add('copied'); hint.textContent = 'copied';
    setTimeout(() => { slot.classList.remove('copied'); hint.textContent = 'tap to copy'; }, 1600);
  });
}

/* ---------- socials ---------- */
function initSocials() {
  document.querySelectorAll('[data-social]').forEach((el) => {
    const rec = register[el.dataset.social]; const s = socialLink(rec);
    const label = el.dataset.social === 'x' ? 'X' : 'GitHub';
    if (s.live) {
      el.href = s.href; el.target = '_blank'; el.rel = 'noopener noreferrer';
      el.setAttribute('aria-label', `Solature on ${label}${s.handle ? ' (@' + s.handle + ')' : ''}`);
      el.classList.remove('is-inert'); el.removeAttribute('aria-disabled');
    } else {
      el.removeAttribute('href'); el.setAttribute('aria-disabled', 'true'); el.classList.add('is-inert');
      el.setAttribute('aria-label', `${label} not stated yet`);
    }
  });
}

/* ---------- market ---------- */
const board = $('#board'), status = $('#status'), statusText = $('#status-text');
const cache = new Map(); // address -> last values
let lastGood = null, lastOwn = null;

const tile = (r) => {
  const d = document.createElement('span'); d.className = 'tile is-letter';
  d.textContent = (r.symbol || r.name || '?').trim().charAt(0).toUpperCase() || '?';
  const chain = (r.logos || []).slice();
  if (r.brand) { if (!chain.length) d.textContent = ''; chain.push(LOGO); } // brand/ logo ahead of letter tile
  const tryNext = () => {
    const src = chain.shift(); if (!src) return;
    const img = new Image(); img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.onerror = tryNext; img.onload = () => { d.textContent = ''; d.classList.remove('is-letter'); d.appendChild(img); };
    img.src = src;
  };
  tryNext();
  return d;
};

function rowEl(key) {
  const el = document.createElement('div'); el.className = 'row'; el.dataset.key = key; el.setAttribute('data-spot', '');
  el.innerHTML = `<span class="c-rank"></span><span class="c-token"><span class="tile-slot"></span><span class="tk"><b class="sym"></b><i class="nm"></i></span></span>
  <span class="c-price" data-f="price"></span><span class="c-chg" data-f="pct"></span><span class="c-vol" data-f="usd" data-l="Vol"></span><span class="c-liq" data-f="usd" data-l="Liq"></span>`;
  return el;
}
const FIELDS = { price: 'price', chg: 'change', vol: 'volume', liq: 'liquidity' };

function paint(el, r, rank, fresh) {
  el.querySelector('.c-rank').textContent = String(rank).padStart(2, '0');
  const slot = el.querySelector('.tile-slot'); const sig = (r.logos || []).join('|') + (r.brand ? '|b' : '');
  if (slot.dataset.sig !== sig || !slot.firstChild) { slot.replaceChildren(tile(r)); slot.dataset.sig = sig; }
  el.querySelector('.sym').textContent = r.symbol ? r.symbol : (r.ok === false ? DASH : '· · · ·');
  el.querySelector('.nm').textContent = r.name || '';
  const prev = cache.get(r.address) || {};
  [['c-price', 'price'], ['c-chg', 'change'], ['c-vol', 'volume'], ['c-liq', 'liquidity']].forEach(([cls, k]) => {
    const cell = el.querySelector('.' + cls); const fmt = FORMATS[cell.dataset.f];
    const to = r[k];
    if (r.placeholder) { cell.textContent = '· · · · ·'; return; }
    if (!Number.isFinite(to)) { cell.textContent = DASH; return; }
    cell.classList.toggle('up', k === 'change' && to > 0); cell.classList.toggle('down', k === 'change' && to < 0);
    const from = prev[k];
    if (fresh || !Number.isFinite(from)) cell.textContent = fmt(to);
    else if (from !== to) { countTo(cell, from, to, fmt); flash(cell, to - from); }
    else cell.textContent = fmt(to);
  });
  cache.set(r.address, { ...prev, ...r });
  el.classList.toggle('is-err', r.ok === false && !r.placeholder);
}

function ownPlaceholder() { return { address: '__own__', placeholder: true, symbol: 'SOLATURE', name: 'Awaiting contract', brand: true, logos: [], ok: true }; }

function renderBoard(own, trending) {
  const wrap = $('#rows'); const first = !wrap.dataset.ready;
  // Row 1: own token (live or placeholder), then trending 2..
  const ownRow = own || ownPlaceholder();
  let ownEl = wrap.querySelector('[data-own]');
  if (!ownEl) { ownEl = rowEl('own'); ownEl.dataset.own = ''; ownEl.classList.add('is-own'); wrap.prepend(ownEl); }
  const stated = !!own;
  ownEl.classList.toggle('is-placeholder', !stated);
  ownRow.brand = ownRow.brand || !!(own && !own.logos.length);
  paint(ownEl, { ...ownRow, address: ownRow.address }, 1, !cache.has(ownRow.address));
  if (stated && ownRow.url) { ownEl.dataset.href = ownRow.url; ownEl.setAttribute('role', 'link'); ownEl.tabIndex = 0; }
  else { delete ownEl.dataset.href; ownEl.removeAttribute('role'); ownEl.removeAttribute('tabindex'); }

  const list = dedupeTrending(trending || [], register);
  const keep = new Set(list.map((r) => r.address));
  wrap.querySelectorAll('.row[data-key]:not([data-own])').forEach((e) => { if (!keep.has(e.dataset.key)) e.remove(); });
  list.forEach((r, i) => {
    let el = wrap.querySelector(`.row[data-key="${CSS.escape(r.address)}"]`);
    const isNew = !el;
    if (isNew) { el = rowEl(r.address); wrap.appendChild(el); }
    paint(el, r, i + 2, isNew);
    if (isNew) { el.style.transitionDelay = (i * 45) + 'ms'; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in'))); }
    wrap.appendChild(el);
  });
  if (first) { wrap.dataset.ready = '1'; requestAnimationFrame(() => ownEl.classList.add('in')); }
  else ownEl.classList.add('in');
  if (list.length) $('#skeleton').classList.add('gone');
  renderTicker(list);
}

function renderTicker(list) {
  const track = $('#ticker-track'); if (!list.length) return;
  const items = list.filter((r) => r.ok).map((r) => `<span class="tick"><b>${esc(r.symbol || DASH)}</b><i>${esc(FORMATS.price(r.price))}</i><u class="${r.change > 0 ? 'up' : r.change < 0 ? 'down' : ''}">${esc(FORMATS.pct(r.change))}</u></span>`).join('');
  if (!items) return;
  track.innerHTML = `<div class="tick-set">${items}</div><div class="tick-set" aria-hidden="true">${items}</div>`;
  track.parentElement.classList.add('has-data');
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function setStatus(kind, text) { status.dataset.kind = kind; statusText.textContent = text; }

let busy = false, failures = 0, timer = 0;
async function refresh() {
  if (busy) return; busy = true; setStatus('sync', 'Syncing');
  const plan = ownRowPlan(register);
  const [t, o] = await Promise.allSettled([loadTrending(), plan.mode === 'live' ? loadOwn() : Promise.resolve(null)]);
  if (t.status === 'fulfilled') {
    lastGood = t.value; failures = 0;
    setStatus('live', `Live · ${t.value.filter((r) => r.ok).length} tokens`);
    $('#board-error').hidden = true;
  } else {
    failures++;
    setStatus('err', 'Source unreachable');
    const eb = $('#board-error'); eb.hidden = false; eb.textContent = lastGood ? 'Feed went silent. Last good numbers stay on display.' : 'Feed went silent. Dashes mark each value until it returns.';
    if (!lastGood) lastGood = Array.from({ length: 10 }, (_, i) => ({ address: '__e' + i, ok: false }));
  }
  if (o.status === 'fulfilled' && o.value) lastOwn = o.value; // keep last good own row on failure
  renderBoard(plan.mode === 'live' ? lastOwn || { address: register.ca.value, own: true, ok: false, symbol: null, logos: [] } : null, lastGood);
  busy = false;
}
function schedule() {
  clearInterval(timer);
  timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refresh(); } });

$('#rows').addEventListener('click', (e) => { const r = e.target.closest('.row[data-href]'); if (r) open(r.dataset.href, '_blank', 'noopener'); });
$('#rows').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const r = e.target.closest('.row[data-href]'); if (r) open(r.dataset.href, '_blank', 'noopener'); } });

/* ---------- address check ---------- */
function initCheck() {
  const f = $('#check'), inp = $('#check-input'), out = $('#check-out');
  const run = () => { const r = scanAddress(inp.value, register); out.dataset.kind = r.kind; out.textContent = r.message; };
  f.addEventListener('submit', (e) => { e.preventDefault(); run(); });
  inp.addEventListener('input', run); run();
}

/* ---------- boot ---------- */
initCA(); initSocials(); initCheck();
renderBoard(ownRowPlan(register).mode === 'live' ? { address: register.ca.value, own: true, ok: false, logos: [] } : null, []);
initReveal(); initParallax(); initSpotlight(); initProgress();
refresh(); schedule();
