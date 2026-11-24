export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Damped spring solver (semi-implicit Euler, fixed 1/120s substeps).
export function spring(from, to, { k = 170, c = 22, m = 1 } = {}, onUpdate, onDone) {
  let x = from, v = 0, last = performance.now(), raf;
  const step = (now) => {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    while (dt > 0) { const h = Math.min(dt, 1 / 120); v += (-k * (x - to) - c * v) / m * h; x += v * h; dt -= h; }
    onUpdate(x);
    if (Math.abs(x - to) < 0.0008 && Math.abs(v) < 0.0008) { onUpdate(to); onDone && onDone(); return; }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

export function initReveal() {
  const els = [...document.querySelectorAll('[data-reveal]')];
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => { e.style.opacity = 1; e.style.transform = 'none'; }); return; }
  els.forEach((e) => { e.style.opacity = 0; e.style.transform = 'translate3d(0,36px,0)'; });
  const io = new IntersectionObserver((entries) => {
    const batch = entries.filter((e) => e.isIntersecting);
    batch.forEach((en, i) => {
      const el = en.target; io.unobserve(el);
      const delay = (Number(el.dataset.revealIndex) || i) * 45;
      setTimeout(() => spring(0, 1, { k: 170, c: 22 }, (p) => {
        el.style.opacity = Math.min(1, Math.max(0, p));
        el.style.transform = `translate3d(0,${(1 - p) * 36}px,0)`;
      }, () => { el.style.opacity = 1; el.style.transform = 'none'; }), delay);
    });
  }, { threshold: 0.25, rootMargin: '0px 0px -10% 0px' });
  els.forEach((e) => io.observe(e));
}

export function initParallax() {
  const hero = document.querySelector('.hero'); if (!hero) return;
  const layers = [...hero.querySelectorAll('[data-depth]')];
  if (reduced()) return;
  let px = 0, py = 0, tx = 0, ty = 0, sy = 0, raf = 0;
  const loop = () => {
    px += (tx - px) * 0.08; py += (ty - py) * 0.08;
    const s = Math.min(sy, hero.offsetHeight);
    layers.forEach((l) => {
      const d = Number(l.dataset.depth);
      l.style.transform = `translate3d(${px * d * 26}px,${py * d * 18 - s * d * 0.35}px,0)`;
    });
    raf = (Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001) ? requestAnimationFrame(loop) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  hero.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5; kick(); });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  addEventListener('scroll', () => { sy = scrollY; kick(); }, { passive: true });
}

export function initSpotlight() {
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-spot]'); if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', e.clientX - r.left + 'px');
    t.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });
}

export function initProgress() {
  const bar = document.getElementById('progress'); if (!bar) return;
  const upd = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`; };
  addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
}

export function countTo(el, from, to, fmt, ms = 700) {
  if (reduced() || !Number.isFinite(from) || !Number.isFinite(to) || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(tick); else el.textContent = fmt(to);
  };
  requestAnimationFrame(tick);
}
export function flash(el, dir) {
  if (reduced()) return;
  el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth;
  el.classList.add(dir > 0 ? 'flash-up' : 'flash-down');
}
