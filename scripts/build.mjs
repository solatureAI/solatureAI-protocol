import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build as esbuild } from 'esbuild';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src'), DIST = path.join(ROOT, 'dist');
const LOGO_SRC = path.join(ROOT, 'brand', 'LOGO SOLATURE PNG...png'); // RGBA colourtype 6, 3,649,176 px pure-black transparent
let failures = 0;
const ok = (n, c, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  ' + d : ''}`); if (!c) failures++; };

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });

// ---- static files
for (const f of ['index.html', 'tokens.css', 'styles.css']) fs.copyFileSync(path.join(SRC, f), path.join(DIST, f));
await esbuild({ entryPoints: [path.join(SRC, 'main.js')], bundle: true, minify: true, format: 'iife', outfile: path.join(DIST, 'app.js'), target: 'es2020', logLevel: 'error' });

// ---- logo: explicit copy + premultiplied resizes (transparent regions are pure black → premultiply avoids dark fringes)
fs.copyFileSync(LOGO_SRC, path.join(DIST, 'assets', 'solature-logo.png'));
const CROP = { left: 410, top: 415, width: 1180, height: 1180 }; // square around the mark's centre (mark bbox ≈ 463–1544 × 473–1537 of 2000)
// premultiplied resize: decode → premultiply alpha → resample → un-premultiply (no black fringes from pure-black transparent pixels)
async function resizePM(size) {
  const { data, info } = await sharp(LOGO_SRC).ensureAlpha().extract(CROP).raw().toBuffer({ resolveWithObject: true });
  const pm = Buffer.from(data);
  for (let i = 0; i < pm.length; i += 4) { const a = pm[i + 3] / 255; pm[i] = Math.round(pm[i] * a); pm[i + 1] = Math.round(pm[i + 1] * a); pm[i + 2] = Math.round(pm[i + 2] * a); }
  const out = await sharp(pm, { raw: { width: info.width, height: info.height, channels: 4 } }).resize(size, size, { kernel: 'lanczos3' }).raw().toBuffer();
  for (let i = 0; i < out.length; i += 4) { const a = out[i + 3] / 255; if (a > 0) { out[i] = Math.min(255, Math.round(out[i] / a)); out[i + 1] = Math.min(255, Math.round(out[i + 1] / a)); out[i + 2] = Math.min(255, Math.round(out[i + 2] / a)); } }
  return { out, size };
}
for (const size of [512, 128]) {
  const { out } = await resizePM(size);
  await sharp(out, { raw: { width: size, height: size, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(DIST, 'assets', `solature-logo-${size}.png`));
}

// ---- favicon: traced from the real 32x32 alpha grid of the logo
const tokens = fs.readFileSync(path.join(SRC, 'tokens.css'), 'utf8');
const purple = /--c-purple:\s*(#[0-9a-fA-F]{6})/.exec(tokens)[1];
const { out: data } = await resizePM(32);
let rects = '';
for (let y = 0; y < 32; y++) {
  let x = 0;
  while (x < 32) {
    if (data[(y * 32 + x) * 4 + 3] >= 110) { let x0 = x; while (x < 32 && data[(y * 32 + x) * 4 + 3] >= 110) x++; rects += `<rect x="${x0}" y="${y}" width="${x - x0}" height="1"/>`; }
    else x++;
  }
}
fs.writeFileSync(path.join(DIST, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" shape-rendering="crispEdges"><g fill="${purple}">${rects}</g></svg>\n`);

// ---- hygiene checks
const walk = (d) => fs.readdirSync(d).flatMap((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
const srcFiles = walk(SRC).filter((f) => /\.(css|js|html)$/.test(f));
const hexHits = srcFiles.filter((f) => path.basename(f) !== 'tokens.css').filter((f) => /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])/.test(fs.readFileSync(f, 'utf8').replace(/href="#[\w-]*"/g, '').replace(/url\(#[\w-]+\)/g, '')));
ok('palette rule: no colour literals outside tokens.css', hexHits.length === 0, hexHits.map((f) => path.basename(f)).join(','));
const dateRe = /\b(19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}\b|new Date|Date\.now|toLocale(Date|Time)String|\b\d{1,2}:\d{2}(:\d{2})?\b/;
const dateHits = srcFiles.filter((f) => dateRe.test(fs.readFileSync(f, 'utf8')));
ok('no dates / timestamps / clock strings in src', dateHits.length === 0, dateHits.map((f) => path.basename(f)).join(','));
ok('no ch units in css', !/\d\s?ch\b/.test(fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8')));
ok('repo hygiene: no CLAUDE.md / .claude/', !fs.existsSync(path.join(ROOT, 'CLAUDE.md')) && !fs.existsSync(path.join(ROOT, '.claude')));

// ---- logo wiring
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+|favicon\.svg|app\.js|tokens\.css|styles\.css)"/g)].map((m) => m[1]);
const missing = refs.filter((r) => !fs.existsSync(path.join(DIST, r)));
ok('dist/assets/solature-logo-512.png exists', fs.existsSync(path.join(DIST, 'assets/solature-logo-512.png')));
ok('index.html references logo with correct relative path', html.includes('src="assets/solature-logo-512.png"') && html.includes('src="assets/solature-logo-128.png"'));
ok('every local reference in dist/index.html resolves', missing.length === 0, missing.join(','));

// ---- gates: both branches, anchors read the CURRENT record at runtime (never a hard-coded state)
const reg = (await import(pathToFileURL(path.join(SRC, 'register.js')).href));
const G = (await import(pathToFileURL(path.join(SRC, 'gates.js')).href));
const clone = (o) => ({ ...o, ca: { ...o.ca }, x: { ...o.x }, github: { ...o.github } });
const SAMPLE = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const withCA = (on) => { const r = clone(reg.register); r.ca = on ? { state: 'stated', value: SAMPLE } : { state: 'absent', value: null }; return r; };
const current = reg.register.ca.state;
console.log(`      current CA record state at build: ${current}`);
let gates = 0; const gate = (n, c) => { gates++; ok(`gate ${String(gates).padStart(2, '0')} ${n}`, c); };
for (const on of [false, true]) {
  const r = withCA(on), tag = on ? 'CA stated' : 'CA absent';
  const slot = G.caSlot(r);
  gate(`${tag}: CA slot ${on ? 'live + copyable' : 'inert, not copyable'}`, on ? slot.live && slot.copyable && slot.text === SAMPLE : slot.inert && !slot.copyable && slot.text === null);
  const plan = G.ownRowPlan(r);
  gate(`${tag}: own row ${on ? 'live, DexScreener + pump.fun fetched in parallel' : 'placeholder, zero fetches'}`, on ? plan.mode === 'live' && plan.fetches.length === 2 && plan.fetches[0].includes('/latest/dex/tokens/') && plan.fetches[1].includes('frontend-api.pump.fun/coins/') : plan.mode === 'placeholder' && plan.fetches.length === 0);
  const rows = [{ address: 'AAA' }, { address: SAMPLE }, { address: 'BBB' }];
  gate(`${tag}: dedupe ${on ? 'removes own token from rows 2-10' : 'leaves trending untouched'}`, G.dedupeTrending(rows, r).length === (on ? 2 : 3));
  gate(`${tag}: market plan unchanged by CA state`, JSON.stringify(G.marketPlan(r)) === JSON.stringify(G.marketPlan(reg.register)) && G.marketPlan(r).active);
  const scan = G.scanAddress(SAMPLE, r);
  gate(`${tag}: scanner ${on ? 'matches stated CA exactly' : 'reports no record to match'}`, scan.kind === (on ? 'match' : 'no-record'));
  const evm = G.scanAddress('0x' + 'ab'.repeat(20), r);
  gate(`${tag}: 0x hex is never blanket-rejected`, evm.shape === 'evm' && evm.kind !== 'unshaped');
}
// social records, evaluated from whatever the register currently holds
for (const k of ['x', 'github']) {
  const rec = reg.register[k], s = G.socialLink(rec);
  gate(`social ${k} (record is ${rec.state}): ${rec.state === 'stated' ? 'href derived from stored URL' : 'inert, no href'}`, rec.state === 'stated' ? s.href === rec.url && !!s.handle : s.href === null);
}
gate('social x handle derived from URL = usesolature', G.socialLink(reg.register.x).handle === 'usesolature');
gate('absent record flips inert, stated record flips live (mutation both directions)', G.socialLink({ state: 'stated', url: 'https://x.com/a' }).live && !G.socialLink({ state: 'absent', url: 'https://x.com/a' }).live && !G.socialLink({ state: 'unconfirmed', url: 'https://x.com/a' }).live);

// ---- animation audit: every @keyframes is applied; reduced-motion silences all; social/CA markup
const cssAll = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
const kfs = [...cssAll.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
for (const k of kfs) gate(`keyframes "${k}" is applied to an element`, new RegExp('animation:[^;}]*\\b' + k + '\\b').test(cssAll));
gate('reduced-motion block silences every animation and transition', /@media \(prefers-reduced-motion:reduce\)\{[^]*animation:none!important[^]*transition:none!important/.test(cssAll));
const mot = fs.readFileSync(path.join(SRC, 'motion.js'), 'utf8');
gate('JS motion (reveal, parallax, count-up, flash) is reduced-motion guarded', (mot.match(/reduced\(\)/g) || []).length >= 4);
gate('nav has X anchor (href filled from register at runtime)', /<a class="social" data-social="x"/.test(html));
gate('nav has GitHub anchor with no static href', /<a class="social" data-social="github"(?![^>]*href)/.test(html));
gate('CA slot markup present in sticky header', /<button class="ca" id="ca"/.test(html) && /\.top\{position:sticky;top:0/.test(cssAll));

console.log(`\ngates evaluated: ${gates}   failures: ${failures}`);
if (failures) { console.error('BUILD FAILED'); process.exit(1); }
console.log('BUILD OK → dist/');
