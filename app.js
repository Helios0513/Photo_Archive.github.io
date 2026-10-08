/* ============================================================
   Hamihamoo — "Darkroom" (한 페이지 앱)
   - photos.json / projects.json / site.json / profile.json 을 읽어 화면을 그려요.
   - 관리(Studio)에서 고친 내용은 GitHub 저장소에 바로 저장돼요.
   - 위치·지도 관련 기능은 없어요.
   ============================================================ */

const DATA_BASE = './';
const IMG_BASE = 'images/digital/';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------- 색 탐색기 ----------
   사진마다 이름표 하나 대신 실제로 들어 있는 색과 비율(palette)을 기록해요.
   예: 벚꽃 = [['white', 0.6], ['sky', 0.25], ['forest', 0.1]]
   큰 색 6가지(families) 안에 세밀한 색(shades)이 들어 있어요. */
const FAMILIES = [['white', '흰색', '#f2f0ea'], ['gray', '회색', '#9a9a94'], ['black', '검정', '#1f1f1e'], ['warm', '따뜻한 색', '#d8843c'], ['green', '초록', '#5f8a4f'], ['blue', '파랑', '#4a73a8']];
const SHADES = {
  white: ['white', '흰색', '#f2f0ea'], gray: ['gray', '회색', '#9a9a94'], black: ['black', '검정', '#1f1f1e'],
  red: ['warm', '빨강', '#c4483c'], orange: ['warm', '주황', '#db8a3e'], yellow: ['warm', '노랑', '#dcb840'], brown: ['warm', '갈색', '#8a6a4f'], pink: ['warm', '분홍', '#e0a2b4'],
  lime: ['green', '연두', '#a8c46a'], green: ['green', '초록', '#5f8a4f'], forest: ['green', '짙은 숲색', '#2f4a33'],
  sky: ['blue', '하늘색', '#8cb8e0'], sea: ['blue', '바다색', '#3f8a94'], navy: ['blue', '남색', '#2c3e6b'], purple: ['blue', '보라', '#7c5ca3'],
};
const LIGHTS = [['bright', '밝음'], ['mid', '중간'], ['dark', '어두움']];
// 사진에서 이 비율 이상 보이는 색이어야 그 색 사진으로 쳐요.
// 흰색·회색·검정은 거의 모든 사진에 조금씩 있어서 기준을 높이고, 진짜 색은 작은 주인공(빨간 장식 등)도 잡히게 낮춰요.
// 갈색은 나무·흙·그늘처럼 배경에 흔해서 15% 이상일 때만 색으로 쳐요
const minShare = k => ['white', 'gray', 'black'].includes(k) ? 0.2 : k === 'brown' ? 0.15 : k === 'warm' ? 0.1 : 0.06;
const LEGACY = { Black: 'black', White: 'white', Gray: 'gray', Brown: 'brown', Red: 'red', Orange: 'orange', Yellow: 'yellow', Green: 'green', Blue: 'sky', Purple: 'purple', Pink: 'pink' };
const familyOf = s => (SHADES[s] || SHADES.gray)[0];
const shadeKo = s => (SHADES[s] || SHADES.gray)[1];
const shadeHex = s => (SHADES[s] || SHADES.gray)[2];
const familyKo = f => (FAMILIES.find(x => x[0] === f) || [, f])[1];
const paletteOf = p => (p.palette && p.palette.length) ? p.palette : [[LEGACY[p.color] || 'gray', 1]];
const mainShade = p => paletteOf(p)[0][0];
const familyShare = (p, f) => paletteOf(p).reduce((s, [k, v]) => s + (familyOf(k) === f && !(k === 'brown' && v < 0.15) ? v : 0), 0);
const shadeShare = (p, s) => paletteOf(p).reduce((t, [k, v]) => t + (k === s ? v : 0), 0);
const lightOf = p => p.light || 'mid';

// 사람 눈에 가까운 색 공간(OKLab)으로 바꿔서 밝기(L)·색 진하기(C)·색상(h)을 따로 봐요
function oklab(r, g, b) {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  r = lin(r); g = lin(g); b = lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
}
function shadeOfPixel(L, C, h) {
  if (L < 0.12) return 'black';
  // 옅은 색: 밝으면 흰색(벚꽃·흐린 하늘), 어두운 곳은 아주 옅은 색도 색으로 봐요(그늘진 숲)
  const minC = L > 0.7 ? 0.045 : L < 0.45 ? 0.012 : 0.022;
  if (C < minC) return L > 0.6 ? 'white' : L < 0.3 ? 'black' : 'gray';
  if (h >= 345 || h < 40) return L > 0.72 ? 'pink' : (L < 0.42 && C < 0.1 ? 'brown' : 'red');
  if (h < 80) return L < 0.48 && C < 0.12 ? 'brown' : 'orange';
  if (h < 105) return L < 0.5 ? 'forest' : 'yellow';
  if (h < 180) return L < 0.42 ? 'forest' : L > 0.68 ? 'lime' : 'green';
  if (h < 275) return h < 230 && L >= 0.4 && L <= 0.68 ? 'sea' : L > 0.5 ? 'sky' : 'navy';
  if (h < 325) return 'purple';
  return 'pink';
}
function analyzeColors(img) {
  const N = 72, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data, cnt = {};
  let Ls = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { const [L, C, h] = oklab(d[i], d[i + 1], d[i + 2]); Ls += L; n++; const k = shadeOfPixel(L, C, h); cnt[k] = (cnt[k] || 0) + 1; }
  const palette = Object.entries(cnt).map(([k, v]) => [k, +(v / n).toFixed(3)]).filter(([, v]) => v >= 0.03).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mL = Ls / n;
  return { palette, light: mL < 0.42 ? 'dark' : mL > 0.53 ? 'bright' : 'mid', color: familyOf(palette[0] ? palette[0][0] : 'gray') };
}
function analyzeUrl(url) {
  return new Promise(res => { const im = new Image(); im.onload = () => res(analyzeColors(im)); im.onerror = () => res({ palette: [['gray', 1]], light: 'mid', color: 'gray' }); im.src = url; });
}
const paletteStrip = (p, cls = 'pal') => `<span class="${cls}">${paletteOf(p).map(([k, v]) => `<i style="--c:${shadeHex(k)};flex:${v}" title="${shadeKo(k)} ${Math.round(v * 100)}%"></i>`).join('')}</span>`;

const S = {
  photos: [], byName: new Map(), projects: [], site: {}, profile: {},
  photoProjects: new Map(), ratios: {}, archive: { view: 'mosaic', month: 'all', color: 'all' },
};

/* ---------- 도구 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* ---------- 로고: 도장 (바깥 테두리 · 글자를 비워 낸 띠 · 안쪽 눈금 · h와 주황 점) ---------- */
const LOGO_TXT = 'HAMIHAMOO · PHOTOGRAPHY · ';
let logoN = 0;
// 화면용: 글자는 띠에서 비워 내서(마스크) 어떤 바탕 위에서도 뒤가 비쳐요
function logoSvg() {
  const k = ++logoN, tk = Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2 - Math.PI / 2, c = Math.cos(a), si = Math.sin(a); return `M${(50 + 28 * c).toFixed(2)} ${(50 + 28 * si).toFixed(2)}L${(50 + 31 * c).toFixed(2)} ${(50 + 31 * si).toFixed(2)}`; }).join('');
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><path id="lgP${k}" d="M50 50m-35.8 0a35.8 35.8 0 1 1 71.6 0a35.8 35.8 0 1 1-71.6 0"/>
    <mask id="lgM${k}"><rect width="100" height="100" fill="#fff"/><text font-family="JetBrains Mono, monospace" font-weight="600" font-size="7.6" fill="#000"><textPath href="#lgP${k}" textLength="224" lengthAdjust="spacing">${LOGO_TXT}</textPath></text></mask></defs>
    <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" stroke-width="1.2"/>
    <circle cx="50" cy="50" r="38.5" fill="none" stroke="currentColor" stroke-width="12" mask="url(#lgM${k})"/>
    <path d="${tk}" stroke="currentColor" stroke-width=".9"/>
    <text x="50" y="62" text-anchor="middle" font-family="Instrument Serif, Georgia, serif" font-style="italic" font-size="40" fill="currentColor">h</text>
    <circle cx="59" cy="58.5" r="2.6" fill="var(--accent, #ff5a36)"/></svg>`;
}
// 그림(캔버스)용: 같은 모양을 size 크기로 (cx, cy)가 가운데가 되게
function drawLogo(x, cx, cy, size, color, accent = '#ff5a36') {
  const S0 = Math.max(64, Math.ceil(size * 2)), c = document.createElement('canvas'); c.width = c.height = S0;
  const g = c.getContext('2d'); g.scale(S0 / 100, S0 / 100); g.strokeStyle = g.fillStyle = color;
  g.lineWidth = 12; g.beginPath(); g.arc(50, 50, 38.5, 0, Math.PI * 2); g.stroke();
  // 띠 글자: 왼쪽에서 시작해 시계 방향으로 한 바퀴를 꽉 채워요 (화면용과 같은 자리)
  g.save(); g.globalCompositeOperation = 'destination-out'; g.font = '600 7.6px "JetBrains Mono", monospace'; g.textAlign = 'center';
  const ch = [...LOGO_TXT], ws = ch.map(t => g.measureText(t).width), sum = ws.reduce((a, b) => a + b, 0), gap = (Math.PI * 2 * 35.8 - sum) / ch.length;
  let d = 0; ch.forEach((t, i) => { const a = Math.PI + (d + ws[i] / 2) / 35.8; g.save(); g.translate(50 + 35.8 * Math.cos(a), 50 + 35.8 * Math.sin(a)); g.rotate(a + Math.PI / 2); g.fillText(t, 0, 0); g.restore(); d += ws[i] + gap; });
  g.restore();
  g.lineWidth = 1.2; g.beginPath(); g.arc(50, 50, 48, 0, Math.PI * 2); g.stroke();
  g.lineWidth = .9; g.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2 - Math.PI / 2; g.moveTo(50 + 28 * Math.cos(a), 50 + 28 * Math.sin(a)); g.lineTo(50 + 31 * Math.cos(a), 50 + 31 * Math.sin(a)); } g.stroke();
  g.font = 'italic 40px "Instrument Serif", Georgia, serif'; g.textAlign = 'center'; g.fillText('h', 50, 62);
  g.fillStyle = accent; g.beginPath(); g.arc(59, 58.5, 2.6, 0, Math.PI * 2); g.fill();
  x.drawImage(c, cx - size / 2, cy - size / 2, size, size);
}
const pad = (n, l = 2) => String(n).padStart(l, '0');
const fmtDate = d => (d || '').replace(/-/g, '.');
const monthKey = d => (d || '').slice(0, 7);
const monthLabel = k => k ? `${k.slice(0, 4)} ${MONTHS[+k.slice(5, 7) - 1] || ''}` : '';
const imgUrl = p => p ? (p._local || IMG_BASE + encodeURIComponent(p.filename)) : '';
// 목록·작은 칸에는 작은 사진(긴 쪽 900px)을 써요. 없으면 큰 사진으로 대신 보여줘요.
const THUMB_BASE = 'images/thumbs/';
const thumbUrl = p => p ? (p._local || THUMB_BASE + encodeURIComponent(p.filename)) : '';
const tint = p => `color-mix(in srgb, ${shadeHex(mainShade(p))} 26%, var(--bg-3))`;
const ratio = p => S.ratios[p.filename] || 1.5;
/* 컴퓨터 설정에서 '애니메이션 효과'를 꺼두면 움직임을 줄여요. 주소 끝에 ?motion=on 을 붙이면 그 브라우저에서는 강제로 켜져요 (?motion=off 로 원래대로). */
const forceMotion = (() => { const q = new URLSearchParams(location.search).get('motion'); try { if (q === 'on') localStorage.setItem('hm-motion', '1'); if (q === 'off') localStorage.removeItem('hm-motion'); return localStorage.getItem('hm-motion') === '1'; } catch (e) { return q === 'on'; } })();
if (forceMotion) document.documentElement.classList.add('force-motion');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches && !forceMotion;
const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

function parseInfo(text) {
  const t = String(text || '').trim();
  const mm = t.match(/\b\d+(\.\d+)?mm\b/i);
  const f = t.match(/\bf\/?\d+(\.\d+)?\b/i);
  const s = t.match(/\b\d+\/\d+s\b|\b\d+(\.\d+)?s\b/i);
  const iso = t.match(/\biso\s*\d+\b/i);
  const cut = Math.min(...[mm, f, s, iso].filter(Boolean).map(m => m.index), t.length);
  return {
    camera: t.slice(0, cut).trim() || '—',
    focal: mm ? mm[0] : '',
    aperture: f ? f[0].replace(/^f\/?/i, 'ƒ/') : '—',
    shutter: s ? s[0] : '—',
    iso: iso ? iso[0].replace(/iso\s*/i, 'ISO ') : '—',
  };
}

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms);
}

function splitChars(text, base = 0, startIndex = 0) {
  let i = startIndex;
  return [...text].map(c => c === ' ' ? ' ' : `<span class="ch" style="--i:${i++};--base:${base}ms">${esc(c)}</span>`).join('');
}

/* ---------- 데이터 불러오기 ---------- */
async function loadJson(name, fallback) {
  try { const r = await fetch(DATA_BASE + name, { cache: 'no-store' }); if (!r.ok) throw 0; return await r.json(); }
  catch (e) { return fallback; }
}
async function loadData() {
  const [photos, projects, site, profile, posters, calendars, exhibitions] = await Promise.all([
    loadJson('photos.json', []), loadJson('projects.json', []), loadJson('site.json', {}), loadJson('profile.json', {}), loadJson('posters.json', []), loadJson('calendars.json', []), loadJson('exhibitions.json', []),
  ]);
  S.site = site; S.profile = profile; S.projects = projects; S.posters = posters; S.posterBase = DATA_BASE; S.calendars = calendars; S.exhibitions = exhibitions;
  S.photos = photos
    .filter(p => p && p.filename)
    .map(({ location, ...p }) => p) // 위치 정보는 쓰지 않아요
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.filename.localeCompare(b.filename));
  reindex();
  S.ratios = store.get('hm-ratios', {});
  S.archive = { ...S.archive, ...store.get('hm-archive', {}) };
}
function reindex() {
  S.photos.forEach((p, i) => { p._n = pad(i + 1, 3); });
  S.byName = new Map(S.photos.map(p => [p.filename, p]));
  S.photoProjects = new Map();
  S.projects.forEach(pr => (pr.photos || []).forEach(f => {
    if (!S.photoProjects.has(f)) S.photoProjects.set(f, []);
    S.photoProjects.get(f).push(pr);
  }));
}
const featured = () => (S.site.featuredPhotos || []).map(f => S.byName.get(f)).filter(Boolean);
const projectPhotos = pr => (pr.photos || []).map(f => S.byName.get(f)).filter(Boolean);
const projectCover = pr => S.byName.get(pr.cover) || projectPhotos(pr)[0];
const cameras = list => [...new Set(list.map(p => parseInfo(p.info).camera.toUpperCase()).filter(c => c && c !== '—'))];

const years = list => [...new Set(list.map(p => (p.date || '').slice(0, 4)).filter(Boolean))].sort();

const HEART_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.4 3.8 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.2 0 5.4 2.9 4.2 6.2C19.5 15.4 12 20 12 20z"/></svg>';

/* ---------- 사진 카드 ---------- */
function card(p, opt = {}) {
  const { cls = '', cap = true, d = 0, extra = '', full = false } = opt;
  const info = parseInfo(p.info);
  const dt = p.date ? new Date(p.date + 'T00:00:00') : null;
  const exif = [info.camera !== '—' ? info.camera : '', info.aperture !== '—' ? info.aperture : '', info.shutter !== '—' ? info.shutter : '', info.iso !== '—' ? info.iso : ''].filter(Boolean).join(' · ');
  return `<figure class="ph rv ${cls}" data-f="${esc(p.filename)}" style="--r:${ratio(p)};--tint:${tint(p)};--d:${d}ms">
    <div class="ph-frame"><img alt="${esc(fmtDate(p.date))} 사진" loading="lazy" decoding="async" src="${esc(full ? imgUrl(p) : thumbUrl(p))}" data-full="${esc(imgUrl(p))}">${p.story ? '<span class="story-tag mono">✎ Story</span>' : ''}
      <div class="ph-info"><div class="ph-info-top"><b>${dt ? `${MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}` : 'Undated'}</b><span class="mono">No. ${p._n}</span></div><div class="ph-exif mono">${esc(exif)}</div>${p.story ? `<div class="ph-story">“${esc(String(p.story).split('\n')[0])}”</div>` : ''}
        <button class="card-heart needs-social" data-heart="${esc(p.filename)}" aria-label="하트">${HEART_SVG}<span class="n">0</span></button></div>
    </div>
    ${cap ? `<figcaption class="ph-cap mono"><b>${p._n}</b><span>${fmtDate(p.date)}</span></figcaption>` : ''}${extra}
  </figure>`;
}

function wireImages(root = document) {
  $$('.ph img, .hero-slide img', root).forEach(img => {
    if (img._wired) return; img._wired = true;
    const done = () => {
      img.classList.add('ok');
      const fig = img.closest('[data-f]');
      if (fig && img.naturalWidth) {
        const r = +(img.naturalWidth / img.naturalHeight).toFixed(3);
        const f = fig.dataset.f;
        if (S.ratios[f] !== r) { S.ratios[f] = r; saveRatios(); }
        fig.style.setProperty('--r', r);
      }
    };
    if (img.complete && img.naturalWidth) done();
    else {
      img.addEventListener('load', done, { once: true });
      const hide = () => { const fig = img.closest('.ph'); if (fig) fig.style.display = 'none'; };
      img.addEventListener('error', () => {
        // 작은 사진이 아직 없으면 큰 사진으로 대신해요
        if (img.dataset.full && img.getAttribute('src') !== img.dataset.full) { img.addEventListener('load', done, { once: true }); img.addEventListener('error', hide, { once: true }); img.src = img.dataset.full; }
        else hide();
      }, { once: true });
    }
  });
  paintHearts(root);
}
let ratioTimer;
function saveRatios() { clearTimeout(ratioTimer); ratioTimer = setTimeout(() => store.set('hm-ratios', S.ratios), 800); }

/* 스크롤하면 나타나는 효과 */
const revealIO = new IntersectionObserver(entries => entries.forEach(en => {
  if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
}), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
function observeReveal(root = document) {
  $$('.rv:not(.in)', root).forEach(el => revealIO.observe(el));
}

/* 사진을 누르면 그 묶음 안에서 크게 보기 */
const lists = {};
function bindPhotoClicks(container, key) {
  container.addEventListener('click', e => {
    const fig = e.target.closest('.ph[data-f]');
    if (!fig || !container.contains(fig) || e.target.closest('[data-heart]')) return;
    const list = typeof lists[key] === 'function' ? lists[key]() : lists[key];
    const idx = list.findIndex(p => p.filename === fig.dataset.f);
    if (idx >= 0) Lightbox.open(list, idx, fig.querySelector('img'));
  });
}

/* ---------- 페이지 공통: 스크롤 ---------- */
let pageScroll = [];
let pageCleanup = [];
let lastY = 0;
function onScroll() {
  const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
  $('#progress').style.transform = `scaleX(${h > 0 ? y / h : 0})`;
  const top = $('#topbar');
  const hero = $('.hero') || $('.pd-hero');
  const overHero = hero && y < hero.offsetHeight - 70;
  top.classList.toggle('on-hero', !!overHero);
  top.classList.toggle('solid', !overHero && y > 10);
  const hide = y > 300 && y > lastY + 2 && !document.body.classList.contains('locked');
  if (y < lastY - 4 || y < 300) top.classList.remove('hidden');
  else if (hide) top.classList.add('hidden');
  document.body.classList.toggle('top-visible', !top.classList.contains('hidden'));
  $('#topBtn').classList.toggle('on', y > 900);
  $('#topRing').style.strokeDashoffset = 132 * (1 - (h > 0 ? y / h : 0));
  lastY = y;
  pageScroll.forEach(fn => fn(y));
}
addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });

/* 맨 위로: 천천히 감기며 올라가고, 위쪽 진행 막대도 거꾸로 줄어들어요 */
function rewindToTop() {
  const y0 = scrollY; if (!y0) return;
  if (reduced) return scrollTo(0, 0);
  const dur = Math.min(1500, 600 + y0 * 0.12), t0 = performance.now();
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  document.body.classList.add('rewinding');
  const stop = () => { removeEventListener('wheel', stop); removeEventListener('touchstart', stop); document.body.classList.remove('rewinding'); cancelAnimationFrame(rewindToTop.raf); };
  addEventListener('wheel', stop, { passive: true }); addEventListener('touchstart', stop, { passive: true });
  const step = now => {
    const t = Math.min(1, (now - t0) / dur);
    scrollTo(0, y0 * (1 - ease(t)));
    if (t < 1) rewindToTop.raf = requestAnimationFrame(step); else stop();
  };
  rewindToTop.raf = requestAnimationFrame(step);
}
$('#topBtn').addEventListener('click', rewindToTop);

/* ---------- 라우터 + 페이지 전환 ---------- */
const ROUTES = [
  [/^\/?$/, 'home', renderHome],
  [/^\/projects\/?$/, 'projects', renderProjects],
  [/^\/prints(?:\/([^/]+))?\/?$/, 'projects', renderPrints],
  [/^\/exhibitions\/?$/, 'projects', renderExhibitions],
  [/^\/exhibitions\/new\/?$/, 'projects', v => renderExEditor(v, null)],
  [/^\/exhibitions\/preview\/?$/, 'projects', v => renderExhibition(v, null, S._exDraft)],
  [/^\/exhibitions\/([^/]+)\/edit\/?$/, 'projects', renderExEditor],
  [/^\/exhibitions\/([^/]+)\/?$/, 'projects', renderExhibition],
  [/^\/calendars\/new\/?$/, 'projects', renderCalMaker],
  [/^\/calendars(?:\/([^/]+))?\/?$/, 'projects', renderCalendars],
  [/^\/projects\/(.+)$/, 'projects', renderProject],
  [/^\/p\/(\w+)$/, 'projects', renderShortProject],
  [/^\/colors(?:\/(\w+))?\/?$/, 'home', renderColorsRedirect],
  [/^\/constellation\/?$/, 'constellation', renderConstellation],
  [/^\/seasons\/?$/, 'seasons', renderSeasons],
  [/^\/guestbook\/?$/, 'guestbook', renderGuestbook],
  [/^\/studio\/?$/, 'studio', renderStudio],
];
let firstRender = true;
function currentRoute() {
  const path = decodeURIComponent(location.hash.replace(/^#/, '') || '/');
  for (const [re, name, fn] of ROUTES) { const m = path.match(re); if (m) return { name, fn, args: m.slice(1) }; }
  return { name: 'home', fn: renderHome, args: [] };
}
function render() {
  const r = currentRoute();
  if (Studio.authed && !Drafts.pulled) Drafts.pull().then(got => {
    if (!got.length) return;
    toast(`다른 기기에서 임시저장한 ${got.map(k => Drafts.NAME[k]).join(' · ')}을(를) 불러왔어요`, 4200);
    if (/^#\/(calendars\/new|exhibitions\/new|exhibitions\/[^/]+\/edit|studio)/.test(location.hash)) render();
  });
  const go = () => {
    pageCleanup.forEach(f => { try { f(); } catch (e) {} });
    pageCleanup = []; pageScroll = []; Drafts.flush();
    const view = $('#view');
    view.innerHTML = '';
    document.body.dataset.route = r.name;
    scrollTo(0, 0);
    r.fn(view, ...r.args);
    wireImages(view); observeReveal(view);
    // 작업물 탭이 옆으로 밀리는 휴대폰에서는 지금 고른 탭이 보이게
    const tabOn = $(".ptabs a.on", view); if (tabOn && tabOn.parentNode.scrollWidth > tabOn.parentNode.clientWidth) tabOn.parentNode.scrollLeft = tabOn.offsetLeft - 16;
    setDock(r.name);
    onScroll();
  };
  // 페이지 전환은 짧은 페이드라서 움직임 줄이기 설정에서도 그대로 써요
  if (firstRender || document.hidden || (reduced && !document.startViewTransition)) { firstRender = false; go(); return; }
  if (document.startViewTransition && !document.hidden) { const vt = document.startViewTransition(go); vt.ready.catch(() => {}); vt.finished.catch(() => {}); }
  else {
    const c = $('#curtain');
    c.animate([{ transform: 'scaleY(0)', transformOrigin: 'bottom' }, { transform: 'scaleY(1)', transformOrigin: 'bottom' }], { duration: 200, easing: 'cubic-bezier(.77,0,.18,1)', fill: 'forwards' }).onfinish = () => {
      go();
      c.animate([{ transform: 'scaleY(1)', transformOrigin: 'top' }, { transform: 'scaleY(0)', transformOrigin: 'top' }], { duration: 250, easing: 'cubic-bezier(.77,0,.18,1)', fill: 'forwards' });
    };
  }
}
addEventListener('hashchange', () => { if (Lightbox.isOpen) Lightbox.close(true); closeDrawer(); render(); });

// 메뉴 밑줄: 지금 페이지 메뉴 밑에 있다가, 마우스를 올린 메뉴로 따라가요
const dockInd = a => { const ind = $('#dockInd'); if (!a || !a.offsetWidth) { ind.style.width = '0px'; return; } ind.style.width = a.offsetWidth + 'px'; ind.style.transform = `translateX(${a.offsetLeft}px)`; };
function setDock(name) {
  const dock = $('#dock');
  $$('a', dock).forEach(a => a.classList.toggle('active', a.dataset.route === name));
  dockInd($('a.active', dock));
}
$('#dock').addEventListener('pointerover', e => { const a = e.target.closest('a'); if (a && e.pointerType === 'mouse') dockInd(a); });
$('#dock').addEventListener('pointerleave', () => dockInd($('a.active', $('#dock'))));
// 좁은 화면: 메뉴 버튼(☰)을 누르면 유리 막대 아래로 메뉴가 펼쳐져요
const navOpen = on => { $('#topbar').classList.toggle('open', on); $('#navBtn').setAttribute('aria-expanded', on); };
$('#navBtn').onclick = e => { e.stopPropagation(); navOpen(!$('#topbar').classList.contains('open')); };
addEventListener('click', e => { if (!e.target.closest('#topbar')) navOpen(false); });
addEventListener('hashchange', () => navOpen(false));
addEventListener('resize', () => setDock(document.body.dataset.route));

/* ============================================================
   홈
   ============================================================ */
function renderHome(view) {
  const site = S.site, all = S.photos;
  let heroList = featured();
  for (const p of all) { if (heroList.length >= 5) break; if (!heroList.includes(p)) heroList.push(p); }
  // Selected Works에는 관리에서 직접 고른 대표작만 보여줘요 (없으면 칸을 숨겨요)
  const selected = featured();
  const yrs = years(all);
  const statement = `${(site.heroNote || '').replace(/\n/g, ' ')} ${site.featuredDescription || ''} 카메라를 들고 걸으며 마주친 빛과 색, 오래 바라보고 싶었던 순간들을 이곳에 모아 둡니다.`.trim();

  view.innerHTML = `
  <section class="hero" id="hero">
    ${heroList.map((p, i) => `<div class="hero-slide ${i === 0 ? 'on' : ''}" data-f="${esc(p.filename)}"><img ${i === 0 ? 'src' : 'data-src'}="${esc(imgUrl(p))}" alt=""></div>`).join('')}
    <div class="hero-inner">
      <div class="hero-kicker mono">${esc(site.archiveKicker || 'THE PHOTOGRAPHIC ARCHIVE')}</div>
      <h1 class="hero-title split">${splitChars(site.heroPrefix || 'A way of', 200)}<br><em>${splitChars(site.heroEmphasis || 'seeing.', 200, [...(site.heroPrefix || 'A way of')].length)}</em></h1>
      <div class="hero-bottom">
        <div class="hero-note">${esc(site.heroNote || '')}<small class="mono">${esc(site.heroCredit || '')}</small></div>
        <div>
          <div class="hero-bars">${heroList.map((_, i) => `<span class="hero-bar" data-i="${i}"><i></i></span>`).join('')}</div>
          <div class="hero-meta mono"><span id="heroNum">FRAME ${heroList[0] ? heroList[0]._n : ''}</span><span id="heroDate">${heroList[0] ? fmtDate(heroList[0].date) : ''}</span></div>
        </div>
      </div>
    </div>
    <div class="scroll-cue mono"><span>Scroll</span><i></i></div>
  </section>

  <section class="statement">
    <div class="mono accent" style="margin-bottom:26px">( About this archive )</div>
    <p id="statement">${statement.split(/\s+/).map(w => `<span class="w">${esc(w)}</span>`).join(' ')}</p>
    <div class="statement-meta mono">
      <div><b>${all.length}</b>Photographs</div>
      <div><b>${S.projects.length}</b>Projects</div>
      <div><b>${cameras(all).length}</b>Cameras</div>
      <div><b>${yrs.length ? (yrs[0] === yrs[yrs.length - 1] ? yrs[0] : `${yrs[0]}—${yrs[yrs.length - 1].slice(2)}`) : '—'}</b>Years</div>
    </div>
  </section>

  <section class="hs" id="hs" ${selected.length ? '' : 'hidden'}>
    <div class="hs-sticky">
      <div class="hs-head">
        <h2>${esc(site.featuredTitle || 'Selected Works').replace(/(\S+)$/, '<em>$1</em>')}</h2>
        <div class="hs-count"><b id="hsNow">01</b> / ${pad(selected.length)}</div>
      </div>
      <div class="hs-track" id="hsTrack">
        ${selected.map((p, i) => card(p, { cls: 'hs-card', d: i * 60, full: true })).join('')}
      </div>
    </div>
  </section>

  <section class="loved-sec needs-social" id="lovedSec" hidden>
    <div class="hs-head" style="padding:0;margin-bottom:28px"><h2>Most <em>loved</em></h2><div class="hs-count">방문자의 하트를 가장 많이 받은 사진</div></div>
    <div class="loved" id="loved"></div>
  </section>

  <section class="archive" id="archive">
    <div class="archive-head">
      <h2>${esc(site.galleryTitle || 'Photographs')}<sup id="archCount">${all.length}</sup></h2>
    </div>
    <div class="toolbar" id="toolbar">
      <div class="toolbar-row">
      <div class="seg" id="viewSeg">
        <span class="seg-ind"></span>
        <button data-v="mosaic">Mosaic</button>
        <button data-v="timeline">By date</button>
      </div>
      <span class="select"><select id="monthSel" aria-label="기간"></select></span>
      <div class="seg" id="lightSeg" aria-label="밝기"><span class="seg-ind"></span><button data-v="all">모든 밝기</button>${LIGHTS.map(([k, l]) => `<button data-v="${k}">${l}</button>`).join('')}</div>
      <span class="spacer"></span>
      <button class="pill" id="randomBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h3.5c3 0 4.5 10 8 10H20M4 17h3.5c1.4 0 2.4-2 3.3-4.4M14.3 9.4C15 8 15.6 7 16.5 7H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/></svg>Random</button>
      <button class="pill" id="playAllBtn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>Slideshow</button>
      </div>
      <div class="palette" id="palette" aria-label="색으로 거르기"></div>
      <div class="shades" id="shades" aria-label="세밀한 색"></div>
    </div>
    <div class="count-line mono" id="countLine"></div>
    <div id="gallery"></div>
  </section>

  <footer class="footer mono"><span>${esc(site.footerCopyright || '© Hamihamoo')}</span><span>${esc(site.archiveKicker || '')}</span><a href="#/" id="toTop">Back to top ↑</a></footer>`;

  /* 히어로 슬라이드 */
  const slides = $$('.hero-slide', view), bars = $$('.hero-bar', view);
  let cur = 0, timer;
  // 첫 사진만 먼저 받고, 나머지는 첫 사진이 화면에 뜬 뒤에 받아요 (화질은 그대로)
  const loadRest = () => slides.forEach(sl => { const im = $('img', sl); if (im.dataset.src && !im.getAttribute('src')) im.src = im.dataset.src; });
  const first = slides[0] && $('img', slides[0]);
  if (first) { if (first.complete && first.naturalWidth) loadRest(); else { first.addEventListener('load', loadRest, { once: true }); first.addEventListener('error', loadRest, { once: true }); } }
  const restTimer = setTimeout(loadRest, 4000);
  const DUR = 6000;
  const show = i => {
    slides[cur].classList.remove('on');
    cur = (i + slides.length) % slides.length;
    slides[cur].classList.add('on');
    const img = $('img', slides[cur]); if (img.dataset.src && !img.getAttribute('src')) img.src = img.dataset.src; img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
    bars.forEach((b, j) => { b.classList.toggle('done', j < cur); b.classList.remove('on'); });
    void bars[cur].offsetWidth; bars[cur].classList.add('on');
    const p = heroList[cur];
    $('#heroNum').textContent = 'FRAME ' + p._n; $('#heroDate').textContent = fmtDate(p.date);
    clearTimeout(timer); timer = setTimeout(() => show(cur + 1), DUR);
  };
  if (slides.length) { view.style.setProperty('--dur', DUR + 'ms'); bars[0].classList.add('on'); timer = setTimeout(() => show(1), DUR); }
  bars.forEach(b => b.addEventListener('click', () => show(+b.dataset.i)));
  $('#hero').addEventListener('click', e => {
    if (e.target.closest('.hero-bar')) return;
    if (e.target.closest('.hero-inner') && !e.target.closest('.hero-title')) return;
    Lightbox.open(heroList, cur, $('img', slides[cur]));
  });
  pageCleanup.push(() => { clearTimeout(timer); clearTimeout(restTimer); });

  /* 숫자가 0부터 세어 올라가기 */
  const countIO = new IntersectionObserver(es => es.forEach(en => {
    if (!en.isIntersecting) return; countIO.disconnect();
    $$('.statement-meta b', view).forEach((b, k) => {
      const m = b.textContent.match(/^(\d+)(.*)$/); if (!m || reduced) return;
      const to = +m[1], rest = m[2], from = to > 1000 ? to - 40 : 0, t0 = performance.now() + k * 120;
      const tick = now => { const t = Math.max(0, Math.min(1, (now - t0) / 1400)), e = 1 - Math.pow(1 - t, 4); b.textContent = Math.round(from + (to - from) * e) + rest; if (t < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }), { threshold: 0.4 });
  countIO.observe($('.statement-meta', view)); pageCleanup.push(() => countIO.disconnect());

  /* 소개 문장: 스크롤에 따라 단어가 하나씩 밝아짐 */
  const words = $$('#statement .w', view);
  const stEl = $('#statement', view);
  pageScroll.push(() => {
    const r = stEl.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('lit', i < n));
  });

  /* 대표작: 세로 스크롤을 가로로 */
  const hs = $('#hs', view), track = $('#hsTrack', view);
  const sizeHs = () => {
    if (!selected.length) return;
    if (innerWidth <= 720) { hs.style.height = ''; track.style.transform = ''; return; }
    const extra = Math.max(0, track.scrollWidth - innerWidth);
    hs.style.height = (innerHeight + extra) + 'px';
  };
  const hsScroll = () => {
    if (!selected.length || innerWidth <= 720) return;
    const top = hs.offsetTop, extra = Math.max(0, track.scrollWidth - innerWidth);
    const p = Math.min(1, Math.max(0, (scrollY - top) / Math.max(1, extra)));
    track.style.transform = `translate3d(${-p * extra}px,0,0)`;
    $('#hsNow').textContent = pad(Math.min(selected.length, Math.floor(p * (selected.length - 1) + 1.5)));
  };
  pageScroll.push(hsScroll);
  const ro = new ResizeObserver(() => { sizeHs(); hsScroll(); });
  ro.observe(track); pageCleanup.push(() => ro.disconnect());
  lists.selected = selected; bindPhotoClicks(track, 'selected');

  /* 방문자가 고른 인기 사진 (하트 수 순서) */
  const lovedSec = $('#lovedSec', view), lovedEl = $('#loved', view);
  let lovedKey = '';
  const renderLoved = () => {
    const top = S.photos.filter(p => heartsOf(p) > 0).sort((a, b) => heartsOf(b) - heartsOf(a) || (b.date || '').localeCompare(a.date || '')).slice(0, 5);
    lovedSec.hidden = !Social.ok || !top.length;
    const key = top.map(p => p.filename + heartsOf(p)).join('|'); if (key === lovedKey) return; lovedKey = key;
    lists.loved = top;
    lovedEl.innerHTML = top.map((p, r) => `<div>${card(p, { cap: false, d: r * 70 })}<div class="loved-rank"><b>${pad(r + 1)}</b><span class="mono">${HEART_SVG}<i data-count="${esc(p.filename)}">${heartsOf(p)}</i></span></div></div>`).join('');
    wireImages(lovedEl); observeReveal(lovedEl);
  };
  bindPhotoClicks(lovedEl, 'loved');
  Social.listeners.add(renderLoved); pageCleanup.push(() => Social.listeners.delete(renderLoved));
  renderLoved();

  /* 아카이브 */
  lists.archive = () => archiveList();
  bindPhotoClicks($('#gallery', view), 'archive');
  const months = [...new Set(all.map(p => monthKey(p.date)).filter(Boolean))];
  $('#monthSel', view).innerHTML = `<option value="all">전체 기간</option>` + years(all).reverse().map(y =>
    `<optgroup label="${y}"><option value="${y}">${y} 전체</option>${months.filter(m => m.startsWith(y)).map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('')}</optgroup>`).join('');
  // 큰 색 막대: 너비는 그 색이 들어간 사진 수
  const counts = Object.fromEntries(FAMILIES.map(([f]) => [f, all.filter(p => familyShare(p, f) >= minShare(f)).length]));
  $('#palette', view).innerHTML = FAMILIES.filter(([f]) => counts[f]).map(([f, ko, hex]) => `<button class="spec" data-c="${f}" style="--n:${counts[f]};--c:${hex}" title="${ko} ${counts[f]}장" aria-label="${ko} ${counts[f]}장"><span class="spec-tip mono">${ko} ${counts[f]}</span></button>`).join('');
  $('#monthSel', view).value = S.archive.month;
  if ($('#monthSel', view).value !== S.archive.month) S.archive.month = 'all';

  $('#viewSeg', view).addEventListener('click', e => { const b = e.target.closest('button'); if (b) setArchive({ view: b.dataset.v }); });
  $('#monthSel', view).addEventListener('change', e => setArchive({ month: e.target.value }));
  $('#palette', view).addEventListener('click', e => { const b = e.target.closest('.spec'); if (b) setArchive({ color: S.archive.color === b.dataset.c ? 'all' : b.dataset.c, shade: 'all' }); });
  $('#shades', view).addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) setArchive({ shade: S.archive.shade === b.dataset.s ? 'all' : b.dataset.s }); });
  $('#lightSeg', view).addEventListener('click', e => { const b = e.target.closest('button'); if (b) setArchive({ light: b.dataset.v }); });
  // 랜덤: 목록 전체를 섞어서 열어요 (첫 장만이 아니라 넘길 때마다 무작위 순서)
  $('#randomBtn', view).addEventListener('click', () => {
    const l = [...archiveList()];
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    if (l.length) Lightbox.open(l, 0);
  });
  $('#playAllBtn', view).addEventListener('click', () => { const l = archiveList(); if (l.length) { Lightbox.open(l, 0); Lightbox.play(true); } });
  $('#toTop', view).addEventListener('click', e => { e.preventDefault(); rewindToTop(); });

  const tb = $('#toolbar', view);
  pageScroll.push(() => tb.classList.toggle('stuck', tb.getBoundingClientRect().top < 80 && $('#archive').getBoundingClientRect().bottom > 200));
  renderArchive(false);
  requestAnimationFrame(() => { sizeHs(); syncSeg($('#viewSeg', view)); syncSeg($('#lightSeg', view)); });
}

function archiveList() {
  const { month, color, shade, light } = S.archive;
  const list = S.photos.filter(p => (month === 'all' || (p.date || '').startsWith(month))
    && (light === 'all' || lightOf(p) === light)
    && (color === 'all' || familyShare(p, color) >= minShare(color))
    && (shade === 'all' || shadeShare(p, shade) >= minShare(shade)));
  // 색을 고르면 그 색이 많이 들어간 사진부터 보여줘요
  if (color !== 'all') {
    const score = p => shade !== 'all' ? shadeShare(p, shade) : familyShare(p, color);
    list.sort((a, b) => score(b) - score(a) || (b.date || '').localeCompare(a.date || ''));
  }
  return list;
}
function validArchive() {
  const a = S.archive;
  if (!FAMILIES.some(([f]) => f === a.color)) a.color = 'all';
  if (!SHADES[a.shade] || familyOf(a.shade) !== a.color) a.shade = 'all';
  if (!LIGHTS.some(([k]) => k === a.light)) a.light = 'all';
}
function setArchive(patch) {
  Object.assign(S.archive, patch); store.set('hm-archive', S.archive);
  renderArchive(true);
}
function syncSeg(seg) {
  if (!seg) return; // 페이지를 빨리 옮기면 버튼 묶음이 이미 사라졌을 수 있어요
  const on = $('button.on', seg), ind = $('.seg-ind', seg);
  if (!on || !ind) return;
  ind.style.width = on.offsetWidth + 'px'; ind.style.transform = `translateX(${on.offsetLeft}px)`;
}
function renderArchive(animate) {
  const g = $('#gallery'); if (!g) return;
  if (!['mosaic', 'timeline'].includes(S.archive.view)) S.archive.view = 'mosaic';
  validArchive();
  const list = archiveList(), A = S.archive;
  $$('#viewSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === A.view));
  syncSeg($('#viewSeg'));
  $$('#lightSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === A.light));
  syncSeg($('#lightSeg'));
  $$('#palette .spec').forEach(d => d.classList.toggle('on', d.dataset.c === A.color));
  $('#palette').classList.toggle('has-on', A.color !== 'all');
  // 큰 색을 고르면 그 안의 세밀한 색이 펼쳐져요
  const shadesEl = $('#shades');
  const inFamily = A.color === 'all' ? [] : Object.keys(SHADES).filter(s => familyOf(s) === A.color).map(s => [s, S.photos.filter(p => shadeShare(p, s) >= minShare(s)).length]).filter(([, n]) => n);
  shadesEl.classList.toggle('on', inFamily.length > 1);
  shadesEl.innerHTML = inFamily.length > 1 ? inFamily.map(([s, n]) => `<button class="shade ${A.shade === s ? 'on' : ''}" data-s="${s}"><i style="--c:${shadeHex(s)}"></i>${shadeKo(s)}<span class="mono">${n}</span></button>`).join('') : '';
  const filt = [A.month !== 'all' ? (A.month.length === 4 ? A.month + '년' : monthLabel(A.month)) : '', A.color !== 'all' ? (A.shade !== 'all' ? shadeKo(A.shade) : familyKo(A.color)) : '', A.light !== 'all' ? LIGHTS.find(([k]) => k === A.light)[1] : ''].filter(Boolean).join(' · ');
  $('#countLine').innerHTML = `${list.length} frames${filt ? ` — ${esc(filt)} <button class="accent mono" id="clearFilt" style="margin-left:8px">✕ 필터 해제</button>` : ''}`;
  $('#archCount').textContent = list.length;
  const clr = $('#clearFilt'); if (clr) clr.onclick = () => { $('#monthSel').value = 'all'; setArchive({ month: 'all', color: 'all', shade: 'all', light: 'all' }); };

  const motion = animate && !reduced;
  // 바뀌기 전: 화면에 보이던 사진들의 자리를 기억해요
  if (motion) { const top = $('#archive').offsetTop - 20; if (scrollY > top + 200) scrollTo(0, top); }
  const old = new Map($$('.ph[data-f]', g).map(f => [f.dataset.f, f]));
  const onScreen = r => r.bottom > -100 && r.top < innerHeight + 100;
  const first = new Map();
  if (motion) old.forEach((f, k) => { const r = f.getBoundingClientRect(); if (onScreen(r)) first.set(k, r); });

  // 같은 사진은 같은 요소를 그대로 옮겨 써요 (다시 불러오지 않아 깜빡임이 없어요)
  const tmp = document.createElement('div');
  const fig = (p, i) => { if (old.has(p.filename)) return old.get(p.filename); tmp.innerHTML = card(p, { cap: false, d: (i % 6) * 50 }); return tmp.firstElementChild; };
  let root;
  if (!list.length) { root = document.createElement('div'); root.className = 'empty'; root.textContent = '조건에 맞는 사진이 없어요.'; }
  else if (S.archive.view === 'mosaic') { root = document.createElement('div'); root.className = 'mosaic'; list.forEach((p, i) => root.appendChild(fig(p, i))); }
  else {
    const groups = new Map();
    list.forEach(p => { const k = p.date || '—'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
    root = document.createElement('div'); root.className = 'timeline';
    groups.forEach((ps, d) => {
      const grp = document.createElement('div'); grp.className = 'tl-group';
      grp.innerHTML = `<div class="tl-date"><b>${d === '—' ? '—' : d.slice(5).replace('-', '.')}</b><span class="mono">${d.slice(0, 4)} · ${ps.length} frames · ${esc(cameras(ps).join(', ') || '')}</span></div><div class="tl-grid"></div>`;
      ps.forEach((p, i) => grp.lastElementChild.appendChild(fig(p, i)));
      root.appendChild(grp);
    });
  }
  const kept = new Set(list.map(p => p.filename));
  // 빠지는 사진: 제자리에서 작아지며 사라지기
  const ghosts = [];
  if (motion) first.forEach((r, k) => {
    if (kept.has(k) || ghosts.length > 40) return;
    const gh = old.get(k).cloneNode(true); gh.classList.add('in'); gh.querySelector('.ph-frame').style.height = '100%';
    Object.assign(gh.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0, zIndex: 5, pointerEvents: 'none' });
    document.body.appendChild(gh); ghosts.push(gh);
    gh.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.85)' }], { duration: 200, easing: 'ease-out', fill: 'forwards' }).onfinish = () => gh.remove();
  });
  g.replaceChildren(root);
  wireImages(g);

  if (motion) {
    const EASE = 'cubic-bezier(.22,1,.36,1)';
    let k = 0;
    $$('.ph[data-f]', g).forEach(el => {
      const was = first.get(el.dataset.f), now = el.getBoundingClientRect();
      if (was) {
        // 남는 사진: 원래 자리에서 새 자리로 미끄러지듯
        el.classList.add('in');
        const dx = was.left - now.left, dy = was.top - now.top, sx = was.width / now.width, sy = was.height / now.height;
        if (Math.abs(dx) + Math.abs(dy) > 1 || Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01)
          el.animate([{ transformOrigin: '0 0', transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transformOrigin: '0 0', transform: 'none' }], { duration: 300, easing: EASE });
      } else if (onScreen(now)) {
        // 새로 들어오는 사진: 살짝 커지며 나타나기
        el.classList.add('in');
        el.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 250, delay: 60 + Math.min(k++, 20) * 25, easing: EASE, fill: 'backwards' });
      }
    });
    $$('.tl-date', g).forEach((d, i) => { if (onScreen(d.getBoundingClientRect())) d.animate([{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'none' }], { duration: 250, delay: 60 + i * 60, easing: EASE, fill: 'backwards' }); });
  }
  observeReveal(g);
}
/* ============================================================
   프로젝트 목록
   ============================================================ */
function renderProjects(view) {
  const prs = S.projects.filter(pr => projectPhotos(pr).length);
  view.innerHTML = `<section class="page">
    ${worksHead('series', prs.length)}
    <div class="plist" id="plist">
      ${prs.map((pr, i) => {
        const ps = projectPhotos(pr), ds = ps.map(p => p.date).filter(Boolean).sort();
        return `<a class="prow rv" href="#/projects/${encodeURIComponent(pr.id)}" data-cover="${esc(thumbUrl(projectCover(pr)))}" style="--d:${i * 70}ms">
          <span class="mono faint">${pad(i + 1)}</span>
          <h3>${esc(pr.title)}</h3>
          <span class="prow-desc">${esc(pr.description || pr.subtitle || '')}</span>
          <span class="mono faint prow-count">${ps.length} frames<br>${ds.length ? fmtDate(ds[ds.length - 1]).slice(0, 7) : ''}</span>
          <span class="arrow">→</span>
        </a>`;
      }).join('')}
    </div>
    <div class="pcards">
      ${prs.map(pr => { const c = projectCover(pr); return `<a class="pcard rv" href="#/projects/${encodeURIComponent(pr.id)}"><figure class="ph" data-f="${esc(c.filename)}" style="--tint:${tint(c)}"><div class="ph-frame"><img src="${esc(thumbUrl(c))}" data-full="${esc(imgUrl(c))}" alt="" loading="lazy"></div></figure><h3>${esc(pr.title)}</h3><span class="mono faint">${projectPhotos(pr).length} frames · ${esc(pr.subtitle || '')}</span></a>`; }).join('')}
    </div>
    ${prs.length ? '' : '<div class="empty">아직 프로젝트가 없어요.</div>'}
  </section>
  <div class="pfloat" id="pfloat"><img alt=""></div>`;

  // 마우스를 따라다니는 표지 미리보기
  const pf = $('#pfloat', view), pimg = $('img', pf);
  let tx = 0, ty = 0, x = 0, y = 0, raf;
  const loop = () => { x += (tx - x) * 0.14; y += (ty - y) * 0.14; pf.style.left = x + 'px'; pf.style.top = y + 'px'; raf = requestAnimationFrame(loop); };
  loop();
  const plist = $('#plist', view);
  plist.addEventListener('mousemove', e => { tx = e.clientX + 170; ty = e.clientY; });
  plist.addEventListener('mouseover', e => {
    const row = e.target.closest('.prow'); if (!row) return;
    if (pimg.getAttribute('src') !== row.dataset.cover) { pimg.style.opacity = 0; pimg.src = row.dataset.cover; pimg.onload = () => pimg.style.opacity = 1; }
    pf.classList.add('on');
  });
  plist.addEventListener('mouseleave', () => pf.classList.remove('on'));
  pageCleanup.push(() => cancelAnimationFrame(raf));
}

/* ============================================================
   Projects / Prints 공용 머리말: 사진 묶음(Series)과 엽서·포스터(Prints)를 탭으로 나눠요
   ============================================================ */
function worksHead(tab, n) {
  const series = S.projects.filter(pr => projectPhotos(pr).length).length, prints = (S.posters || []).length, cals = (S.calendars || []).length, exs = (S.exhibitions || []).length;
  const t = tab === 'series'
    ? ['Projects', `( ${pad(n)} series )`, '장소와 계절, 하나의 주제로 엮은 사진 묶음이에요. 제목 위에 마우스를 올려 표지를 미리 보세요.']
    : tab === 'exhibitions' ? ['Exhibitions', `( ${pad(n)} exhibitions )`, '여러 시리즈에서 골라 주제로 엮은 전시예요. 입구부터 출구까지, 한 점씩 천천히 걸어 보세요.']
    : tab === 'prints' ? ['Prints', `( ${pad(n)} prints )`, '아카이브의 사진으로 만든 엽서와 포스터예요. 누르면 크게 보고, 원본 사진으로도 갈 수 있어요.']
    : ['Calendars', `( ${pad(n)} calendars )`, '열두 달 사진으로 엮은 탁상 달력이에요. 한 장씩 넘겨 보고, 뒤집어 뒷면도 보고, 내려받을 수 있어요.'];
  return `<div class="page-head">
      <div><div class="page-kicker mono">${t[1]}</div><h1 class="page-title split">${splitChars(t[0])}</h1></div>
      <p class="page-sub">${t[2]}</p>
    </div>
    <nav class="ptabs" aria-label="작업물 종류">
      <a href="#/projects" class="${tab === 'series' ? 'on' : ''}">Series <sup class="mono">${pad(series)}</sup><small>사진 묶음</small></a>
      <a href="#/exhibitions" class="${tab === 'exhibitions' ? 'on' : ''}">Exhibitions <sup class="mono">${pad(exs)}</sup><small>주제 전시</small></a>
      <a href="#/prints" class="${tab === 'prints' ? 'on' : ''}">Prints <sup class="mono">${pad(prints)}</sup><small>엽서 · 포스터</small></a>
      <a href="#/calendars" class="${tab === 'calendars' ? 'on' : ''}">Calendars <sup class="mono">${pad(cals)}</sup><small>탁상 달력</small></a>
    </nav>`;
}
// 엽서·포스터 분류: 만든 형태로 나눠요
const printKind = f => PRINT_KIND[f] || PRINT_KIND[String(f).split('-')[0]] || 'etc';
const PRINT_KIND = { orig: 'card', sq: 'etc', r45: 'social', r23: 'card', a4: 'poster', r916: 'social', phone: 'social', r25: 'etc', land: 'card', port: 'card', square: 'etc', poster: 'poster', posterL: 'poster', feed: 'social', story: 'social', phone: 'social', wide: 'social', bookmark: 'etc', ticket: 'etc' };
const PRINT_KIND_KO = { all: '전체', card: '엽서', poster: '포스터', social: 'SNS · 배경화면', etc: '기타' };
const LAYOUT_KO = { card: '엽서', gallery: '전시 포스터', full: '꽉 찬 사진', type: '글자 속 사진', swiss: '스위스', cover: '잡지 표지', split: '반반', frame: '액자', polaroid: '폴라로이드', circle: '원형', warhol: '팝아트 4분할', repeat: '반복 글자', ticket: '입장권', newspaper: '신문 1면', movie: '영화 포스터', editorial: '잡지 지면', campaign: '캠페인', filmstill: '영화 스틸', calendar: '달력', receipt: '영수증', nowplaying: '음악 재생', arch: '아치 창', triptych: '세 폭', museum: '미술관 배너', cutstrip: '잘린 글자' };
const printKey = p => (p.file || '').split('/').pop().replace(/\.jpg$/i, '');
function renderPrints(view, key) {
  const all = [...(S.posters || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const kinds = ['all', ...['card', 'poster', 'social', 'etc'].filter(k => all.some(p => printKind(p.fmt) === k))];
  const count = k => k === 'all' ? all.length : all.filter(p => printKind(p.fmt) === k).length;
  const keyOf = p => p.file || p._local;
  let kind = 'all', selecting = false;
  const picked = new Set();
  view.innerHTML = `<section class="page">
    ${worksHead('prints', all.length)}
    ${Postcard.draftOf() ? `<div class="draft-bar"><span>임시저장된 엽서가 있어요</span><button class="btn small" id="prResume">이어서 만들기</button><button class="pc-link" id="prDrop">지우기</button></div>` : ''}
    ${all.length ? `<div class="toolbar-row prints-bar"><div class="seg" id="prKind"><span class="seg-ind"></span>${kinds.map(k => `<button data-v="${k}" class="${k === 'all' ? 'on' : ''}">${PRINT_KIND_KO[k]} <span class="mono">${count(k)}</span></button>`).join('')}</div><button class="pill" id="prSelect">선택해서 내려받기</button></div>` : ''}
    <div class="prints-wall" id="prWall"></div>
    ${all.length ? '' : '<div class="empty">아직 전시된 엽서·포스터가 없어요. 사진을 열고 엽서 버튼으로 만들어 보세요.</div>'}
    <div class="pr-selbar" id="prBar" hidden>
      <span class="mono" id="prCount">0장 선택</span>
      <button id="prAll">전체 선택</button><button id="prNone">선택 해제</button>
      <button class="go" id="prDown" disabled>내려받기 ↓</button><button id="prDone" aria-label="선택 끝내기">완료</button>
    </div>
  </section>`;
  const wall = $('#prWall', view);
  if ($('#prResume', view)) $('#prResume', view).onclick = () => Postcard.open(S.byName.get(Postcard.draftOf().photo));
  if ($('#prDrop', view)) $('#prDrop', view).onclick = () => { if (!confirm('임시저장된 엽서를 지울까요?')) return; Drafts.clear('print'); $('.draft-bar', view).remove(); };
  const list = () => kind === 'all' ? all : all.filter(p => printKind(p.fmt) === kind);
  function paint() {
    wall.classList.toggle('selecting', selecting);
    wall.innerHTML = list().map((p, i) => {
      const src = S.byName.get(p.photo), prs = src ? (S.photoProjects.get(src.filename) || []) : [];
      return `<figure class="print rv ${picked.has(keyOf(p)) ? 'sel' : ''}" data-i="${i}" style="--d:${(i % 6) * 60}ms">
        <button class="print-frame" aria-label="${esc(p.title || '포스터')} ${selecting ? '선택' : '크게 보기'}"><img src="${esc(p._local || S.posterBase + p.file)}" alt="" loading="lazy" style="aspect-ratio:${p.w} / ${p.h}"><span class="print-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></button>
        <figcaption>
          <b>${esc(p.title || 'Untitled')}</b>
          <span class="mono faint">${[...new Set([PRINT_KIND_KO[printKind(p.fmt)], LAYOUT_KO[p.layout]])].filter(Boolean).concat(p.date ? [fmtDate(p.date)] : []).join(' · ')}</span>
          ${src ? `<span class="print-src"><a href="#" data-photo="${esc(src.filename)}">원본 사진 →</a>${prs.map(pr => `<a href="#/projects/${encodeURIComponent(pr.id)}" class="chip-c">${esc(pr.title)}</a>`).join('')}</span>` : ''}
        </figcaption>
      </figure>`;
    }).join('');
    observeReveal(wall);
  }
  // 선택 상태를 아래 막대에 보여 줘요. 고른 엽서는 미리 받아 두어서, 휴대폰 공유 창이 바로 뜨게 해요
  const files = new Map();
  const prefetch = p => { const k = keyOf(p); if (!files.has(k)) files.set(k, fetchPrint(p, files.size).catch(() => { files.delete(k); return null; })); };
  function paintBar() {
    $('#prBar', view).hidden = !selecting;
    $('#prCount', view).textContent = `${picked.size}장 선택`;
    $('#prDown', view).disabled = !picked.size;
    $('#prSelect', view) && $('#prSelect', view).classList.toggle('on', selecting);
  }
  const setSelecting = on => { selecting = on; if (!on) picked.clear(); paint(); paintBar(); };
  paint();
  const seg = $('#prKind', view);
  if (seg) {
    requestAnimationFrame(() => syncSeg(seg));
    seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', seg).forEach(x => x.classList.toggle('on', x === b)); syncSeg(seg); kind = b.dataset.v; paint(); });
  }
  if (all.length) {
    $('#prSelect', view).onclick = () => setSelecting(!selecting);
    $('#prDone', view).onclick = () => setSelecting(false);
    // 전체 선택은 지금 보고 있는 분류(예: 포스터만) 안에서 골라요
    $('#prAll', view).onclick = () => { list().forEach(p => { picked.add(keyOf(p)); prefetch(p); }); paint(); paintBar(); };
    $('#prNone', view).onclick = () => { picked.clear(); paint(); paintBar(); };
    $('#prDown', view).onclick = async () => {
      const items = all.filter(p => picked.has(keyOf(p)));
      if (!items.length) return;
      const btn = $('#prDown', view); btn.disabled = true; btn.textContent = '준비 중…';
      try { items.forEach(prefetch); await downloadPrints(items.map(p => files.get(keyOf(p)))); }
      catch (err) { console.error(err); toast(err.message || '내려받지 못했어요', 5000); }
      finally { btn.textContent = '내려받기 ↓'; btn.disabled = !picked.size; }
    };
  }
  wall.addEventListener('click', e => {
    const ph = e.target.closest('[data-photo]');
    if (ph) { e.preventDefault(); const i = S.photos.findIndex(p => p.filename === ph.dataset.photo); if (i >= 0) Lightbox.open(S.photos, i); return; }
    const fr = e.target.closest('.print-frame'); if (!fr) return;
    const fig = fr.closest('.print'), p = list()[+fig.dataset.i];
    if (!selecting) return openPrint(list(), +fig.dataset.i);
    const k = keyOf(p);
    picked.has(k) ? picked.delete(k) : (picked.add(k), prefetch(p));
    fig.classList.toggle('sel', picked.has(k)); paintBar();
  });
  // 링크로 들어오면 그 한 장을 바로 크게 보여 줘요
  const k0 = key ? all.findIndex(p => printKey(p) === decodeURIComponent(key)) : -1;
  if (k0 >= 0) openPrint(all, k0); else if (key) toast('그 엽서를 찾을 수 없어요');
}
// ---------- 엽서·포스터 내려받기 ----------
const printName = (p, n) => `hamihamoo-${p.date || 'print'}-${p.layout || 'poster'}-${String(n + 1).padStart(2, '0')}.jpg`;
async function fetchPrint(p, n) {
  const r = await fetch(p._local || S.posterBase + p.file);
  if (!r.ok) throw new Error('이미지를 받지 못했어요');
  return new File([await r.blob()], printName(p, n), { type: 'image/jpeg' });
}
const saveBlob = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
// 여러 장을 한 파일로 묶는 도구(JSZip)는 처음 쓸 때만 불러와요
let zipLib = null;
const loadZip = () => zipLib || (zipLib = new Promise((res, rej) => {
  const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  sc.onload = () => res(window.JSZip); sc.onerror = () => { zipLib = null; rej(new Error('압축 도구를 불러오지 못했어요')); };
  document.head.appendChild(sc);
}));
// 휴대폰: 공유 창 (아이폰은 "이미지 저장"으로 사진 앱에 한 번에) / 컴퓨터: 1장은 그대로, 여러 장은 zip 하나로
async function downloadPrints(filePromises) {
  const list = (await Promise.all(filePromises)).filter(Boolean);
  if (!list.length) throw new Error('이미지를 받지 못했어요');
  if (isTouch && navigator.canShare && navigator.canShare({ files: list })) {
    try { await navigator.share({ files: list, title: 'Hamihamoo prints' }); return; }
    catch (e) {
      if (e && e.name === 'AbortError') return;
      if (e && e.name === 'NotAllowedError') throw new Error('준비가 끝났어요. 내려받기를 한 번 더 눌러 주세요');
    }
  }
  if (list.length === 1) { saveBlob(list[0], list[0].name); return; }
  const JSZip = await loadZip(), zip = new JSZip();
  list.forEach(f => zip.file(f.name, f));
  saveBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `hamihamoo-prints-${list.length}.zip`);
  toast(`${list.length}장을 압축 파일 하나로 내려받았어요`);
}
// 포스터 크게 보기: 좌우로 넘기고, 원본 사진으로 갈 수 있어요
function openPrint(list, i) {
  const el = document.createElement('div'); el.className = 'pview';
  el.innerHTML = `<button class="icon-btn pview-x" aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <button class="pview-nav prev" aria-label="이전">←</button><figure><img alt=""><figcaption></figcaption></figure><button class="pview-nav next" aria-label="다음">→</button>`;
  document.body.appendChild(el); document.body.classList.add('locked');
  const img = $('img', el), cap = $('figcaption', el);
  const show = () => {
    const p = list[i]; img.src = p._local || S.posterBase + p.file;
    cap.innerHTML = `<b>${esc(p.title || 'Untitled')}</b><span class="mono">${pad(i + 1)} / ${pad(list.length)} · ${LAYOUT_KO[p.layout] || ''}</span>${S.byName.get(p.photo) ? '<button class="btn small ghost" data-src>원본 사진 보기</button>' : ''}${printKey(p) ? '<button class="btn small ghost" data-link>링크 복사</button>' : ''}`;
  };
  const close = () => { el.remove(); document.body.classList.remove('locked'); removeEventListener('keydown', key); if (location.hash.startsWith('#/prints/')) history.replaceState(null, '', '#/prints'); };
  const step = d => { i = (i + d + list.length) % list.length; show(); };
  const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); };
  addEventListener('keydown', key);
  el.addEventListener('click', e => {
    if (e.target === el || e.target.closest('.pview-x')) return close();
    if (e.target.closest('.prev')) return step(-1);
    if (e.target.closest('.next')) return step(1);
    if (e.target.closest('[data-link]')) return copyText(shareLink('#/prints/' + encodeURIComponent(printKey(list[i]))), '이 엽서의 링크를 복사했어요');
    if (e.target.closest('[data-src]')) { const f = list[i].photo, k = S.photos.findIndex(p => p.filename === f); close(); if (k >= 0) Lightbox.open(S.photos, k); }
  });
  show();
}

/* ============================================================
   Calendars: 탁상 달력(가로) 만들기 · 전시 · 내려받기
   표지 → 1~12월(앞면 사진+날짜, 뒷면 사진 이야기·메모) → 뒷표지
   ============================================================ */
// ---------- 공휴일: 양력 공휴일 + 음력(설·부처님오신날·추석) 자동 계산 + 대체공휴일 규칙 ----------
const Holidays = (() => {
  let K = null, loading = null;
  // 음력 → 양력 바꾸기 도구는 처음 쓸 때만 불러와요 (2050년까지 계산돼요)
  const load = () => loading || (loading = new Promise(res => {
    const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/korean-lunar-calendar@0.3.6/dist/korean-lunar-calendar.min.js';
    sc.onload = () => { K = window.KoreanLunarCalendar || null; res(!!K); }; sc.onerror = () => { loading = null; res(false); };
    document.head.appendChild(sc);
  }));
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const add = (d, n) => { const t = new Date(d); t.setDate(t.getDate() + n); return t; };
  const lunar = (y, m, d) => { if (!K) return null; const c = new K(); if (!c.setLunarDate(y, m, d, false)) return null; const r = c.getSolarCalendar(); return new Date(r.year, r.month - 1, r.day); };
  const cache = {};
  function year(y) {
    const key = y + (K ? 'L' : '');
    if (cache[key]) return cache[key];
    const map = {}, put = (d, n) => { (map[iso(d)] = map[iso(d)] || []).push(n); };
    // [월, 일, 이름, 주말·겹침이면 대체공휴일이 생기는지]
    const subs = [], groups = [];
    [[1, 1, '신정', 0], [3, 1, '삼일절', 1], [5, 5, '어린이날', 1], [6, 6, '현충일', 0], [8, 15, '광복절', 1], [10, 3, '개천절', 1], [10, 9, '한글날', 1], [12, 25, '성탄절', 1]]
      .forEach(([m, d, n, s]) => { const t = new Date(y, m - 1, d); put(t, n); if (s) subs.push(t); });
    const ny = lunar(y, 1, 1), bd = lunar(y, 4, 8), cs = lunar(y, 8, 15);
    if (ny) { const g = [add(ny, -1), ny, add(ny, 1)]; g.forEach(d => put(d, '설날')); groups.push(g); }
    if (bd) { put(bd, '부처님오신날'); subs.push(bd); }
    if (cs) { const g = [add(cs, -1), cs, add(cs, 1)]; g.forEach(d => put(d, '추석')); groups.push(g); }
    // 설·추석 연휴는 일요일이나 다른 공휴일과 겹치면, 나머지는 토·일요일이나 다른 공휴일과 겹치면 다음 평일이 쉬는 날
    const inGroup = d => groups.some(g => g.some(x => iso(x) === iso(d)));
    const need = [];
    groups.forEach(g => { if (g.some(d => d.getDay() === 0 || map[iso(d)].length > 1)) need.push(g[2]); });
    const seen = new Set();
    subs.forEach(d => { const k = iso(d); if (seen.has(k) || inGroup(d)) return; seen.add(k); if (d.getDay() === 0 || d.getDay() === 6 || map[k].length > 1) need.push(d); });
    const off = d => d.getDay() === 0 || d.getDay() === 6 || map[iso(d)];
    need.sort((a, b) => a - b).forEach(d => { let t = add(d, 1); while (off(t)) t = add(t, 1); put(t, '대체공휴일'); });
    return (cache[key] = map);
  }
  return { load, year, iso, get lunarOk() { return !!K; } };
})();

const CAL_W = 2480, CAL_H = 1748;
const CAL_MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// 종이 색: 모든 장에 함께 써요. num은 큰 숫자 글꼴(serif/mono)
const CAL_PAPER = {
  ivory: { name: '아이보리', bg: '#f6f4ee', ink: '#1d1c19', muted: '#8b887f', red: '#d2452b', blue: '#3563b5', line: 'rgba(29,28,25,.16)', num: 'serif' },
  white: { name: '화이트', bg: '#fdfdfb', ink: '#161614', muted: '#8d8b84', red: '#d2452b', blue: '#3563b5', line: 'rgba(22,22,20,.14)', num: 'serif' },
  kraft: { name: '크라프트', bg: '#d8c6a5', ink: '#2a2118', muted: '#76634c', red: '#a93a1f', blue: '#2d4c86', line: 'rgba(42,33,24,.22)', num: 'serif' },
  night: { name: '밤', bg: '#151514', ink: '#efece4', muted: '#8d8a82', red: '#ff7a5c', blue: '#86a8ff', line: 'rgba(239,236,228,.16)', num: 'mono' },
};
// 구도: 장마다 따로 고르거나 모든 달에 한 번에 적용해요
// 앞면 = 달력(날짜 칸이 주인공), 뒷면 = 사진이 주인공
const CAL_FRONT = { side: '사진 왼쪽', right: '사진 오른쪽', bottom: '아래 사진 띠', corner: '모서리 사진', circle: '원형 사진', arch: '아치 사진', numeral: '숫자 속 사진', stamp: '우표 사진', planner: '플래너', minimal: '날짜만 + 색 띠' };
const CAL_BACK = { full: '꽉 찬 사진', frame: '액자', large: '사진 크게 + 정보', split: '반반 + 글귀', triptych: '세 폭', circle: '원형', arch: '아치 창', type: '숫자 속 사진', memo: '사진 + 메모', palette: '사진 + 색 구성', polaroid: '폴라로이드', note: '메모장' };
const CAL_COVER = { frame: '액자', full: '꽉 찬 사진', side: '옆 사진', center: '가운데 사진', arch: '아치 창', triptych: '세 폭', polaroid: '폴라로이드', type: '사진 든 연도' };
const CAL_END = { grid: '열두 장 모음', year: '한 해 달력', film: '필름 띠', circles: '열두 개의 원', single: '사진 한 장', palette: '한 해의 색', colophon: '맺음말 · 목록' };
// 표지 뒷면(첫 장을 넘기면 보이는 면) · 뒷표지 뒷면(달력 맨 바깥 면): 다른 장과 겹치지 않는 구도
const CAL_COVERB = { intro: '서문 + 사진', contents: '열두 달 목차', quote: '큰 글귀', photo: '작은 사진 한 장', owner: '이 달력의 주인', dates: '기억할 날' };
const CAL_ENDB = { imprint: '판권 면', brand: '로고 · 주소', postcard: '엽서 뒷면', strip: '가로 사진 띠', nextyear: '다음 해 미리 보기' };
const CAL_COVERB_TEXT = '열두 달, 열두 장의 사진.\n지나간 날들을 한 장씩 넘겨 보세요.';
// 장마다 켜고 끌 수 있는 것
const CAL_SHOW = { photo: '사진', info: '사진 정보', quote: '글귀', memo: '메모 줄', palette: '색', next: '다음 달' };
const CAL_COVER_SHOW = { year: '연도', title: '제목', sub: '한 줄 문구', months: '열두 달 목록', brand: 'HAMIHAMOO' };
const CAL_END_SHOW = { title: '제목', note: '맺음말', labels: '달 이름', site: '사이트 주소' };
// 탁상 달력(A5 가로 210×148mm, 300dpi). 위쪽은 스프링 구멍 자리라 날짜·글씨는 안전 영역 안에만
const CAL_SAFE = { x: 70, y: 200, r: CAL_W - 70, b: CAL_H - 70 };
// 구도마다 사진 칸 [x, y, 너비, 높이]. 편집기도 이 크기로 열려요 (null이면 사진 칸 없음)
const CAL_RECT = {
  front: { side: [0, 0, 760, CAL_H], right: [CAL_W - 760, 0, 760, CAL_H], bottom: [0, CAL_H - 460, CAL_W, 460], circle: [90, 240, 640, 640], arch: [90, 220, 640, 900], numeral: [70, 200, 860, 1478], corner: [70, 200, 560, 380], stamp: [CAL_W - 70 - 420, 230, 380, 300], planner: [70, 200, 600, 450], minimal: null },
  back: { full: [0, 0, CAL_W, CAL_H], frame: [190, 230, CAL_W - 380, 1220], large: [0, 0, 1660, CAL_H], split: [1240, 0, 1240, CAL_H], triptych: [70, 220, 2340, 1180], circle: [90, 290, 1300, 1300], arch: [150, 220, 1000, 1458], type: [0, 0, CAL_W, CAL_H], memo: [0, 0, CAL_W, 900], palette: [0, 0, 1560, CAL_H], polaroid: [0, 0, 1000, 1000], note: [70, 200, 600, 420] },
  cover: { frame: [70, 200, CAL_W - 140, 1060], full: [0, 0, CAL_W, CAL_H], side: [0, 0, 1320, CAL_H], center: [CAL_W / 2 - 470, 300, 940, 940], arch: [CAL_W / 2 - 380, 240, 760, 1000], triptych: [70, 240, 2340, 900], polaroid: [0, 0, 1000, 1000], type: [0, 0, CAL_W, CAL_H] },
  end: { grid: null, year: null, film: null, circles: null, single: [0, 0, CAL_W, CAL_H], palette: null, colophon: null },
  coverb: { intro: [1460, 200, 950, 1478], contents: null, quote: [CAL_W / 2 - 150, 250, 300, 300], photo: [CAL_W / 2 - 450, 270, 900, 1060], owner: null, dates: null },
  endb: { imprint: null, brand: null, postcard: [CAL_W - 70 - 340, 250, 300, 380], strip: [0, 560, CAL_W, 620], nextyear: null },
};
// 예전 이름으로 저장된 달력도 열 수 있게
const CAL_OLD_FRONT = { split: 'side', mirror: 'right', band: 'side', full: 'side', strip: 'side', top: 'side', poster: 'corner', focus: 'planner', circle: 'side', polaroid: 'side' };
const CAL_OLD_BACK = { standard: 'large', photo: 'large', palette: 'palette', note: 'note' };
const CAL_OLD_THEME = { gallery: ['ivory', 'side', 'frame'], bleed: ['white', 'top', 'full'], night: ['night', 'right', 'side'] };
const calBackDefault = () => ({ layout: 'large', photo: null, edit: null, show: { photo: true, info: true, quote: true, memo: true, palette: true, next: true } });
function calFix(cal) {
  if (cal.theme) { const o = CAL_OLD_THEME[cal.theme] || CAL_OLD_THEME.gallery; cal.paper = o[0]; cal.cover.layout = cal.cover.layout || o[2]; cal.months.forEach(it => { it.layout = it.layout || o[1]; }); delete cal.theme; }
  cal.paper = CAL_PAPER[cal.paper] ? cal.paper : 'ivory';
  if (!CAL_COVER[cal.cover.layout]) cal.cover.layout = 'frame';
  cal.cover.sub = cal.cover.sub || '';
  cal.cover.show = Object.assign({ year: true, title: true, sub: true, months: true, brand: true }, cal.cover.show || {});
  cal.cover.type = Object.assign({ font: 'serif', weight: 400, size: 100, v: 0, align: 'center' }, cal.cover.type || {});
  cal.end = Object.assign({ layout: 'grid', photo: null, edit: null, note: '' }, cal.end || {});
  if (!CAL_END[cal.end.layout]) cal.end.layout = 'grid';
  cal.end.show = Object.assign({ title: true, note: true, labels: true, site: true }, cal.end.show || {});
  cal.coverB = Object.assign({ layout: 'intro', photo: null, edit: null, text: CAL_COVERB_TEXT }, cal.coverB || {});
  if (!CAL_COVERB[cal.coverB.layout]) cal.coverB.layout = 'intro';
  cal.endB = Object.assign({ layout: 'imprint', photo: null, edit: null, text: '' }, cal.endB || {});
  if (!CAL_ENDB[cal.endB.layout]) cal.endB.layout = 'imprint';
  cal.months.forEach(it => {
    if (!CAL_FRONT[it.layout]) it.layout = CAL_OLD_FRONT[it.layout] || 'side';
    it.back = Object.assign(calBackDefault(), it.back || {}); it.back.show = Object.assign(calBackDefault().show, it.back.show || {});
    if (!CAL_BACK[it.back.layout]) it.back.layout = CAL_OLD_BACK[it.back.layout] || 'large';
  });
  return cal;
}
const CF = { serif: '"Instrument Serif", "Noto Serif KR", Georgia, serif', sans: 'Pretendard, sans-serif', mono: '"JetBrains Mono", monospace' };
const calFonts = () => loadPosterFonts().then(() => Promise.all(['italic 40px "Instrument Serif"', '40px "Instrument Serif"', '400 40px Pretendard', '700 40px Pretendard', '900 40px Pretendard', '100 40px Pretendard', '400 40px Fraunces', '900 40px Fraunces', '40px "JetBrains Mono"', '40px "Noto Serif KR"'].map(f => document.fonts.load(f, 'Aa가1').catch(() => {}))));

// 사진 불러오기 · 사진에서 색 뽑기 (한 번 불러온 건 기억해 둬요)
const calImgs = new Map(), calPal = new Map();
const calImg = p => {
  if (!calImgs.has(p.filename)) calImgs.set(p.filename, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = imgUrl(p); }));
  return calImgs.get(p.filename);
};
function calPalette(fn, img) {
  if (calPal.has(fn)) return calPal.get(fn);
  const c = document.createElement('canvas'); c.width = c.height = 40;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 40, 40);
  const d = x.getImageData(0, 0, 40, 40).data, bins = {};
  for (let i = 0; i < d.length; i += 4) { const k = (d[i] >> 5) << 6 | (d[i + 1] >> 5) << 3 | d[i + 2] >> 5, b = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 }); b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; }
  const hex = b => '#' + [b.r, b.g, b.b].map(v => Math.round(v / b.n).toString(16).padStart(2, '0')).join('');
  const out = [];
  Object.values(bins).sort((a, b) => b.n - a.n).forEach(b => {
    const h = hex(b), rgb = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const near = out.find(o => Math.hypot(...o.rgb.map((v, i) => v - rgb[i])) < 60);
    if (near) near.n += b.n; else if (out.length < 5) out.push({ h, rgb, n: b.n });
  });
  const tot = out.reduce((a, o) => a + o.n, 0) || 1, res = out.map(o => ({ h: o.h, share: o.n / tot }));
  calPal.set(fn, res); return res;
}

// ---------- 그리기 도우미 ----------
function calCover(x, src, X, Y, w, h) {
  const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, k = Math.max(w / sw, h / sh), dw = sw * k, dh = sh * k;
  x.save(); x.beginPath(); x.rect(X, Y, w, h); x.clip(); x.drawImage(src, X + (w - dw) / 2, Y + (h - dh) / 2, dw, dh); x.restore();
}
const calFont = (x, px, fam, sty = '') => { x.font = `${sty} ${Math.round(px)}px ${fam}`.trim(); };
function calText(x, t, X, Y, { px = 24, fam = CF.mono, sty = '', color, align = 'left', track = 0 } = {}) {
  calFont(x, px, fam, sty); x.fillStyle = color; x.textAlign = align; x.textBaseline = 'alphabetic';
  if ('letterSpacing' in x) x.letterSpacing = track ? track + 'px' : '0px';
  x.fillText(t, X, Y);
  if ('letterSpacing' in x) x.letterSpacing = '0px';
  x.textAlign = 'left';
}
// 줄 바꿈: 띄어쓰기 기준, 너무 긴 낱말은 글자 단위로 잘라요. 빈 줄은 그대로 띄워요
function calWrap(x, t, maxW) {
  const lines = [];
  String(t || '').split('\n').forEach(par => {
    if (!par.trim()) { lines.push(''); return; }
    let cur = '';
    par.split(/(\s+)/).forEach(w => {
      if (!w) return;
      const tryL = cur + w;
      if (x.measureText(tryL.trimEnd()).width <= maxW || !cur.trim()) {
        if (x.measureText(tryL.trimEnd()).width > maxW) { [...w].forEach(ch => { if (x.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch; }); }
        else cur = tryL;
      } else { lines.push(cur.trimEnd()); cur = w.trimStart(); }
    });
    lines.push(cur.trimEnd());
  });
  return lines;
}
// 한 달 날짜 칸. 일요일·공휴일은 빨강, 토요일은 파랑, 공휴일 이름은 숫자 아래 작게
function calGrid(x, X, Y, w, h, y, m, T, hol, o = {}) {
  const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), rows = Math.ceil((first + days) / 7);
  const head = o.head || 58, cw = w / 7, rh = (h - head) / rows, num = o.num || Math.min(rh * .42, cw * .4);
  ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].forEach((d, i) => calText(x, o.short ? d[0] : d, X + cw * i + (o.center ? cw / 2 : 0), Y + head * .55, { px: o.hs || 20, color: i === 0 ? T.red : i === 6 ? T.blue : T.muted, align: o.center ? 'center' : 'left', track: 2 }));
  x.fillStyle = T.line; x.fillRect(X, Y + head * .8, w, Math.max(1, o.rule || 2));
  for (let d = 1; d <= days; d++) {
    const k = first + d - 1, col = k % 7, row = Math.floor(k / 7), date = new Date(y, m, d), names = hol[Holidays.iso(date)];
    const color = col === 0 || names ? T.red : col === 6 ? T.blue : T.ink;
    const cx = X + cw * col + (o.center ? cw / 2 : 0), cy = Y + head + rh * row + num * 1.05;
    calText(x, String(d), cx, cy, { px: num, fam: o.fam || CF.sans, sty: o.weight || '500', color, align: o.center ? 'center' : 'left' });
    if (names && !o.noNames) {
      let px = o.np || 19; calFont(x, px, CF.sans, '500');
      const t = names[0]; while (px > 11 && x.measureText(t).width > cw - 10) { px--; calFont(x, px, CF.sans, '500'); }
      calText(x, t, cx, cy + px * 1.45, { px, fam: CF.sans, sty: '500', color: T.red, align: o.center ? 'center' : 'left' });
    }
  }
}

// ---------- 한 장 그리기 ----------
// page: {k: 'cover' | 'front' | 'back' | 'end', m}. W 너비로 그려요 (높이는 탁상 달력 비율)
// 종이 한 장 = 앞쪽 면 + 그 뒤쪽 면. 뒤쪽 면(back · coverb · endb)은 넘겨 보기에서 뒤집어서 봐요
function calPages() { return [{ k: 'cover' }, { k: 'coverb' }, ...Array.from({ length: 12 }, (_, m) => [{ k: 'front', m }, { k: 'back', m }]).flat(), { k: 'end' }, { k: 'endb' }]; }
const CAL_FLIP = { front: 'back', cover: 'coverb', end: 'endb' }, CAL_UNFLIP = { back: 'front', coverb: 'cover', endb: 'end' };
const calIsBack = k => !!CAL_UNFLIP[k];
const calPageName = pg => pg.k === 'cover' ? '표지' : pg.k === 'coverb' ? '표지 뒷면' : pg.k === 'end' ? '뒷표지' : pg.k === 'endb' ? '뒷표지 뒷면' : `${pg.m + 1}월 ${pg.k === 'front' ? '앞면' : '뒷면'}`;
// 이 장에 쓰는 사진 · 편집 그림 열쇠 · 설정 묶음 · 사진 칸
const calKey = pg => pg.k === 'cover' ? 'c' : pg.k === 'coverb' ? 'cb' : pg.k === 'end' ? 'e' : pg.k === 'endb' ? 'eb' : pg.k === 'back' ? 'b' + pg.m : pg.m;
function calPhotoOf(cal, pg) {
  if (pg.k === 'cover') return cal.cover.photo;
  if (pg.k === 'coverb') return cal.coverB.photo || cal.cover.photo;
  if (pg.k === 'end') return cal.end.photo || cal.months[11].photo;
  if (pg.k === 'endb') return cal.endB.photo || cal.end.photo || cal.months[11].photo;
  const it = cal.months[pg.m]; if (!it) return null;
  return pg.k === 'back' ? (it.back.photo || it.photo) : it.photo;
}
function calEditOf(cal, pg) { return pg.k === 'cover' ? cal.cover : pg.k === 'coverb' ? cal.coverB : pg.k === 'end' ? cal.end : pg.k === 'endb' ? cal.endB : pg.k === 'front' ? cal.months[pg.m] : cal.months[pg.m].back; }
function calRectOf(cal, pg) {
  if (pg.k === 'cover') return CAL_RECT.cover[cal.cover.layout];
  if (pg.k === 'coverb') return CAL_RECT.coverb[cal.coverB.layout];
  if (pg.k === 'endb') return CAL_RECT.endb[cal.endB.layout];
  if (pg.k === 'end') return CAL_RECT.end[cal.end.layout];
  if (pg.k === 'front') return CAL_RECT.front[cal.months[pg.m].layout];
  const b = cal.months[pg.m].back; return b.show.photo ? CAL_RECT.back[b.layout] : null;
}
// cal: 달력 설정, art: 편집기로 다듬은 그림(열쇠 → canvas), imgs: 파일 이름 → 불러온 사진
// ext: 바깥에서 준 그리기 판(편집용 SVG, PSD 레이어). 없으면 새 canvas에 그려요
function calDraw(cal, pg, W, art, imgs, ext) {
  const c = ext ? null : document.createElement('canvas'); if (c) { c.width = Math.round(W); c.height = Math.round(W * CAL_H / CAL_W); }
  const x = ext || c.getContext('2d'), u = W / CAL_W, T = CAL_PAPER[cal.paper] || CAL_PAPER.ivory, NF = T.num === 'mono' ? CF.mono : CF.serif;
  x.scale(u, u); x.imageSmoothingQuality = 'high';
  x.fillStyle = T.bg; x.fillRect(0, 0, CAL_W, CAL_H);
  const y = cal.year, hol = { ...Holidays.year(y) };
  (cal.extra || []).forEach(e => { if (e.d && e.d.startsWith(y + '-')) (hol[e.d] = [...(hol[e.d] || []), e.n || '쉬는 날']); });
  const fn = calPhotoOf(cal, pg), p = fn && S.byName.get(fn), im = p && imgs.get(p.filename), key = calKey(pg);
  const { x: SX, y: SY, r: SR, b: SB } = CAL_SAFE, SW = SR - SX, H = CAL_H, W0 = CAL_W;
  // 사진 칸: 편집기로 다듬은 그림이 있으면 그걸, 없으면 원본을 꽉 차게
  const pic = (R, k = key, src = im) => { const a = art.get(k); if (a) calCover(x, a, ...R); else if (src) calCover(x, src, ...R); else { x.fillStyle = T.line; x.fillRect(...R); } };
  const photo = R => pic(R);
  const shapePath = (kind, R) => { const [X, Y, w, h] = R; x.beginPath(); if (kind === 'circle') x.arc(X + w / 2, Y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2); else { const r = w / 2; x.moveTo(X, Y + h); x.lineTo(X, Y + r); x.arc(X + r, Y + r, r, Math.PI, 0); x.lineTo(X + w, Y + h); x.closePath(); } };
  const shaped = (kind, R) => { x.save(); shapePath(kind, R); x.clip(); pic(R); x.restore(); };
  // 큰 글자 모양으로 사진을 오려요 (R은 사진 칸, 글자는 X·Y 기준)
  const inText = (t, R, px, fam, X, Y, align = 'left') => {
    const c2 = document.createElement('canvas'); c2._alpha = true; c2.width = Math.ceil(W0 * u); c2.height = Math.ceil(H * u); const t2 = c2.getContext('2d'); t2.scale(u, u);
    const a = art.get(key); if (a) calCover(t2, a, ...R); else if (im) calCover(t2, im, ...R);
    t2.globalCompositeOperation = 'destination-in'; t2.fillStyle = '#000'; t2.textAlign = align; t2.font = `${Math.round(px)}px ${fam}`; t2.fillText(t, X, Y);
    x.drawImage(c2, 0, 0, W0, H);
  };
  const fitPx = (t, fam, maxW, maxH, start = 1600) => { let px = start; calFont(x, px, fam); while (px > 100 && (x.measureText(t).width > maxW || px * .72 > maxH)) { px -= 20; calFont(x, px, fam); } return px; };
  const monthPic = (i, R) => { const q = S.byName.get(cal.months[i].photo); pic(R, i, q && imgs.get(q.filename)); };
  const title = (cal.title || '').trim(), host = 'HAMIHAMOO';
  const info = q => q ? [fmtDate(q.date), parseInfo(q.info).camera].filter(v => v && v !== '—') : [];
  const cap = info(p).join('  ·  ');
  const mm = pg.m != null ? pad(pg.m + 1) : '', mon = pg.m != null ? CAL_MON[pg.m] : '';
  const numW = (t, px) => { calFont(x, px, NF); return x.measureText(t).width; };
  const big = (t, X, Y, px, col = T.ink, align) => calText(x, t, X, Y, { px: T.num === 'mono' ? px * .8 : px, fam: NF, color: col, track: -px * .03, align });
  const light = { ink: '#fbfaf6', muted: 'rgba(251,250,246,.78)', red: '#ff9a80', blue: '#b2c8ff', line: 'rgba(251,250,246,.35)' };
  const shade = (y0, y1, a) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); x.fillStyle = g; x.fillRect(0, Math.min(y0, y1), W0, Math.abs(y1 - y0)); };
  const pal = (q, src) => q && src ? calPalette(q.filename, src) : [];
  // 날짜 칸 (크게). 칸 크기에 맞춰 숫자·공휴일 이름 크기가 정해져요
  const grid = (X, Y, w, h, o = {}) => {
    const cw = w / 7, rows0 = Math.ceil((new Date(y, pg.m, 1).getDay() + new Date(y, pg.m + 1, 0).getDate()) / 7), rh0 = (h - Math.min(80, h * .08)) / rows0;
    calGrid(x, X, Y, w, h, y, pg.m, o.T || T, hol, { num: Math.min(rh0 * .36, cw * .3, 72), hs: Math.min(26, cw * .12), np: Math.max(16, Math.min(26, cw * .1)), head: Math.min(80, h * .08), ...(T.num === 'mono' ? { fam: CF.mono, weight: '400' } : {}), ...o });
    if (o.rows) { const first = new Date(y, pg.m, 1).getDay(), rows = Math.ceil((first + new Date(y, pg.m + 1, 0).getDate()) / 7), head = Math.min(80, h * .08), rh = (h - head) / rows; x.fillStyle = (o.T || T).line; for (let r = 1; r < rows; r++) x.fillRect(X, Y + head + rh * r - 4, w, 1.5); }
  };
  const lines = (X, Y, w, n, gap = 70) => { x.fillStyle = T.line; for (let i = 0; i < n; i++) x.fillRect(X, Y + i * gap, w, 2); };
  const wrapQ = (q, X, Y, w, px, maxL, col = T.ink, align) => { if (!q) return 0; calFont(x, px, CF.serif, 'italic'); const L = calWrap(x, q, w).slice(0, maxL); L.forEach((l, i) => l && calText(x, l, X, Y + i * px * 1.32, { px, fam: CF.serif, sty: 'italic', color: col, align })); return L.length * px * 1.32; };

  if (pg.k === 'front') {
    // ---------- 앞면: 날짜 칸이 주인공 ----------
    const L = cal.months[pg.m].layout, R = CAL_RECT.front[L];
    const head = (X, Y, w, o = {}) => {
      const nw = numW(mm, o.px || 220);
      big(mm, X - 6, Y, o.px || 220);
      calText(x, mon, X + nw + 26, Y - (o.px || 220) * .38, { px: o.mp || 76, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, String(y), X + nw + 28, Y - 6, { px: 24, color: T.muted, track: 4 });
      if (!o.noHost) calText(x, o.cap === false || !cap ? host : cap, X + w, Y - 6, { px: 20, color: T.muted, align: 'right', track: 3 });
    };
    if (L === 'side' || L === 'right') {
      photo(R);
      const X = L === 'side' ? R[2] + 90 : SX, w = (L === 'side' ? SR : R[0] - 90) - X;
      head(X, SY + 190, w);
      grid(X, SY + 270, w, SB - SY - 270, { rows: true });
    } else if (L === 'corner') {
      photo(R);
      const X = R[0] + R[2] + 60; big(mm, X - 6, R[1] + R[3] - 6, 330);
      const nw = numW(mm, 330);
      calText(x, mon, X + nw + 30, R[1] + R[3] - 120, { px: 84, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, `${y}  ·  ${host}`, X + nw + 32, R[1] + R[3] - 50, { px: 22, color: T.muted, track: 4 });
      if (cap) calText(x, cap, SR, R[1] + 30, { px: 20, color: T.muted, align: 'right', track: 3 });
      grid(SX, R[1] + R[3] + 60, SW, SB - R[1] - R[3] - 60, { rows: true });
    } else if (L === 'stamp') {
      // 우표: 톱니 테두리 안에 사진, 살짝 기울여서
      x.save(); x.translate(R[0] + R[2] / 2, R[1] + R[3] / 2); x.rotate(3 * Math.PI / 180);
      const bw = R[2] + 56, bh = R[3] + 56; x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = 18; x.shadowOffsetY = 6;
      x.fillStyle = '#fbfaf6'; x.fillRect(-bw / 2, -bh / 2, bw, bh); x.shadowColor = 'transparent';
      x.fillStyle = T.bg; for (let i = 0; i <= 14; i++) { [[-bw / 2 + bw * i / 14, -bh / 2], [-bw / 2 + bw * i / 14, bh / 2]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 11, 0, Math.PI * 2); x.fill(); }); }
      for (let i = 0; i <= 11; i++) { [[-bw / 2, -bh / 2 + bh * i / 11], [bw / 2, -bh / 2 + bh * i / 11]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 11, 0, Math.PI * 2); x.fill(); }); }
      pic([-R[2] / 2, -R[3] / 2, R[2], R[3]]);
      x.restore();
      calText(x, mon, SX, SY + 150, { px: 130, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, `${mm} / ${y}`, SX, SY + 230, { px: 26, color: T.muted, track: 5 });
      if (cap) calText(x, cap, SX + 700, SY + 230, { px: 20, color: T.muted, track: 3 });
      grid(SX, SY + 380, SW, SB - SY - 380, { rows: true });
    } else if (L === 'planner') {
      photo(R);
      big(mm, SX - 8, R[1] + R[3] + 300, 300);
      calText(x, `${mon.toUpperCase()}  ${y}`, SX, R[1] + R[3] + 370, { px: 26, color: T.muted, track: 5 });
      calText(x, 'NOTES', SX, R[1] + R[3] + 470, { px: 20, color: T.muted, track: 4 });
      lines(SX, R[1] + R[3] + 530, R[2], Math.floor((SB - R[1] - R[3] - 530) / 70) + 1);
      grid(SX + R[2] + 80, SY, SW - R[2] - 80, SB - SY, { rows: true });
    } else if (L === 'bottom') {
      // 아래 사진 띠: 아래쪽은 구멍이 없어서 사진이 넉넉히 보여요
      photo(R);
      head(SX, SY + 190, SW);
      grid(SX, SY + 260, SW, R[1] - 50 - SY - 260, { rows: true });
    } else if (L === 'circle' || L === 'arch') {
      shaped(L, R);
      const by = R[1] + R[3] + (L === 'circle' ? 250 : 200);
      big(mm, SX - 6, by, L === 'circle' ? 240 : 200);
      calText(x, `${mon.toUpperCase()}  ${y}`, SX, by + 70, { px: 24, color: T.muted, track: 5 });
      if (cap && by + 130 < SB) calText(x, cap, SX, by + 120, { px: 18, color: T.muted, track: 2 });
      const X = R[0] + R[2] + 100;
      grid(X, SY, SR - X, SB - SY, { rows: true });
    } else if (L === 'numeral') {
      // 숫자 속 사진: 왼쪽에 달 숫자를 크게, 그 안에 사진
      // 숫자 크기는 열두 달 중 가장 넓은 숫자에 맞춰서 모든 달이 같아요
      const px = Math.min(...CAL_MON.map((_, i) => fitPx(pad(i + 1), NF, R[2], R[3] - 260)));
      inText(mm, R, px, NF, SX - 10, SY + px * .74);
      const by = SY + px * .74;
      calText(x, mon, SX, by + 120, { px: 84, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, `${y}${cap ? '  ·  ' + cap : ''}`, SX, by + 180, { px: 20, color: T.muted, track: 3 });
      // 남는 아래 공간은 플래너처럼 메모 줄
      if (SB - by - 330 >= 0) { calText(x, 'NOTES', SX, by + 270, { px: 20, color: T.muted, track: 4 }); lines(SX, by + 330, R[2], Math.floor((SB - by - 330) / 70) + 1); }
      const X = R[0] + R[2] + 80;
      grid(X, SY, SR - X, SB - SY, { rows: true });
    } else {
      // 날짜만: 사진은 위쪽 구멍 자리에 색 띠로만 (사진에서 뽑은 색)
      let px0 = 0; const P = pal(p, im);
      P.forEach((c2, i) => { const pw = i === P.length - 1 ? W0 - px0 : Math.round(W0 * c2.share); x.fillStyle = c2.h; x.fillRect(px0, 0, pw, 120); px0 += pw; });
      head(SX, SY + 200, SW, { px: 240, mp: 84 });
      grid(SX, SY + 280, SW, SB - SY - 280, { rows: true });
    }
  } else if (pg.k === 'back') {
    // ---------- 뒷면: 사진이 주인공 ----------
    const m = pg.m, b = cal.months[m].back, sh = b.show, L = b.layout, R = CAL_RECT.back[L];
    const prs = p ? (S.photoProjects.get(p.filename) || []).map(pr => pr.title) : [];
    const inf = sh.info ? [...info(p), prs.length ? 'SERIES — ' + prs.join(', ') : ''].filter(Boolean) : [];
    const q = sh.quote ? (cal.months[m].quote || '').trim() : '';
    const ny = m === 11 ? y + 1 : y, nm = (m + 1) % 12, nhol = ny === y ? hol : Holidays.year(ny);
    const P = sh.palette ? pal(p, im) : [];
    const next = (X, Y, w, h, TT = T) => { if (!sh.next) return; calText(x, `NEXT — ${CAL_MON[nm].toUpperCase()} ${ny}`, X, Y, { px: 22, color: TT.ink, track: 4 }); calGrid(x, X, Y + 30, w, h - 30, ny, nm, TT, nhol, { center: true, short: true, hs: 18, num: Math.min(30, w / 26), noNames: true, head: 50, rule: 1 }); };
    const band = (X, Y, w, h, labels = true, col = T.muted) => { let px0 = X; P.forEach((c2, i) => { const pw = i === P.length - 1 ? X + w - px0 : Math.round(w * c2.share); x.fillStyle = c2.h; x.fillRect(px0, Y, pw, h); if (labels && pw > 120) calText(x, c2.h.toUpperCase(), px0, Y + h + 34, { px: 18, color: col, track: 2 }); px0 += pw; }); };
    const infoAt = (X, Y, col = T.muted, align) => inf.forEach((t, i) => calText(x, t.toUpperCase(), X, Y + i * 40, { px: 20, color: col, track: 3, align }));
    const foot = (col = T.muted) => { const left = L === 'split' && sh.photo; calText(x, [`${mm} / 12`, host, title.toUpperCase()].filter(Boolean).join('  ·  '), left ? SX : SR, SB, { px: 18, color: col, align: left ? 'left' : 'right', track: 3 }); };
    const show = sh.photo;
    if (L === 'full') {
      if (show) photo(R);
      const TT = show ? light : T;
      if (show) shade(H * .5, H, .6);
      const qh = wrapQ(q, SX, SB - 120 - (inf.length * 40) - 40, 1500, q.length > 60 ? 46 : 58, 3, TT.ink);
      infoAt(SX, SB - 90 - Math.max(0, inf.length - 1) * 40 + 20, TT.muted);
      if (P.length) P.forEach((c2, i) => { x.fillStyle = c2.h; x.beginPath(); x.arc(SR - 30 - i * 64, SB - 90, 24, 0, Math.PI * 2); x.fill(); if (show) { x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 3; x.stroke(); } });
      calText(x, `${mon.toUpperCase()}  ·  ${y}`, SR, SY + 10, { px: 22, color: TT.muted, align: 'right', track: 4 });
      foot(TT.muted);
      void qh;
    } else if (L === 'frame') {
      if (show) photo(R);
      const by = R[1] + R[3] + (P.length ? 120 : 80);
      if (P.length) band(R[0], R[1] + R[3] + 26, R[2], 14, false);
      calText(x, `${mon}`, R[0], by + 30, { px: 64, fam: CF.serif, sty: 'italic', color: T.ink });
      wrapQ(q, R[0] + 420, by + 20, 1100, 40, 2);
      infoAt(R[0] + R[2], by - 6, T.muted, 'right');
      foot();
    } else if (L === 'large' || L === 'split' || L === 'palette') {
      if (show) photo(R);
      const X = L === 'split' ? SX : (show ? R[2] + 80 : SX), w = (L === 'split' ? (show ? R[0] - 80 : SR) : SR) - X;
      calText(x, `${mon.toUpperCase()}  ·  ${y}`, X, SY + 10, { px: 22, color: T.muted, track: 4 });
      if (L === 'palette') {
        // 사진의 색을 세로로 쌓아 보여 줘요
        let y0 = SY + 60; const tot = SB - 200 - y0;
        P.forEach(c2 => { const hh = Math.max(70, Math.round(tot * c2.share)); x.fillStyle = c2.h; x.fillRect(X, y0, w, hh - 10); const [r, g2, bb] = [1, 3, 5].map(k => parseInt(c2.h.slice(k, k + 2), 16)), lt = (.2126 * r + .7152 * g2 + .0722 * bb) / 255 > .55; calText(x, `${c2.h.toUpperCase()}   ${Math.round(c2.share * 100)}%`, X + 24, y0 + Math.min(hh - 10, 80) - 26, { px: 20, color: lt ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.8)', track: 3 }); y0 += hh; });
        if (!P.length) wrapQ(q, X, SY + 140, w, 52, 8);
        infoAt(X, SB - 60 - Math.max(0, inf.length - 1) * 40);
      } else {
        const qp = L === 'split' ? (q.length > 60 ? 64 : 84) : (q.length > 60 ? 48 : 60);
        const qh = wrapQ(q, X, SY + 140, w, qp, L === 'split' ? 7 : 6);
        infoAt(X, SY + 170 + qh + 30);
        next(X, SB - 420, Math.min(w, 760), 330);
        if (P.length) band(X, SB - (sh.next ? 540 : 110), w, 36);
      }
      foot();
    } else if (L === 'memo') {
      if (show) photo(R);
      const top = show ? R[3] + 70 : SY + 40;
      calText(x, mon, SX, top + 70, { px: 80, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, String(y), SX, top + 120, { px: 22, color: T.muted, track: 4 });
      infoAt(SX, top + 190);
      if (P.length) P.forEach((c2, i) => { x.fillStyle = c2.h; x.fillRect(SX + i * 90, SB - 110, 70, 70); });
      const X = 780; wrapQ(q, X, top + 40, SR - X, 40, 2);
      if (sh.memo) lines(X, top + (q ? 140 : 40), SR - X, Math.floor((SB - 40 - top - (q ? 140 : 40)) / 70) + 1);
      foot();
    } else if (L === 'polaroid') {
      // 폴라로이드: 크게 기울인 사진 + 옆에 손글씨처럼 글귀
      if (show) {
        x.save(); x.translate(720, 930); x.rotate(-4 * Math.PI / 180);
        x.shadowColor = 'rgba(0,0,0,.22)'; x.shadowBlur = 40; x.shadowOffsetY = 16; x.fillStyle = '#fbfaf6'; x.fillRect(-540, -620, 1080, 1260); x.shadowColor = 'transparent';
        pic([-500, -580, 1000, 1000]); calText(x, `${mon}, ${y}`, -500, 520, { px: 60, fam: CF.serif, sty: 'italic', color: '#2a2925' }); x.restore();
      }
      const X = show ? 1420 : SX, w = SR - X;
      const qh = wrapQ(q, X, SY + 160, w, q.length > 60 ? 48 : 60, 6);
      infoAt(X, SY + 200 + qh);
      if (sh.memo) lines(X, SY + 320 + qh + inf.length * 40, w, 5);
      if (P.length) band(X, SB - 120, w, 30);
      foot();
    } else if (L === 'triptych') {
      // 세 폭: 한 장의 사진을 세 칸으로 나눠 걸어요
      if (show) { [0, 1, 2].forEach(i => { const gw = 40, pw = (R[2] - gw * 2) / 3; x.save(); x.beginPath(); x.rect(R[0] + i * (pw + gw), R[1], pw, R[3]); x.clip(); pic(R); x.restore(); }); }
      const by = (show ? R[1] + R[3] : SY) + 110;
      calText(x, mon, SX, by + 20, { px: 70, fam: CF.serif, sty: 'italic', color: T.ink });
      wrapQ(q, SX + 420, by, 1200, 40, 2);
      infoAt(SR, by - 20, T.muted, 'right');
      if (P.length) band(SX, by + 60, 300, 12, false);
      foot();
    } else if (L === 'circle' || L === 'arch' || L === 'type') {
      let X;
      if (L === 'type') {
        // 숫자 속 사진: 달 숫자를 종이 높이만큼 크게, 그 안에 사진
        const px = fitPx(mm, NF, SW * .72, SB - SY - 60);
        if (show) inText(mm, R, px, NF, SX - 20, SY + 30 + px * .72); else big(mm, SX - 20, SY + 30 + px * .72, px, T.line);
        calFont(x, px, NF); X = SX + x.measureText(mm).width + 60;
      } else { if (show) shaped(L, R); X = R[0] + R[2] + 110; }
      const w = SR - X;
      calText(x, `${mon.toUpperCase()}  ·  ${y}`, X, SY + 30, { px: 22, color: T.muted, track: 4 });
      const qh = w > 380 ? wrapQ(q, X, SY + 160, w, q.length > 50 ? 44 : 56, 7) : 0;
      infoAt(X, SY + 190 + qh + 20);
      next(X, SB - 420, Math.min(w, 700), 330);
      if (P.length) band(X, SB - (sh.next ? 540 : 110), w, 30);
      foot();
    } else {
      // 메모장: 사진은 작게, 줄을 넓게
      if (show) photo(R);
      const X = show ? R[0] + R[2] + 80 : SX;
      calText(x, mon, X, SY + 110, { px: 110, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, `${y}  ·  MEMO`, X, SY + 170, { px: 22, color: T.muted, track: 4 });
      wrapQ(q, X, SY + 270, SR - X - (sh.next ? 700 : 0), 40, 3);
      next(SR - 620, SY + 20, 620, 320);
      if (show) infoAt(SX, R[1] + R[3] + 60);
      if (sh.memo) lines(SX, SY + 520, SW, Math.floor((SB - 80 - SY - 520) / 70) + 1);
      if (P.length) band(SX, SB - 30, 600, 12, false);
      foot();
    }
  } else if (pg.k === 'coverb') {
    // ---------- 표지 뒷면: 첫 장을 넘기면 보이는 면 ----------
    const o = cal.coverB, L = o.layout, R = CAL_RECT.coverb[L], txt = (o.text || '').trim(), tt = title || 'A Year in Photographs';
    const para = (t, X, Y, w, px, maxL, col = T.ink, align, sty = '') => { calFont(x, px, CF.serif, sty); const L2 = calWrap(x, t, w).slice(0, maxL); L2.forEach((l, i) => l && calText(x, l, X, Y + i * px * 1.4, { px, fam: CF.serif, sty, color: col, align })); return L2.length * px * 1.4; };
    if (L === 'intro') {
      // 서문: 왼쪽에 제목과 글, 오른쪽에 세로로 긴 사진
      photo(R);
      const w = R[0] - 140 - SX;
      calText(x, `PREFACE  —  ${y}`, SX, SY + 40, { px: 22, color: T.muted, track: 5 });
      calFont(x, 96, CF.serif, 'italic'); const tl = calWrap(x, tt, w).slice(0, 2);
      tl.forEach((l, i) => calText(x, l, SX, SY + 180 + i * 104, { px: 96, fam: CF.serif, sty: 'italic', color: T.ink }));
      const t0 = SY + 180 + tl.length * 104 + 40;
      x.fillStyle = T.ink; x.fillRect(SX, t0, 120, 3);
      para(txt, SX, t0 + 100, w, 40, 13);
      calText(x, host, SX, SB, { px: 20, color: T.muted, track: 5 });
      if (cap) calText(x, cap.toUpperCase(), R[0] - 60, SB, { px: 18, color: T.muted, align: 'right', track: 3 });
    } else if (L === 'contents') {
      // 목차: 열두 달 사진을 작게, 달 이름과 글귀 첫 줄
      calText(x, tt, SX, SY + 110, { px: 90, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, `CONTENTS  —  ${y}`, SR, SY + 110, { px: 22, color: T.muted, align: 'right', track: 5 });
      x.fillStyle = T.line; x.fillRect(SX, SY + 160, SW, 2);
      const top = SY + 210, rh = (SB - top) / 6, cw = (SW - 100) / 2;
      cal.months.forEach((it, i) => {
        const X = SX + (i >= 6 ? cw + 100 : 0), Y = top + rh * (i % 6), ph = rh - 34, pw = ph * 1.5, npx = Math.min(110, ph * .7);
        monthPic(i, [X, Y, pw, ph]);
        big(pad(i + 1), X + pw + 36, Y + ph * .7, npx);
        const nx = X + pw + 36 + numW(pad(i + 1), T.num === 'mono' ? npx * .8 : npx) + 30, maxW = X + cw - nx;
        calText(x, CAL_MON[i], nx, Y + ph * .42, { px: 44, fam: CF.serif, sty: 'italic', color: T.ink });
        const line = (it.quote || '').split('\n')[0].trim() || info(S.byName.get(it.photo)).join('  ·  ');
        if (line) { calFont(x, 22, CF.sans); let s = line; while (s.length > 2 && x.measureText(s + '…').width > maxW) s = s.slice(0, -1); calText(x, s === line ? s : s + '…', nx, Y + ph * .42 + 52, { px: 22, fam: CF.sans, color: T.muted }); }
      });
    } else if (L === 'quote') {
      // 큰 글귀: 위에 작은 원형 사진, 가운데에 글
      shaped('circle', R);
      calFont(x, 76, CF.serif, 'italic'); const ql = calWrap(x, txt || tt, 1700).slice(0, 6), lh = 76 * 1.3, from = R[1] + R[3] + 160;
      const y0 = from + 76 + Math.max(0, (SB - 120 - from - ql.length * lh) / 2);
      ql.forEach((l, i) => l && calText(x, l, W0 / 2, y0 + i * lh, { px: 76, fam: CF.serif, sty: 'italic', color: T.ink, align: 'center' }));
      calText(x, `—  ${title ? title + ',  ' : ''}${y}`, W0 / 2, SB - 20, { px: 22, color: T.muted, align: 'center', track: 4 });
    } else if (L === 'photo') {
      // 작은 사진 한 장: 넉넉한 여백 가운데 사진, 아래에 짧은 글
      photo(R);
      let yy = R[1] + R[3] + 100;
      if (txt) yy += para(txt, W0 / 2, yy, 1600, 42, 2, T.ink, 'center', 'italic');
      if (cap) calText(x, cap.toUpperCase(), W0 / 2, Math.min(yy + 10, SB), { px: 20, color: T.muted, align: 'center', track: 4 });
    } else if (L === 'owner') {
      // 이 달력의 주인: 이름 · 연락처를 적는 줄
      calText(x, 'THIS CALENDAR BELONGS TO', W0 / 2, SY + 230, { px: 26, color: T.muted, align: 'center', track: 8 });
      const X = W0 / 2 - 700, w = 1400;
      x.fillStyle = T.ink; x.fillRect(X, SY + 460, w, 3);
      [['PHONE', SY + 640], ['E-MAIL', SY + 790]].forEach(([l, Y]) => { calText(x, l, X, Y - 20, { px: 18, color: T.muted, track: 4 }); x.fillStyle = T.line; x.fillRect(X + 180, Y, w - 180, 2); });
      if (txt) para(txt, W0 / 2, SY + 930, 1400, 34, 2, T.muted, 'center', 'italic');
      big(String(y), W0 / 2, SB, 300, T.line, 'center');
    } else {
      // 기억할 날: 달마다 생일·기념일을 적는 칸
      calText(x, 'Dates to remember', SX, SY + 110, { px: 90, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, `${y}${title ? '  ·  ' + title.toUpperCase() : ''}`, SR, SY + 110, { px: 22, color: T.muted, align: 'right', track: 5 });
      const top = SY + 200, gx = 40, gy = 50, cw = (SW - gx * 5) / 6, ch = (SB - top - gy) / 2;
      for (let i = 0; i < 12; i++) {
        const X = SX + (cw + gx) * (i % 6), Y = top + (ch + gy) * Math.floor(i / 6);
        big(pad(i + 1), X, Y + 80, 80);
        calText(x, CAL_MON[i].toUpperCase(), X + cw, Y + 74, { px: 18, color: T.muted, align: 'right', track: 3 });
        lines(X, Y + 160, cw, Math.floor((ch - 160) / 70) + 1);
      }
    }
  } else if (pg.k === 'endb') {
    // ---------- 뒷표지 뒷면: 달력을 세워 두면 맨 바깥에 보이는 면 ----------
    const o = cal.endB, L = o.layout, R = CAL_RECT.endb[L], txt = (o.text || '').trim(), tt = title || 'Desk Calendar';
    if (L === 'imprint') {
      // 판권 면: 아래 왼쪽에 만든 정보를 작게, 오른쪽에 장식 바코드
      calText(x, String(y), SR, SY + 40, { px: 22, color: T.muted, align: 'right', track: 5 });
      const rows = [tt, `${y}  Desk Calendar`, `Photographs — ${host}`, `12 photographs · ${calPages().length} pages`, 'Format — 210 × 148 mm', 'hamihamoo.com'], Y = SB - (rows.length - 1) * 44;
      if (txt) { calFont(x, 32, CF.serif, 'italic'); const tl = calWrap(x, txt, 1100).slice(0, 4); tl.forEach((l, i) => l && calText(x, l, SX, Y - 110 - (tl.length - 1 - i) * 46, { px: 32, fam: CF.serif, sty: 'italic', color: T.ink })); }
      rows.forEach((r, i) => calText(x, r, SX, Y + i * 44, i ? { px: 20, color: T.muted, track: 2 } : { px: 34, fam: CF.serif, sty: 'italic', color: T.ink }));
      // 연도·제목으로 늘 같은 무늬가 나와요
      let s = 7; for (const ch of String(y) + tt) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
      const bx = SR - 400, by = SB - 220; let cx = bx; x.fillStyle = T.ink;
      while (true) { s = (s * 1103515245 + 12345) >>> 0; const bw = 3 + (s >>> 16) % 4 * 3; if (cx + bw > SR) break; if ((s >>> 8) % 3) x.fillRect(cx, by, bw, 160); cx += bw + 4 + (s >>> 4) % 3 * 2; }
      calText(x, `HM — ${y}`, bx, SB, { px: 20, color: T.ink, track: 6 });
    } else if (L === 'brand') {
      // 로고 · 주소: 가운데에 작게, 나머지는 비워 둬요
      drawLogo(x, W0 / 2, H / 2 - 50, 280, T.ink);
      calText(x, host, W0 / 2, H / 2 + 160, { px: 30, color: T.ink, align: 'center', track: 16 });
      if (txt) wrapQ(txt, W0 / 2, H / 2 + 280, 1400, 32, 2, T.muted, 'center');
      calText(x, `DESK CALENDAR ${y}  ·  HAMIHAMOO.COM`, W0 / 2, SB, { px: 20, color: T.muted, align: 'center', track: 5 });
    } else if (L === 'postcard') {
      // 엽서 뒷면: 왼쪽은 글, 오른쪽은 우표 자리와 주소 줄
      calText(x, 'Post Card', SX, SY + 80, { px: 64, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, `${host}  ·  ${y}`, SX, SY + 130, { px: 18, color: T.muted, track: 4 });
      const mid = Math.round(W0 * .56); x.fillStyle = T.line; x.fillRect(mid, SY + 200, 2, SB - SY - 260);
      x.fillStyle = T.muted; for (let k = -14; k < R[2] + 14; k += 18) { x.fillRect(R[0] + k, R[1] - 16, 10, 2); x.fillRect(R[0] + k, R[1] + R[3] + 14, 10, 2); }
      for (let k = -14; k < R[3] + 14; k += 18) { x.fillRect(R[0] - 16, R[1] + k, 2, 10); x.fillRect(R[0] + R[2] + 14, R[1] + k, 2, 10); }
      photo(R);
      if (txt) { calFont(x, 44, CF.serif, 'italic'); calWrap(x, txt, mid - SX - 100).slice(0, 13).forEach((l, i) => l && calText(x, l, SX, SY + 300 + i * 66, { px: 44, fam: CF.serif, sty: 'italic', color: T.ink })); }
      else lines(SX, SY + 330, mid - SX - 100, 9, 120);
      const ax = mid + 100;
      calText(x, 'TO.', ax, SB - 560, { px: 22, color: T.muted, track: 4 });
      lines(ax, SB - 450, SR - ax, 4, 130);
      if (cap) calText(x, cap.toUpperCase(), SR, R[1] + R[3] + 70, { px: 16, color: T.muted, align: 'right', track: 3 });
    } else if (L === 'strip') {
      // 가로 사진 띠: 가운데를 가로지르는 사진, 위에 제목
      photo(R);
      calText(x, tt, SX, R[1] - 90, { px: 96, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, String(y), SR, R[1] - 90, { px: 26, color: T.muted, align: 'right', track: 6 });
      if (cap) calText(x, cap.toUpperCase(), SR, R[1] + R[3] + 60, { px: 18, color: T.muted, align: 'right', track: 3 });
      if (txt) wrapQ(txt, SX, R[1] + R[3] + 110, 1500, 34, 2, T.ink);
      calText(x, 'HAMIHAMOO.COM', SR, SB, { px: 22, color: T.muted, align: 'right', track: 5 });
    } else {
      // 다음 해 미리 보기: 내년 열두 달을 작은 달력으로
      const ny = y + 1, nh = Holidays.year(ny);
      big(String(ny), SX - 8, SY + 300, 300);
      calText(x, 'SEE YOU NEXT YEAR', SX, SY + 380, { px: 24, color: T.muted, track: 6 });
      if (txt) wrapQ(txt, SX, SY + 500, 600, 34, 6, T.ink);
      const X0 = SX + 760, gx = 40, gy = 40, cw = (SR - X0 - gx * 3) / 4, ch = (SB - SY - gy * 2) / 3;
      for (let i = 0; i < 12; i++) {
        const X = X0 + (cw + gx) * (i % 4), Y = SY + (ch + gy) * Math.floor(i / 4);
        calText(x, `${pad(i + 1)}  ${CAL_MON[i].toUpperCase()}`, X, Y + 24, { px: 18, color: T.ink, track: 3 });
        calGrid(x, X, Y + 40, cw, ch - 40, ny, i, T, nh, { center: true, short: true, hs: 15, num: Math.min(26, cw / 13), noNames: true, head: 40, rule: 1 });
      }
      calText(x, 'HAMIHAMOO.COM', SX, SB, { px: 20, color: T.muted, track: 5 });
    }
  } else if (pg.k === 'cover') {
    // ---------- 표지 ----------
    const co = cal.cover, sh = co.show, L = co.layout, R = CAL_RECT.cover[L], sub = sh.sub ? (co.sub || '').trim() : '';
    const tt = sh.title ? title : '';
    const brand = (X, Y, col, align) => { if (sh.brand) calText(x, 'DESK CALENDAR  ·  ' + host, X, Y, { px: 22, color: col, align, track: 4 }); };
    if (L === 'full') {
      photo(R); shade(H * .4, H, .6);
      if (sh.year) big(String(y), SX - 8, SB, 440, '#fbfaf6');
      if (tt) calText(x, tt, SR, SB - 120, { px: 84, fam: CF.serif, sty: 'italic', color: '#fbfaf6', align: 'right' });
      if (sub) calText(x, sub, SR, SB - 60, { px: 28, fam: CF.sans, color: 'rgba(251,250,246,.85)', align: 'right' });
      brand(SR, SY, 'rgba(251,250,246,.8)', 'right');
    } else if (L === 'side') {
      photo(R);
      const X = R[2] + 110, w = SR - X;
      if (sh.year) big(String(y), X - 6, SY + 260, 300);
      if (tt) { calFont(x, 86, CF.serif, 'italic'); calWrap(x, tt, w).slice(0, 3).forEach((l, i) => calText(x, l, X, SY + 400 + i * 96, { px: 86, fam: CF.serif, sty: 'italic', color: T.ink })); }
      if (sub) wrapQ(sub, X, SY + 720, w, 34, 3, T.muted);
      if (sh.months) CAL_MON.forEach((n, i) => calText(x, `${pad(i + 1)}  ${n.toUpperCase()}`, X + (i >= 6 ? 420 : 0), SB - 420 + (i % 6) * 56, { px: 22, color: T.muted, track: 3 }));
      brand(X, SB, T.muted);
    } else if (L === 'center' || L === 'arch') {
      const bh = R[3] + (sh.year ? 150 : 0) + (tt ? 90 : 0) + (sub ? 64 : 0), top = SY + Math.max(0, (SB - 60 - SY - bh) / 2), P2 = [R[0], top, R[2], R[3]];
      if (L === 'arch') shaped('arch', P2); else photo(P2);
      let yy = top + R[3];
      if (sh.year) { yy += 150; calText(x, String(y), W0 / 2, yy, { px: T.num === 'mono' ? 100 : 130, fam: NF, color: T.ink, align: 'center' }); }
      if (tt) { yy += 90; calText(x, tt, W0 / 2, yy, { px: 60, fam: CF.serif, sty: 'italic', color: T.ink, align: 'center' }); }
      if (sub) { yy += 64; calText(x, sub, W0 / 2, yy, { px: 26, fam: CF.sans, color: T.muted, align: 'center' }); }
      brand(W0 / 2, SB, T.muted, 'center');
      if (sh.months) { calText(x, CAL_MON.slice(0, 6).map(n => n.slice(0, 3).toUpperCase()).join('   '), SX, top + 30, { px: 20, color: T.muted, track: 3 }); calText(x, CAL_MON.slice(6).map(n => n.slice(0, 3).toUpperCase()).join('   '), SR, top + 30, { px: 20, color: T.muted, align: 'right', track: 3 }); }
    } else if (L === 'triptych') {
      // 세 폭: 사진 한 장을 세 칸으로 나눠 걸고, 아래에 연도와 제목
      [0, 1, 2].forEach(i => { const gw = 40, pw = (R[2] - gw * 2) / 3; x.save(); x.beginPath(); x.rect(R[0] + i * (pw + gw), R[1], pw, R[3]); x.clip(); photo(R); x.restore(); });
      if (sh.year) big(String(y), SX - 10, SB + 10, 330);
      if (tt) calText(x, tt, SR, SB - 110, { px: 76, fam: CF.serif, sty: 'italic', color: T.ink, align: 'right' });
      if (sub) calText(x, sub, SR, SB - 55, { px: 26, fam: CF.sans, color: T.muted, align: 'right' });
      if (sh.months) calText(x, CAL_MON.map(n => n.slice(0, 3).toUpperCase()).join('  ·  '), SX, R[1] + R[3] + 60, { px: 20, color: T.muted, track: 3 });
      brand(SR, SB, T.muted, 'right');
    } else if (L === 'polaroid') {
      // 폴라로이드: 기울인 사진 아래 여백에 제목, 오른쪽에 연도
      x.save(); x.translate(760, 960); x.rotate(-4 * Math.PI / 180);
      x.shadowColor = 'rgba(0,0,0,.22)'; x.shadowBlur = 40; x.shadowOffsetY = 16; x.fillStyle = '#fbfaf6'; x.fillRect(-550, -640, 1100, 1290); x.shadowColor = 'transparent';
      pic([-500, -590, 1000, 1000]);
      calText(x, tt || String(y), -500, 530, { px: 64, fam: CF.serif, sty: 'italic', color: '#2a2925' });
      x.restore();
      const X = 1480, w = SR - X;
      if (sh.year) big(String(y), X - 6, SY + 330, 300);
      if (tt) { calFont(x, 80, CF.serif, 'italic'); calWrap(x, tt, w).slice(0, 3).forEach((l, i) => calText(x, l, X, SY + 470 + i * 90, { px: 80, fam: CF.serif, sty: 'italic', color: T.ink })); }
      if (sub) wrapQ(sub, X, SY + 760, w, 32, 3, T.muted);
      if (sh.months) CAL_MON.forEach((n, i) => calText(x, `${pad(i + 1)}  ${n.toUpperCase()}`, X + (i >= 6 ? 420 : 0), SB - 420 + (i % 6) * 56, { px: 22, color: T.muted, track: 3 }));
      brand(X, SB, T.muted);
    } else if (L === 'type') {
      // 큰 연도 글자 안에 사진이 보여요
      const t = document.createElement('canvas'); t._alpha = true; t.width = W0; t.height = H; const tx = t.getContext('2d');
      const a = art.get(key); if (a) calCover(tx, a, 0, 0, W0, H); else if (im) calCover(tx, im, 0, 0, W0, H);
      const ty = co.type, fam = ty.font === 'sans' ? 'Pretendard, sans-serif' : ty.font === 'classic' ? NF : 'Fraunces, "Noto Serif KR", serif', wt = ty.font === 'classic' ? 400 : ty.weight;
      tx.globalCompositeOperation = 'destination-in'; tx.fillStyle = '#000'; tx.textAlign = ty.align;
      // 안전 영역 너비에 꼭 맞는 크기를 찾고, 고른 크기(%)를 곱해요
      let px = 1200; const setF = () => { tx.font = `${wt} ${Math.round(px)}px ${fam}`; }; setF();
      while (tx.measureText(String(y)).width > SW && px > 200) { px -= 20; setF(); }
      px *= ty.size / 100; setF();
      // 세로 위치 0 = 맨 위(구멍 자리 아래), 100 = 맨 아래
      const top0 = SY + px * .74, bot0 = SB - 40;
      tx.fillText(String(y), ty.align === 'left' ? SX : ty.align === 'right' ? SR : W0 / 2, top0 + Math.max(0, bot0 - top0) * ty.v / 100);
      x.drawImage(t, 0, 0);
      if (tt) calText(x, tt, SX, SB - 60, { px: 84, fam: CF.serif, sty: 'italic', color: T.ink });
      if (sub) calText(x, sub, SX, SB, { px: 28, fam: CF.sans, color: T.muted });
      brand(SR, SB, T.muted, 'right');
    } else {
      photo(R);
      if (sh.year) big(String(y), SX - 10, SB + 10, 360);
      if (tt) calText(x, tt, SR, SB - 110, { px: 76, fam: CF.serif, sty: 'italic', color: T.ink, align: 'right' });
      if (sub) calText(x, sub, SR, SB - 55, { px: 26, fam: CF.sans, color: T.muted, align: 'right' });
      brand(SR, SB, T.muted, 'right');
      if (sh.months) calText(x, CAL_MON.map(n => n.slice(0, 3).toUpperCase()).join('  ·  '), SX, R[1] - 40 > 0 ? R[1] + R[3] + 60 : SB, { px: 20, color: T.muted, track: 3 });
    }
  } else {
    // ---------- 뒷표지 ----------
    const e = cal.end, sh = e.show, L = e.layout, note = sh.note ? (e.note || '').trim() : '', tt = sh.title ? (title || String(y)) : '';
    const site = col => { if (sh.site) calText(x, 'HAMIHAMOO.COM', SR, SB, { px: 22, color: col, align: 'right', track: 5 }); };
    const headE = () => { if (tt) calText(x, tt, SX, SY + 110, { px: 100, fam: CF.serif, sty: 'italic', color: T.ink }); calText(x, `A YEAR IN PHOTOGRAPHS  —  ${y}`, SX, SY + 175, { px: 22, color: T.muted, track: 5 }); };
    if (L === 'year') {
      // 한 해 달력: 열두 달을 작은 달력으로 한눈에
      headE();
      const top = SY + 250, gx = 50, gy = 40, cw = (SW - gx * 5) / 6, ch = (SB - 80 - top - gy) / 2;
      for (let i = 0; i < 12; i++) {
        const X = SX + (cw + gx) * (i % 6), Y = top + (ch + gy) * Math.floor(i / 6);
        calText(x, `${pad(i + 1)}  ${CAL_MON[i].toUpperCase()}`, X, Y + 24, { px: 20, color: T.ink, track: 3 });
        calGrid(x, X, Y + 44, cw, ch - 44, y, i, T, hol, { center: true, short: true, hs: 16, num: Math.min(28, cw / 12), noNames: true, head: 44, rule: 1 });
      }
      wrapQ(note, SX, SB, 1500, 26, 1, T.muted);
      site(T.ink);
    } else if (L === 'film') {
      // 필름 띠: 열두 장을 두 줄 필름처럼
      headE();
      const top = SY + 260, sh2 = (SB - 80 - top - 60) / 2, fw = SW / 6;
      for (let r = 0; r < 2; r++) {
        const Y = top + r * (sh2 + 60); x.fillStyle = '#141413'; x.fillRect(0, Y, W0, sh2);
        x.fillStyle = T.bg; for (let k = 0; k < 40; k++) { const hx = 20 + k * (W0 - 40) / 39; [Y + 22, Y + sh2 - 46].forEach(hy => { x.beginPath(); x.roundRect ? x.roundRect(hx - 14, hy, 28, 24, 5) : x.rect(hx - 14, hy, 28, 24); x.fill(); }); }
        for (let c2 = 0; c2 < 6; c2++) { const i = r * 6 + c2, X = SX + fw * c2 + 12; monthPic(i, [X, Y + 70, fw - 24, sh2 - 160]); if (sh.labels) calText(x, `${pad(i + 1)}  ${CAL_MON[i].slice(0, 3).toUpperCase()}`, X, Y + sh2 - 60, { px: 18, color: '#e9b44c', track: 3 }); }
      }
      wrapQ(note, SX, SB, 1500, 26, 1, T.muted);
      site(T.ink);
    } else if (L === 'circles') {
      // 열두 개의 원
      headE();
      const top = SY + 250, cw = SW / 6, ch = (SB - 70 - top) / 2, d = Math.min(cw - 50, ch - 80);
      for (let i = 0; i < 12; i++) {
        const cx = SX + cw * (i % 6) + cw / 2, cy = top + ch * Math.floor(i / 6) + d / 2 + 10;
        x.save(); x.beginPath(); x.arc(cx, cy, d / 2, 0, Math.PI * 2); x.clip(); monthPic(i, [cx - d / 2, cy - d / 2, d, d]); x.restore();
        if (sh.labels) calText(x, `${pad(i + 1)}  ${CAL_MON[i].slice(0, 3).toUpperCase()}`, cx, cy + d / 2 + 44, { px: 20, color: T.muted, align: 'center', track: 3 });
      }
      wrapQ(note, SX, SB, 1500, 26, 1, T.muted);
      site(T.ink);
    } else if (L === 'single') {
      photo(CAL_RECT.end.single); shade(H * .45, H, .6);
      if (tt) calText(x, tt, SX, SB - 150, { px: 96, fam: CF.serif, sty: 'italic', color: '#fbfaf6' });
      wrapQ(note, SX, SB - 80, 1500, 30, 2, 'rgba(251,250,246,.85)');
      site('rgba(251,250,246,.85)');
    } else if (L === 'palette') {
      // 한 해의 색: 달마다 사진에서 가장 많은 색 한 줄씩
      if (tt) calText(x, tt, SX, SY + 110, { px: 96, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, `THE COLOURS OF ${y}`, SX, SY + 180, { px: 22, color: T.muted, track: 5 });
      const top = SY + 260, bw = SW / 12;
      cal.months.forEach((it, i) => {
        const q = S.byName.get(it.photo), src = q && imgs.get(q.filename), P = pal(q, src); let y0 = top; const hh = SB - 140 - top;
        P.forEach(c2 => { const h2 = Math.round(hh * c2.share); x.fillStyle = c2.h; x.fillRect(SX + bw * i, y0, bw - 8, h2); y0 += h2; });
        if (sh.labels) calText(x, CAL_MON[i].slice(0, 3).toUpperCase(), SX + bw * i, SB - 90, { px: 18, color: T.muted, track: 3 });
      });
      wrapQ(note, SX, SB, 1500, 26, 1, T.muted);
      site(T.ink);
    } else if (L === 'colophon') {
      // 맺음말 · 목록: 열두 장의 날짜와 카메라를 목록으로
      if (tt) calText(x, tt, SX, SY + 130, { px: 110, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, `A YEAR IN PHOTOGRAPHS  —  ${y}`, SX, SY + 200, { px: 22, color: T.muted, track: 5 });
      wrapQ(note, SX, SY + 330, 1000, 40, 12);
      cal.months.forEach((it, i) => { const q = S.byName.get(it.photo), Y = SY + 300 + i * 92; monthPic(i, [1260, Y - 50, 96, 64]); calText(x, `${pad(i + 1)}  ${CAL_MON[i].toUpperCase()}`, 1400, Y, { px: 20, color: T.ink, track: 3 }); calText(x, info(q).join('  ·  ').toUpperCase(), 1720, Y, { px: 18, color: T.muted, track: 2 }); });
      site(T.ink);
    } else {
      if (tt) calText(x, tt, SX, SY + 110, { px: 110, fam: CF.serif, sty: 'italic', color: T.ink });
      calText(x, `A YEAR IN PHOTOGRAPHS  —  ${y}`, SX, SY + 180, { px: 22, color: T.muted, track: 4 });
      const gy = SY + 260, gap = 26, cw = (SW - gap * 5) / 6, ch = (SB - gy - 160 - gap - 50) / 2;
      cal.months.forEach((it, i) => { const X = SX + (cw + gap) * (i % 6), Y = gy + (ch + gap + 50) * Math.floor(i / 6); monthPic(i, [X, Y, cw, ch]); if (sh.labels) calText(x, `${pad(i + 1)}  ${CAL_MON[i].slice(0, 3).toUpperCase()}`, X, Y + ch + 34, { px: 20, color: T.muted, track: 3 }); });
      wrapQ(note, SX, SB, 1500, 26, 1, T.muted);
      site(T.ink);
    }
  }
  return c || x;
}
// 화면에서만 보이는 안내: 디자인 안전 영역(점선)과 위쪽 스프링 구멍 자리
function calGuide(cv) {
  const x = cv.getContext('2d'), k = cv.width / CAL_W, { x: SX, y: SY, r: SR, b: SB } = CAL_SAFE;
  x.save(); x.setTransform(k, 0, 0, k, 0, 0);
  x.setLineDash([14, 10]); x.lineWidth = 2.5 / Math.max(k, .3); x.strokeStyle = 'rgba(255,90,54,.9)'; x.strokeRect(SX, SY, SR - SX, SB - SY); x.setLineDash([]);
  x.fillStyle = 'rgba(255,90,54,.12)'; x.fillRect(0, 0, CAL_W, SY);
  x.fillStyle = 'rgba(40,40,38,.55)'; for (let i = 0; i < 34; i++) { const cx = 170 + i * ((CAL_W - 340) / 33); x.beginPath(); x.roundRect ? x.roundRect(cx - 9, 70, 18, 38, 9) : x.rect(cx - 9, 70, 18, 38); x.fill(); }
  calText(x, '디자인 안전 영역 · 위쪽은 스프링 구멍 자리', CAL_W / 2, SY - 26, { px: 30, fam: CF.sans, sty: '600', color: 'rgba(255,90,54,.95)', align: 'center' });
  x.restore();
}

// ---------- 사진 채우기 ----------
// 계절 맞춤: 그 달에 찍은 사진 → 가까운 달 → 아무 사진 (겹치지 않게)
function calFill(mode) {
  const all = S.photos.filter(p => p.filename), used = new Set(), shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pool = shuffle(all), take = ok => { const p = pool.find(q => !used.has(q.filename) && ok(q)) || pool.find(q => !used.has(q.filename)) || pool[0]; if (p) used.add(p.filename); return p; };
  const mon = q => q.date ? +q.date.slice(5, 7) - 1 : -9, near = (a, b) => Math.min(Math.abs(a - b), 12 - Math.abs(a - b));
  const months = Array.from({ length: 12 }, (_, m) => {
    if (mode !== 'season') return take(() => true);
    for (let d = 0; d <= 6; d++) { const p = pool.find(q => !used.has(q.filename) && near(mon(q), m) === d); if (p) { used.add(p.filename); return p; } }
    return take(() => true);
  });
  return { cover: take(q => (q.light || '') !== 'dark') || months[0], months };
}
const calNew = () => { const f = calFill('season'), y = new Date().getMonth() >= 9 ? new Date().getFullYear() + 1 : new Date().getFullYear(); return calFix({ title: '', year: y, paper: 'ivory', cover: { photo: f.cover.filename, edit: null, layout: 'frame' }, months: f.months.map(p => ({ photo: p.filename, edit: null, quote: p.story || '', layout: 'side', back: calBackDefault() })), extra: [] }); };

// ---------- 목록: Projects › Calendars ----------
function renderCalendars(view, id) {
  // 달력은 "몇 년도 달력인지"로 묶어요 (최신 연도부터, 같은 해 안에서는 최근에 올린 것부터)
  const all = [...(S.calendars || [])].sort((a, b) => (+b.year - +a.year) || (b.date || '').localeCompare(a.date || ''));
  const years = [...new Set(all.map(c => +c.year))], ofYear = y => all.filter(c => +c.year === y);
  const card = (c, i) => `<figure class="cal-card rv" style="--d:${(i % 6) * 60}ms"><button class="cal-frame" data-i="${all.indexOf(c)}" aria-label="${esc(c.title || c.year)} 달력 넘겨 보기"><img src="${esc(calSrc(c, c.pages[0]))}" alt="" loading="lazy"></button>
        <figcaption><b>${esc(c.title || 'Desk calendar')}</b><span class="mono faint">${esc(c.year)} · ${esc((CAL_PAPER[c.paper] || {}).name || '')} · ${c.pages.length}쪽</span></figcaption></figure>`;
  const make = '<a class="cal-new rv" href="#/calendars/new"><span class="cal-new-plus" aria-hidden="true">+</span><b>새 달력 만들기</b><small>열두 달 사진을 고르고 다듬어서<br>표지부터 뒷표지까지 한 권으로</small></a>';
  view.innerHTML = `<section class="page">
    ${worksHead('calendars', all.length)}
    ${years.length > 1 ? `<div class="toolbar-row"><div class="seg" id="calYears"><span class="seg-ind"></span><button data-v="all" class="on">전체 <span class="mono">${all.length}</span></button>${years.map(y => `<button data-v="${y}">${y} <span class="mono">${ofYear(y).length}</span></button>`).join('')}</div></div>` : ''}
    <div id="calWall">
      ${years.length ? years.map((y, k) => `<section class="cal-year" data-y="${y}">
        <h2 class="cal-year-h"><span>${y}</span><span class="mono faint">${pad(ofYear(y).length)} calendars</span></h2>
        <div class="cal-wall">${k === 0 ? make : ''}${ofYear(y).map(card).join('')}</div>
      </section>`).join('') : `<div class="cal-wall">${make}</div>`}
    </div>
  </section>`;
  $('#calWall', view).addEventListener('click', e => { const b = e.target.closest('.cal-frame'); if (b) openCalendar(all[+b.dataset.i]); });
  // 연도 버튼: 그 해 달력만 보여요
  const seg = $('#calYears', view);
  if (seg) {
    requestAnimationFrame(() => syncSeg(seg));
    seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('button', seg).forEach(x => x.classList.toggle('on', x === b)); syncSeg(seg);
      $$('.cal-year', view).forEach(sec => { sec.hidden = b.dataset.v !== 'all' && sec.dataset.y !== b.dataset.v; });
      // 새 달력 만들기 칸은 지금 보이는 첫 해의 맨 앞으로 옮겨요
      const make = $('.cal-new', view), first = $('.cal-year:not([hidden]) .cal-wall', view); if (make && first) first.prepend(make);
    });
  }
  // 링크로 들어오면 그 달력을 바로 넘겨 보기로 열어요
  const c0 = id && all.find(c => c.id === decodeURIComponent(id));
  if (c0) openCalendar(c0); else if (id) toast('그 달력을 찾을 수 없어요');
}
const calSrc = (c, pg) => pg._local || S.posterBase + pg.file;
const calFileName = (c, pg, i) => `hamihamoo-calendar-${c.year}-${pad(i, 2)}-${({ cover: 'cover', coverb: 'cover-back', end: 'backcover', endb: 'backcover-back' })[pg.k] || pad(pg.m + 1) + '-' + CAL_MON[pg.m].slice(0, 3).toLowerCase() + '-' + pg.k}.jpg`;

// ---------- 넘겨 보기: 한 장씩 넘기고, 달마다 앞·뒤를 뒤집어 봐요 ----------
function openCalendar(c) {
  const pages = c.pages, stops = [];
  pages.forEach((pg, i) => { if (!calIsBack(pg.k)) stops.push(i); });
  let prep = null; // 편집용 파일을 만들 때 한 번만 준비해요
  let s = 0, back = false;
  const el = document.createElement('div'); el.className = 'pview cal-view';
  el.innerHTML = `<button class="icon-btn pview-x" aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <button class="pview-nav prev" aria-label="이전 장">←</button>
    <figure><div class="cal-sheet"><div class="cal-face front"><img alt=""></div><div class="cal-face back"><img alt=""></div></div><figcaption></figcaption></figure>
    <button class="pview-nav next" aria-label="다음 장">→</button>`;
  document.body.appendChild(el); document.body.classList.add('locked');
  const sheet = $('.cal-sheet', el), cap = $('figcaption', el), [fi, bi] = $$('.cal-face img', el);
  const show = anim => {
    const i = stops[s], pg = pages[i], hasBack = pages[i + 1] && calIsBack(pages[i + 1].k);
    if (!hasBack) back = false;
    fi.src = calSrc(c, pg); if (hasBack) bi.src = calSrc(c, pages[i + 1]);
    sheet.classList.toggle('flipped', back);
    if (anim && !reduced) $('figure', el).animate([{ opacity: .3, transform: `translateX(${anim * 24}px)` }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' });
    cap.innerHTML = `<b>${esc(c.title || c.year)}</b><span class="mono">${esc(calPageName(back ? pages[i + 1] : pg))} · ${pad(s + 1)} / ${pad(stops.length)}</span>
      ${hasBack ? `<button class="btn small ghost" data-flip>${back ? '앞면 보기' : '뒷면 보기'} ↻</button>` : ''}${c.id ? '<button class="btn small ghost" data-link>링크 복사</button>' : ''}
      <span class="cal-down"><span class="mono">내려받기</span><button class="btn small" data-down="img">이미지 묶음 (JPG)</button><button class="btn small" data-down="pdf">인쇄용 PDF</button>${c.recipe ? '<button class="btn small" data-down="svg">편집용 SVG (전체)</button><button class="btn small" data-down="psd">포토샵 PSD (이 면)</button>' : ''}</span>`;
  };
  // 뒤로 가기 등으로 페이지가 바뀌면 같이 닫아요
  const close = () => { el.remove(); document.body.classList.remove('locked'); removeEventListener('keydown', key); removeEventListener('hashchange', close); if (location.hash.startsWith('#/calendars/') && location.hash !== '#/calendars/new') history.replaceState(null, '', '#/calendars'); };
  addEventListener('hashchange', close);
  const step = d => { s = (s + d + stops.length) % stops.length; back = false; show(d); };
  const flip = () => { back = !back; show(0); };
  const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); flip(); } };
  addEventListener('keydown', key);
  el.addEventListener('click', async e => {
    if (e.target === el || e.target.closest('.pview-x')) return close();
    if (e.target.closest('.prev')) return step(-1);
    if (e.target.closest('.next')) return step(1);
    if (e.target.closest('[data-link]')) return copyText(shareLink('#/calendars/' + encodeURIComponent(c.id)), '이 달력의 링크를 복사했어요');
    if (e.target.closest('[data-flip]') || e.target.closest('.cal-sheet')) return flip();
    const db = e.target.closest('[data-down]');
    if (db) {
      const label = db.textContent, files = () => pages.map((pg, i) => fetch(calSrc(c, pg)).then(r => r.blob()).then(b => new File([b], calFileName(c, pg, i), { type: 'image/jpeg' })));
      db.disabled = true; db.textContent = '준비 중…';
      const kind = db.dataset.down;
      try {
        if (kind === 'svg' || kind === 'psd') {
          const pr = await (prep || (prep = calPrepare(c.recipe)));
          if (kind === 'svg') await calSvgZip(pr.cal, pr.art, pr.imgs, (n, t) => { db.textContent = `그리는 중 ${n}/${t}`; });
          else { const k = stops[s] + (back ? 1 : 0); await calPsd(pr.cal, pages[k], k, pr.art, pr.imgs); }
        } else if (kind === 'pdf') await calPdf(c.year, files()); else await calDownload(c.year, files());
      }
      catch (err) { console.error(err); toast(err.message || '내려받지 못했어요', 4000); }
      finally { db.disabled = false; db.textContent = label; }
    }
  });
  show(0);
}
// PDF 만드는 도구(jsPDF)는 처음 쓸 때만 불러와요
let pdfLib = null;
const loadPdf = () => pdfLib || (pdfLib = new Promise((res, rej) => {
  const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  sc.onload = () => res(window.jspdf.jsPDF); sc.onerror = () => { pdfLib = null; rej(new Error('PDF 도구를 불러오지 못했어요')); };
  document.head.appendChild(sc);
}));
// 인쇄용 PDF 한 파일: 한 쪽 = 탁상 달력 한 면(210×148mm)
async function calPdf(year, filePromises) {
  const [JsPDF, list] = await Promise.all([loadPdf(), Promise.all(filePromises)]);
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: [148, 210], compress: true });
  for (let i = 0; i < list.length; i++) {
    const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(list[i]); });
    if (i) doc.addPage([148, 210], 'landscape');
    doc.addImage(url, 'JPEG', 0, 0, 210, 148);
  }
  const file = new File([doc.output('blob')], `hamihamoo-calendar-${year}.pdf`, { type: 'application/pdf' });
  if (isTouch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `Hamihamoo calendar ${year}` }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  saveBlob(file, file.name); toast(`PDF 한 파일(${list.length}쪽)로 내려받았어요`);
}
// ---------- 편집용 파일: SVG(일러스트레이터·피그마) · PSD(포토샵 레이어) ----------
// 도구는 처음 쓸 때만 불러와요
const loadLib = (src, get) => new Promise((res, rej) => { const v = get(); if (v) return res(v); const sc = document.createElement('script'); sc.src = src; sc.onload = () => res(get()); sc.onerror = () => rej(new Error('도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요')); document.head.appendChild(sc); });
const loadC2S = () => loadLib('https://cdn.jsdelivr.net/npm/canvas2svg@1.0.16/canvas2svg.js', () => window.C2S);
const loadAgPsd = () => loadLib('https://cdn.jsdelivr.net/npm/ag-psd@31.0.2/dist/bundle.js', () => window.agPsd);
const CAL_README = `Hamihamoo 탁상 달력 · 편집용 파일
==============================

크기: 210 × 148 mm (A5 가로), 300dpi 기준 2480 × 1748 px
위쪽 약 17mm는 스프링 구멍 자리예요. 글씨와 날짜는 그 아래에 있어요.

[SVG] 일러스트레이터 · 피그마 · 인디자인 · 잉크스케이프
- 일러스트레이터: 파일 > 열기로 SVG를 열고, 다른 이름으로 저장에서 .ai를 고르면 AI 파일이 돼요.
- 피그마: SVG 파일을 캔버스에 끌어다 놓으면 돼요.
- 글씨는 진짜 글자라서 고칠 수 있고, 사진은 틀(클리핑 마스크) 안에 들어 있어 위치·크기를 바꿀 수 있어요.

[PSD] 포토샵
- 레이어: 배경 / 아래 장식 / 사진 / 글씨·날짜·장식
- 글씨는 그림으로 들어 있어요(포토샵에서 글자를 고치려면 SVG를 쓰세요).

[글꼴] 글씨를 똑같이 보려면 아래 글꼴을 컴퓨터에 설치하세요 (모두 무료)
- Instrument Serif, Fraunces, JetBrains Mono, Noto Serif KR : https://fonts.google.com
- Pretendard : https://github.com/orioncactus/pretendard
`;
// 사진은 SVG 안에 JPEG로 넣어요 (PNG보다 훨씬 가벼워요). 글자 모양 사진처럼 투명한 곳이 있는 그림은 PNG 그대로
const calJpeg = new WeakMap();
function calSvgCtx(C2S) {
  const ctx = new C2S({ width: CAL_W, height: CAL_H });
  // canvas2svg는 오려 낼 모양을 비워 둔 채 clip해서, 모양을 먼저 적어 줘요
  const clip = ctx.clip; ctx.clip = function () { if (this.__currentElement && this.__currentElement.nodeName === 'path') this.__applyCurrentDefaultPath(); return clip.apply(this); };
  const draw = ctx.drawImage;
  ctx.drawImage = function (img) {
    // canvas2svg는 사진 위치(x, y)를 빼먹고 빈 묶음을 남겨서, 위치를 직접 적고 빈 묶음은 지워요
    const parent = this.__closestGroupOrSvg(), before = parent.childNodes.length; draw.apply(this, arguments);
    const added = [...parent.childNodes].slice(before), el = added.find(n => n.nodeName === 'image');
    added.forEach(n => { if (n !== el && n.nodeName === 'g' && !n.childNodes.length) parent.removeChild(n); });
    if (!el) return;
    const a = arguments; el.setAttribute('x', a.length === 9 ? a[5] : a[1]); el.setAttribute('y', a.length === 9 ? a[6] : a[2]);
    if (img._alpha) return;
    if (!calJpeg.has(img)) {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, 2600 / Math.max(w, h)), c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      calJpeg.set(img, c.toDataURL('image/jpeg', .9));
    }
    el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', calJpeg.get(img));
  };
  return ctx;
}
async function calSvgZip(cal, art, imgs, progress) {
  const [C2S, JSZip] = await Promise.all([loadC2S(), loadZip()]), zip = new JSZip(), pages = calPages(), c = { year: cal.year };
  for (let i = 0; i < pages.length; i++) {
    const ctx = calSvgCtx(C2S); calDraw(cal, pages[i], CAL_W, art, imgs, ctx);
    zip.file(calFileName(c, pages[i], i).replace(/\.jpg$/, '.svg'), ctx.getSerializedSvg(true));
    if (progress) progress(i + 1, pages.length);
    await new Promise(r => setTimeout(r));
  }
  zip.file('읽어 주세요.txt', CAL_README);
  saveBlob(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }), `hamihamoo-calendar-${cal.year}-svg.zip`);
  toast(`편집용 SVG ${pages.length}장을 압축 파일로 내려받았어요 · 글꼴 안내는 "읽어 주세요" 파일에 있어요`, 5200);
}
// PSD: 한 장을 같은 순서로 네 번 그리면서, 그리는 명령을 종류별로 다른 레이어에만 남겨요
// (맨 처음 바탕 = 배경, 첫 사진 전 = 아래 장식, 사진 = 사진, 첫 사진 뒤 = 글씨·날짜·장식)
const CAL_DRAWOPS = new Set(['fillRect', 'strokeRect', 'fill', 'stroke', 'fillText', 'strokeText', 'drawImage']);
function calLayerCtx(real, keep, seen) {
  let n = 0, img = false;
  return new Proxy(real, {
    get(t, p) {
      const v = t[p]; if (typeof v !== 'function') return v;
      if (!CAL_DRAWOPS.has(p)) return v.bind(t);
      return (...a) => { const kind = n++ === 0 ? 'bg' : p === 'drawImage' ? (img = true, 'photo') : img ? 'ink' : 'under'; seen.add(kind); if (kind === keep) return v.apply(t, a); };
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
async function calPsd(cal, pg, idx, art, imgs) {
  const ag = await loadAgPsd(), seen = new Set(), names = { bg: '배경', under: '아래 장식', photo: '사진', ink: '글씨 · 날짜 · 장식' };
  const layers = ['bg', 'under', 'photo', 'ink'].map(k => { const c = document.createElement('canvas'); c.width = CAL_W; c.height = CAL_H; calDraw(cal, pg, CAL_W, art, imgs, calLayerCtx(c.getContext('2d'), k, seen)); return { k, c }; });
  const psd = { width: CAL_W, height: CAL_H, canvas: calDraw(cal, pg, CAL_W, art, imgs), children: layers.filter(l => seen.has(l.k)).map(l => ({ name: names[l.k], canvas: l.c })) };
  const buf = ag.writePsd(psd, { generateThumbnail: true });
  const name = calFileName({ year: cal.year }, pg, idx).replace(/\.jpg$/, '.psd');
  saveBlob(new Blob([buf], { type: 'image/vnd.adobe.photoshop' }), name);
  toast(`${calPageName(pg)}을(를) 포토샵 파일(레이어 ${psd.children.length}개)로 내려받았어요`, 4200);
}
// 전시된 달력은 함께 저장된 설계도(recipe)로 사진·편집 그림을 다시 준비해요
async function calPrepare(recipe) {
  const cal = calFix(JSON.parse(JSON.stringify(recipe))), imgs = new Map(), art = new Map();
  await Promise.all([calFonts(), Holidays.load()]);
  const ty = cal.cover.type; if (ty && ty.font !== 'classic') await document.fonts.load(`${ty.weight} 40px ${ty.font === 'sans' ? 'Pretendard' : 'Fraunces'}`, '0123456789').catch(() => {});
  const files = new Set(calPages().map(pg => calPhotoOf(cal, pg)).concat(cal.months.map(m => m.photo)).filter(Boolean));
  await Promise.all([...files].map(f => { const p = S.byName.get(f); return p ? calImg(p).then(i => imgs.set(f, i)).catch(() => {}) : null; }));
  for (const pg of calPages()) {
    const it = calEditOf(cal, pg), R = calRectOf(cal, pg), p = S.byName.get(calPhotoOf(cal, pg));
    if (it && it.edit && R && p) { const a = await Postcard.render(p, R[2], R[3], it.edit).catch(() => null); if (a) art.set(calKey(pg), a); }
  }
  return { cal, art, imgs };
}
// 휴대폰은 공유 창, 컴퓨터는 zip 하나로
async function calDownload(year, filePromises) {
  const list = await Promise.all(filePromises);
  if (isTouch && navigator.canShare && navigator.canShare({ files: list })) {
    try { await navigator.share({ files: list, title: `Hamihamoo calendar ${year}` }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const JSZip = await loadZip(), zip = new JSZip();
  list.forEach(f => zip.file(f.name, f));
  saveBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `hamihamoo-calendar-${year}.zip`);
  toast(`${list.length}장을 압축 파일 하나로 내려받았어요`);
}

// ---------- 만들기 ----------
function renderCalMaker(view) {
  let cal = store.get('hm-cal-draft', null);
  if (!cal || !Array.isArray(cal.months) || cal.months.length !== 12 || !cal.months.every(it => S.byName.get(it.photo)) || !S.byName.get(cal.cover && cal.cover.photo)) cal = calNew();
  calFix(cal);
  const art = new Map(), imgs = new Map(), pages = calPages();
  let editing = (S.calendars || []).find(c => c.id === store.get('hm-cal-edit', null)) || null;
  let cur = 0, alive = true, guide = store.get('hm-cal-guide', true);
  pageCleanup.push(() => { alive = false; });
  const save = () => { store.set('hm-cal-draft', cal); Drafts.touch('cal'); };
  view.innerHTML = `<section class="page cal-make">
    <div class="page-head">
      <div><div class="page-kicker mono"><a href="#/calendars" class="faint">← Calendars</a></div><h1 class="page-title split">${splitChars('New calendar')}</h1></div>
      ${editing ? `<p class="cm-editing" id="cmEditing"><b>「${esc(editing.title || editing.year)}」 달력을 고치는 중</b> · 올리면 원래 달력이 이 버전으로 바뀌어요 <button class="pc-link" id="cmEditOff">새 달력으로 만들기</button></p>` : ''}
      <p class="page-sub">탁상 달력(가로) 한 권: 표지와 그 뒷면, 열두 달 앞·뒷면, 뒷표지와 그 뒷면. 장마다 구도를 고르거나 모든 달에 한 번에 적용할 수 있어요. 만드는 중인 달력은 자동으로 임시저장돼요.</p>
      ${Drafts.tag('cal')}
    </div>
    <div class="cm-top">
      <label class="field"><span>제목</span><input id="cmTitle" maxlength="40" placeholder="예: 연기처럼 지나간 날들"></label>
      <label class="field cm-year"><span>연도</span><input id="cmYear" type="number" min="2000" max="2050"></label>
      <div class="field"><span>종이 색 (모든 장)</span><div class="seg" id="cmPaper"><span class="seg-ind"></span>${Object.entries(CAL_PAPER).map(([k, t]) => `<button data-v="${k}">${t.name}</button>`).join('')}</div></div>
      <div class="field"><span>한 번에 바꾸기</span><div class="cm-row"><button class="pill" data-fill="season">사진: 계절 맞춤 랜덤</button><button class="pill" data-fill="random">사진: 완전 랜덤</button><button class="pill" id="cmMix">구도 섞기</button></div></div>
    </div>
    <div class="cm-strip" id="cmStrip"></div>
    <div class="cm-main">
      <div class="cm-stage"><canvas id="cmCanvas"></canvas><div class="cm-flip" id="cmFlip"></div></div>
      <aside class="cm-side" id="cmSide"></aside>
    </div>
    <div class="cm-actions">
      <button class="btn ghost" id="cmView">넘겨 보기</button>
      <div class="cm-dl" id="cmDl">
        <button class="btn" id="cmDlBtn" aria-expanded="false" aria-controls="cmDlMenu">내려받기 <span class="arrow">▾</span></button>
        <div class="cm-dl-menu" id="cmDlMenu" hidden>
          <button id="cmDown"><b>이미지 묶음 (JPG)</b><small>28장 · 폰, SNS</small></button>
          <button id="cmPdf"><b>인쇄용 PDF</b><small>한 파일 · 인쇄소, 프린터</small></button>
          <button id="cmSvg"><b>편집용 SVG (전체)</b><small>일러스트레이터, 피그마</small></button>
          <button id="cmPsd"><b>포토샵 PSD (지금 보는 면)</b><small>레이어로 나뉜 한 면</small></button>
        </div>
      </div>
      <button class="btn" id="cmPublish" hidden>${editing ? '고친 달력 올리기' : '전시에 올리기'} <span class="arrow">↗</span></button>
      <button class="pc-link" id="cmReset">처음부터 다시</button>
    </div>
  </section>`;
  const cv = $('#cmCanvas', view), strip = $('#cmStrip', view), side = $('#cmSide', view);
  const pg = () => pages[cur];
  const idx = (k, m) => pages.findIndex(q => q.k === k && (m == null || q.m === m));

  async function ensureImgs() {
    const need = [cal.cover, cal.coverB, cal.end, cal.endB, ...cal.months, ...cal.months.map(it => it.back)].map(it => it.photo && S.byName.get(it.photo)).filter(p => p && !imgs.has(p.filename));
    await Promise.all(need.map(p => calImg(p).then(i => imgs.set(p.filename, i)).catch(() => {})));
  }
  // 편집기로 다듬은 칸은 저장된 설정으로 다시 그려 둬요. 구도를 바꿔 칸 크기가 달라지면 새 크기로 다시
  let artRun = 0;
  async function ensureArt() {
    const run = ++artRun;
    for (const q of pages) {
      const it = calEditOf(cal, q); if (!it || !it.edit) continue;
      const R = calRectOf(cal, q), k = calKey(q); if (!R) continue;
      const a0 = art.get(k); if (a0 && a0.width === Math.round(R[2]) && a0.height === Math.round(R[3])) continue;
      const a = await Postcard.render(S.byName.get(calPhotoOf(cal, q)), R[2], R[3], it.edit).catch(() => null);
      if (!alive || run !== artRun) return; if (a) art.set(k, a); paint();
    }
  }
  let pr = 0;
  function paint() {
    if (pr) return;
    pr = requestAnimationFrame(() => {
      pr = 0; if (!alive) return;
      const W = Math.min(1600, Math.round(cv.parentNode.clientWidth * (devicePixelRatio || 1)));
      const big = calDraw(cal, pg(), W, art, imgs);
      cv.width = big.width; cv.height = big.height; cv.getContext('2d').drawImage(big, 0, 0);
      if (guide) calGuide(cv);
      paintStrip();
    });
  }
  // 위 줄: 표지 · 1~12월 · 뒷표지 (위 앞쪽 면, 아래 뒤쪽 면)
  function paintStrip() {
    strip.innerHTML = '';
    const thumb = i => { const b = document.createElement('button'); b.className = 'cm-thumb' + (i === cur ? ' on' : ''); b.dataset.i = i; b.title = calPageName(pages[i]); b.appendChild(calDraw(cal, pages[i], 240, art, imgs)); return b; };
    const col = (label, ...is) => { const d = document.createElement('div'); d.className = 'cm-col'; is.forEach(i => d.appendChild(thumb(i))); const l = document.createElement('span'); l.className = 'mono'; l.textContent = label; d.appendChild(l); strip.appendChild(d); };
    col('표지', idx('cover'), idx('coverb'));
    for (let m = 0; m < 12; m++) col(`${m + 1}월`, idx('front', m), idx('back', m));
    col('뒷표지', idx('end'), idx('endb'));
  }
  const pills = (map, on, attr) => `<div class="pc-chips cm-pills">${Object.entries(map).map(([k, t]) => `<button class="pill${k === on ? ' on' : ''}" ${attr}="${k}">${t}</button>`).join('')}</div>`;
  function paintSide() {
    const q = pg(), y = cal.year, it = calEditOf(cal, q), fn = calPhotoOf(cal, q), p = fn && S.byName.get(fn);
    const flip = $('#cmFlip', view);
    const fk = CAL_UNFLIP[q.k] || q.k;
    flip.innerHTML = `<div class="seg" id="cmFace"><span class="seg-ind"></span><button data-v="${fk}" class="${calIsBack(q.k) ? '' : 'on'}">앞면</button><button data-v="${CAL_FLIP[fk]}" class="${calIsBack(q.k) ? 'on' : ''}">뒷면</button></div>` + `<label class="cm-guide"><input type="checkbox" id="cmGuide" ${guide ? 'checked' : ''}> 안전 영역 보기 <span class="faint">(화면에만 보여요)</span></label>`;
    if ($('#cmFace', view)) requestAnimationFrame(() => syncSeg($('#cmFace', view)));
    const R0 = calRectOf(cal, q);
    const photoBox = (extra = '') => p && R0 ? `<div class="cm-photo"><img src="${esc(thumbUrl(p))}" alt=""><div><span class="mono faint">${esc(fmtDate(p.date))}</span><span class="cm-state">${it.edit ? '편집기로 다듬음' : '원본 그대로'}</span></div></div>
      <div class="cm-row"><button class="pill" id="cmPick">사진 바꾸기</button><button class="pill" id="cmEdit">편집기에서 다듬기</button>${it.edit ? '<button class="pill" id="cmPlain">원본으로</button>' : ''}${extra}</div>` : '';
    let h = `<h3>${esc(calPageName(q))}</h3>`;
    const toggles = (map, sh, attr) => `<div class="pc-chips cm-pills">${Object.entries(map).map(([k, t]) => `<button class="pill${sh[k] ? ' on' : ''}" ${attr}="${k}">${sh[k] ? '✓ ' : ''}${t}</button>`).join('')}</div>`;
    if (q.k === 'cover') h += `<div class="mono faint pc-l">표지 구도</div>${pills(CAL_COVER, cal.cover.layout, 'data-cover')}
      <div class="mono faint pc-l">보여 줄 것</div>${toggles(CAL_COVER_SHOW, cal.cover.show, 'data-cshow')}
      ${cal.cover.layout === 'type' ? (() => { const ty = cal.cover.type; return `<div class="cm-type">
        <div class="mono faint pc-l">연도 글꼴</div>${pills({ serif: '세리프', sans: '고딕', classic: '기본(가는 세리프)' }, ty.font, 'data-tyf')}
        <div class="mono faint pc-l">두께 <span id="cmTyWN">${ty.font === 'classic' ? '이 글꼴은 두께 고정' : ty.weight}</span></div><input type="range" class="pc-range" id="cmTyW" min="100" max="900" step="50" value="${ty.weight}" ${ty.font === 'classic' ? 'disabled' : ''}>
        <div class="mono faint pc-l">크기 <span id="cmTySN">${ty.size}%</span></div><input type="range" class="pc-range" id="cmTyS" min="40" max="130" step="1" value="${ty.size}">
        <div class="mono faint pc-l">세로 위치 <span id="cmTyVN">${ty.v === 0 ? '맨 위' : ty.v === 100 ? '맨 아래' : ty.v}</span></div><input type="range" class="pc-range" id="cmTyV" min="0" max="100" step="1" value="${ty.v}">
        <div class="mono faint pc-l">가로 위치</div>${pills({ left: '왼쪽', center: '가운데', right: '오른쪽' }, ty.align, 'data-tya')}</div>`; })() : ''}
      <label class="field" style="margin-top:12px"><span>한 줄 문구 (제목은 위 칸에서)</span><input id="cmSub" maxlength="80" placeholder="예: 한 해 동안 찍은 열두 장의 사진" value="${esc(cal.cover.sub || '')}"></label>
      ${R0 ? '<div class="mono faint pc-l">사진</div>' + photoBox() : '<p class="faint">이 구도는 열두 달 사진으로 채워져요.</p>'}`;
    else if (q.k === 'end') h += `<div class="mono faint pc-l">뒷표지 구도</div>${pills(CAL_END, cal.end.layout, 'data-end')}
      <div class="mono faint pc-l">보여 줄 것</div>${toggles(CAL_END_SHOW, cal.end.show, 'data-eshow')}
      <label class="field" style="margin-top:12px"><span>맺음말</span><textarea id="cmNote" maxlength="400" rows="3" placeholder="한 해를 마치며 남기는 말">${esc(cal.end.note || '')}</textarea></label>
      ${R0 ? '<div class="mono faint pc-l">사진 (기본은 12월 사진)</div>' + photoBox(cal.end.photo ? '<button class="pill" id="cmSame">12월 사진으로</button>' : '') : '<p class="faint">이 구도는 열두 달 사진으로 채워져요.</p>'}`;
    else if (q.k === 'coverb' || q.k === 'endb') {
      const cb = q.k === 'coverb', map = cb ? CAL_COVERB : CAL_ENDB;
      h += `<div class="mono faint pc-l">${cb ? '표지 뒷면' : '뒷표지 뒷면'} 구도</div>${pills(map, it.layout, 'data-inner')}
      <p class="faint" style="font-size:12px;margin:6px 0 0">${cb ? '첫 장을 넘기면 보이는 면이에요.' : '달력을 세워 두면 맨 바깥(뒤쪽)에 보이는 면이에요.'}</p>
      <label class="field" style="margin-top:12px"><span>글 (구도에 따라 서문 · 글귀 · 엽서 글 · 한 줄 메모로 쓰여요)</span><textarea id="cmInner" maxlength="400" rows="4" placeholder="${cb ? '예: 한 해 동안 찍은 열두 장의 사진' : '예: 내년에 또 만나요'}">${esc(it.text || '')}</textarea></label>
      ${R0 ? `<div class="mono faint pc-l">사진 (기본은 ${cb ? '표지' : '뒷표지'} 사진)</div>` + photoBox(it.photo ? `<button class="pill" id="cmSame">${cb ? '표지' : '뒷표지'} 사진으로</button>` : '') : `<p class="faint">${it.layout === 'contents' ? '이 구도는 열두 달 사진으로 채워져요.' : '이 구도에는 사진 칸이 없어요.'}</p>`}`;
    } else if (q.k === 'front') {
      const holMap = Holidays.year(y), mHol = Object.entries(holMap).filter(([d]) => +d.slice(5, 7) === q.m + 1).sort();
      const extra = (cal.extra || []).filter(e => +e.d.slice(5, 7) === q.m + 1);
      h += `<div class="mono faint pc-l">앞면 구도</div>${pills(CAL_FRONT, it.layout, 'data-front')}<button class="pc-link cm-all" id="cmAllFront">이 구도를 모든 달에 적용</button>
      <div class="mono faint pc-l">사진</div>${photoBox()}
      <div class="mono faint pc-l">이 달의 공휴일 ${Holidays.lunarOk || y > 2050 ? '' : '(음력 공휴일 계산 중…)'}</div>
      <ul class="cm-hol">${mHol.length ? mHol.map(([d, n]) => `<li><b>${+d.slice(8)}일</b> ${esc(n.join(' · '))}</li>`).join('') : '<li class="faint">없음</li>'}${extra.map(e => `<li><b>${+e.d.slice(8)}일</b> ${esc(e.n)} <button class="pc-link" data-del="${(cal.extra || []).indexOf(e)}">지우기</button></li>`).join('')}</ul>
      ${y > 2050 ? '<p class="faint" style="font-size:12px">2050년 뒤는 설날·추석 같은 음력 공휴일이 자동으로 안 들어가요. 아래에서 직접 넣어 주세요.</p>' : ''}
      <form class="cm-add" id="cmAdd"><input type="date" id="cmAddD" required min="${y}-${pad(q.m + 1)}-01" max="${y}-${pad(q.m + 1)}-${new Date(y, q.m + 1, 0).getDate()}" value="${y}-${pad(q.m + 1)}-01"><input id="cmAddN" maxlength="10" placeholder="예: 선거일" required><button class="pill">쉬는 날 추가</button></form>`;
    } else {
      const b = it, mo = cal.months[q.m];
      h += `<div class="mono faint pc-l">뒷면 구도</div>${pills(CAL_BACK, b.layout, 'data-back')}<button class="pc-link cm-all" id="cmAllBack">이 구도를 모든 달 뒷면에 적용</button>
      <div class="mono faint pc-l">보여 줄 것</div>${toggles(CAL_SHOW, b.show, 'data-show')}<button class="pc-link cm-all" id="cmAllShow">이 구성을 모든 달 뒷면에 적용</button>
      <label class="field" style="margin-top:14px"><span>글귀</span><textarea id="cmQuote" maxlength="200" rows="3" placeholder="이 달에 남기고 싶은 한 줄">${esc(mo.quote || '')}</textarea></label>
      <div class="mono faint pc-l">뒷면 사진 ${b.photo ? '(앞면과 다른 사진)' : '(앞면과 같은 사진)'}</div>${photoBox(b.photo ? '<button class="pill" id="cmSame">앞면 사진으로</button>' : '')}`;
    }
    side.innerHTML = h;
  }
  const refresh = () => { paintSide(); paint(); };
  // 연도 글꼴의 고른 두께를 내려받은 뒤 한 번 더 그려요
  const tyFont = () => { const ty = cal.cover.type; if (ty.font === 'classic') return Promise.resolve(); return document.fonts.load(`${ty.weight} 40px ${ty.font === 'sans' ? 'Pretendard' : 'Fraunces'}`, '0123456789').then(() => paint()).catch(() => {}); };
  const go = i => { cur = i; refresh(); };

  // 위쪽 설정
  const tEl = $('#cmTitle', view), yEl = $('#cmYear', view), paperSeg = $('#cmPaper', view);
  tEl.value = cal.title || ''; yEl.value = cal.year;
  const paintPaper = () => { $$('button', paperSeg).forEach(b => b.classList.toggle('on', b.dataset.v === cal.paper)); requestAnimationFrame(() => syncSeg(paperSeg)); };
  paintPaper();
  tEl.addEventListener('input', () => { cal.title = tEl.value; save(); paint(); });
  yEl.addEventListener('change', () => { cal.year = Math.max(2000, Math.min(2050, Math.round(+yEl.value) || new Date().getFullYear())); yEl.value = cal.year; save(); refresh(); });
  paperSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cal.paper = b.dataset.v; save(); paintPaper(); paint(); });
  $$('[data-fill]', view).forEach(b => b.onclick = async () => {
    const f = calFill(b.dataset.fill);
    cal.cover.photo = f.cover.filename; cal.cover.edit = null;
    f.months.forEach((p, m) => { const it = cal.months[m]; it.photo = p.filename; it.edit = null; it.back.photo = null; it.back.edit = null; });
    art.clear(); save(); await ensureImgs(); refresh();
  });
  // 구도 섞기: 달마다 다른 구도를 골라요 (같은 구도가 연달아 나오지 않게)
  $('#cmMix', view).onclick = () => {
    const keys = Object.keys(CAL_FRONT); let last = null;
    cal.months.forEach(it => { const pool = keys.filter(k => k !== last); it.layout = last = pool[Math.floor(Math.random() * pool.length)]; });
    save(); refresh(); ensureArt();
  };
  strip.addEventListener('click', e => { const b = e.target.closest('.cm-thumb'); if (b) go(+b.dataset.i); });
  view.addEventListener('click', e => {
    const fb = e.target.closest('#cmFace button'); if (fb) return go(idx(fb.dataset.v, pg().m));
    const q = pg(), it = calEditOf(cal, q), t = e.target;
    const lay = (sel, set) => { const b = t.closest(sel); if (!b) return false; set(b); save(); refresh(); ensureArt(); return true; };
    if (lay('[data-cover]', b => { cal.cover.layout = b.dataset.cover; })) return;
    if (lay('[data-front]', b => { it.layout = b.dataset.front; })) return;
    if (lay('[data-back]', b => { it.layout = b.dataset.back; })) return;
    if (lay('[data-end]', b => { cal.end.layout = b.dataset.end; })) return;
    if (lay('[data-inner]', b => { it.layout = b.dataset.inner; })) return;
    if (lay('[data-tyf]', b => { cal.cover.type.font = b.dataset.tyf; tyFont(); })) return;
    if (lay('[data-tya]', b => { cal.cover.type.align = b.dataset.tya; })) return;
    if (lay('[data-cshow]', b => { const k = b.dataset.cshow; cal.cover.show[k] = !cal.cover.show[k]; })) return;
    if (lay('[data-eshow]', b => { const k = b.dataset.eshow; cal.end.show[k] = !cal.end.show[k]; })) return;
    if (lay('[data-show]', b => { it.show[b.dataset.show] = !it.show[b.dataset.show]; })) return;
    if (t.closest('#cmAllFront')) { cal.months.forEach(o => { o.layout = it.layout; }); save(); refresh(); ensureArt(); return toast(`열두 달 앞면을 "${CAL_FRONT[it.layout]}" 구도로 바꿨어요`); }
    if (t.closest('#cmAllBack')) { cal.months.forEach(o => { o.back.layout = it.layout; }); save(); refresh(); ensureArt(); return toast(`열두 달 뒷면을 "${CAL_BACK[it.layout]}" 구도로 바꿨어요`); }
    if (t.closest('#cmAllShow')) { cal.months.forEach(o => { o.back.show = { ...it.show }; }); save(); refresh(); ensureArt(); return toast('열두 달 뒷면에 같은 구성을 적용했어요'); }
    if (t.closest('#cmPick')) return pickPhoto(q.m != null ? q.m : null, async p => {
      it.photo = p.filename; it.edit = null; art.delete(calKey(q));
      // 앞면 사진을 바꾸면, 앞면 사진을 함께 쓰던 뒷면도 새로 그려요
      if (q.k === 'front' && !it.back.photo) { it.back.edit = null; art.delete('b' + q.m); if (!it.quote && p.story) it.quote = p.story; }
      save(); await ensureImgs(); refresh();
    });
    if (t.closest('#cmEdit')) { const R = calRectOf(cal, q); if (!R) return toast('이 구도에는 사진 칸이 없어요'); return Postcard.edit(S.byName.get(calPhotoOf(cal, q)), R[2], R[3], it.edit, (c, sv) => { it.edit = sv; art.set(calKey(q), c); save(); refresh(); }); }
    if (t.closest('#cmPlain')) { it.edit = null; art.delete(calKey(q)); save(); refresh(); return; }
    if (t.closest('#cmSame')) { it.photo = null; it.edit = null; art.delete(calKey(q)); save(); refresh(); return; }
    const del = t.closest('[data-del]'); if (del) { cal.extra.splice(+del.dataset.del, 1); save(); refresh(); }
  });
  view.addEventListener('input', e => {
    const id = e.target.id;
    const ty = cal.cover.type, v = +e.target.value;
    if (id === 'cmTyW') { ty.weight = v; $('#cmTyWN', view).textContent = v; tyFont(); }
    else if (id === 'cmTyS') { ty.size = v; $('#cmTySN', view).textContent = v + '%'; }
    else if (id === 'cmTyV') { ty.v = v; $('#cmTyVN', view).textContent = v === 0 ? '맨 위' : v === 100 ? '맨 아래' : v; }
    else if (id === 'cmQuote') cal.months[pg().m].quote = e.target.value; else if (id === 'cmSub') cal.cover.sub = e.target.value; else if (id === 'cmNote') cal.end.note = e.target.value; else if (id === 'cmInner') calEditOf(cal, pg()).text = e.target.value; else return;
    save(); paint();
  });
  view.addEventListener('change', e => { if (e.target.id === 'cmGuide') { guide = e.target.checked; store.set('hm-cal-guide', guide); paint(); } });
  view.addEventListener('submit', e => {
    if (e.target.id !== 'cmAdd') return; e.preventDefault();
    const d = $('#cmAddD', view).value, n = $('#cmAddN', view).value.trim(); if (!d || !n) return;
    (cal.extra = cal.extra || []).push({ d, n }); save(); refresh(); toast(`${+d.slice(5, 7)}월 ${+d.slice(8)}일을 쉬는 날로 넣었어요`);
  });
  function editOff() { editing = null; store.set('hm-cal-edit', null); Drafts.touch('cal'); const n = $('#cmEditing', view); if (n) n.remove(); $('#cmPublish', view).innerHTML = '전시에 올리기 <span class="arrow">↗</span>'; }
  if ($('#cmEditOff', view)) $('#cmEditOff', view).onclick = () => { editOff(); toast('이제 올리면 새 달력으로 더해져요'); };
  $('#cmReset', view).onclick = async () => { if (!confirm('지금 만든 달력을 지우고 새로 시작할까요?')) return; editOff(); cal = calFix(calNew()); art.clear(); save(); tEl.value = ''; yEl.value = cal.year; paintPaper(); cur = 0; await ensureImgs(); refresh(); };

  // 한 권을 다 그려요 (내려받기·넘겨 보기·전시용). 네 장씩 함께 그려서 기다리는 시간을 줄여요
  let progress = null;
  const renderAll = async (W, q = .9) => {
    await calFonts(); await tyFont(); await ensureImgs();
    const out = [];
    for (let i = 0; i < pages.length; i += 4) {
      const part = await Promise.all(pages.slice(i, i + 4).map(p2 => new Promise(r => calDraw(cal, p2, W, art, imgs).toBlob(b => r({ ...p2, blob: b }), 'image/jpeg', q))));
      out.push(...part); if (progress) progress(out.length, pages.length);
    }
    return out;
  };
  const busy = async (btn, txt, fn) => { const h = btn.innerHTML; btn.disabled = true; btn.textContent = txt; progress = (n, t) => { btn.textContent = `${txt.replace('…', '')} ${n}/${t}`; }; try { await fn(); } catch (err) { console.error(err); toast(err.message || '문제가 생겼어요', 5000); } finally { progress = null; btn.disabled = false; btn.innerHTML = h; } };
  $('#cmDown', view).onclick = e => busy(e.currentTarget, '그리는 중…', async () => {
    const out = await renderAll(CAL_W, .92), c = { year: cal.year };
    await calDownload(cal.year, out.map((p2, i) => Promise.resolve(new File([p2.blob], calFileName(c, p2, i), { type: 'image/jpeg' }))));
  });
  $('#cmPdf', view).onclick = e => busy(e.currentTarget, '그리는 중…', async () => {
    const out = await renderAll(CAL_W, .92), c = { year: cal.year };
    await calPdf(cal.year, out.map((p2, i) => Promise.resolve(new File([p2.blob], calFileName(c, p2, i), { type: 'image/jpeg' }))));
  });
  const dlBtn = $('#cmDlBtn', view), dlMenu = $('#cmDlMenu', view);
  const dlOpen = on => { dlMenu.hidden = !on; dlBtn.setAttribute('aria-expanded', on); };
  dlBtn.onclick = () => dlOpen(dlMenu.hidden);
  const dlAway = e => { if (!dlMenu.hidden && !e.target.closest('#cmDl') && !dlMenu.querySelector(':disabled')) dlOpen(false); };
  const dlEsc = e => { if (e.key === 'Escape' && !dlMenu.querySelector(':disabled')) dlOpen(false); };
  document.addEventListener('click', dlAway); addEventListener('keydown', dlEsc);
  pageCleanup.push(() => { document.removeEventListener('click', dlAway); removeEventListener('keydown', dlEsc); });
  // 편집용: 다듬은 사진까지 다 준비된 뒤에 만들어요
  const readyAll = async () => { await calFonts(); await tyFont(); await ensureImgs(); await ensureArt(); };
  $('#cmSvg', view).onclick = e => busy(e.currentTarget, '그리는 중…', async () => { await readyAll(); await calSvgZip(cal, art, imgs, progress); });
  $('#cmPsd', view).onclick = e => busy(e.currentTarget, '만드는 중…', async () => { await readyAll(); await calPsd(cal, pg(), cur, art, imgs); });
  $('#cmView', view).onclick = e => busy(e.currentTarget, '준비 중…', async () => {
    const out = await renderAll(1600, .85);
    openCalendar({ title: cal.title, year: cal.year, pages: out.map(p2 => ({ k: p2.k, m: p2.m, _local: URL.createObjectURL(p2.blob) })) });
  });
  const pubBtn = $('#cmPublish', view); pubBtn.hidden = !Studio.authed;
  let published = false;
  pubBtn.onclick = e => busy(e.currentTarget, '올리는 중…', async () => {
    const out = await renderAll(2000, .86), d = new Date();
    // recipe: 나중에 편집 가능한 파일(SVG·PSD 등)로 다시 그릴 수 있게 달력 설정도 함께 저장해요
    await publishCalendar(out, { title: cal.title.trim(), year: cal.year, paper: cal.paper, recipe: JSON.parse(JSON.stringify(cal)), date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, w: 2000, h: Math.round(2000 * CAL_H / CAL_W) }, editing && editing.id);
    toast(editing ? '달력을 새 버전으로 바꿨어요 · 1~2분 뒤 홈페이지에도 반영돼요' : '전시(Projects › Calendars)에 올렸어요 · 1~2분 뒤 홈페이지에도 반영돼요', 4200);
    published = true;
  }).then(() => { if (published && editing) editOff(); published = false; });

  // 처음 그리기: 글꼴·사진 → 화면 → 다듬은 칸 → 음력 공휴일이 오면 한 번 더
  (async () => {
    await calFonts(); await ensureImgs(); if (!alive) return;
    refresh(); ensureArt(); tyFont();
    if (await Holidays.load() && alive) refresh();
  })();
  const onResize = () => paint(); addEventListener('resize', onResize); pageCleanup.push(() => removeEventListener('resize', onResize));
}
// 사진 고르기 창: 이 달에 찍은 사진을 먼저 보여 줘요
function pickPhoto(month, done) {
  const el = document.createElement('div'); el.className = 'pview cm-pick';
  const list = [...S.photos], inMonth = month == null ? [] : list.filter(p => p.date && +p.date.slice(5, 7) === month + 1);
  let only = inMonth.length > 0;
  el.innerHTML = `<div class="cm-pick-box"><div class="cm-pick-head"><b>사진 고르기</b>${month != null ? `<div class="seg" id="cmPickSeg"><span class="seg-ind"></span><button data-v="m" class="${only ? 'on' : ''}">${month + 1}월에 찍은 사진 ${inMonth.length}</button><button data-v="a" class="${only ? '' : 'on'}">전체 ${list.length}</button></div>` : ''}<button class="icon-btn" data-x aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="cm-pick-grid" id="cmPickGrid"></div></div>`;
  document.body.appendChild(el); document.body.classList.add('locked');
  const grid = $('#cmPickGrid', el);
  const paintG = () => { const l = only ? inMonth : list; grid.innerHTML = l.map(p => `<button data-f="${esc(p.filename)}"><img src="${esc(thumbUrl(p))}" alt="" loading="lazy"><span class="mono">${esc(fmtDate(p.date))}</span></button>`).join(''); };
  paintG(); const seg = $('#cmPickSeg', el); if (seg) requestAnimationFrame(() => syncSeg(seg));
  const close = () => { el.remove(); document.body.classList.remove('locked'); removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', key);
  el.addEventListener('click', e => {
    if (e.target === el || e.target.closest('[data-x]')) return close();
    const sb = e.target.closest('#cmPickSeg button'); if (sb) { only = sb.dataset.v === 'm'; $$('button', seg).forEach(b => b.classList.toggle('on', b === sb)); syncSeg(seg); paintG(); return; }
    const b = e.target.closest('[data-f]'); if (b) { close(); done(S.byName.get(b.dataset.f)); }
  });
}

/* ============================================================
   Exhibitions: 여러 시리즈에서 골라 주제로 엮는 전시
   Series = 한 번의 여행 기록 전부 / Exhibitions = 골라낸 몇 점을 방·글·라벨로 엮은 작품
   ============================================================ */
const EX_WALL = { light: '밝은 벽', dark: '어두운 벽', concrete: '콘크리트' };
const exWorks = ex => (ex.rooms || []).flatMap(r => (r.works || []).filter(w => S.byName.get(w.f)));
const exCover = ex => S.byName.get(ex.cover) || S.byName.get((exWorks(ex)[0] || {}).f);
const exPeriod = ex => `${fmtDate(ex.from)} —${ex.to ? ' ' + fmtDate(ex.to) : ''}`;
// 이 전시에 걸린 사진들이 어느 시리즈에서 왔는지 (시리즈를 넘나든다는 게 보이게)
const exSeries = ex => [...new Set(exWorks(ex).flatMap(w => (S.photoProjects.get(w.f) || []).map(pr => pr.title)))];
const exNo = ex => pad([...(S.exhibitions || [])].sort((a, b) => (a.created || '').localeCompare(b.created || '')).findIndex(e => e.id === ex.id) + 1 || 1);

// ---------- 목록: Projects › Exhibitions ----------
function renderExhibitions(view) {
  const all = [...(S.exhibitions || [])].sort((a, b) => (b.from || '').localeCompare(a.from || ''));
  const card = (ex, i) => {
    const c = exCover(ex), works = exWorks(ex), series = exSeries(ex);
    return `<a class="ex-card rv" href="#/exhibitions/${encodeURIComponent(ex.id)}" style="--d:${(i % 6) * 60}ms">
      <div class="ex-poster ph-frame" data-wall="${esc(ex.wall || 'light')}">${c ? `<img src="${esc(imgUrl(c))}" alt="" loading="lazy">` : ''}
        <div class="ex-poster-t"><span class="mono">Exhibition ${exNo(ex)}</span><b>${esc(ex.title)}</b><span>${esc(ex.subtitle || '')}${ex.subtitle ? ' · ' : ''}${works.length}점</span></div></div>
      <div class="ex-card-meta"><span class="mono faint">${esc(exPeriod(ex))}</span><span class="ex-from">${series.map(t => `<i>${esc(t)}</i>`).join('')}</span></div>
    </a>`;
  };
  view.innerHTML = `<section class="page">
    ${worksHead('exhibitions', all.length)}
    <div class="ex-list">${all.map(card).join('')}
      ${Studio.authed ? '<a class="ex-new rv" href="#/exhibitions/new"><span class="cal-new-plus" aria-hidden="true">+</span><b>새 전시 기획하기</b><small>여러 시리즈에서 사진을 골라<br>주제로 엮고, 방을 나누고, 글을 붙여요</small></a>' : ''}
    </div>
    ${all.length ? '' : `<div class="empty">아직 열린 전시가 없어요.${Studio.authed ? '' : ' <a class="accent" href="#/exhibitions/new">관리자라면 첫 전시를 기획해 보세요</a>'}</div>`}
  </section>`;
}

// ---------- 전시 보기: 입구 → 방마다 작품 → 출구 ----------
function renderExhibition(view, id, draft) {
  const ex = draft || (S.exhibitions || []).find(e => e.id === id);
  if (!ex) { view.innerHTML = `<section class="page"><div class="empty">전시를 찾을 수 없어요. <a class="accent" href="#/exhibitions">전시 목록으로</a></div></section>`; return; }
  const works = exWorks(ex), photos = works.map(w => S.byName.get(w.f)), total = works.length;
  let n = 0;
  const label = w => {
    const p = S.byName.get(w.f), k = n++, inf = parseInfo(p.info), from = (S.photoProjects.get(p.filename) || []).map(pr => pr.title).join(', ');
    const set = [inf.aperture, inf.shutter, inf.iso].filter(v => v && v !== '—').join(' · ');
    return `<section class="ex-work" data-n="${k + 1}">
      <button class="ex-frame rv" data-k="${k}" aria-label="${esc(w.title || '무제')} 크게 보기"><img src="${esc(imgUrl(p))}" alt="" loading="lazy"></button>
      <div class="ex-label rv"><div class="mono ex-no">No. ${pad(k + 1)}</div><h3>${esc(w.title || '무제')}</h3>
        <div class="mono ex-meta">${esc(fmtDate(p.date))}${from ? ' · ' + esc(from) : ''}</div>
        <p>${esc(inf.camera !== '—' ? inf.camera : '')}${set ? `<br>${esc(set)}` : ''}</p>${w.note ? `<p class="ex-note">${esc(w.note)}</p>` : ''}</div>
    </section>`;
  };
  const series = exSeries(ex);
  view.innerHTML = `<div class="ex" data-wall="${esc(ex.wall || 'light')}">
    <div class="ex-bar">
      <a class="mono" href="${draft ? (draft.id ? '#/exhibitions/' + encodeURIComponent(draft.id) + '/edit' : '#/exhibitions/new') : '#/exhibitions'}">${draft ? '← 기획으로 돌아가기' : '← Exhibitions'}</a>
      <span class="mono" id="exProg">${draft ? '미리 보기 · ' : ''}Entrance</span>
      <div class="ex-walls" id="exWalls">${Object.entries(EX_WALL).map(([k, t]) => `<button data-v="${k}" class="${(ex.wall || 'light') === k ? 'on' : ''}">${t}</button>`).join('')}${!draft ? '<button class="ex-edit" id="exLink">링크 복사</button>' : ''}${!draft && Studio.authed ? `<a class="ex-edit" href="#/exhibitions/${encodeURIComponent(ex.id)}/edit">수정</a>` : ''}</div>
    </div>
    <section class="ex-entrance">
      <div class="rv"><div class="mono">Exhibition ${draft ? '—' : exNo(ex)} · ${esc(exPeriod(ex))}</div><h1>${esc(ex.title || '제목 없는 전시')}</h1>${ex.subtitle ? `<div class="ex-sub">${esc(ex.subtitle)}</div>` : ''}</div>
      <div class="ex-statement rv">${(ex.statement || '').split(/\n{2,}/).filter(Boolean).map(t => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('')}
        <div class="mono ex-facts">${total}점 · 방 ${ex.rooms.filter(r => r.works.length).length}개${series.length ? ' · ' + esc(series.join(' / ')) : ''}</div>
        <span class="mono faint">↓ 전시장으로</span></div>
    </section>
    ${ex.rooms.filter(r => (r.works || []).some(w => S.byName.get(w.f))).map((r, i) => `<section class="ex-room rv"><span class="mono">Room ${i + 1}</span><b>${esc(r.title || '')}</b>${r.text ? `<p>${esc(r.text)}</p>` : ''}</section>${r.works.filter(w => S.byName.get(w.f)).map(label).join('')}`).join('')}
    <section class="ex-exit">
      <span class="mono">Exit</span><h2>전시를 마치며</h2>
      ${(ex.closing || '').trim() ? `<div class="ex-statement ex-closing">${ex.closing.trim().split(/\n{2,}/).map(t => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('')}</div>` : ''}
      <div class="ex-index">${works.map((w, k) => `<button data-k="${k}"><img src="${esc(thumbUrl(photos[k]))}" alt="" loading="lazy"><span class="mono">${pad(k + 1)} · ${esc(w.title || '무제')}</span></button>`).join('')}</div>
      ${!draft ? `<div class="ex-more">${(S.exhibitions || []).filter(e => e.id !== ex.id).slice(0, 3).map(e => `<a href="#/exhibitions/${encodeURIComponent(e.id)}"><span class="mono">다른 전시</span><b>${esc(e.title)}</b></a>`).join('')}<a href="#/exhibitions"><span class="mono">목록</span><b>모든 전시 보기 →</b></a></div>` : ''}
    </section>
  </div>`;
  const root = $('.ex', view), prog = $('#exProg', view), secs = $$('.ex-work', view);
  // 벽 색은 보는 사람이 바꿔 볼 수 있어요 (저장되지는 않아요)
  $('#exWalls', view).addEventListener('click', e => { if (e.target.closest('#exLink')) return copyText(shareLink('#/exhibitions/' + encodeURIComponent(ex.id)), '이 전시의 링크를 복사했어요'); const b = e.target.closest('button'); if (!b) return; root.dataset.wall = b.dataset.v; $$('#exWalls button', view).forEach(x => x.classList.toggle('on', x === b)); });
  view.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b && photos.length) Lightbox.open(photos, +b.dataset.k, $('img', b)); });
  // 지금 몇 번째 작품 앞에 서 있는지
  pageScroll.push(() => {
    const mid = innerHeight / 2, w = secs.find(el => { const r = el.getBoundingClientRect(); return r.top < mid && r.bottom > mid; });
    prog.textContent = (draft ? '미리 보기 · ' : '') + (w ? `${pad(w.dataset.n)} / ${pad(total)}` : scrollY < innerHeight * .6 ? 'Entrance' : '·');
  });
}

// ---------- 전시 기획 (관리자) ----------
function renderExEditor(view, id) {
  if (!Studio.authed) {
    view.innerHTML = `<section class="page"><div class="ex-gate"><h2>전시 기획은 관리자만 할 수 있어요</h2><p class="faint">GitHub 열쇠(토큰)로 들어오면 전시를 기획하고 열 수 있어요.</p>
      <form id="exGate" autocomplete="off"><input type="password" id="exTok" placeholder="GitHub 열쇠 (토큰)" required><button class="btn small">확인</button></form><p class="faint" id="exGateMsg"></p></div></section>`;
    $('#exGate', view).addEventListener('submit', async e => { e.preventDefault(); $('#exGateMsg', view).textContent = '확인하는 중…'; const ok = await adminLogin($('#exTok', view).value.trim()).catch(() => false); if (ok) render(); else $('#exGateMsg', view).textContent = '열쇠가 맞지 않거나, 저장할 권한이 없어요.'; });
    return;
  }
  const orig = id && (S.exhibitions || []).find(e => e.id === id);
  if (id && !orig) { view.innerHTML = `<section class="page"><div class="empty">전시를 찾을 수 없어요. <a class="accent" href="#/exhibitions">전시 목록으로</a></div></section>`; return; }
  const today = new Date(), iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const blank = () => ({ id: null, title: '', subtitle: '', statement: '', from: iso, to: '', wall: 'light', cover: null, rooms: [{ title: '', text: '', works: [] }] });
  const DKEY = 'hm-ex-draft';
  // 미리 보기를 다녀와도 고치던 내용이 그대로 남아 있게
  const dr = store.get(DKEY, null);
  let ex = orig ? (S._exDraft && S._exDraft.id === id ? S._exDraft : dr && dr.id === id ? dr : JSON.parse(JSON.stringify(orig))) : (S._exDraft && !S._exDraft.id ? S._exDraft : dr && !dr.id ? dr : blank());
  let room = 0, fSeries = 'all', fColor = 'all', hideUsed = false;
  const save = () => { S._exDraft = ex; store.set(DKEY, ex); Drafts.touch('ex'); };
  const used = () => new Set(ex.rooms.flatMap(r => r.works.map(w => w.f)));
  const series = S.projects.filter(pr => projectPhotos(pr).length);
  const COLORS = { all: '모든 색', ...Object.fromEntries(FAMILIES.map(([k, t]) => [k, t])) };
  view.innerHTML = `<section class="page ex-ed">
    <div class="page-head"><div><div class="page-kicker mono"><a href="#/exhibitions" class="faint">← Exhibitions</a></div><h1 class="page-title split">${splitChars(orig ? 'Edit exhibition' : 'New exhibition')}</h1></div>
      <p class="page-sub">여러 시리즈에서 사진을 골라 주제로 엮어요. 방을 나누고, 서문과 작품 제목을 쓰면 하나의 전시가 돼요.</p>${Drafts.tag('ex')}</div>
    <div class="ex-ed-grid">
      <div class="ex-ed-main">
        <div class="ex-ed-basic">
          <label class="field"><span>전시 제목</span><input id="exT" maxlength="60" placeholder="예: 푸른 시간"></label>
          <label class="field"><span>부제 (선택)</span><input id="exSub" maxlength="60" placeholder="예: 세 도시의 파란 오후"></label>
          <label class="field ex-wide"><span>서문 (빈 줄로 문단을 나눠요)</span><textarea id="exSt" maxlength="1200" rows="5" placeholder="이 전시를 왜, 어떻게 엮었는지 들려주세요."></textarea></label>
          <label class="field ex-wide"><span>맺음말 (전시 끝 "전시를 마치며" 아래에 보여요 · 비워 두면 안 보여요)</span><textarea id="exClose" maxlength="1200" rows="4" placeholder="전시를 둘러본 관람객에게 마지막으로 남기고 싶은 말"></textarea></label>
          <div class="ex-row2"><label class="field"><span>시작일</span><input type="date" id="exFrom"></label><label class="field"><span>종료일 (비우면 상설)</span><input type="date" id="exTo"></label></div>
          <div class="field"><span>벽 색</span><div class="seg" id="exWallSeg"><span class="seg-ind"></span>${Object.entries(EX_WALL).map(([k, t]) => `<button data-v="${k}">${t}</button>`).join('')}</div></div>
        </div>
        <div class="ex-rooms" id="exRooms"></div>
        <button class="pill" id="exAddRoom">+ 방 추가</button>
        <div class="ex-ed-actions">
          <button class="btn ghost" id="exPrev">미리 보기</button>
          <button class="btn" id="exSave">${orig ? '저장하기' : '전시 열기'} <span class="arrow">↗</span></button>
          ${orig ? '<button class="pc-link" id="exDel">이 전시 내리기</button>' : '<button class="pc-link" id="exReset">처음부터 다시</button>'}
          <span class="faint" id="exMsg"></span>
        </div>
      </div>
      <aside class="ex-pick">
        <div class="ex-pick-head"><b>사진 고르기</b><span class="mono faint" id="exPickTo"></span></div>
        <div class="ex-chips" id="exFS"><button data-v="all" class="on">모든 시리즈</button>${series.map(pr => `<button data-v="${esc(pr.id)}">${esc(pr.title)}</button>`).join('')}</div>
        <div class="ex-chips" id="exFC">${Object.entries(COLORS).map(([k, t]) => `<button data-v="${k}" class="${k === 'all' ? 'on' : ''}">${k !== 'all' ? `<i style="--c:${FAMILIES.find(f => f[0] === k)[2]}"></i>` : ''}${t}</button>`).join('')}</div>
        <label class="ex-hide"><input type="checkbox" id="exHide"> 이미 건 사진 숨기기</label>
        <div class="ex-grid" id="exGrid"></div>
      </aside>
    </div>
  </section>`;
  const $v = s => $(s, view);
  $v('#exT').value = ex.title; $v('#exSub').value = ex.subtitle || ''; $v('#exSt').value = ex.statement || ''; $v('#exClose').value = ex.closing || ''; $v('#exFrom').value = ex.from || iso; $v('#exTo').value = ex.to || '';
  const wallSeg = $v('#exWallSeg'), paintWall = () => { $$('button', wallSeg).forEach(b => b.classList.toggle('on', b.dataset.v === ex.wall)); requestAnimationFrame(() => syncSeg(wallSeg)); };
  paintWall();
  wallSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ex.wall = b.dataset.v; paintWall(); save(); });
  [['#exT', 'title'], ['#exSub', 'subtitle'], ['#exSt', 'statement'], ['#exClose', 'closing'], ['#exFrom', 'from'], ['#exTo', 'to']].forEach(([s, k]) => $v(s).addEventListener('input', e => { ex[k] = e.target.value; save(); }));

  // 방과 작품
  function paintRooms() {
    room = Math.min(room, ex.rooms.length - 1);
    $v('#exRooms').innerHTML = ex.rooms.map((r, i) => `<div class="exr${i === room ? ' on' : ''}" data-r="${i}">
      <div class="exr-head"><span class="mono">Room ${i + 1}</span><input data-k="title" maxlength="40" placeholder="방 이름 (예: 도착)" value="${esc(r.title || '')}">
        <button class="pill exr-pick" data-act="room">${i === room ? '✓ 여기에 담는 중' : '여기에 담기'}</button>${ex.rooms.length > 1 ? '<button class="pc-link" data-act="delroom">방 지우기</button>' : ''}</div>
      <textarea data-k="text" rows="2" maxlength="300" placeholder="방 설명 (선택)">${esc(r.text || '')}</textarea>
      <ol class="exw">${r.works.map((w, j) => { const p = S.byName.get(w.f); return p ? `<li data-w="${j}"><img src="${esc(thumbUrl(p))}" alt=""><div class="exw-f"><input data-k="wtitle" maxlength="40" placeholder="작품 제목 (비우면 무제)" value="${esc(w.title || '')}"><input data-k="wnote" maxlength="120" placeholder="한 줄 설명 (선택)" value="${esc(w.note || '')}"><span class="mono faint">${esc(fmtDate(p.date))} · ${esc((S.photoProjects.get(p.filename) || []).map(pr => pr.title).join(', ') || '시리즈 없음')}</span></div>
        <div class="exw-b"><button data-act="cover" class="${ex.cover === w.f ? 'on' : ''}" title="전시 대표 사진으로">★</button><button data-act="up" title="위로">↑</button><button data-act="down" title="아래로">↓</button>${ex.rooms.length > 1 ? `<select data-act="move" title="다른 방으로"><option value="">방 옮기기</option>${ex.rooms.map((rr, k) => k !== i ? `<option value="${k}">Room ${k + 1}${rr.title ? ' · ' + esc(rr.title) : ''}</option>` : '').join('')}</select>` : ''}<button data-act="del" title="빼기">✕</button></div></li>` : ''; }).join('')}</ol>
      ${r.works.length ? '' : '<p class="faint exr-empty">오른쪽에서 사진을 눌러 이 방에 걸어요.</p>'}
    </div>`).join('');
    $v('#exPickTo').textContent = `Room ${room + 1}${ex.rooms[room].title ? ' · ' + ex.rooms[room].title : ''}에 담아요`;
  }
  function paintGrid() {
    const u = used(), sp = fSeries === 'all' ? null : series.find(pr => pr.id === fSeries);
    // 찍은 날짜 순서: 최근 사진이 맨 앞
    let list = [...(sp ? projectPhotos(sp) : S.photos)].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (fColor !== 'all') list = list.filter(p => familyShare(p, fColor) >= minShare(fColor));
    if (hideUsed) list = list.filter(p => !u.has(p.filename));
    $v('#exGrid').innerHTML = list.map(p => `<button data-f="${esc(p.filename)}" class="${u.has(p.filename) ? 'on' : ''}"><img src="${esc(thumbUrl(p))}" alt="" loading="lazy"><span class="ex-ck" aria-hidden="true">✓</span></button>`).join('') || '<p class="faint">조건에 맞는 사진이 없어요.</p>';
  }
  const refresh = () => { paintRooms(); paintGrid(); };
  refresh();

  const chipSel = (sel, set) => $v(sel).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', $v(sel)).forEach(x => x.classList.toggle('on', x === b)); set(b.dataset.v); paintGrid(); });
  chipSel('#exFS', v => { fSeries = v; }); chipSel('#exFC', v => { fColor = v; });
  $v('#exHide').addEventListener('change', e => { hideUsed = e.target.checked; paintGrid(); });
  // 사진 누르면 지금 고른 방에 걸고, 이미 걸린 사진이면 빼요
  $v('#exGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return; const f = b.dataset.f;
    const where = ex.rooms.findIndex(r => r.works.some(w => w.f === f));
    if (where >= 0) { ex.rooms[where].works = ex.rooms[where].works.filter(w => w.f !== f); if (ex.cover === f) ex.cover = null; }
    else ex.rooms[room].works.push({ f, title: '', note: '' });
    save(); refresh();
  });
  $v('#exRooms').addEventListener('input', e => {
    const r = ex.rooms[+e.target.closest('[data-r]').dataset.r], li = e.target.closest('[data-w]'), k = e.target.dataset.k;
    if (k === 'title' || k === 'text') { r[k] = e.target.value; if (k === 'title') $v('#exPickTo').textContent = `Room ${room + 1}${ex.rooms[room].title ? ' · ' + ex.rooms[room].title : ''}에 담아요`; }
    else if (li) r.works[+li.dataset.w][k === 'wtitle' ? 'title' : 'note'] = e.target.value;
    save();
  });
  $v('#exRooms').addEventListener('change', e => {
    if (e.target.dataset.act !== 'move' || e.target.value === '') return;
    const i = +e.target.closest('[data-r]').dataset.r, j = +e.target.closest('[data-w]').dataset.w, w = ex.rooms[i].works.splice(j, 1)[0];
    ex.rooms[+e.target.value].works.push(w); save(); refresh();
  });
  $v('#exRooms').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
    const i = +b.closest('[data-r]').dataset.r, li = b.closest('[data-w]'), j = li ? +li.dataset.w : -1, ws = ex.rooms[i].works, act = b.dataset.act;
    if (act === 'room') room = i;
    else if (act === 'delroom') { if (ws.length && !confirm('이 방과 방에 건 사진을 모두 뺄까요? (사진 자체는 지워지지 않아요)')) return; ex.rooms.splice(i, 1); if (room >= ex.rooms.length) room = ex.rooms.length - 1; }
    else if (act === 'cover') ex.cover = ws[j].f;
    else if (act === 'up' && j > 0) [ws[j - 1], ws[j]] = [ws[j], ws[j - 1]];
    else if (act === 'down' && j < ws.length - 1) [ws[j + 1], ws[j]] = [ws[j], ws[j + 1]];
    else if (act === 'del') { if (ex.cover === ws[j].f) ex.cover = null; ws.splice(j, 1); }
    save(); refresh();
  });
  $v('#exAddRoom').onclick = () => { ex.rooms.push({ title: '', text: '', works: [] }); room = ex.rooms.length - 1; save(); refresh(); };
  const check = () => { if (!ex.title.trim()) return '전시 제목을 써 주세요'; if (!exWorks(ex).length) return '사진을 한 장 이상 걸어 주세요'; return ''; };
  $v('#exPrev').onclick = () => { S._exDraft = ex; location.hash = '#/exhibitions/preview'; };
  $v('#exSave').onclick = async e => {
    const msg = check(); if (msg) { $v('#exMsg').textContent = msg; return toast(msg); }
    const btn = e.currentTarget, h = btn.innerHTML; btn.disabled = true; btn.textContent = '저장하는 중…';
    try {
      // 빈 방은 빼고, 대표 사진이 없으면 첫 작품으로
      const out = { ...ex, title: ex.title.trim(), rooms: ex.rooms.filter(r => r.works.length).map(r => ({ title: (r.title || '').trim(), text: (r.text || '').trim(), works: r.works.map(w => ({ f: w.f, title: (w.title || '').trim(), note: (w.note || '').trim() })) })) };
      out.cover = out.cover && exWorks(out).some(w => w.f === out.cover) ? out.cover : exWorks(out)[0].f;
      out.id = out.id || `ex-${iso}-${Date.now().toString(36)}`; out.created = out.created || new Date().toISOString(); out.updated = new Date().toISOString();
      await publishExhibition(out);
      Drafts.clear('ex');
      S._exDraft = null;
      toast(orig ? '전시를 고쳤어요 · 1~2분 뒤 홈페이지에도 반영돼요' : '전시를 열었어요 · 1~2분 뒤 홈페이지에도 반영돼요', 4200);
      location.hash = '#/exhibitions/' + encodeURIComponent(out.id);
    } catch (err) { console.error(err); toast('저장하지 못했어요: ' + err.message, 6000); btn.disabled = false; btn.innerHTML = h; }
  };
  if ($v('#exDel')) $v('#exDel').onclick = async () => {
    if (!confirm('이 전시를 내릴까요? 전시만 사라지고 사진은 그대로 남아요.')) return;
    try { await unpublishExhibition(orig.id); toast('전시를 내렸어요'); location.hash = '#/exhibitions'; } catch (err) { toast('내리지 못했어요: ' + err.message, 6000); }
  };
  if ($v('#exReset')) $v('#exReset').onclick = () => { if (!confirm('지금 기획 중인 전시를 지우고 새로 시작할까요?')) return; ex = blank(); room = 0; Drafts.clear('ex'); S._exDraft = null; $v('#exT').value = ''; $v('#exSub').value = ''; $v('#exSt').value = ''; $v('#exFrom').value = iso; $v('#exTo').value = ''; paintWall(); refresh(); };
}

/* 예전 공유 링크(p.html#abc123)에서 쓰던 짧은 코드 */
function projectShortCode(id) {
  const A = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let h = 2166136261; const t = String(id || '');
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  h >>>= 0; let code = '';
  do { code = A[h % A.length] + code; h = Math.floor(h / A.length); } while (h > 0);
  return code.padStart(6, '0');
}
function renderShortProject(view, code) {
  const pr = S.projects.find(p => projectShortCode(p.id) === code);
  if (!pr) return renderProjects(view);
  history.replaceState(null, '', location.pathname + location.search + '#/projects/' + encodeURIComponent(pr.id));
  renderProject(view, pr.id);
}

/* ============================================================
   프로젝트 상세
   ============================================================ */
function renderProject(view, id) {
  const prs = S.projects.filter(pr => projectPhotos(pr).length);
  const idx = prs.findIndex(pr => pr.id === id);
  const pr = prs[idx];
  if (!pr) { view.innerHTML = `<section class="page"><div class="empty">프로젝트를 찾을 수 없어요. <a class="accent" href="#/projects">목록으로</a></div></section>`; return; }
  const ps = projectPhotos(pr), cover = projectCover(pr), next = prs[(idx + 1) % prs.length];
  const ds = ps.map(p => p.date).filter(Boolean).sort();
  const range = ds.length ? (ds[0] === ds[ds.length - 1] ? fmtDate(ds[0]) : `${fmtDate(ds[0])} — ${fmtDate(ds[ds.length - 1])}`) : '—';
  view.innerHTML = `
  <section class="pd-hero" id="pdHero">
    <img src="${esc(imgUrl(cover))}" alt="" id="pdCover">
    <div class="pd-hero-inner">
      <div><div class="mono" style="opacity:.75;margin-bottom:14px">Project ${pad(idx + 1)} — ${esc(pr.subtitle || '')}</div><h1 class="split">${splitChars(pr.title || '', 150)}</h1></div>
      <div style="display:flex;gap:8px"><a class="btn ghost small" href="#/projects" style="color:#fff;border-color:rgba(255,255,255,.4)">← 목록</a><button class="btn small" id="shareProject">링크 복사</button></div>
    </div>
  </section>
  <section class="pd-intro">
    <div class="pd-facts mono">
      <span>Frames</span><b>${ps.length}</b>
      <span>Period</span><b>${range}</b>
      <span>Camera</span><b>${esc(cameras(ps).join(', ') || '—')}</b>
    </div>
    <p class="rv">${esc(pr.description || '')}</p>
  </section>
  <section class="pd-photos" id="pdPhotos">${ps.map(p => card(p, { full: true })).join('')}</section>
  ${next && next !== pr ? `<a class="pd-next" href="#/projects/${encodeURIComponent(next.id)}"><span class="mono">Next project →</span><b>${esc(next.title)}</b></a>` : ''}`;
  lists.project = ps; bindPhotoClicks($('#pdPhotos', view), 'project');
  $('#pdCover', view).addEventListener('click', () => Lightbox.open(ps, Math.max(0, ps.indexOf(cover))));
  $('#shareProject', view).addEventListener('click', () => copyText(location.href, '프로젝트 링크를 복사했어요'));
  const coverEl = $('#pdCover', view);
  pageScroll.push(y => { coverEl.style.transform = `translateY(${y * 0.35}px) scale(${1 + y * 0.0002})`; });
}

/* 예전 Colors 페이지 주소(#/colors/Blue 등)로 들어오면 Work의 색 필터로 연결해요 */
function renderColorsRedirect(view, c) {
  if (c && LEGACY[c]) { S.archive.color = familyOf(LEGACY[c]); S.archive.shade = LEGACY[c]; store.set('hm-archive', S.archive); }
  history.replaceState(null, '', location.pathname + location.search + '#/');
  renderHome(view);
  setTimeout(() => { const a = $('#archive'); if (a) scrollTo({ top: a.offsetTop - 10 }); }, 60);
}

/* ============================================================
   별자리 (사진 사이의 관계 그래프)
   ============================================================ */
function renderConstellation(view) {
  const REL = [['all', '전체'], ['date', '같은 날'], ['project', '같은 프로젝트'], ['color', '같은 색'], ['camera', '같은 카메라']];
  const yrs = years(S.photos);
  view.innerHTML = `<div class="cons" id="cons">
    <canvas id="consCanvas"></canvas>
    <div class="cons-ui">
      <h1>Constellation</h1>
      <p>사진 하나하나가 별이에요. 같은 날, 같은 프로젝트, 비슷한 색, 같은 카메라로 찍은 사진끼리 선으로 이어져요. 끌어서 돌리고, 휠로 확대하고, 별을 눌러 보세요.</p>
      <div class="cons-filters" id="relF">${REL.map(([k, l]) => `<button class="pill ${k === 'all' ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
      <div class="cons-filters" id="yearF"><button class="pill on" data-y="all">모든 해</button>${yrs.map(y => `<button class="pill" data-y="${y}">${y}</button>`).join('')}</div>
      <input class="cons-search" id="consSearch" placeholder="날짜, 카메라, 색, 프로젝트 이름으로 찾기">
    </div>
    <aside class="cons-panel" id="consPanel"></aside>
    <div class="cons-tip" id="consTip"></div>
    <div class="cons-legend mono">
      <span><i style="--c:var(--accent)"></i>같은 날</span><span><i style="--c:#e8c26a"></i>같은 프로젝트</span><span><i style="--c:#8fb3d9"></i>같은 색</span><span><i style="--c:var(--ink-3)"></i>같은 카메라</span>
      <span class="cons-stat" id="consStat"></span>
    </div>
  </div>`;
  document.body.style.overflow = 'hidden';

  const cv = $('#consCanvas', view), ctx = cv.getContext('2d');
  const tip = $('#consTip', view), panel = $('#consPanel', view);
  const EXT = { x: 430, y: 330, z: 390 }, PERSP = 1150, DEPTH = 520;
  let W = 0, H = 0, DPR = 1, raf, rel = 'all', yearF = 'all', query = '';
  let rot = { x: -0.18, y: 0, z: 0 }, base = 1;
  const cam = { x: 0, y: 0, zoom: 1 };
  let hover = null, selected = null, focusAnim = null, lastT = performance.now();
  let colors = readColors();
  function readColors() { const cs = getComputedStyle(document.documentElement); return { bg: cs.getPropertyValue('--bg').trim(), ink: cs.getPropertyValue('--ink').trim(), ink3: cs.getPropertyValue('--ink-3').trim(), accent: cs.getPropertyValue('--accent').trim(), light: document.documentElement.dataset.theme === 'light' }; }

  /* 1) 3D 공간 안에 고르게 흩어진 별 (파일 이름으로 자리를 고정해 새로고침해도 같은 모양) */
  const seeded = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const nodes = S.photos.map((p, i) => {
    const r = seeded(`${p.filename}-${i}`);
    const zDir = r() * 2 - 1, ang = r() * Math.PI * 2, ring = Math.sqrt(Math.max(0, 1 - zDir * zDir));
    const rad = 0.22 + 0.78 * Math.pow(r(), 0.52);
    let sx = Math.cos(ang) * ring * EXT.x * rad * (0.72 + r() * 0.56);
    let sy = zDir * EXT.y * rad * (0.72 + r() * 0.56);
    let sz = Math.sin(ang) * ring * EXT.z * rad * (0.72 + r() * 0.56);
    sx += (r() - 0.5) * 105; sy += (r() - 0.5) * 80; sz += (r() - 0.5) * 115;
    if (r() < 0.16) { const b = 1.08 + r() * 0.26; sx *= b; sy *= b; sz *= b; }
    return {
      p, i, sx, sy, sz, cam: parseInfo(p.info).camera.toUpperCase(),
      prj: new Set((S.photoProjects.get(p.filename) || []).map(x => x.id)),
      img: null, orbit: -1, mix: 0, scr: null,
      search: [p.filename, p.date, p.info, ...paletteOf(p).map(([k]) => shadeKo(k) + ' ' + familyKo(familyOf(k))), ...(S.photoProjects.get(p.filename) || []).map(x => x.title)].join(' ').toLowerCase(),
    };
  });

  /* 2) 관계와 선 */
  const W8 = { date: 5, project: 6, color: 3.2, camera: 1.5 };
  function relation(a, b) {
    const da = a.p.date || '', db = b.p.date || '';
    const date = da && da === db ? 5 : da && da.slice(0, 7) === db.slice(0, 7) ? 2.2 : da && da.slice(0, 4) === db.slice(0, 4) ? 0.6 : 0;
    let project = 0; for (const id of a.prj) if (b.prj.has(id)) { project = 6; break; }
    const color = familyOf(mainShade(a.p)) === familyOf(mainShade(b.p)) ? 3.2 : 0;
    const camera = a.cam !== '—' && a.cam === b.cam ? 1.5 : 0;
    const parts = { date, project, color, camera };
    const w = rel === 'all' ? date + project + color + camera : parts[rel];
    const type = rel === 'all' ? Object.entries(parts).sort((x, y) => y[1] / W8[y[0]] - x[1] / W8[x[0]] || y[1] - x[1])[0][0] : rel;
    return { w, type };
  }
  const visible = n => (yearF === 'all' || (n.p.date || '').startsWith(yearF)) && (!query || n.search.includes(query));
  let edges = [], relations = [];
  function buildEdges() {
    const v = nodes.filter(n => yearF === 'all' || (n.p.date || '').startsWith(yearF));
    relations = [];
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
      const r = relation(v[i], v[j]); if (r.w <= 0) continue;
      const dist = Math.hypot(v[j].sx - v[i].sx, v[j].sy - v[i].sy, v[j].sz - v[i].sz);
      relations.push({ a: v[i], b: v[j], w: r.w, type: r.type, dist });
    }
    relations.sort((a, b) => b.w - a.w || a.dist - b.dist);
    edges = [];
    const deg = new Map(), maxE = Math.min(130, Math.max(55, Math.floor(v.length * 0.62)));
    const tryAdd = (e, minW) => {
      if (edges.length >= maxE || e.w < minW) return;
      const da = deg.get(e.a) || 0, db = deg.get(e.b) || 0;
      if (da >= 2 || db >= 2) return;
      if (e.dist > 520 && e.w < 6) return;
      edges.push(e); deg.set(e.a, da + 1); deg.set(e.b, db + 1);
    };
    const strong = rel === 'all' ? 4.4 : W8[rel] * (rel === 'date' ? 0.44 : 1);
    relations.forEach(e => tryAdd(e, strong));
    const minimum = Math.min(78, Math.floor(v.length * 0.42));
    if (edges.length < minimum) relations.forEach(e => { if (!edges.includes(e) && edges.length < minimum) tryAdd(e, rel === 'all' ? 3.15 : strong * 0.4); });
    $('#consStat').textContent = `${v.length} photographs · ${edges.length} connections`;
  }
  const strongest = n => relations.filter(e => e.a === n || e.b === n).map(e => ({ node: e.a === n ? e.b : e.a, w: e.w, type: e.type })).filter(x => visible(x.node));

  /* 3) 3D 회전과 원근 */
  function project(n) {
    let { sx: x, sy: y, sz: z } = n;
    const cy = Math.cos(rot.y), sy = Math.sin(rot.y);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const cx = Math.cos(rot.x), sxr = Math.sin(rot.x);
    const y2 = y * cx - z1 * sxr, z2 = y * sxr + z1 * cx;
    const cz = Math.cos(rot.z), szr = Math.sin(rot.z);
    const x3 = x1 * cz - y2 * szr, y3 = x1 * szr + y2 * cz;
    const per = PERSP / (PERSP - z2);
    return { x: x3 * per * cam.zoom + cam.x, y: y3 * per * cam.zoom + cam.y, z: z2, s: per, d: Math.max(0, Math.min(1, (z2 + DEPTH) / (DEPTH * 2))) };
  }
  function resize() {
    DPR = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    base = Math.max(0.42, Math.min(1.15, Math.min(W / 1250, H / 900)));
    if (!selected) { cam.x = W > 900 ? W * 0.58 : W / 2; cam.y = W > 900 ? H * 0.52 : H * 0.56; cam.zoom = base; }
  }

  /* 4) 별 하나를 누르면: 앞으로 돌려 세우고, 가까운 사진 6장이 달처럼 공전 */
  function focusOn(n) {
    const tY = Math.atan2(-n.sx, n.sz), tX = Math.atan2(n.sy, Math.hypot(n.sx, n.sz));
    const turns = Math.round((rot.y - tY) / (Math.PI * 2));
    const panelW = W > 720 ? 340 : 0;
    focusAnim = {
      t0: performance.now(), dur: 720,
      from: { ...rot, cx: cam.x, cy: cam.y, zoom: cam.zoom },
      to: { y: tY + turns * Math.PI * 2, x: tX, z: 0, cx: (W - panelW) / 2, cy: W > 720 ? H / 2 : Math.max(170, (H - 200) / 2), zoom: Math.min(2.1, Math.max(cam.zoom, base * 1.45)) },
    };
  }
  function select(n) {
    nodes.forEach(m => { m.orbit = -1; });
    selected = n;
    if (!n) { panel.classList.remove('on'); focusAnim = { t0: performance.now(), dur: 900, from: { ...rot, cx: cam.x, cy: cam.y, zoom: cam.zoom }, to: { ...rot, cx: W > 900 ? W * 0.58 : W / 2, cy: W > 900 ? H * 0.52 : H * 0.56, zoom: base } }; return; }
    const top = strongest(n).slice(0, 6);
    top.forEach((x, k) => { x.node.orbit = k; });
    focusOn(n);
    const info = parseInfo(n.p.info);
    panel.innerHTML = `<img src="${esc(thumbUrl(n.p))}" alt="" id="cpImg"><div><div class="mono accent" style="margin-top:12px">Photo ${n.p._n}</div><h4>${fmtDate(n.p.date)}</h4><div class="mono faint">${esc(info.camera)} · ${shadeKo(mainShade(n.p))}</div></div>
      <div class="mono faint" style="margin-top:14px;grid-column:1/-1">${top.length} orbit connections</div>
      <div class="cons-links">${top.map(x => `<img src="${esc(thumbUrl(x.node.p))}" data-i="${x.node.i}" title="${fmtDate(x.node.p.date)}" alt="">`).join('')}</div>`;
    panel.classList.add('on');
    $('#cpImg', panel).onclick = () => Lightbox.open(S.photos, n.i);
    $$('.cons-links img', panel).forEach(im => im.onclick = () => select(nodes[+im.dataset.i]));
  }

  const EDGE_C = { date: () => colors.accent, project: () => '#e8c26a', color: () => '#8fb3d9', camera: () => colors.ink3 };
  const ease = t => 1 - Math.pow(1 - t, 3);

  function frame(now) {
    const dt = Math.min(50, now - lastT); lastT = now;
    // 모든 별이 같은 방향으로 천천히 돌아요 (별을 고르거나 끄는 중에는 잠시 멈춤)
    if (focusAnim) {
      const t = Math.min(1, (now - focusAnim.t0) / focusAnim.dur), e = ease(t), f = focusAnim.from, to = focusAnim.to;
      rot.x = f.x + (to.x - f.x) * e; rot.y = f.y + (to.y - f.y) * e; rot.z = f.z + (to.z - f.z) * e;
      cam.x = f.cx + (to.cx - f.cx) * e; cam.y = f.cy + (to.cy - f.cy) * e; cam.zoom = f.zoom + (to.zoom - f.zoom) * e;
      if (t >= 1) focusAnim = null;
    } else if (!selected && !drag.on && !reduced) {
      rot.y += 0.000085 * dt;
      rot.x += ((-0.18 + Math.sin(now * 0.000095) * 0.075) - rot.x) * 0.02;
      rot.z += ((Math.sin(now * 0.000061) * 0.045) - rot.z) * 0.02;
    }
    nodes.forEach(n => { n.mix += ((selected && n.orbit >= 0 ? 1 : 0) - n.mix) * 0.08; });

    // 화면 위치 계산 (+ 공전)
    const center = selected ? project(selected) : null;
    nodes.forEach(n => {
      const s = project(n);
      if (center && n.mix > 0.001 && n !== selected) {
        const k = n.orbit >= 0 ? n.orbit : 0, inner = k < 3, group = inner ? 3 : 3;
        const ringR = (inner ? 95 : 150) * Math.max(0.8, cam.zoom / base * 0.7);
        const dir = inner ? 1 : -1;
        const a = ((inner ? k : k - 3) / group) * Math.PI * 2 + now * 0.00032 * dir + (inner ? 0 : 0.5);
        const tx = center.x + Math.cos(a) * ringR, ty = center.y + Math.sin(a) * ringR * 0.92;
        s.x += (tx - s.x) * n.mix; s.y += (ty - s.y) * n.mix;
        s.z += (center.z + 1 - s.z) * n.mix; s.d += (1 - s.d) * n.mix * 0.8; s.s += (center.s - s.s) * n.mix * 0.6;
      }
      n.scr = s;
    });

    // 그리기
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(cam.x, cam.y, 0, cam.x, cam.y, 520 * cam.zoom);
    g.addColorStop(0, colors.light ? 'rgba(217,67,31,.05)' : 'rgba(255,90,54,.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const focus = hover || selected;
    const near = selected ? new Set([selected, ...nodes.filter(n => n.orbit >= 0)]) : hover ? new Set([hover, ...strongest(hover).slice(0, 6).map(x => x.node)]) : null;
    ctx.lineCap = 'round';
    edges.forEach(e => {
      const A = e.a.scr, B = e.b.scr, vis = visible(e.a) && visible(e.b);
      let a = vis ? (0.12 + 0.4 * ((A.d + B.d) / 2)) * Math.min(1, 0.45 + e.w / 10) : 0.025;
      if (near) a *= 0.25;
      ctx.globalAlpha = a; ctx.strokeStyle = EDGE_C[e.type](); ctx.lineWidth = 0.6 + (A.d + B.d) * 0.45;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    });
    // 고른 별과 공전하는 별을 잇는 선
    if (focus) {
      const links = selected ? nodes.filter(n => n.orbit >= 0).map(n => ({ node: n, type: (strongest(selected).find(x => x.node === n) || {}).type })) : strongest(hover).slice(0, 6);
      links.forEach(x => {
        ctx.globalAlpha = selected ? 0.35 + 0.55 * x.node.mix : 0.75; ctx.strokeStyle = (EDGE_C[x.type] || EDGE_C.camera)(); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(focus.scr.x, focus.scr.y); ctx.lineTo(x.node.scr.x, x.node.scr.y); ctx.stroke();
      });
    }
    const order = nodes.slice().sort((a, b) => a.scr.z - b.scr.z);
    order.forEach(n => {
      const s = n.scr; if (s.x < -60 || s.y < -60 || s.x > W + 60 || s.y > H + 60) return;
      const vis = visible(n);
      let a = vis ? 0.28 + 0.72 * s.d : 0.07;
      if (near && !near.has(n)) a *= 0.3;
      let r = (2.2 + 4.2 * s.d) * s.s * cam.zoom;
      if (n === focus) r = Math.max(r * 2.6, 26);
      else if (near && near.has(n)) r = Math.max(r * 2, (selected ? 24 : 14) * Math.max(n.mix, selected ? 0 : 1) + r);
      ctx.globalAlpha = a;
      const photo = r > 7.5;
      if (photo) {
        if (!n.img) { n.img = new Image(); n.img.decoding = 'async'; n.img.src = thumbUrl(n.p); }
        if (n.img.complete && n.img.naturalWidth) {
          ctx.save(); ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.clip();
          const iw = n.img.naturalWidth, ih = n.img.naturalHeight, k = (r * 2) / Math.min(iw, ih);
          ctx.drawImage(n.img, s.x - iw * k / 2, s.y - ih * k / 2, iw * k, ih * k); ctx.restore();
          ctx.strokeStyle = n === focus ? colors.accent : 'rgba(255,255,255,.35)'; ctx.lineWidth = n === focus ? 2 : 1;
          ctx.beginPath(); ctx.arc(s.x, s.y, r + (n === focus ? 3 : 0.5), 0, Math.PI * 2); ctx.stroke();
          return;
        }
      }
      // 작은 별: 사진의 대표 색으로 빛나는 점
      const c = shadeHex(mainShade(n.p));
      if (s.d > 0.55 && vis) { ctx.globalAlpha = a * 0.25; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(s.x, s.y, r * 2.4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = a; }
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(1.2, r), 0, Math.PI * 2); ctx.fill();
      if (mainShade(n.p) === 'black') { ctx.strokeStyle = colors.ink3; ctx.lineWidth = 0.8; ctx.stroke(); }
    });
    ctx.globalAlpha = 1;
    if (hover && hover.scr) { tip.style.left = hover.scr.x + 'px'; tip.style.top = (hover.scr.y - 12) + 'px'; }
    raf = requestAnimationFrame(frame);
  }
  function hit(x, y) {
    let best = null, bd = Infinity;
    nodes.forEach(n => {
      if (!visible(n) || !n.scr) return;
      const r = Math.max(9, (2.2 + 4.2 * n.scr.d) * n.scr.s * cam.zoom + 5), d = Math.hypot(n.scr.x - x, n.scr.y - y);
      if (d < r && (d - n.scr.z * 0.002) < bd) { bd = d; best = n; }
    });
    return best;
  }

  /* 5) 조작: 끌어서 돌리기 · 휠/두 손가락으로 확대 · 누르기 */
  const drag = { on: false, x: 0, y: 0, moved: false, pts: new Map(), pinch: 0 };
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); drag.pts.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (drag.pts.size === 2) { const [a, b] = [...drag.pts.values()]; drag.pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); return; }
    drag.on = true; drag.x = e.offsetX; drag.y = e.offsetY; drag.moved = false; cv.classList.add('drag');
  });
  cv.addEventListener('pointermove', e => {
    if (drag.pts.has(e.pointerId)) drag.pts.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (drag.pts.size === 2 && drag.pinch) {
      const [a, b] = [...drag.pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      cam.zoom = Math.min(3.2, Math.max(0.3, cam.zoom * d / drag.pinch)); drag.pinch = d; return;
    }
    if (drag.on) {
      const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.moved) { focusAnim = null; rot.y += dx * 0.005; rot.x = Math.max(-1.3, Math.min(1.3, rot.x + dy * 0.004)); drag.x = e.offsetX; drag.y = e.offsetY; }
      return;
    }
    const h = hit(e.offsetX, e.offsetY);
    if (h !== hover) {
      hover = h;
      if (h) { tip.textContent = `${fmtDate(h.p.date)} · ${parseInfo(h.p.info).camera}`; tip.classList.add('on'); cv.style.cursor = 'pointer'; }
      else { tip.classList.remove('on'); cv.style.cursor = ''; }
    }
  });
  const up = e => {
    drag.pts.delete(e.pointerId); if (drag.pts.size < 2) drag.pinch = 0;
    if (drag.on && !drag.moved) { const n = hit(e.offsetX, e.offsetY); if (n !== selected) select(n || null); }
    drag.on = false; cv.classList.remove('drag');
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { hover = null; tip.classList.remove('on'); });
  cv.addEventListener('wheel', e => { e.preventDefault(); focusAnim = null; cam.zoom = Math.min(3.2, Math.max(0.3, cam.zoom * Math.exp(-e.deltaY * 0.0015))); }, { passive: false });
  cv.addEventListener('dblclick', e => { const n = hit(e.offsetX, e.offsetY); if (n) Lightbox.open(S.photos, n.i); });

  $('#relF', view).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#relF .pill').forEach(x => x.classList.toggle('on', x === b));
    rel = b.dataset.k; buildEdges(); if (selected) select(selected);
  });
  $('#yearF', view).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#yearF .pill').forEach(x => x.classList.toggle('on', x === b)); yearF = b.dataset.y; buildEdges();
    if (selected && !visible(selected)) select(null);
  });
  $('#consSearch', view).addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); });
  const onKey = e => { if (e.key === 'Escape' && selected && !Lightbox.isOpen) select(null); };
  const onTheme = () => { colors = readColors(); };
  addEventListener('keydown', onKey); addEventListener('themechange', onTheme); addEventListener('resize', resize);
  resize(); buildEdges();
  raf = requestAnimationFrame(frame);
  pageCleanup.push(() => {
    cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('themechange', onTheme); removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
  });
}

/* ============================================================
   방명록
   ============================================================ */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB7ZAZN43x_hYitRyEgcXnjeyIfYr9OyUQ',
  authDomain: 'my-photo-web-9b97a.firebaseapp.com',
  projectId: 'my-photo-web-9b97a',
  storageBucket: 'my-photo-web-9b97a.firebasestorage.app',
  messagingSenderId: '719108728610',
  appId: '1:719108728610:web:6e289f800ca5e19815677b',
};
const BLOCKED = ['시발', '씨발', 'ㅅㅂ', '병신', 'ㅂㅅ', '개새', '좆', 'fuck', 'shit'];
const EXIFR_URL = 'https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/lite.umd.js';
function loadScript(src) { return new Promise((res, rej) => { if ($(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
let fbDb = null;
async function getDb() {
  if (fbDb) return fbDb;
  await loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js');
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  fbDb = firebase.firestore(); return fbDb;
}
/* ---------- 하트 · 한 줄 감상 (Firebase) ---------- */
const Social = { ok: false, hearts: new Map(), mine: new Set(store.get('hm-hearts', [])), notes: new Map(), listeners: new Set() };
const heartId = f => String(f).replace(/\//g, '_');
const heartsOf = p => Social.hearts.get(heartId(p.filename)) || 0;
async function initSocial() {
  try {
    const db = await getDb();
    const snap = await db.collection('hearts').get();
    snap.forEach(d => Social.hearts.set(d.id, Math.max(0, +d.data().count || 0)));
    Social.ok = true;
  } catch (e) { Social.ok = false; }
  document.body.classList.toggle('social-on', Social.ok);
  emitSocial();
}
function emitSocial() { Social.listeners.forEach(f => f()); paintHearts(document); }
function paintHearts(root = document) {
  $$('[data-heart]', root).forEach(b => {
    const id = heartId(b.dataset.heart); if (!b.dataset.heart) return;
    b.classList.toggle('on', Social.mine.has(id));
    const n = $('.n', b); if (n) n.textContent = Social.hearts.get(id) || 0;
  });
  $$('[data-count]', root).forEach(el => { el.textContent = Social.hearts.get(heartId(el.dataset.count)) || 0; });
}
async function toggleHeart(filename, force) {
  if (!Social.ok) return false;
  const id = heartId(filename), was = Social.mine.has(id), on = force === undefined ? !was : force;
  if (on === was) return on;
  const apply = v => {
    v ? Social.mine.add(id) : Social.mine.delete(id); store.set('hm-hearts', [...Social.mine]);
    Social.hearts.set(id, Math.max(0, (Social.hearts.get(id) || 0) + (v ? 1 : -1))); emitSocial();
  };
  apply(on);
  try { const db = await getDb(); await db.collection('hearts').doc(id).set({ count: firebase.firestore.FieldValue.increment(on ? 1 : -1) }, { merge: true }); }
  catch (e) { apply(!on); toast('하트를 저장하지 못했어요'); }
  return on;
}
function heartPop(btn) {
  btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
  if (reduced) return;
  const b = document.createElement('span'); b.className = 'burst';
  b.innerHTML = Array.from({ length: 8 }, (_, k) => `<i style="--a:${k * 45}deg"></i>`).join('');
  btn.appendChild(b); setTimeout(() => b.remove(), 700);
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-heart]'); if (!b || !b.dataset.heart) return;
  e.preventDefault(); e.stopPropagation();
  if (await toggleHeart(b.dataset.heart)) heartPop(b);
}, true);
async function loadNotes(filename, fresh) {
  if (!Social.ok) return [];
  if (Social.notes.has(filename) && !fresh) return Social.notes.get(filename);
  try {
    const db = await getDb();
    const snap = await db.collection('notes').where('photo', '==', filename).get();
    const list = snap.docs.map(d => { const x = d.data(); return { nickname: x.nickname || '익명', message: x.message || '', date: x.timestamp && x.timestamp.toDate ? x.timestamp.toDate() : new Date() }; })
      .sort((a, b) => b.date - a.date);
    Social.notes.set(filename, list); return list;
  } catch (e) { return []; }
}
async function addNote(filename, nickname, message) {
  const db = await getDb();
  await db.collection('notes').add({ photo: filename, nickname, message, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
  const list = Social.notes.get(filename) || [];
  list.unshift({ nickname: nickname || '익명', message, date: new Date(), fresh: true });
  Social.notes.set(filename, list);
  return list;
}

function fmtStamp(d) {
  if (!d) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return Math.floor(diff / 60) + '분 전';
  if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + '일 전';
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}
function renderGuestbook(view) {
  view.innerHTML = `<section class="page">
    <div class="page-head">
      <div><div class="page-kicker mono">( Notes from visitors )</div><h1 class="page-title split">${splitChars('Guestbook')}</h1></div>
      <p class="page-sub">사진을 보고 떠오른 이야기, 짧은 인사, 무엇이든 좋아요.</p>
    </div>
    <div class="gb">
      <form class="gb-form rv" id="gbForm" autocomplete="off">
        <h3>Leave a note</h3>
        <p>남긴 글은 모두에게 보여요. 욕설은 자동으로 막혀요.</p>
        <label class="field"><span>이름</span><input id="gbName" maxlength="20" required placeholder="닉네임"></label>
        <label class="field"><span>메시지</span><textarea id="gbMsg" maxlength="500" required placeholder="사진 잘 봤어요!"></textarea><div class="cnt mono" id="gbCnt">0 / 500</div></label>
        <button class="btn block" id="gbSend">남기기 <span class="arrow">→</span></button>
        <div class="gb-status" id="gbStatus"></div>
      </form>
      <div>
        <div class="mono faint" id="gbCount" style="margin-bottom:16px">불러오는 중…</div>
        <div class="gb-wall" id="gbWall"></div>
      </div>
    </div>
  </section>`;
  const wall = $('#gbWall', view), count = $('#gbCount', view);
  let local = [];
  const paint = (items) => {
    // 서버에 도착한 글은 임시로 띄워둔 글과 겹치지 않게 빼요
    local = local.filter(l => !items.some(r => r.nickname === l.nickname && r.message === l.message));
    const all = [...local, ...items];
    count.textContent = `${all.length} notes`;
    wall.innerHTML = all.map((m, i) => `<article class="note ${m._new ? 'new' : ''} rv" style="--d:${Math.min(i, 10) * 50}ms"><p>${esc(m.message)}</p><footer class="mono"><b>${esc(m.nickname || '익명')}</b><span>${fmtStamp(m.date)}</span></footer></article>`).join('') || '<div class="empty">첫 번째 글을 남겨주세요.</div>';
    observeReveal(wall); local.forEach(m => m._new = false);
  };
  let remote = [], unsub = null;
  getDb().then(db => {
    unsub = db.collection('guestbook').orderBy('timestamp', 'desc').limit(100).onSnapshot(snap => {
      remote = snap.docs.map(d => { const x = d.data(); return { nickname: x.nickname, message: x.message, date: x.timestamp && x.timestamp.toDate ? x.timestamp.toDate() : null }; });
      paint(remote);
    }, () => { count.textContent = '방명록을 불러오지 못했어요.'; paint([]); });
  }).catch(() => { count.textContent = '방명록을 불러오지 못했어요.'; paint([]); });
  pageCleanup.push(() => unsub && unsub());

  const msg = $('#gbMsg', view);
  msg.addEventListener('input', () => { $('#gbCnt', view).textContent = `${msg.value.length} / 500`; });
  $('#gbForm', view).addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#gbName', view).value.trim(), text = msg.value.trim(), st = $('#gbStatus', view);
    if (!name || !text) { st.textContent = '이름과 메시지를 모두 적어주세요.'; return; }
    if (BLOCKED.some(w => (name + text).toLowerCase().includes(w))) { st.textContent = '사용할 수 없는 단어가 들어 있어요.'; return; }
    const last = store.get('hm-gb-last', 0);
    if (Date.now() - last < 30000) { st.textContent = '잠시 후 다시 남겨주세요. (30초에 한 번)'; return; }
    store.set('hm-gb-last', Date.now());
    const from = msg.getBoundingClientRect();
    const before = $$('.note', wall).map(n => n.getBoundingClientRect());
    local.unshift({ nickname: name, message: text, date: new Date(), _new: true });
    paint(remote);
    msg.value = ''; $('#gbCnt', view).textContent = '0 / 500';
    flyNote(from, before);
    st.textContent = '등록하는 중…';
    getDb().then(db => db.collection('guestbook').add({ nickname: name, message: text, timestamp: firebase.firestore.FieldValue.serverTimestamp() }))
      .then(() => { st.textContent = '등록되었어요. 고마워요!'; setTimeout(() => { if (st.textContent.startsWith('등록되었어요')) st.textContent = ''; }, 3000); })
      .catch(() => { local = local.filter(l => !(l.nickname === name && l.message === text)); paint(remote); st.textContent = '등록하지 못했어요. 잠시 후 다시 시도해 주세요.'; store.set('hm-gb-last', 0); });
  });

  // 쓴 글이 종이처럼 날아가 벽에 붙는 효과
  function flyNote(from, before) {
    const notes = $$('.note', wall), note = notes[0];
    if (!note) return;
    notes.forEach(n => n.classList.add('in'));
    if (reduced) return;
    const EASE = 'cubic-bezier(.22,1,.36,1)';
    // 원래 있던 글들은 한 칸씩 밀려나며 자리를 비켜줘요
    notes.slice(1).forEach((n, i) => {
      const was = before[i]; if (!was) return;
      const now = n.getBoundingClientRect(), dx = was.left - now.left, dy = was.top - now.top;
      if (Math.abs(dx) + Math.abs(dy) > 1) n.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 700, delay: 120, easing: EASE, fill: 'backwards' });
    });
    let to = note.getBoundingClientRect();
    if (to.top < 60 || to.bottom > innerHeight) { note.scrollIntoView({ block: 'center' }); to = note.getBoundingClientRect(); from = { left: from.left, top: Math.min(innerHeight - 120, Math.max(60, from.top)), width: from.width, height: from.height }; }
    note.style.visibility = 'hidden';
    const fly = note.cloneNode(true);
    fly.classList.remove('new');
    Object.assign(fly.style, { position: 'fixed', margin: 0, zIndex: 60, visibility: 'visible', pointerEvents: 'none', boxShadow: '0 30px 60px -20px rgba(0,0,0,.6)' });
    document.body.appendChild(fly);
    const box = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    const midTop = Math.min(from.top, to.top) - 90;
    fly.animate([
      { ...box(from), transform: 'rotate(-5deg) scale(.92)', opacity: 0 },
      { offset: 0.12, opacity: 1 },
      { offset: 0.55, left: (from.left + to.left) / 2 + 'px', top: midTop + 'px', width: to.width + 'px', height: to.height + 'px', transform: 'rotate(7deg) scale(1.06)' },
      { ...box(to), transform: 'rotate(0deg) scale(1)', opacity: 1 },
    ], { duration: 1050, easing: 'cubic-bezier(.45,0,.2,1)' }).onfinish = () => {
      fly.remove(); note.style.visibility = '';
      note.animate([{ transform: 'scale(1.045)' }, { transform: 'scale(.985)' }, { transform: 'none' }], { duration: 420, easing: 'ease-out' });
    };
  }
}

/* ============================================================
   작가 소개
   ============================================================ */
function openDrawer() {
  const s = S.site, all = S.photos, yrs = years(all);
  $('#drawerBody').innerHTML = `
    <div class="mono accent">${esc(s.aboutKicker || 'BEHIND THE CAMERA')}</div>
    ${S.profile.profileImage ? `<img class="about-img" src="${esc(DATA_BASE + S.profile.profileImage)}" alt="">` : '<div style="height:40px"></div>'}
    <h2>${esc(s.aboutTitle || s.brandName || '')}</h2>
    <div class="role mono">${esc(s.aboutRole || '')}${s.aboutIntro ? ' · ' + esc(s.aboutIntro) : ''}</div>
    <div class="body">${esc(s.aboutBody || '')}</div>
    <div class="about-stats mono">
      <div><b>${all.length}</b><span>Photographs</span></div>
      <div><b>${S.projects.length}</b><span>Projects</span></div>
      <div><b>${cameras(all).length}</b><span>${esc(cameras(all).slice(0, 2).join(', '))}</span></div>
      <div><b>${yrs[0] || '—'}</b><span>Since</span></div>
    </div>
    <div class="signoff">${esc(s.aboutSignoff || '')}</div>`;
  $('#drawer').classList.add('on'); $('#drawerBack').classList.add('on'); document.body.classList.add('locked');
}
function closeDrawer() {
  if (!$('#drawer').classList.contains('on')) return;
  $('#drawer').classList.remove('on'); $('#drawerBack').classList.remove('on');
  if (!Lightbox.isOpen) document.body.classList.remove('locked');
}

/* ============================================================
   크게 보기 (라이트박스)
   ============================================================ */
const Lightbox = (() => {
  const lb = $('#lb'), stage = $('#lbStage'), strip = $('#lbStrip'), info = $('#lbInfo');
  let list = [], idx = 0, img = null, origin = null, playing = false, playTimer = null, zoomed = false, quiet = false;
  const SLIDE = 4500;
  const api = { get isOpen() { return lb.classList.contains('on'); } };
  lb.classList.toggle('no-info', !store.get('hm-lb-info', true));

  /* 한 줄 감상: 오른쪽 목록 + 사진 위 자막 */
  let subTimer = null, subIdx = 0, subsOn = store.get('hm-subs', true);
  const subsEl = $('#lbSubs');
  $('#lbNotesBtn').classList.toggle('on', subsOn);
  function paintNotes(f, list) {
    if (!list) return;
    const el = $('#lbNotesList'); if (!el || list_cur() !== f) return;
    $('#lbNoteCount').textContent = list.length;
    el.innerHTML = list.length ? list.map(n => `<div class="n ${n.fresh ? 'new' : ''}">${esc(n.message)}<small>${esc(n.nickname)} · ${fmtStamp(n.date)}</small></div>`).join('') : '<div class="faint" style="font-size:13px">아직 감상이 없어요. 아래 칸에 첫 한 줄을 남겨주세요.</div>';
    list.forEach(n => { n.fresh = false; });
  }
  function runSubs(f) {
    clearInterval(subTimer); subsEl.innerHTML = ''; subIdx = 0;
    const list = Social.notes.get(f) || [];
    if (!subsOn || !list.length || !Social.ok) return;
    const show = () => { const n = list[subIdx % list.length]; if (!n) return; subsEl.innerHTML = `<span><em>${esc(n.nickname)}</em>${esc(n.message)}</span>`; subIdx++; };
    show(); subTimer = setInterval(show, 4000);
  }
  async function showNotes(f) {
    clearInterval(subTimer); subsEl.innerHTML = '';
    if (!Social.ok) return;
    const list = await loadNotes(f);
    if (!api.isOpen || list_cur() !== f) return;
    paintNotes(f, list); runSubs(f);
  }
  const list_cur = () => list[idx] && list[idx].filename;
  $('#lbNotesBtn').onclick = () => {
    if (matchMedia('(max-width: 1000px)').matches) { const n = $('#lbNotes'); if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    subsOn = !subsOn; store.set('hm-subs', subsOn); $('#lbNotesBtn').classList.toggle('on', subsOn); runSubs(list_cur());
  };
  $('#lbNoteForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = list_cur(), name = $('#lbNoteName').value.trim().slice(0, 12), text = $('#lbNoteText').value.trim().slice(0, 60);
    if (!text) return;
    if (BLOCKED.some(w => (name + text).toLowerCase().includes(w))) return toast('사용할 수 없는 단어가 들어 있어요');
    if (Date.now() - store.get('hm-note-last', 0) < 20000) return toast('잠시 후 다시 남겨주세요 (20초에 한 번)');
    store.set('hm-note-last', Date.now());
    const btn = $('#lbNoteForm button'); btn.disabled = true;
    try {
      const l = await addNote(f, name, text);
      $('#lbNoteText').value = '';
      if (list_cur() === f) { paintNotes(f, l); subsOn = true; $('#lbNotesBtn').classList.add('on'); runSubs(f); }
      toast('감상을 남겼어요. 고마워요!');
    } catch (err) { store.set('hm-note-last', 0); toast('남기지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    btn.disabled = false;
  });
  /* 사진을 두 번 연속 누르면 큰 하트 */
  async function bigHeart() {
    const f = list_cur(); if (!Social.ok || !f) return;
    await toggleHeart(f, true);
    if (reduced) return;
    const h = document.createElement('div'); h.className = 'big-heart'; h.innerHTML = HEART_SVG.replace('fill="none"', 'fill="currentColor"');
    stage.appendChild(h); setTimeout(() => h.remove(), 950);
    heartPop($('#lbHeart'));
  }
  /* 엽서 */
  $('#lbCard').onclick = () => Postcard.open(list[idx]);

  function makeImg(p) { const im = document.createElement('img'); im.className = 'lb-img'; im.src = imgUrl(p); im.alt = fmtDate(p.date); im.draggable = false; stage.appendChild(im); return im; }
  function paintInfo() {
    const p = list[idx], i = parseInfo(p.info), prs = S.photoProjects.get(p.filename) || [];
    const d = p.date ? new Date(p.date + 'T00:00:00') : null;
    $('#lbCounter').textContent = `${pad(idx + 1, 3)} / ${pad(list.length, 3)}`;
    info.innerHTML = `
      <div class="num mono">Frame ${p._n}</div>
      <h3>${d ? `${MONTHS[d.getMonth()]} ${d.getDate()}` : '—'}</h3>
      <div class="year mono">${d ? `${d.getFullYear()} · ${['일', '월', '화', '수', '목', '금', '토'][d.getDay()]}요일` : ''}</div>
      ${p.story ? `<div class="lb-story" id="lbStory"><div class="mono lbl">Story</div><blockquote>${esc(p.story)}</blockquote><button class="mono more" id="lbStoryMore" hidden>더 읽기 ↓</button></div>` : ''}
      <div class="exif mono">
        <div class="wide"><span>Camera</span><b>${esc(i.camera)}</b></div>
        <div><span>Aperture</span><b>${esc(i.aperture)}</b></div>
        <div><span>Shutter</span><b>${esc(i.shutter)}</b></div>
        <div><span>ISO</span><b>${esc(i.iso.replace('ISO ', ''))}</b></div>
        <div><span>Light</span><b>${(LIGHTS.find(([k]) => k === lightOf(p)) || [, '—'])[1]}</b></div>
        <div class="wide"><span>Colors</span>${paletteStrip(p, 'lb-pal')}<small class="lb-pal-names">${paletteOf(p).slice(0, 3).map(([k, v]) => `${shadeKo(k)} ${Math.round(v * 100)}%`).join(' · ')}</small></div>
      </div>
      ${prs.length ? `<div class="lb-projects"><div class="mono" style="color:#75736b;margin-bottom:6px">In projects</div>${prs.map(pr => `<a href="#/projects/${encodeURIComponent(pr.id)}">${esc(pr.title)}<span>→</span></a>`).join('')}</div>` : ''}
      <div class="lb-notes needs-social" id="lbNotes"><div class="mono lbl">Notes · <span id="lbNoteCount">…</span></div><div class="notes-list" id="lbNotesList"></div></div>
      <div class="mono" style="color:#55534d;margin-top:26px;line-height:2">← → 넘기기 · Space 슬라이드쇼<br>F 전체 화면 · I 정보 · 사진 클릭 확대 · 두 번 누르면 하트</div>`;
    $('#lbHeart').dataset.heart = p.filename; paintHearts(lb);
    const story = $('#lbStory', info);
    if (story) requestAnimationFrame(() => { const q = $('blockquote', story), more = $('#lbStoryMore', info); if (q.scrollHeight > q.clientHeight + 4) { more.hidden = false; more.onclick = () => { story.classList.add('open'); more.hidden = true; }; } });
    showNotes(p.filename);
    $$('img', strip).forEach((t, j) => t.classList.toggle('on', j === idx));
    const on = strip.children[idx]; if (on) strip.scrollTo({ left: on.offsetLeft - strip.clientWidth / 2 + 28, behavior: 'smooth' });
    const u = new URL(location.href); u.searchParams.set('photo', p.filename); history.replaceState(null, '', u);
    [idx - 1, idx + 1].forEach(j => { const q = list[(j + list.length) % list.length]; if (q) { const pre = new Image(); pre.src = imgUrl(q); } });
    if (!reduced && !quiet) {
      // 정보 글자들이 차례로 떠오르기
      [...info.children].forEach((el, k) => el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: k * 40, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
      $('#lbCounter').animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
    }
  }
  api.open = (l, i, fromImg) => {
    list = l; idx = i; origin = fromImg || null; zoomed = false;
    $$('.lb-img', stage).forEach(n => n.remove());
    strip.innerHTML = list.map(p => `<img src="${esc(thumbUrl(p))}" loading="lazy" alt="">`).join('');
    img = makeImg(list[idx]);
    $('#view').style.transformOrigin = `50% ${scrollY + innerHeight / 2}px`;
    lb.classList.add('on'); document.body.classList.add('locked', 'lb-on'); $('#dock').classList.add('away'); $('#cursor').classList.remove('on');
    paintInfo();
    // 움직임 줄이기 설정이면 짧게 나타나기만 해요
    if (reduced) { lb.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' }); return; }
    $$('img', strip).slice(Math.max(0, idx - 12), idx + 14).forEach((t, k) => t.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: t.classList.contains('on') ? 1 : .35, transform: t.classList.contains('on') ? 'translateY(-4px)' : 'none' }], { duration: 300, delay: k * 22, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
    const vis = origin && origin.getBoundingClientRect();
    if (vis && vis.width && vis.bottom > 0 && vis.top < innerHeight && origin.complete) {
      const go = () => {
        const to = img.getBoundingClientRect();
        img.style.visibility = 'hidden';
        const fly = document.createElement('img'); fly.className = 'lb-fly'; fly.src = img.src; document.body.appendChild(fly);
        lb.animate([{ backgroundColor: 'rgba(8,8,7,0)' }, { backgroundColor: 'rgba(8,8,7,.985)' }], { duration: 300, easing: 'ease-out' });
        $$('.lb-info, .lb-strip, .lb-top, .lb-nav', lb).forEach(el => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'backwards' }));
        fly.animate([rectFrames(vis), rectFrames(to)], { duration: 400, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => { img.style.visibility = ''; fly.remove(); };
      };
      img.complete && img.naturalWidth ? requestAnimationFrame(go) : img.addEventListener('load', go, { once: true });
    } else {
      lb.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: 'ease-out' });
      img.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
    }
  };
  const rectFrames = r => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  api.close = (instant) => {
    if (!api.isOpen) return;
    api.play(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    clearInterval(subTimer); subsEl.innerHTML = ''; Postcard.close();
    const finish = () => {
      lb.classList.remove('on'); lb.getAnimations().forEach(a => a.cancel());
      if (!$('#drawer').classList.contains('on')) document.body.classList.remove('locked');
      $('#dock').classList.remove('away');
      const u = new URL(location.href); u.searchParams.delete('photo'); history.replaceState(null, '', u);
    };
    const view = $('#view'); view.style.transition = 'none'; document.body.classList.remove('lb-on'); void view.offsetWidth; view.style.transition = '';
    if (instant || reduced) return finish();
    // 원래 자리의 사진으로 돌아가기
    const p = list[idx];
    const target = $(`#view [data-f="${CSS.escape(p.filename)}"] img`);
    const tr = target && target.getBoundingClientRect();
    if (tr && tr.width && tr.bottom > 0 && tr.top < innerHeight && img) {
      const from = img.getBoundingClientRect();
      const fly = document.createElement('img'); fly.className = 'lb-fly'; fly.src = img.src; document.body.appendChild(fly);
      img.style.visibility = 'hidden'; target.style.opacity = 0;
      lb.animate([{ backgroundColor: 'rgba(8,8,7,.985)' }, { backgroundColor: 'rgba(8,8,7,0)' }], { duration: 300, fill: 'forwards' });
      $$('.lb-info, .lb-strip, .lb-top, .lb-nav', lb).forEach(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
      fly.animate([rectFrames(from), rectFrames(tr)], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }).onfinish = () => {
        target.style.opacity = ''; fly.remove(); $$('.lb-info, .lb-strip, .lb-top, .lb-nav', lb).forEach(el => el.getAnimations().forEach(a => a.cancel())); finish();
      };
    } else {
      lb.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, fill: 'forwards' }).onfinish = finish;
    }
  };
  // instant: 키보드로 넘길 때는 애니메이션 없이 바로 바꿔요
  api.step = (dir, instant) => {
    if (!list.length) return;
    setZoom(false);
    const old = img;
    idx = (idx + dir + list.length) % list.length;
    quiet = !!instant; img = makeImg(list[idx]); paintInfo(); quiet = false;
    if (reduced || instant) { old.remove(); if (playing) schedule(); return; }
    const EASE = 'cubic-bezier(.77,0,.18,1)';
    img.animate([{ clipPath: dir > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)', transform: `translateX(${dir * 70}px) scale(1.05)` }, { clipPath: 'inset(0 0 0 0)', transform: 'none' }], { duration: 300, easing: EASE });
    old.animate([{ transform: 'none', filter: 'brightness(1)', opacity: 1 }, { transform: `translateX(${-dir * 140}px) scale(.94)`, filter: 'brightness(.3)', opacity: .2 }], { duration: 300, easing: EASE, fill: 'forwards' }).onfinish = () => old.remove();
    if (playing) schedule();
  };
  api.jump = i => {
    if (i === idx) return;
    const dir = i > idx ? 1 : -1;
    idx = (i - dir + list.length) % list.length; // step()이 한 칸 움직이면 i에 도착
    api.step(dir);
  };
  function schedule() {
    clearTimeout(playTimer);
    const bar = $('#lbSlideBar'); bar.getAnimations().forEach(a => a.cancel());
    if (!playing) return;
    bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: SLIDE, easing: 'linear' });
    playTimer = setTimeout(() => api.step(1), SLIDE);
  }
  api.play = on => {
    playing = on === undefined ? !playing : on;
    $('#lbPlay').classList.toggle('on', playing);
    $('#lbPlay').innerHTML = playing ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5.5" width="3.5" height="13" rx="1"/><rect x="13.5" y="5.5" width="3.5" height="13" rx="1"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
    schedule();
  };
  function setZoom(on, e) {
    zoomed = on; if (!img) return;
    img.classList.toggle('zoomed', on);
    if (on && e) { const r = img.getBoundingClientRect(); img.style.transformOrigin = `${(e.clientX - r.left) / r.width * 100}% ${(e.clientY - r.top) / r.height * 100}%`; }
    img.style.transform = on ? 'scale(2.2)' : '';
  }
  // 조작
  $('#lbClose').onclick = () => api.close();
  $('#lbPrev').onclick = () => api.step(-1);
  $('#lbNext').onclick = () => api.step(1);
  $('#lbPlay').onclick = () => api.play();
  $('#lbShare').onclick = () => copyText(location.href, '이 사진의 링크를 복사했어요');
  $('#lbFull').onclick = () => document.fullscreenElement ? document.exitFullscreen() : lb.requestFullscreen && lb.requestFullscreen().catch(() => {});
  $('#lbInfoBtn').onclick = () => { lb.classList.toggle('no-info'); store.set('hm-lb-info', !lb.classList.contains('no-info')); };
  strip.addEventListener('click', e => { const t = e.target.closest('img'); if (t) api.jump([...strip.children].indexOf(t)); });
  stage.addEventListener('mousemove', e => {
    if (!zoomed || !img) return;
    const r = stage.getBoundingClientRect();
    img.style.transformOrigin = `${(e.clientX - r.left) / r.width * 100}% ${(e.clientY - r.top) / r.height * 100}%`;
  });
  let sx = 0, sy = 0, swiping = false, lastTap = 0, tapTimer = null;
  stage.addEventListener('pointerdown', e => { if (e.target.closest('button, form')) return; sx = e.clientX; sy = e.clientY; swiping = true; });
  stage.addEventListener('pointerup', e => {
    if (!swiping) return; swiping = false;
    if (e.target.closest('button, form')) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!zoomed && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return api.step(dx < 0 ? 1 : -1);
    if (!zoomed && dy > 110 && Math.abs(dy) > Math.abs(dx)) return api.close();
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      if (e.target === img) {
        // 한 번 누르면 확대, 빠르게 두 번 누르면 하트
        const now = Date.now();
        if (now - lastTap < 300) { clearTimeout(tapTimer); lastTap = 0; if (zoomed) setZoom(false); bigHeart(); return; }
        lastTap = now; const ev = { clientX: e.clientX, clientY: e.clientY };
        tapTimer = setTimeout(() => setZoom(!zoomed, ev), 260);
      }
      else if (e.target === stage) api.close();
    }
  });
  addEventListener('keydown', e => {
    if (!api.isOpen) { if (e.key === 'Escape') closeDrawer(); return; }
    if (Postcard.isOpen) { if (e.key === 'Escape') Postcard.close(); return; }
    if (e.target.closest && e.target.closest('input, textarea')) { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.key === 'Escape') api.close();
    else if (e.key === 'ArrowRight') api.step(1, true);
    else if (e.key === 'ArrowLeft') api.step(-1, true);
    else if (e.key === ' ') { e.preventDefault(); api.play(); }
    else if (e.key.toLowerCase() === 'f') $('#lbFull').click();
    else if (e.key.toLowerCase() === 'i') $('#lbInfoBtn').click();
  });
  return api;
})();

/* ============================================================
   엽서 만들기
   ============================================================ */
/* ---------- 전시에 올리기: 저장 방법 ---------- */
// 엽서 창에서 관리자 로그인: Studio와 같은 GitHub 열쇠를 확인해요 (창을 닫으면 잊어요)
async function adminLogin(token) {
  const r = await fetch(`https://api.github.com/repos/${REPO}`, { headers: { Authorization: `token ${token}` }, cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !(j.permissions && j.permissions.push)) return false;
  setToken(token); Studio.authed = true; return true;
}
// 포스터 이미지를 images/posters/에 올리고, posters.json 맨 앞에 추가해요
async function publishPoster(blob, meta) {
  const name = `${meta.date}-${Date.now().toString(36)}.jpg`, file = 'images/posters/' + name;
  await gh(file, { method: 'PUT', body: JSON.stringify({ message: `Poster: ${name}`, content: await blobToBase64(blob) }) });
  const item = { ...meta, file };
  await updateJson('posters.json', d => [item, ...(Array.isArray(d) ? d : [])], `Add poster: ${meta.title || name}`);
  S.posters = [{ ...item, _local: URL.createObjectURL(blob) }, ...(S.posters || [])];
}
// 임시저장: drafts 가지(branch)의 drafts.json 하나에 종류별로 넣어요. 이 가지는 홈페이지를 다시 만들지 않아요
const DRAFT_REF = 'drafts';
const draftText = async f => f.content ? b64decode(f.content) : (await fetch(f.download_url, { cache: 'no-store' })).text();
async function loadDraftsRemote() { const f = await gh('drafts.json?ref=' + DRAFT_REF); return f ? JSON.parse(await draftText(f)) : {}; }
async function ensureDraftBranch() {
  const h = { Authorization: `token ${getToken()}`, Accept: 'application/vnd.github+json' };
  if ((await fetch(`https://api.github.com/repos/${REPO}/git/ref/heads/${DRAFT_REF}`, { headers: h, cache: 'no-store' })).ok) return;
  const main = await (await fetch(`https://api.github.com/repos/${REPO}/git/ref/heads/main`, { headers: h, cache: 'no-store' })).json();
  const r = await fetch(`https://api.github.com/repos/${REPO}/git/refs`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'refs/heads/' + DRAFT_REF, sha: main.object.sha }) });
  if (!r.ok && r.status !== 422) throw new Error('임시저장 공간을 만들지 못했어요');
}
async function saveDraftRemote(kind, entry) {
  for (let attempt = 0; ; attempt++) {
    const f = await gh('drafts.json?ref=' + DRAFT_REF);
    if (!f) await ensureDraftBranch();
    const all = f ? JSON.parse(await draftText(f)) : {};
    all[kind] = entry;
    try { await gh('drafts.json', { method: 'PUT', body: JSON.stringify({ message: `Draft: ${kind}`, content: b64encode(JSON.stringify(all)), branch: DRAFT_REF, ...(f ? { sha: f.sha } : {}) }) }); return; }
    catch (e) { if (attempt >= 2 || ![404, 409, 422].includes(e.status)) throw e; }
  }
}
// 저장소의 파일 하나 지우기 (없으면 그냥 넘어가요)
async function deleteFile(path) {
  const f = await gh(path); if (!f) return;
  await gh(path, { method: 'DELETE', body: JSON.stringify({ message: `Delete ${path}`, sha: f.sha }) });
}
// 달력: 모든 장을 images/calendars/<id>/에 올리고, calendars.json 맨 앞에 추가해요
// replaceId가 있으면(다시 편집) 그 달력 자리에 새 버전을 넣고, 예전 그림 파일은 지워요
async function publishCalendar(pages, meta, replaceId) {
  const id = `${meta.year}-${Date.now().toString(36)}`, out = [];
  for (let i = 0; i < pages.length; i++) {
    const pg = pages[i], file = `images/calendars/${id}/${String(i).padStart(2, '0')}.jpg`;
    await gh(file, { method: 'PUT', body: JSON.stringify({ message: `Calendar ${id}: page ${i + 1}/${pages.length}`, content: await blobToBase64(pg.blob) }) });
    out.push({ k: pg.k, ...(pg.m != null ? { m: pg.m } : {}), file });
  }
  const item = { ...meta, id, pages: out };
  let old = null;
  await updateJson('calendars.json', d => {
    const a = Array.isArray(d) ? d : [], i = replaceId ? a.findIndex(c => c.id === replaceId) : -1;
    if (i >= 0) { old = a[i]; a[i] = item; return a; }
    return [item, ...a];
  }, `${replaceId ? 'Update' : 'Add'} calendar: ${meta.title || id}`);
  const local = { ...item, pages: out.map((p, i) => ({ ...p, _local: URL.createObjectURL(pages[i].blob) })) }, a = S.calendars || [];
  S.calendars = a.some(c => c.id === replaceId) ? a.map(c => c.id === replaceId ? local : c) : [local, ...a];
  if (old) for (const p of old.pages || []) await deleteFile(p.file).catch(e => console.warn('예전 달력 그림 삭제 실패', p.file, e));
}
async function updateCalendar(c, patch) {
  await updateJson('calendars.json', d => (Array.isArray(d) ? d : []).map(q => q.id === c.id ? { ...q, ...patch } : q), `Edit calendar: ${patch.title || c.id}`);
  Object.assign(c, patch);
}
async function deleteCalendar(c) {
  await updateJson('calendars.json', d => (Array.isArray(d) ? d : []).filter(q => q.id !== c.id), `Remove calendar: ${c.title || c.id}`);
  S.calendars = (S.calendars || []).filter(q => q.id !== c.id);
  for (const p of c.pages || []) await deleteFile(p.file).catch(e => console.warn('달력 그림 삭제 실패', p.file, e));
}
// 프린트: posters.json에서 file로 찾아요
async function updatePoster(p, patch) {
  await updateJson('posters.json', d => (Array.isArray(d) ? d : []).map(q => q.file === p.file ? { ...q, ...patch } : q), `Edit poster: ${patch.title || p.file}`);
  Object.assign(p, patch);
}
async function deletePoster(p) {
  await updateJson('posters.json', d => (Array.isArray(d) ? d : []).filter(q => q.file !== p.file), `Remove poster: ${p.title || p.file}`);
  S.posters = (S.posters || []).filter(q => q.file !== p.file);
  await deleteFile(p.file).catch(e => console.warn('포스터 그림 삭제 실패', p.file, e));
}
// 전시: 사진은 이미 저장소에 있어서 exhibitions.json만 고쳐요 (새 전시는 맨 앞, 고친 전시는 제자리)
async function publishExhibition(ex) {
  await updateJson('exhibitions.json', d => { const a = Array.isArray(d) ? d : [], i = a.findIndex(e => e.id === ex.id); if (i >= 0) a[i] = ex; else a.unshift(ex); return a; }, `${(S.exhibitions || []).some(e => e.id === ex.id) ? 'Update' : 'Open'} exhibition: ${ex.title}`);
  const a = S.exhibitions || []; S.exhibitions = a.some(e => e.id === ex.id) ? a.map(e => e.id === ex.id ? ex : e) : [ex, ...a];
}
async function unpublishExhibition(id) {
  await updateJson('exhibitions.json', d => (Array.isArray(d) ? d : []).filter(e => e.id !== id), 'Close exhibition');
  S.exhibitions = (S.exhibitions || []).filter(e => e.id !== id);
}
/* ---------- 전시에 올리기: 저장 방법 끝 ---------- */
/* ---------- 서식 있는 글씨 칸: 글자를 골라 그 부분만 굵기·기울임·크기를 바꿔요 ---------- */
// 칸 안의 글씨를 줄마다 [{t: 글자, w: 굵기, i: 기울임, s: 크기 배율}] 묶음으로 읽어요
function rtLines(ed) {
  const lines = [[]];
  const walk = (node, sty) => {
    if (node.nodeType === 3) { node.nodeValue.split('\n').forEach((part, k) => { if (k) lines.push([]); if (part) lines[lines.length - 1].push({ t: part, ...sty }); }); return; }
    if (node.nodeName === 'BR') { lines.push([]); return; }
    const block = node !== ed && /^(DIV|P)$/.test(node.nodeName);
    if (block && lines[lines.length - 1].length) lines.push([]);
    const d = node.dataset || {}, s2 = { ...sty };
    if (d.w) s2.w = +d.w; if (d.i) s2.i = d.i === '1'; if (d.s) s2.s = +d.s;
    node.childNodes.forEach(ch => walk(ch, s2));
  };
  walk(ed, {});
  while (lines.length && !lines[lines.length - 1].length) lines.pop();
  while (lines.length && !lines[0].length) lines.shift();
  return lines;
}
const rtPlain = ed => rtLines(ed).map(l => l.map(r => r.t).join('')).join('\n').trim();
const rtStyled = ed => !!ed.querySelector('[data-w],[data-i],[data-s]');
// 편집 칸에서도 고른 서식이 보이게 (크기는 칸의 기본 크기에 대한 배율이라 겹쳐도 커지지 않아요)
function rtPaint(n) {
  const d = n.dataset;
  n.style.fontWeight = d.w || ''; n.style.fontStyle = d.i === '1' ? 'italic' : d.i === '0' ? 'normal' : '';
  n.style.fontSize = d.s ? `calc(var(--rt-base) * ${d.s})` : '';
}
const RT_SIZES = [.5, .65, .8, 1, 1.25, 1.5, 2, 2.5, 3];
function rtApply(kind, val) {
  const sel = getSelection(); if (!sel.rangeCount) return toast('먼저 바꿀 글자를 드래그해서 골라 주세요');
  const rg = sel.getRangeAt(0), ed = ['#pcText', '#pcSub'].map(id => $(id)).find(e => e && e.contains(rg.commonAncestorContainer));
  if (!ed || rg.collapsed) return toast('먼저 바꿀 글자를 드래그해서 골라 주세요');
  // 고른 곳의 지금 서식 (기울임 켜고 끄기, 크기 한 단계씩에 써요)
  const near = attr => { let n = rg.startContainer.nodeType === 3 ? rg.startContainer.parentElement : rg.startContainer; while (n && n !== ed) { if (n.dataset && n.dataset[attr]) return n.dataset[attr]; n = n.parentElement; } return null; };
  const frag = rg.extractContents();
  if (kind === 'clear') { frag.querySelectorAll('span').forEach(n => n.replaceWith(...n.childNodes)); const last = frag.lastChild; rg.insertNode(frag); if (last) { sel.removeAllRanges(); const r2 = document.createRange(); r2.setStartAfter(last); sel.addRange(r2); } }
  else {
    let v = val;
    if (kind === 'i') v = near('i') === '1' ? '0' : '1';
    if (kind === 's') { const cur = +(near('s') || 1), k = RT_SIZES.findIndex(x => x >= cur - .001); v = String(RT_SIZES[Math.max(0, Math.min(RT_SIZES.length - 1, (k < 0 ? 3 : k) + val))]); }
    frag.querySelectorAll('[data-' + kind + ']').forEach(n => { n.removeAttribute('data-' + kind); rtPaint(n); });
    const sp = document.createElement('span'); sp.setAttribute('data-' + kind, v); rtPaint(sp); sp.appendChild(frag); rg.insertNode(sp);
    sel.removeAllRanges(); const r2 = document.createRange(); r2.selectNodeContents(sp); sel.addRange(r2);
  }
  ed.dispatchEvent(new Event('input', { bubbles: true }));
}
function rtInit(ed) {
  // 엔터는 줄바꿈 한 번, 붙여넣기는 글자만 (다른 곳의 글꼴·색은 빼고)
  ed.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); } });
  ed.addEventListener('paste', e => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain'); const room = (+ed.dataset.max || 9999) - rtPlain(ed).length; document.execCommand('insertText', false, t.slice(0, Math.max(0, room))); });
  ed.addEventListener('beforeinput', e => { if (/^insert(Text|LineBreak|Paragraph)/.test(e.inputType) && rtPlain(ed).length >= (+ed.dataset.max || 9999)) e.preventDefault(); });
}
// 엽서·포스터 편집기와 달력에서만 쓰는 글꼴 25종은 처음 쓸 때만 불러와요 (첫 화면을 가볍게)
const POSTER_FONTS = 'https://fonts.googleapis.com/css2?family=Anton&family=Gothic+A1:wght@100;300;500;700;800;900&family=Nanum+Myeongjo:wght@400;700;800&family=Song+Myung&family=Do+Hyeon&family=Gowun+Dodum&family=IBM+Plex+Sans+KR:wght@100;300;500;600;700&family=Orbit&family=Playfair+Display:ital,wght@1,400..900&family=Fraunces:wght@100..900&family=Cormorant+Garamond:ital,wght@1,300..700&family=DM+Serif+Display&family=Syne:wght@400..800&family=Archivo+Black&family=Bebas+Neue&family=Inter+Tight:wght@100..900&family=Space+Mono:wght@400;700&family=Major+Mono+Display&family=UnifrakturMaguntia&family=Black+Han+Sans&family=Bodoni+Moda:ital,opsz,wght@1,6..96,400..900&family=Gowun+Batang:wght@400;700&family=Hahmlet:wght@100..900&family=Space+Grotesk:wght@300..700&family=Unbounded:wght@200..900&family=EB+Garamond:wght@400..800&family=Lora:wght@400..700&family=Alegreya:wght@400..900&family=Bitter:wght@100..900&family=Jost:wght@100..900&family=Charis+SIL:wght@400;700&family=Gasoek+One&display=swap';
// 구글 글꼴에 없는 한글 글꼴: SUIT · 마루 부리(네이버) · 리디 바탕 (모두 무료 오픈소스)
const POSTER_FONTS_MORE = ['https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT.css', 'https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css'];
const POSTER_FONTS_FACE = "@font-face { font-family: 'RIDIBatang'; src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_twelve@1.0/RIDIBatang.woff') format('woff'); font-display: swap; }";
let posterFontsP = null;
const loadPosterFonts = () => posterFontsP || (posterFontsP = new Promise(res => {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = POSTER_FONTS;
  l.onload = () => res(true); l.onerror = () => { posterFontsP = null; res(false); };
  document.head.appendChild(l);
  // 나머지 글꼴은 따로 불러와요 (늦게 와도 글꼴을 고르면 다시 그려져요)
  POSTER_FONTS_MORE.forEach(href => { const m = document.createElement('link'); m.rel = 'stylesheet'; m.href = href; document.head.appendChild(m); });
  const f = document.createElement('style'); f.textContent = POSTER_FONTS_FACE; document.head.appendChild(f);
}));
const Postcard = (() => {
  // 휴대폰 배경: 휴대폰으로 열면 그 폰의 실제 화면 픽셀 그대로, 컴퓨터에서는 아이폰 17 Pro(1206×2622)
  const PHONE = (() => {
    const sw = screen.width, sh = screen.height, dpr = window.devicePixelRatio || 1;
    if (isTouch && sw && sh) { const a = Math.round(Math.min(sw, sh) * dpr), b = Math.round(Math.max(sw, sh) * dpr); if (b > a * 1.6) return [a, b, '내 폰 배경']; }
    return [1206, 2622, '아이폰 17 Pro'];
  })();
  // 형태: [긴 쪽 ÷ 짧은 쪽, 세로일 때 이름, 가로일 때 이름]. "원본"은 사진 비율 그대로예요
  const RATIO = {
    orig: [0, '원본', '사진 비율 그대로'], sq: [1, '1:1', '정사각'], r45: [1.25, '4:5', '인스타 게시물', '5:4', '가로 게시물'],
    r23: [1.5, '2:3', '엽서 · 인화', '3:2', '엽서 · 인화'], a4: [Math.SQRT2, 'A4', '포스터', 'A4', '가로 포스터'],
    r916: [16 / 9, '9:16', '스토리 · 릴스', '16:9', '와이드 화면'], phone: [PHONE[1] / PHONE[0], '9:' + (PHONE[1] / PHONE[0] * 9).toFixed(1), PHONE[2], (PHONE[1] / PHONE[0] * 9).toFixed(1) + ':9', '가로 배경'], r25: [2.5, '2:5', '책갈피', '5:2', '티켓'],
  };
  // 저장해 두는 형태 이름(예: r45-p)으로 실제 크기를 구해요. 긴 쪽은 1800px
  function dims() {
    // 달력 만들기에서 열면 그 달 사진 칸의 크기 그대로 만들어요
    if (st.fixed) return st.fixed;
    // 휴대폰 배경은 화면 픽셀 그대로 만들어요 (확대 없이 딱 맞게)
    if (st.ratio === 'phone') return st.orient === 'l' ? [PHONE[1], PHONE[0]] : [PHONE[0], PHONE[1]];
    const nw = im ? im.naturalWidth : 3, nh = im ? im.naturalHeight : 2;
    const r = st.ratio === 'orig' ? Math.max(nw, nh) / Math.min(nw, nh) : RATIO[st.ratio][0];
    const landNow = st.ratio === 'orig' ? nw >= nh : st.orient === 'l';
    if (r === 1) return [1500, 1500];
    const L = 1800, Sh = Math.round(L / r);
    return landNow ? [L, Sh] : [Sh, L];
  }
  const fmtKey = () => st.ratio === 'orig' || st.ratio === 'sq' ? st.ratio : st.ratio + '-' + st.orient;
  const fmtLabel = () => { if (st.fixed) return '달력 사진 칸'; const d = RATIO[st.ratio], l = st.orient === 'l' && d[3]; return st.ratio === 'orig' ? '원본 비율' : (l ? d[3] + ' ' + d[4] : d[1] + ' ' + d[2]); };
  // [기울기, 글꼴, 크기 배율, 줄 간격, 가장 가는 두께, 가장 굵은 두께, 기본 두께]
  const FONT = {
    ransom: ['', '"Black Han Sans", Pretendard, sans-serif', .62, 1.5, 400, 400, 400],
    serif: ['italic', '"Instrument Serif", "Noto Serif KR", Georgia, serif', 1, .92, 400, 400, 400],
    myeongjo: ['', '"Noto Serif KR", Georgia, serif', .78, 1.22, 200, 900, 400],
    gothic: ['', 'Pretendard, sans-serif', .8, 1.04, 100, 900, 900],
    condensed: ['', 'Anton, Pretendard, sans-serif', .92, 1.0, 400, 400, 400],
    mono: ['', '"JetBrains Mono", monospace', .6, 1.18, 100, 800, 500],
    batang: ['', '"Gowun Batang", "Noto Serif KR", serif', .8, 1.25, 400, 700, 700],
    hahmlet: ['', 'Hahmlet, "Noto Serif KR", serif', .8, 1.15, 100, 900, 600],
    black: ['', '"Black Han Sans", Pretendard, sans-serif', .85, 1.08, 400, 400, 400],
    bodoni: ['italic', '"Bodoni Moda", "Noto Serif KR", serif', .9, .95, 400, 900, 800],
    grotesk: ['', '"Space Grotesk", Pretendard, sans-serif', .82, 1.0, 300, 700, 700],
    wide: ['', 'Unbounded, Pretendard, sans-serif', .62, 1.08, 200, 900, 800],
    gothicA1: ['', '"Gothic A1", Pretendard, sans-serif', .8, 1.05, 100, 900, 800],
    nanummj: ['', '"Nanum Myeongjo", "Noto Serif KR", serif', .8, 1.25, 400, 800, 800],
    songmyung: ['', '"Song Myung", "Noto Serif KR", serif', .82, 1.2, 400, 400, 400],
    dohyeon: ['', '"Do Hyeon", Pretendard, sans-serif', .86, 1.05, 400, 400, 400],
    dodum: ['', '"Gowun Dodum", Pretendard, sans-serif', .82, 1.2, 400, 400, 400],
    plexkr: ['', '"IBM Plex Sans KR", Pretendard, sans-serif', .8, 1.1, 100, 700, 600],
    orbit: ['', 'Orbit, Pretendard, sans-serif', .8, 1.1, 400, 400, 400],
    playfair: ['italic', '"Playfair Display", "Noto Serif KR", serif', .86, .98, 400, 900, 700],
    fraunces: ['', 'Fraunces, "Noto Serif KR", serif', .86, 1.0, 100, 900, 600],
    cormorant: ['italic', '"Cormorant Garamond", "Noto Serif KR", serif', .95, .95, 300, 700, 500],
    dmserif: ['', '"DM Serif Display", "Noto Serif KR", serif', .88, .98, 400, 400, 400],
    syne: ['', 'Syne, Pretendard, sans-serif', .78, 1.0, 400, 800, 800],
    archivo: ['', '"Archivo Black", Pretendard, sans-serif', .78, 1.0, 400, 400, 400],
    bebas: ['', '"Bebas Neue", Pretendard, sans-serif', .95, .95, 400, 400, 400],
    intertight: ['', '"Inter Tight", Pretendard, sans-serif', .82, 1.0, 100, 900, 800],
    spacemono: ['', '"Space Mono", monospace', .6, 1.15, 400, 700, 700],
    majormono: ['', '"Major Mono Display", monospace', .6, 1.15, 400, 400, 400],
    // 책 본문 글꼴 (영문 전용, ebook-fonts 추천 원본)
    garamond: ['', '"EB Garamond", "Noto Serif KR", serif', .8, 1.1, 400, 800, 500],
    lora: ['', 'Lora, "Noto Serif KR", serif', .82, 1.1, 400, 700, 600],
    alegreya: ['', 'Alegreya, "Noto Serif KR", serif', .8, 1.1, 400, 900, 700],
    charter: ['', '"Charis SIL", "Noto Serif KR", serif', .84, 1.1, 400, 700, 700],
    bitter: ['', 'Bitter, "Noto Serif KR", serif', .84, 1.08, 100, 900, 800],
    jost: ['', 'Jost, Pretendard, sans-serif', .8, 1.05, 100, 900, 600],
    // 한글 글꼴 추가 (무료 오픈소스)
    suit: ['', 'SUIT, Pretendard, sans-serif', .8, 1.05, 100, 900, 800],
    maruburi: ['', 'MaruBuri, "Noto Serif KR", serif', .8, 1.2, 200, 700, 600],
    ridi: ['', 'RIDIBatang, "Noto Serif KR", serif', .8, 1.25, 400, 400, 400],
    gasoek: ['', '"Gasoek One", "Black Han Sans", sans-serif', .9, 1.05, 400, 400, 400],
  };
  // 디자인마다 처음 쓰는 글꼴, 위치, 크기(1200px 기준), 색
  const LAYOUT = {
    card: { font: 'serif', size: 46, color: 'white' },
    gallery: { font: 'gothic', size: 112, color: 'cream' },
    full: { font: 'condensed', size: 190, color: 'white', upper: true },
    type: { font: 'condensed', size: 330, color: 'black', upper: true },
    swiss: { font: 'gothic', size: 100, color: 'c0' },
    cover: { font: 'gothic', size: 92, color: 'white' },
    split: { font: 'myeongjo', size: 84, color: 'c0' },
    frame: { font: 'serif', size: 52, color: 'white' },
    polaroid: { font: 'serif', size: 70, color: 'c0' },
    circle: { font: 'wide', size: 54, color: 'cream', upper: true },
    warhol: { font: 'black', size: 150, color: 'white' },
    repeat: { font: 'condensed', size: 200, color: 'c0', upper: true },
    ticket: { font: 'grotesk', size: 80, color: 'cream' },
    newspaper: { font: 'myeongjo', size: 104, color: 'cream', weight: 900 },
    movie: { font: 'wide', size: 120, color: 'white', upper: true },
    editorial: { font: 'bodoni', size: 100, color: 'white', weight: 500 },
    campaign: { font: 'gothic', size: 56, color: 'white', upper: true, weight: 900 },
    filmstill: { font: 'gothic', size: 46, color: 'black', weight: 500 },
    calendar: { font: 'serif', size: 56, color: 'white' },
    receipt: { font: 'spacemono', size: 52, color: 'black', upper: true },
    nowplaying: { font: 'gothic', size: 62, color: 'black', weight: 800 },
    arch: { font: 'cormorant', size: 92, color: 'cream' },
    triptych: { font: 'grotesk', size: 80, color: 'white' },
    museum: { font: 'gothic', size: 150, color: 'c0', weight: 900 },
    cutstrip: { font: 'condensed', size: 260, color: 'cream', upper: true },
  };
  // 목록: [이름, 보이는 글자, 분류]. 분류 버튼으로 걸러 보고, 안 쓰는 묶음은 접어 둘 수 있어요
  const CAT = {
    layout: { cats: { card: '엽서 · 카드', poster: '포스터', print: '잡지 · 인쇄물', graphic: '그래픽 실험' }, items: [
      ['full', '꽉 찬 사진 (기본)', 'poster'], ['card', '엽서', 'card'], ['polaroid', '폴라로이드', 'card'], ['frame', '액자', 'card'], ['arch', '아치 창', 'card'], ['calendar', '달력', 'card'], ['ticket', '입장권', 'card'], ['receipt', '영수증', 'card'],
      ['gallery', '전시 포스터', 'poster'], ['movie', '영화 포스터', 'poster'], ['filmstill', '영화 스틸', 'poster'], ['campaign', '캠페인', 'poster'], ['museum', '미술관 배너', 'poster'], ['triptych', '세 폭', 'poster'], ['split', '반반', 'poster'],
      ['cover', '잡지 표지', 'print'], ['editorial', '잡지 지면', 'print'], ['newspaper', '신문 1면', 'print'], ['nowplaying', '음악 재생', 'print'],
      ['swiss', '스위스', 'graphic'], ['type', '글자 속 사진', 'graphic'], ['cutstrip', '잘린 글자', 'graphic'], ['repeat', '반복 글자', 'graphic'], ['circle', '원형', 'graphic'], ['warhol', '팝아트 4분할', 'graphic']] },
    fx: { cats: { color: '색감', bw: '흑백 · 인쇄', blur: '흐림 · 움직임', warp: '왜곡 · 변형', graphic: '그래픽' }, items: [
      ['none', '원본', 'color'], ['duo', '투톤', 'color'], ['gradmap', '그라디언트 맵', 'color'], ['vintage', '빈티지', 'color'], ['sepia', '세피아', 'color'], ['cyanotype', '청사진', 'color'], ['infrared', '적외선', 'color'], ['crossprocess', '크로스 프로세스', 'color'], ['bleach', '블리치 바이패스', 'color'], ['lomo', '로모', 'color'], ['lightleak', '빛 번짐', 'color'], ['bluemon', '블루 모니터', 'color'], ['heat', '열기', 'color'], ['thermal', '열화상', 'color'], ['invert', '네거티브', 'color'],
      ['mono', '흑백', 'bw'], ['highkey', '하이키 흑백', 'bw'], ['ghost', '고스트 흑백', 'bw'], ['solarize', '솔라리제이션', 'bw'], ['halftone', '망점', 'bw'], ['riso', '리소 인쇄', 'bw'], ['lines', '선 판화', 'bw'], ['crosshatch', '크로스해치', 'bw'], ['sketch', '연필 스케치', 'bw'], ['xerox', '복사기', 'bw'], ['dither', '1비트', 'bw'], ['stencil', '스텐실', 'bw'],
      ['dreamy', '몽환', 'blur'], ['motion', '모션 블러', 'blur'], ['shutter', '흔들린 셔터', 'blur'], ['zoom', '줌 블러', 'blur'], ['tiltshift', '미니어처', 'blur'],
      ['ripple', '물결 왜곡', 'warp'], ['fisheye', '어안 렌즈', 'warp'], ['glassblock', '유리 블록', 'warp'], ['slitscan', '슬릿 스캔', 'warp'], ['slice', '조각내기', 'warp'], ['mirror', '거울', 'warp'], ['kaleido', '만화경', 'warp'], ['chroma', '색수차', 'warp'],
      ['poster', '팝아트', 'graphic'], ['pixel', '픽셀', 'graphic'], ['glitch', '글리치', 'graphic'], ['neon', '네온 윤곽', 'graphic'], ['emboss', '엠보싱', 'graphic']] },
    font: { cats: { ko: '한글 되는 글꼴', en: '영문 전용' }, items: [
      ['ransom', '✂ 오려 붙인 글자', 'ko', 'font-weight:800'], ['gothic', '고딕', 'ko', 'font-weight:900'], ['suit', '수트', 'ko', 'font-family:SUIT;font-weight:800'], ['gothicA1', '고딕 A1', 'ko', "font-family:'Gothic A1';font-weight:800"], ['plexkr', '플렉스', 'ko', "font-family:'IBM Plex Sans KR';font-weight:600"], ['black', '검은고딕', 'ko', "font-family:'Black Han Sans'"], ['gasoek', '가석', 'ko', "font-family:'Gasoek One'"], ['dohyeon', '도현', 'ko', "font-family:'Do Hyeon'"], ['dodum', '고운돋움', 'ko', "font-family:'Gowun Dodum'"], ['orbit', '오르빗', 'ko', 'font-family:Orbit'],
      ['myeongjo', '명조', 'ko', "font-family:'Noto Serif KR'"], ['maruburi', '마루 부리', 'ko', 'font-family:MaruBuri;font-weight:600'], ['ridi', '리디 바탕', 'ko', 'font-family:RIDIBatang'], ['nanummj', '나눔명조', 'ko', "font-family:'Nanum Myeongjo';font-weight:800"], ['batang', '바탕', 'ko', "font-family:'Gowun Batang';font-weight:700"], ['hahmlet', '함렛', 'ko', 'font-family:Hahmlet;font-weight:600'], ['songmyung', '송명', 'ko', "font-family:'Song Myung'"],
      ['serif', 'Serif', 'en', "font-family:'Instrument Serif';font-style:italic;font-size:16px"], ['playfair', 'Playfair', 'en', "font-family:'Playfair Display';font-style:italic;font-weight:700"], ['bodoni', 'Bodoni', 'en', "font-family:'Bodoni Moda';font-style:italic;font-weight:800"], ['fraunces', 'Fraunces', 'en', 'font-family:Fraunces;font-weight:600'], ['cormorant', 'Cormorant', 'en', "font-family:'Cormorant Garamond';font-style:italic;font-size:16px"], ['dmserif', 'DM Serif', 'en', "font-family:'DM Serif Display'"],
      ['garamond', 'Garamond', 'en', "font-family:'EB Garamond';font-weight:500"], ['lora', 'Lora', 'en', 'font-family:Lora;font-weight:600'], ['alegreya', 'Alegreya', 'en', 'font-family:Alegreya;font-weight:700'], ['charter', 'Charter', 'en', "font-family:'Charis SIL';font-weight:700"], ['bitter', 'Bitter', 'en', 'font-family:Bitter;font-weight:800'],
      ['condensed', 'CONDENSED', 'en', 'font-family:Anton'], ['bebas', 'BEBAS', 'en', "font-family:'Bebas Neue';font-size:16px"], ['archivo', 'Archivo', 'en', "font-family:'Archivo Black'"], ['grotesk', 'Grotesk', 'en', "font-family:'Space Grotesk';font-weight:700"], ['intertight', 'Inter Tight', 'en', "font-family:'Inter Tight';font-weight:800"], ['syne', 'Syne', 'en', 'font-family:Syne;font-weight:800'], ['wide', 'WIDE', 'en', 'font-family:Unbounded;font-weight:800'],
      ['jost', 'Jost', 'en', 'font-family:Jost;font-weight:600'],
      ['mono', 'Mono', 'en', "font-family:'JetBrains Mono'"], ['spacemono', 'Space Mono', 'en', "font-family:'Space Mono'"], ['majormono', 'major mono', 'en', "font-family:'Major Mono Display'"]] },
  };
  const PAPER = { white: '#fbfaf6', cream: '#f1e9d8', black: '#141413', orange: '#e2672b' };
  const st = { p: null, ratio: 'orig', orient: 'p', layout: 'full', fx: 'none', font: 'serif', spot: 0, align: null, box: null, spots: [], size: 1, weight: 400, zoom: 1, cx: .5, cy: .5, frame: null, tcolor: null, track: 0, lead: 1, outline: 0, ocolor: null, calYear: null, calMonth: null, fixed: null, ov: null, rseed: 7, vine: null, color: 'white', upper: false, ox: 0, oy: 0, seed: 1 };
  const el = $('#pcModal'), cv = $('#pcCanvas'), out = $('#pcImg'), sheet = $('#pcSheet');
  const api = { get isOpen() { return !el.hidden; } };
  let im = null, cols = [], cache = {};

  // ---------- 색 도우미 ----------
  const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const lum = h => { const [r, g, b] = hx(h); return (.2126 * r + .7152 * g + .0722 * b) / 255; };
  const sat = h => { const a = hx(h); return (Math.max(...a) - Math.min(...a)) / 255; };
  const mix = (a, b, t) => { const B = hx(b); return toHex(hx(a).map((v, i) => v + (B[i] - v) * t)); };
  const dist = (a, b) => { const A = hx(a), B = hx(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  // 사진에서 자주 나오는 색 4개를 뽑아요
  function photoColors() {
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, 48, 48);
    const d = x.getImageData(0, 0, 48, 48).data, bins = {};
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] >> 5) << 6 | (d[i + 1] >> 5) << 3 | d[i + 2] >> 5, b = bins[k] || (bins[k] = { n: 0, r: 0, g: 0, b: 0 });
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
    }
    const res = [];
    Object.values(bins).sort((a, b) => b.n - a.n).forEach(b => { const h = toHex([b.r / b.n, b.g / b.n, b.b / b.n]); if (res.length < 4 && res.every(o => dist(o, h) > 70)) res.push(h); });
    return res;
  }
  function scheme() {
    const bg = PAPER[st.color] || cols[+st.color.slice(1)] || PAPER.white;
    const ink = lum(bg) > .55 ? '#1c1b18' : '#f3f0e8';
    const bySat = [...cols].sort((a, b) => sat(b) - sat(a)), byLum = [...cols].sort((a, b) => lum(a) - lum(b));
    let dark = byLum[0] || '#1c1b18'; if (lum(dark) > .3) dark = mix(dark, '#000000', .6);
    let light = byLum[byLum.length - 1] || '#f6f1e6'; if (lum(light) < .8) light = mix(light, '#f6f1e6', .7);
    const accent = bySat.find(h => sat(h) > .25 && dist(h, bg) > 90) || (lum(bg) > .55 ? '#e0523a' : '#ff8a66');
    // 투톤의 밝은 쪽은 사진에서 가장 선명한 색을 써서 흙빛으로 탁해지지 않게 해요
    const vivid = bySat[0] && sat(bySat[0]) > .25 ? mix(bySat[0], '#ffffff', .2) : light;
    return { bg, ink, muted: mix(ink, bg, .42), accent, dark, light, vivid };
  }

  // ---------- 사진 효과 ----------
  const rnd = i => { const v = Math.sin(i * 91.7 + st.seed * 13.1) * 43758.5; return v - Math.floor(v); };
  // 사진을 w×h 틀에 놓아요. st.zoom 1은 틀을 꽉 채우는 크기, 그보다 작으면 사진 전체가 보이고 남는 곳은 비워 둬요.
  // st.cx, st.cy(0~1)는 사진의 어느 쪽을 보여 줄지예요 (0.5면 가운데)
  // 부드러운 흐림: 작게 줄였다가 두 단계로 다시 키워요 (f가 클수록 많이 흐려요). 모든 브라우저에서 같은 결과가 나와요
  function blurC(srcC, f) {
    const w = srcC.width, h = srcC.height, mk = (cw, ch) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(cw)); c.height = Math.max(1, Math.round(ch)); const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; return [c, cx]; };
    const [a, ax] = mk(w / f, h / f), [b, bx] = mk(w / Math.sqrt(f), h / Math.sqrt(f)), [o, ox] = mk(w, h);
    ax.drawImage(srcC, 0, 0, a.width, a.height); bx.drawImage(a, 0, 0, b.width, b.height); ox.drawImage(b, 0, 0, w, h);
    return o;
  }
  function placed(w, h) {
    const nw = im.naturalWidth, nh = im.naturalHeight, k = Math.max(w / nw, h / nh) * st.zoom, dw = nw * k, dh = nh * k;
    const b = document.createElement('canvas'); b.width = w; b.height = h;
    const bx = b.getContext('2d', { willReadFrequently: true }); bx.imageSmoothingQuality = 'high';
    bx.drawImage(im, (w - dw) * st.cx, (h - dh) * st.cy, dw, dh);
    return b;
  }
  // ---------- 그래픽 오버레이: 사진 위에 데이터 지도처럼 원·선·좌표·사슬·액자를 얹어요 ----------
  // 크기 값은 짧은 변 1200px 기준이에요 (사진 칸 크기에 맞춰 같이 커지고 작아져요)
  const OV_DEF = () => ({
    on: false, ink: 'white', alpha: 1, fade: .85,
    detect: 'combined', block: 16, thresh: 30, max: 80, minDist: 40,
    shape: 'circle', rMin: 4, rMax: 24, stroke: 1, seed: 42, label: 8,
    link: 150, linkW: .8,
    chain: true, count: 11, angle: 45, base: 250, ratio: .79, chainX: 70, chainY: 30, inter: true, marker: 5,
    frame: true, frameSize: 60, dash: 8, frameStroke: 1, star: 40, points: 4,
    corner: true, cornerSize: 12, texts: ['', '', '', ''],
    pix: 16, zone: 100, zoneStroke: true, zones: [],
    noise: .3,
  });
  let ovTex = null, ovTexId = 0, ovCount = 0; // 직접 올린 질감 사진 (저장 파일에는 안 들어가요)
  const ovRand = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  let ovNoise = null;
  const noiseTile = () => {
    if (ovNoise) return ovNoise;
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), d = g.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return (ovNoise = c);
  };
  function drawOverlay(x, W0, H0, c) {
    // 사진을 줄여서 칸 안에 빈 곳이 생기면, 실제 사진이 있는 곳에만 그려요 (placed()와 같은 계산)
    const nw = im.naturalWidth, nh = im.naturalHeight, kk = Math.max(W0 / nw, H0 / nh) * st.zoom, px0 = (W0 - nw * kk) * st.cx, py0 = (H0 - nh * kk) * st.cy;
    const rx = Math.max(0, Math.round(px0)), ry = Math.max(0, Math.round(py0)), w = Math.min(W0, Math.round(px0 + nw * kk)) - rx, h = Math.min(H0, Math.round(py0 + nh * kk)) - ry;
    if (w < 8 || h < 8) return;
    const o = st.ov, u = Math.min(w, h) / 1200, R = ovRand(o.seed);
    const ink = o.ink === 'black' ? '#141413' : o.ink === 'accent' ? '#ff5a36' : o.ink === 'photo' ? c.vivid : '#fbfaf6';
    x.save(); x.beginPath(); x.rect(rx, ry, w, h); x.clip(); x.translate(rx, ry);
    // 1) 모자이크 칸: 사진에서 누른 자리만 굵은 픽셀로
    const P = Math.max(2, o.pix * u), Z = o.zone * u;
    o.zones.forEach(([zu, zv]) => {
      const cx = zu * W0 - rx, cy = zv * H0 - ry, X0 = Math.max(0, Math.round(cx - Z)), Y0 = Math.max(0, Math.round(cy - Z)), X1 = Math.min(w, Math.round(cx + Z)), Y1 = Math.min(h, Math.round(cy + Z)), zw = X1 - X0, zh = Y1 - Y0;
      if (!(zw >= 2 && zh >= 2)) return; // 잘못 찍힌 칸(숫자가 아닌 위치)은 건너뛰어요
      const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(zw / P)); t.height = Math.max(1, Math.round(zh / P));
      t.getContext('2d').drawImage(x.canvas, X0 + rx, Y0 + ry, zw, zh, 0, 0, t.width, t.height);
      x.imageSmoothingEnabled = false; x.drawImage(t, X0, Y0, zw, zh); x.imageSmoothingEnabled = true;
      if (o.zoneStroke) { x.strokeStyle = ink; x.globalAlpha = o.alpha; x.lineWidth = Math.max(1, o.stroke * u); x.strokeRect(X0 + .5, Y0 + .5, zw - 1, zh - 1); x.globalAlpha = 1; }
    });
    // 2) 원을 찍을 자리 찾기: 사진을 칸으로 나눠 밝기·대비 점수를 매겨요 (흐리게 하기 전의 사진으로)
    const B = Math.max(4, Math.round(o.block * u)), cols = Math.floor(w / B), rows = Math.floor(h / B), cand = [];
    if (o.max > 0 && cols && rows) {
      const d = x.getImageData(rx, ry, w, h).data;
      for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
        let s = 0, s2 = 0, n = 0;
        for (let yy = gy * B; yy < (gy + 1) * B; yy += 2) for (let xx = gx * B; xx < (gx + 1) * B; xx += 2) { const i = (yy * w + xx) * 4, l = .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]; s += l; s2 += l * l; n++; }
        const m = s / n, sd = Math.sqrt(Math.max(0, s2 / n - m * m)), con = Math.min(100, sd / 64 * 100), br = m / 2.55, dk = 100 - br;
        const sc = o.detect === 'bright' ? br : o.detect === 'dark' ? dk : o.detect === 'contrast' ? con : con * .6 + Math.abs(m - 128) / 1.28 * .4;
        if (sc >= o.thresh) cand.push({ x: (gx + .5) * B, y: (gy + .5) * B, sc });
      }
    }
    cand.sort((a, b) => b.sc - a.sc);
    const pts = [], md = o.minDist * u;
    for (const p of cand) { if (pts.length >= o.max) break; if (pts.every(q => Math.hypot(q.x - p.x, q.y - p.y) >= md)) pts.push(p); }
    pts.forEach(p => { const k = Math.max(0, Math.min(1, (p.sc - o.thresh) / Math.max(1, 100 - o.thresh))); p.r = (o.rMin + (o.rMax - o.rMin) * k * (.6 + .8 * R())) * u; });
    // 3) 사진 흐리게 + 질감
    if (o.fade < 1) { x.globalAlpha = 1 - o.fade; x.fillStyle = '#7d7b77'; x.fillRect(0, 0, w, h); x.globalAlpha = 1; }
    if (o.noise > 0) {
      x.globalCompositeOperation = 'screen'; x.globalAlpha = o.noise;
      if (ovTex) { const k = Math.max(w / ovTex.naturalWidth, h / ovTex.naturalHeight); x.drawImage(ovTex, (w - ovTex.naturalWidth * k) / 2, (h - ovTex.naturalHeight * k) / 2, ovTex.naturalWidth * k, ovTex.naturalHeight * k); }
      else { x.fillStyle = x.createPattern(noiseTile(), 'repeat'); x.fillRect(0, 0, w, h); }
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    }
    // 4) 그래픽 (모두 같은 색, 같은 투명도)
    x.globalAlpha = o.alpha; x.strokeStyle = x.fillStyle = ink;
    const lw = v => Math.max(.5, v * u);
    // 연결선
    if (o.link > 0) { x.lineWidth = lw(o.linkW); x.beginPath(); const L = o.link * u; for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const a = pts[i], b = pts[j]; if (Math.hypot(a.x - b.x, a.y - b.y) <= L) { x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); } } x.stroke(); }
    // 원·네모 + 가운데 점 + 좌표
    x.lineWidth = lw(o.stroke);
    pts.forEach(p => {
      x.beginPath(); if (o.shape === 'square') x.rect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); else x.arc(p.x, p.y, p.r, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.arc(p.x, p.y, Math.max(1, 1.6 * u), 0, Math.PI * 2); x.fill();
      if (o.label > 0) { x.font = `${Math.max(5, o.label * u)}px "JetBrains Mono", monospace`; x.fillText(`${Math.round(p.x / u)},${Math.round(p.y / u)}`, p.x + p.r + 3 * u, p.y - 2 * u); }
    });
    // 원 사슬: 가운데 원에서 양쪽으로 크기가 변하며 이어지고, 맞닿은 원끼리 만나는 곳에 점
    if (o.chain && o.count > 0) {
      const th = o.angle * Math.PI / 180, dx = Math.sin(th), dy = Math.cos(th), C = [{ x: w * o.chainX / 100, y: h * o.chainY / 100, r: o.base * u }];
      const nL = Math.floor((o.count - 1) / 2), nR = o.count - 1 - nL;
      for (const [side, nn] of [[1, nR], [-1, nL]]) { let prev = C[side === 1 ? C.length - 1 : 0]; for (let k = 0; k < nn; k++) { const r = prev.r * o.ratio, dist = (prev.r + r) * .72; const nx = prev.x + dx * dist * side, ny = prev.y + dy * dist * side; const cc = { x: nx, y: ny, r }; side === 1 ? C.push(cc) : C.unshift(cc); prev = cc; } }
      x.lineWidth = lw(o.stroke * .8);
      C.forEach(q => { x.beginPath(); x.arc(q.x, q.y, q.r, 0, Math.PI * 2); x.stroke(); });
      if (o.inter) for (let i = 0; i < C.length - 1; i++) {
        const a = C[i], b = C[i + 1], d2 = Math.hypot(b.x - a.x, b.y - a.y); if (d2 >= a.r + b.r || d2 <= Math.abs(a.r - b.r)) continue;
        const l = (a.r * a.r - b.r * b.r + d2 * d2) / (2 * d2), hh = Math.sqrt(Math.max(0, a.r * a.r - l * l)), mx = a.x + (b.x - a.x) * l / d2, my = a.y + (b.y - a.y) * l / d2;
        [[mx + hh * (b.y - a.y) / d2, my - hh * (b.x - a.x) / d2], [mx - hh * (b.y - a.y) / d2, my + hh * (b.x - a.x) / d2]].forEach(([ix, iy]) => { x.beginPath(); x.arc(ix, iy, o.marker * u, 0, Math.PI * 2); x.fill(); });
      }
    }
    // 점선 액자 + 가운데 별
    if (o.frame) {
      const S = Math.min(w, h) * o.frameSize / 100; x.lineWidth = lw(o.frameStroke); x.setLineDash(o.dash > 0 ? [o.dash * u, o.dash * u] : []);
      x.strokeRect((w - S) / 2, (h - S) / 2, S, S); x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.globalAlpha = o.alpha * .5; x.stroke(); x.globalAlpha = o.alpha; x.setLineDash([]);
      if (o.star > 0) { const sr = o.star * u / 2; x.beginPath(); for (let k = 0; k < o.points; k++) { const a = Math.PI * k / o.points; x.moveTo(w / 2 - Math.cos(a) * sr, h / 2 - Math.sin(a) * sr); x.lineTo(w / 2 + Math.cos(a) * sr, h / 2 + Math.sin(a) * sr); } x.stroke(); }
    }
    // 네 귀퉁이 글씨
    if (o.corner) {
      const fs = Math.max(6, o.cornerSize * u), m = 28 * u; x.font = `${fs}px "JetBrains Mono", monospace`;
      [[m, m + fs, 'left'], [w - m, m + fs, 'right'], [m, h - m, 'left'], [w - m, h - m, 'right']].forEach(([X, Y, al], k) => { const t = o.texts[k]; if (!t) return; x.textAlign = al; x.fillText(t, X, Y); });
      x.textAlign = 'left';
    }
    x.restore();
    ovCount = pts.length;
  }
  // ---------- 오려 붙인 글자: 글자마다 다른 글꼴·종이 조각·색·기울기 ----------
  // 같은 글자는 전에 쓴 (글꼴, 종이)를 피하고, 바로 옆 글자와도 겹치지 않게 골라요
  const RN_EN = [['Playfair Display', 900], ['Playfair Display', 700, 'italic'], ['Bodoni Moda', 900], ['Anton', 400], ['Archivo Black', 400], ['Bebas Neue', 400, '', 1], ['Abril Fatface', 400], ['DM Serif Display', 400], ['Courier Prime', 700], ['Oswald', 600], ['Alfa Slab One', 400], ['Rubik Mono One', 400, '', 1], ['Fraunces', 900], ['Ultra', 400], ['Rye', 400], ['Special Elite', 400], ['Georgia', 700], ['Times New Roman', 700]];
  const RN_KO = [['Black Han Sans', 400], ['Do Hyeon', 400], ['Gowun Batang', 700], ['Nanum Myeongjo', 800], ['Song Myung', 400], ['Noto Serif KR', 900], ['Gothic A1', 900], ['Hahmlet', 800], ['Gasoek One', 400], ['Jua', 400], ['Yeon Sung', 400], ['Nanum Pen Script', 400], ['Pretendard', 900]];
  const RN_PAPER = [['#ebe6d8', '#151515', '#c8443b'], ['#f7f3ea', '#151515', '#1f3a5f'], ['#d9cbb0', '#151515'], ['#c79a5f', '#151515', '#fbf7ee'], ['#c8443b', '#fbf7ee', '#151515'], ['#e3b23c', '#151515'], ['#2f7f86', '#fbf7ee', '#151515'], ['#e07a8b', '#151515', '#fbf7ee'], ['#29384d', '#fbf7ee', '#e3b23c'], ['#151515', '#fbf7ee', '#e3b23c'], ['#5e8c61', '#fbf7ee', '#151515'], ['#7a4a2a', '#fbf7ee'], ['#8fb7c9', '#151515'], ['#f2d6a2', '#151515', '#c8443b']];
  const RN_FONTS = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Bodoni+Moda:wght@700;900&family=Anton&family=Archivo+Black&family=Bebas+Neue&family=Abril+Fatface&family=DM+Serif+Display&family=Courier+Prime:wght@700&family=Oswald:wght@600&family=Alfa+Slab+One&family=Rubik+Mono+One&family=Fraunces:wght@900&family=Ultra&family=Rye&family=Special+Elite&family=Black+Han+Sans&family=Do+Hyeon&family=Gowun+Batang:wght@700&family=Nanum+Myeongjo:wght@800&family=Song+Myung&family=Noto+Serif+KR:wght@900&family=Gothic+A1:wght@900&family=Hahmlet:wght@800&family=Gasoek+One&family=Jua&family=Yeon+Sung&family=Nanum+Pen+Script&display=swap';
  let rnReady = null;
  // 처음 쓸 때만 글꼴 30여 종을 받아요. 다 받으면 한 번 더 그려요
  const loadRansom = () => rnReady || (rnReady = new Promise(res => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = RN_FONTS;
    l.onload = () => Promise.all([...RN_EN, ...RN_KO].map(f => document.fonts.load(`${f[2] || ''} ${f[1]} 40px "${f[0]}"`, 'Aa가1').catch(() => {}))).then(() => res(true));
    l.onerror = () => { rnReady = null; res(false); };
    document.head.appendChild(l);
  }));
  const rnIsKo = ch => /[ㄱ-힝]/.test(ch);
  // 글자 목록(띄어쓰기·줄바꿈 뺀 순서)에 맞춰 모양을 정해요
  function ransomPlan(chars, seed, mixCase) {
    const R = ovRand(seed), pick = a => a[Math.floor(R() * a.length)], seen = new Map(), out = [];
    let prev = null;
    for (const raw of chars) {
      const ko = rnIsKo(raw), pool = ko ? RN_KO : (R() < .18 ? RN_KO : RN_EN), used = seen.get(raw.toLowerCase()) || [];
      let f, p, n = 0;
      do { f = pick(pool); p = Math.floor(R() * RN_PAPER.length); n++; }
      while (n < 60 && ((prev && (prev.f[0] === f[0] || prev.p === p)) || used.some(u2 => u2.f[0] === f[0] || u2.p === p)));
      let ch = raw; if (!ko && mixCase) ch = f[3] || R() < .45 ? raw.toUpperCase() : raw.toLowerCase();
      const paper = RN_PAPER[p];
      const it = { ch, f, p, paper: paper[0], ink: paper[1 + Math.floor(R() * (paper.length - 1))], outline: R() < .14, rot: (R() - .5) * 14, dy: (R() - .5) * .14, scale: .86 + R() * .3, dots: R() < .25, pad: .16 + R() * .12, seed: Math.floor(R() * 1e9) };
      used.push(it); seen.set(raw.toLowerCase(), used); out.push(it); prev = it;
    }
    return out;
  }
  // 한 글자 조각의 너비 (줄 나누기·정렬용)
  const ransomPieceW = (x, it, size) => { x.font = `${it.f[2] || ''} ${it.f[1]} ${Math.round(size * it.scale)}px "${it.f[0]}"`; return Math.max(x.measureText(it.ch).width, size * .3) * (1 + it.pad * 2) + size * .05; };
  // 미리 재기: 글꼴이 정해지기 전에 줄을 나눌 때는 굵은 고딕으로 어림해요
  const ransomEstW = (x, l, size, ls) => { x.font = `900 ${size}px Pretendard, sans-serif`; return [...l].reduce((a, ch) => a + (ch === ' ' ? size * .38 : Math.max(x.measureText(ch).width, size * .3) * 1.5 + size * .05), 0) + ls * Math.max(0, [...l].length - 1); };
  function ransomGlyph(x, it, cx, Y0, size) {
    const R = ovRand(it.seed), fs = Math.round(size * it.scale);
    x.save(); x.translate(cx, Y0 + it.dy * size); x.rotate(it.rot * Math.PI / 180);
    x.font = `${it.f[2] || ''} ${it.f[1]} ${fs}px "${it.f[0]}"`; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    const m = x.measureText(it.ch), asc = m.actualBoundingBoxAscent || fs * .72, desc = m.actualBoundingBoxDescent || 0, gw = Math.max((m.actualBoundingBoxLeft + m.actualBoundingBoxRight) || m.width, fs * .3);
    const px = fs * it.pad, top = -asc - px, bot = desc + px, left = -gw / 2 - px, right = gw / 2 + px, j = () => (R() - .5) * fs * .12;
    const pts = [[left + j(), top + j()], [(left + right) / 2 + j(), top + j() * .5], [right + j(), top + j()], [right + j() * .5, (top + bot) / 2 + j()], [right + j(), bot + j()], [(left + right) / 2 + j(), bot + j() * .5], [left + j(), bot + j()], [left + j() * .5, (top + bot) / 2 + j()]];
    x.shadowColor = 'rgba(0,0,0,.28)'; x.shadowBlur = fs * .08; x.shadowOffsetX = fs * .03; x.shadowOffsetY = fs * .05;
    x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fillStyle = it.paper; x.fill();
    x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetX = x.shadowOffsetY = 0;
    x.save(); x.clip();
    if (it.dots) { x.fillStyle = 'rgba(0,0,0,.09)'; const g = fs * .07; for (let yy = top; yy < bot; yy += g) for (let xx = left + ((Math.round(yy / g)) % 2) * g / 2; xx < right; xx += g) { x.beginPath(); x.arc(xx, yy, g * .22, 0, Math.PI * 2); x.fill(); } }
    x.globalAlpha = .07; x.fillStyle = '#000'; for (let k = 0; k < 140; k++) x.fillRect(left + R() * (right - left), top + R() * (bot - top), fs * .012, fs * .012);
    x.restore();
    if (it.outline) { x.lineWidth = Math.max(2, fs * .06); x.lineJoin = 'round'; x.strokeStyle = '#151515'; x.fillStyle = '#fbf7ee'; x.strokeText(it.ch, 0, 0); x.fillText(it.ch, 0, 0); }
    else { x.fillStyle = it.ink; x.fillText(it.ch, 0, 0); }
    x.restore();
  }
  // ---------- 장미 덩굴: 큰 글씨 줄마다 줄기·잎·덩굴손·장미를 감아요 ----------
  // 줄기를 토막으로 나눠 글자 앞·뒤를 번갈아 지나가게 해요 (back은 글씨 전에, front는 글씨 뒤에 그려요)
  const VINE_PAL = {
    classic: ['빨강 · 파랑', { stem: '#2b4bff', leaf: '#2b4bff', vein: '#7f97ff', rose: '#ff2a1a', petal: '#ffb79e' }],
    pink: ['분홍 · 초록', { stem: '#2f6b3a', leaf: '#3f8a4a', vein: '#9fd3a6', rose: '#f48fb1', petal: '#fff0f4' }],
    night: ['하양 · 초록', { stem: '#3e7d4e', leaf: '#4f9a5f', vein: '#c9e8cf', rose: '#fbf7ee', petal: '#c9b9a6' }],
    gold: ['노랑 · 남색', { stem: '#1f2f6b', leaf: '#2a3f8f', vein: '#8fa3e0', rose: '#ffc93c', petal: '#b7791f' }],
    mono: ['하얀 덩굴', { stem: '#f1eee6', leaf: '#f1eee6', vein: '#222', rose: '#f1eee6', petal: '#222' }],
    ink: ['검은 덩굴', { stem: '#151515', leaf: '#151515', vein: '#8a8a8a', rose: '#151515', petal: '#e8e4da' }],
  };
  const VINE_DEF = () => ({ on: false, pal: 'classic', roses: 1, leaves: .55, stems: 2, thick: 1, seed: 11 });
  // spans: 줄마다 [왼쪽 x, 너비, 글자 바닥선 y, 글씨 크기]
  function vinePlan(x, spans, v) {
    const R = ovRand(v.seed), c = VINE_PAL[v.pal] ? VINE_PAL[v.pal][1] : VINE_PAL.classic[1], back = [], front = [];
    const put = (f, inFront) => (inFront ? front : back).push(f);
    spans.forEach(([sx, w, Y0, size]) => {
      const L = sx - size * .3, Rt = sx + w + size * .3, mid = Y0 - size * .35, stemW = size * .022 * v.thick;
      // 줄은 이리저리 휘며 나아가요 (방향이 조금씩 바뀌고, 글자 줄에서 너무 멀어지면 돌아와요)
      const walk = (x0, y0, a0, len, pull, curl) => { const pts = [[x0, y0]]; let a = a0, da = 0, X = x0, Y = y0;
        for (let d = 0; d < len; d += 4) { da = da * .92 + (R() - .5) * .025; a += da + (pull ? -(Y - mid) / size * .035 - Math.sin(a) * .03 : 0) + curl * (d / len) ** 3 * .25; X += Math.cos(a) * 4; Y += Math.sin(a) * 4; pts.push([X, Y]); }
        return pts; };
      const leaf = (px, py, ang, len) => { const lw = len * (.32 + R() * .12), bend = (R() - .5) * .5;
        return () => { x.save(); x.translate(px, py); x.rotate(ang);
          x.strokeStyle = c.stem; x.lineWidth = stemW * .7; x.beginPath(); x.moveTo(0, 0); x.lineTo(len * .2, 0); x.stroke();
          x.translate(len * .18, 0); x.beginPath(); x.moveTo(0, 0);
          x.quadraticCurveTo(len * .45, -lw + bend * len * .3, len, bend * len * .4); x.quadraticCurveTo(len * .45, lw + bend * len * .3, 0, 0);
          x.fillStyle = c.leaf; x.fill();
          x.beginPath(); x.moveTo(len * .05, 0); x.quadraticCurveTo(len * .5, bend * len * .2, len * .85, bend * len * .35); x.strokeStyle = c.vein; x.lineWidth = Math.max(1, len * .025); x.stroke();
          x.restore(); }; };
      const tendril = (px, py, ang, len, side) => () => { x.beginPath(); x.moveTo(px, py); let a = ang, X = px, Y = py;
        for (let s = 0; s < 40; s++) { const t = s / 40; a += side * (.02 + t * t * .5); const st0 = len / 40 * (1 - t * .6); X += Math.cos(a) * st0; Y += Math.sin(a) * st0; x.lineTo(X, Y); }
        x.strokeStyle = c.stem; x.lineWidth = stemW * .6; x.lineCap = 'round'; x.stroke(); };
      const rose = (cx, cy, r) => { const ph = R() * 6, bumps = 5 + Math.floor(R() * 3), rot = R() * 6, lw = Math.max(1.2, r * .055);
        return () => {
          x.beginPath(); for (let i = 0; i <= 72; i++) { const t = i / 72 * Math.PI * 2, rr = r * (1 + .1 * Math.sin(bumps * t + ph) + .05 * Math.sin(11 * t)); x.lineTo(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr * .9); }
          x.fillStyle = c.rose; x.fill();
          x.strokeStyle = c.petal; x.lineWidth = lw; x.lineCap = 'round'; x.beginPath();
          for (let i = 0; i <= 60; i++) { const t = i / 60, a = rot + t * Math.PI * 4.2, rr = r * .55 * t; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * .85); }
          x.stroke();
          for (let k = 0; k < 3; k++) { const a0 = rot + k * 2.1 + .4; x.beginPath(); x.arc(cx, cy, r * (.68 + k * .06), a0, a0 + 1.1); x.stroke(); }
        }; };
      const grow = (pts, depth) => {
        let i = 0, inF = R() < .5;
        while (i < pts.length - 1) {
          const n = 10 + Math.floor(R() * 35), seg = pts.slice(i, Math.min(pts.length, i + n + 1)), lw = stemW * (depth ? .75 : 1);
          put(() => { x.beginPath(); seg.forEach(([a, b], k) => k ? x.lineTo(a, b) : x.moveTo(a, b)); x.strokeStyle = c.stem; x.lineWidth = lw; x.lineCap = x.lineJoin = 'round'; x.stroke(); }, inF);
          i += n; inF = !inF;
        }
        let side = 1;
        for (let k = 4; k < pts.length - 3; k += Math.max(2, Math.round(size * (.06 + R() * .08) / 4))) {
          const [px, py] = pts[k], [qx, qy] = pts[k + 2], ang = Math.atan2(qy - py, qx - px); side = -side;
          const r = R();
          if (r < v.leaves) put(leaf(px, py, ang + side * (.5 + R() * .8), size * (.12 + R() * .16)), R() < .45);
          else if (r < v.leaves + .1) put(tendril(px, py, ang + side * .9, size * (.12 + R() * .18), side), R() < .5);
          // 곁가지: 위로 솟거나 아래로 늘어져요
          if (!depth && R() < .16) grow(walk(px, py, ang + side * (.7 + R() * .9), size * (.25 + R() * .45), false, side), 1);
        }
        const nr = depth ? (R() < v.roses * .3 ? 1 : 0) : Math.round(pts.length * 4 / size * v.roses * .9);
        for (let j = 0; j < nr; j++) { const [px, py] = depth ? pts[pts.length - 1] : pts[Math.floor(R() * pts.length)]; put(rose(px, py, size * (.09 + R() * .14)), R() < .45); }
      };
      for (let s = 0; s < v.stems; s++) grow(walk(L - R() * size * .4, mid + (R() - .5) * size * .6, (R() - .5) * .5, Rt - L + size * .6, true, 0), 0);
    });
    const run = list => () => { x.save(); x.shadowColor = 'transparent'; x.shadowBlur = 0; x.globalAlpha = 1; list.forEach(f => f()); x.restore(); };
    return { back: run(back), front: run(front) };
  }
  function fxCanvas(w, h, c) {
    w = Math.round(w); h = Math.round(h);
    // 가장 큰 사진 틀을 기억해 두면, 사진을 끌 때 얼마나 움직일지 계산할 수 있어요
    if (!st.frame || w * h > st.frame.w * st.frame.h) st.frame = { w, h, s: Math.max(w / w, h / h) * st.zoom };
    const key = [st.fx, w, h, st.seed, c.dark, c.light, c.vivid, st.zoom, st.cx, st.cy, st.ov && st.ov.on ? JSON.stringify(st.ov) + ovTexId : ''].join('|');
    if (cache.key === key) return cache.c;
    const can = document.createElement('canvas'); can.width = w; can.height = h;
    const x = can.getContext('2d', { willReadFrequently: true });
    // 먼저 사진을 고른 크기·위치로 틀에 놓고(placed), 효과는 그 결과에 입혀요
    const src = placed(w, h), s = 1, sw = w, sh = h, sx = 0, sy = 0;
    if (st.fx === 'slice') {
      // 사진을 조금 크게 잘라 두고, 폭이 제각각인 세로 조각마다 다른 높이에서 가져와 빈틈 없이 어긋나게
      const zs = s * 1.3, zw = w / zs, zh = h / zs, zx = (w - zw) / 2, slack = h - zh;
      const n = 6 + Math.floor(rnd(99) * 6), ws = Array.from({ length: n }, (_, i) => .45 + rnd(i + 200)), tot = ws.reduce((a, b) => a + b, 0);
      let px = 0;
      ws.forEach((wi, i) => {
        const dw = w * wi / tot, srcY = Math.max(0, Math.min(slack, slack / 2 + (rnd(i) - .5) * slack * 1.7));
        x.drawImage(src, zx + px / zs, srcY, dw / zs, zh, Math.floor(px), 0, Math.ceil(dw) + 1, h);
        px += dw;
      });
    } else if (st.fx === 'motion') {
      // 옆으로 빠르게 움직인 것처럼: 조금씩 밀린 사진을 고르게 겹쳐요
      const N = 16;
      for (let i = 0; i < N; i++) { x.globalAlpha = 1 / (i + 1); x.drawImage(src, sx, sy, sw, sh, (i / (N - 1) - .5) * w * .07 - w * .035, 0, w * 1.07, h); }
      x.globalAlpha = 1;
    } else if (st.fx === 'kaleido') {
      // 만화경: 사진 가운데 한 조각을 위아래·좌우로 뒤집어 네 번 붙여요
      const q = document.createElement('canvas'); q.width = Math.ceil(w / 2); q.height = Math.ceil(h / 2);
      q.getContext('2d').drawImage(src, sx + sw * .2, sy + sh * .2, sw * .4, sh * .4, 0, 0, q.width, q.height);
      [[1, 1, 0, 0], [-1, 1, w, 0], [1, -1, 0, h], [-1, -1, w, h]].forEach(([a, b, tx0, ty0]) => { x.save(); x.translate(tx0, ty0); x.scale(a, b); x.drawImage(q, 0, 0); x.restore(); });
    } else if (st.fx === 'mirror') {
      x.drawImage(src, sx, sy, sw / 2, sh, 0, 0, w / 2, h);
      x.save(); x.translate(w, 0); x.scale(-1, 1); x.drawImage(src, sx, sy, sw / 2, sh, 0, 0, w / 2, h); x.restore();
    } else if (st.fx === 'halftone') {
      // 신문 인쇄처럼 점으로
      const cell = Math.max(w, h) / 105, cw = Math.ceil(w / cell), ch = Math.ceil(h / cell);
      const t = document.createElement('canvas'); t.width = cw; t.height = ch;
      const tx = t.getContext('2d', { willReadFrequently: true }); tx.drawImage(src, sx, sy, sw, sh, 0, 0, cw, ch);
      const d = tx.getImageData(0, 0, cw, ch).data;
      x.fillStyle = c.light; x.fillRect(0, 0, w, h); x.fillStyle = c.dark;
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const k = (j * cw + i) * 4, L = (.299 * d[k] + .587 * d[k + 1] + .114 * d[k + 2]) / 255, r = cell * .56 * Math.sqrt(1 - L);
        if (r > .4) { x.beginPath(); x.arc((i + .5) * cell, (j + .5) * cell, r, 0, Math.PI * 2); x.fill(); }
      }
    } else if (st.fx === 'pixel' || st.fx === 'dither') {
      // 작게 줄였다가 각지게 다시 키워요 (1비트는 줄인 상태에서 흑백 점으로 바꿔요)
      const k = st.fx === 'pixel' ? Math.max(w, h) / 64 : 3, cw = Math.ceil(w / k), ch = Math.ceil(h / k);
      const t = document.createElement('canvas'); t.width = cw; t.height = ch;
      const tx = t.getContext('2d', { willReadFrequently: true }); tx.drawImage(src, sx, sy, sw, sh, 0, 0, cw, ch);
      if (st.fx === 'dither') {
        const id = tx.getImageData(0, 0, cw, ch), d = id.data, L = new Float32Array(cw * ch);
        for (let i = 0, p = 0; i < d.length; i += 4, p++) L[p] = ((.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]) / 255 - .5) * 1.15 + .5;
        for (let p = 0; p < L.length; p++) {
          const v = L[p] > .5 ? 1 : 0, e = (L[p] - v) / 8, px = p % cw;
          [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]].forEach(([dx, dy]) => { if (px + dx >= 0 && px + dx < cw) { const q = p + dx + dy * cw; if (q < L.length) L[q] += e; } });
          const col = v ? [243, 239, 230] : [21, 20, 19];
          d[p * 4] = col[0]; d[p * 4 + 1] = col[1]; d[p * 4 + 2] = col[2];
        }
        tx.putImageData(id, 0, 0);
      }
      x.imageSmoothingEnabled = false; x.drawImage(t, 0, 0, w, h); x.imageSmoothingEnabled = true;
    } else if (st.fx === 'dreamy') {
      // 아주 작게 줄인 사진을 밝게 겹쳐 뿌옇게 빛나게
      x.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
      const t = document.createElement('canvas'); t.width = Math.ceil(w / 22); t.height = Math.ceil(h / 22);
      t.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, t.width, t.height);
      x.globalCompositeOperation = 'screen'; x.globalAlpha = .8; x.drawImage(t, 0, 0, w, h);
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    } else if (['ghost', 'shutter', 'zoom', 'bluemon', 'heat'].includes(st.fx)) {
      if (st.fx === 'ghost' || st.fx === 'shutter') {
        // 한 방향으로 끌린 잔상: 조금씩 밀린 사진을 고르게 겹쳐요 (밀려도 틀 끝까지 덮도록 살짝 크게)
        const N = 16, ang = st.fx === 'ghost' ? -.35 : .12, len = w * (st.fx === 'ghost' ? .08 : .12);
        for (let i = 0; i < N; i++) { const t = i / (N - 1) - .5; x.globalAlpha = 1 / (i + 1); x.drawImage(src, Math.cos(ang) * len * t - w * .07, Math.sin(ang) * len * t - h * .07, w * 1.14, h * 1.14); }
        // 흔들린 셔터는 원래 사진을 옅게 겹쳐 형태를 남겨요
        if (st.fx === 'shutter') { x.globalAlpha = .4; x.drawImage(src, 0, 0); }
        x.globalAlpha = 1;
      } else if (st.fx === 'zoom') {
        // 줌 블러: 가운데를 기준으로 조금씩 키운 사진을 겹치고, 밝은 곳은 번지게
        const N = 14;
        for (let i = 0; i < N; i++) { const z = 1 + i / (N - 1) * .28; x.globalAlpha = 1 / (i + 1); x.drawImage(src, (w - w * z) / 2, (h - h * z) / 2, w * z, h * z); }
        x.globalAlpha = .35; x.globalCompositeOperation = 'screen'; x.drawImage(blurC(can, 14), 0, 0);
        x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      } else x.drawImage(blurC(src, st.fx === 'heat' ? 40 : 9), 0, 0);
    } else x.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
    if (['ghost', 'bluemon', 'heat', 'highkey', 'slitscan', 'ripple', 'fisheye'].includes(st.fx)) {
      const img = x.getImageData(0, 0, w, h), d = img.data, ref = new Uint8ClampedArray(d), uu = Math.min(w, h) / 1200;
      const ramp = list => { const S = list.map(hx); return t => { const k = Math.min(S.length - 2, Math.floor(t * (S.length - 1))), f = t * (S.length - 1) - k; return [0, 1, 2].map(j => S[k][j] + (S[k + 1][j] - S[k][j]) * f); }; };
      const BLUE = ramp(['#140b08', '#1b2f9e', '#3d6bff', '#d4e0ff']), HEAT = ramp(['#5a0904', '#d42a14', '#ff7a1c', '#ffd27a']);
      const grain = { ghost: 22, bluemon: 14, heat: 26, highkey: 8 }[st.fx] || 0;
      const at = (X, Y) => (Math.max(0, Math.min(h - 1, Y | 0)) * w + Math.max(0, Math.min(w - 1, X | 0))) * 4;
      // 슬릿 스캔: 높이가 제각각인 가로 띠마다 옆으로 밀고, 몇몇 띠는 한 점의 색을 길게 늘여요
      const rowShift = new Float32Array(h), smear = new Array(h);
      if (st.fx === 'slitscan') for (let y = 0, b = 0; y < h; b++) {
        const bh = Math.max(1, Math.round((2 + rnd(b + 40) * 10) * uu)), s = (rnd(b + 120) - .5) * w * .4 * Math.pow(rnd(b + 80), 1.5);
        const sm = rnd(b + 160) < .6 ? [Math.floor(rnd(b + 200) * w), Math.floor(w * (.08 + rnd(b + 240) * .45))] : null;
        for (let k = 0; k < bh && y < h; k++, y++) { rowShift[y] = s; smear[y] = sm; }
      }
      const A = Math.min(w, h) * .032, lam = Math.min(w, h) * .045, ph = st.seed, R = Math.max(w, h) / 2;
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const px = p % w, py = (p - px) / w, L = (.299 * ref[i] + .587 * ref[i + 1] + .114 * ref[i + 2]) / 255;
        let col = null, j = -1;
        if (st.fx === 'ghost') { const v = Math.min(1, Math.pow(L, .75) * 1.18 + .04) * 255; col = [v, v, v]; }
        else if (st.fx === 'highkey') { const v = (.2 + (1 - Math.pow(1 - L, 2.6)) * .8) * 255; col = [v, v, v]; }
        else if (st.fx === 'heat') col = HEAT(Math.max(0, Math.min(1, (L - .5) * 1.2 + .5)));
        else if (st.fx === 'bluemon') {
          // 파란 화면을 찍은 듯: 파랑 단색 + 가는 가로줄 + 가장자리 어둡게
          const vx = px / w - .5, vy = py / h - .5, k = (py % Math.max(3, Math.round(4 * uu)) < Math.max(1, 1.5 * uu) ? .84 : 1) * (1 - (vx * vx + vy * vy) * .9);
          col = BLUE(Math.max(0, Math.min(1, (L - .5) * 1.15 + .5))).map(v => v * k);
        }
        else if (st.fx === 'slitscan') { const sm = smear[py]; let sx2 = px - rowShift[py]; if (sm && px > sm[0] && px < sm[0] + sm[1]) sx2 = sm[0] - rowShift[py]; j = at(sx2, py); }
        else if (st.fx === 'ripple') j = at(px + A * Math.sin(py / lam + ph) + A * .5 * Math.sin((px + py) / (lam * .7)), py + A * .6 * Math.cos(px / lam * 1.3 + ph));
        else {
          // 어안 렌즈: 가운데는 크게, 가장자리로 갈수록 눌리고 어두워져요
          const nx = (px - w / 2) / R, ny = (py - h / 2) / R, r = Math.hypot(nx, ny), f = .48 + .52 * r * r;
          j = at(w / 2 + nx * f * R, h / 2 + ny * f * R);
          const dark = Math.max(0, 1 - Math.max(0, r - .6) * 1.3);
          col = [ref[j] * dark, ref[j + 1] * dark, ref[j + 2] * dark];
        }
        if (j >= 0 && !col) { d[i] = ref[j]; d[i + 1] = ref[j + 1]; d[i + 2] = ref[j + 2]; d[i + 3] = ref[j + 3]; continue; }
        if (j >= 0) d[i + 3] = ref[j + 3];
        const n = grain ? (rnd(p % 3571) - .5) * grain : 0;
        d[i] = col[0] + n; d[i + 1] = col[1] + n; d[i + 2] = col[2] + n;
      }
      x.putImageData(img, 0, 0);
    }
    if (['gradmap', 'thermal', 'lines', 'xerox'].includes(st.fx)) {
      const img = x.getImageData(0, 0, w, h), d = img.data;
      // 그라디언트 맵: 어두운 곳→밝은 곳을 세 가지 색으로 이어 칠해요 (무작위 조합마다 색 묶음이 바뀌어요)
      const MAPS = [['#1b0f4d', '#e8366f', '#ffd166'], ['#03203c', '#21a0a0', '#f6f740'], ['#2b0b3f', '#ff6b35', '#f7f0e6'], ['#0a0a0a', '#3a86ff', '#ffbe0b'], ['#14213d', '#fca311', '#e5e5e5']];
      const stops = (st.fx === 'thermal' ? ['#000014', '#3b0f70', '#c11a5a', '#ff7a00', '#ffe75a', '#ffffff'] : MAPS[st.seed % MAPS.length]).map(hx);
      const ramp = t => { const k = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1))), f = t * (stops.length - 1) - k; return [0, 1, 2].map(j => stops[k][j] + (stops[k + 1][j] - stops[k][j]) * f); };
      const period = Math.max(w, h) / 140, ink = [21, 20, 19], paper = [239, 236, 228];
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const px = p % w, py = (p - px) / w;
        let L = Math.max(0, Math.min(1, ((.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]) / 255 - .5) * 1.2 + .5)), col;
        if (st.fx === 'gradmap' || st.fx === 'thermal') col = ramp(L);
        else if (st.fx === 'lines') {
          // 선 판화: 가로줄의 두께로 어둡기를 표현해요 (지폐 초상화처럼 살짝 물결치게)
          const ph = ((py + Math.sin(px / period * .5) * period * .35) % period + period) % period / period;
          col = Math.abs(ph - .5) < (1 - L) * .48 ? ink : paper;
        } else {
          // 복사기: 대비를 세게, 토너 얼룩과 세로 줄무늬를 더해요
          const streak = rnd(px % 613 + 400) < .015 ? -.25 : 0, n = (rnd(p % 2311) - .5) * .35;
          const v = (L - .5) * 2.6 + .5 + n + streak;
          col = rnd(p % 7919 + 31) < .002 ? ink : v > .5 ? paper : ink;
        }
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
      }
      x.putImageData(img, 0, 0);
    }
    if (['vintage', 'invert', 'glitch', 'stencil'].includes(st.fx)) {
      const img = x.getImageData(0, 0, w, h), d = img.data, src = st.fx === 'glitch' ? new Uint8ClampedArray(d) : null;
      const rows = new Int16Array(h), off = Math.round(w * .012);
      if (src) for (let b = 0; b < 10; b++) { const y0 = Math.floor(rnd(b + 50) * h), bh = Math.floor(h * (.01 + rnd(b + 70) * .05)), s = Math.round((rnd(b + 90) - .5) * w * .1); for (let y = y0; y < Math.min(h, y0 + bh); y++) rows[y] = s; }
      const at = (px, py) => (py * w + Math.max(0, Math.min(w - 1, px))) * 4;
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const px = p % w, py = (p - px) / w;
        if (st.fx === 'invert') { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
        else if (st.fx === 'stencil') { const v = (.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]) > 118 ? [243, 239, 230] : [21, 20, 19]; d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; }
        else if (st.fx === 'vintage') {
          // 바랜 필름: 검정을 띄우고 따뜻하게, 가장자리는 어둡게, 잔 노이즈
          const vx = px / w - .5, vy = py / h - .5, vig = 1 - (vx * vx + vy * vy) * 1.2, n = (rnd(p % 1543) - .5) * 22;
          d[i] = (30 + d[i] * .86) * vig + n; d[i + 1] = (22 + d[i + 1] * .82) * vig + n; d[i + 2] = (24 + d[i + 2] * .68) * vig + n;
        } else {
          // 글리치: 빨강·파랑이 어긋나고 몇몇 줄이 옆으로 밀려요
          const s = px + rows[py];
          d[i] = src[at(s + off, py)]; d[i + 1] = src[at(s, py) + 1]; d[i + 2] = src[at(s - off, py) + 2];
        }
      }
      x.putImageData(img, 0, 0);
    }
    if (['mono', 'duo', 'poster', 'riso'].includes(st.fx)) {
      // 리소 인쇄는 실제 리소 잉크(파랑·형광 분홍)를 써요
      const riso = st.fx === 'riso', D = hx(riso ? '#0078bf' : c.dark), Lt = hx(st.fx === 'duo' ? c.vivid : riso ? '#f6f1e6' : c.light), R = hx('#ff48b0');
      const img = x.getImageData(0, 0, w, h), d = img.data;
      const Ls = new Float32Array(w * h);
      for (let i = 0, p = 0; i < d.length; i += 4, p++) Ls[p] = Math.max(0, Math.min(1, ((.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]) / 255 - .5) * 1.25 + .5));
      const off = Math.round(w * .01);
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const L = Ls[p];
        if (st.fx === 'mono') d[i] = d[i + 1] = d[i + 2] = L * 255;
        else if (st.fx === 'duo') for (let k = 0; k < 3; k++) d[i + k] = D[k] + (Lt[k] - D[k]) * L;
        else if (st.fx === 'poster') for (let k = 0; k < 3; k++) { const v = d[i + k] / 255, avg = (d[i] + d[i + 1] + d[i + 2]) / 765; d[i + k] = Math.round(Math.max(0, Math.min(1, avg + (v - avg) * 1.6)) * 3) / 3 * 255; }
        else {
          // 리소 인쇄: 잉크 두 장이 살짝 어긋나게 겹쳐요
          const q = p % w + off < w ? p + off : p, a = Math.pow(1 - L, 2.2), b = (1 - Ls[q]) * .7, n = (rnd(p % 997) - .5) * 26;
          for (let k = 0; k < 3; k++) d[i + k] = Lt[k] * (1 - a + a * D[k] / 255) * (1 - b + b * R[k] / 255) + n;
        }
      }
      x.putImageData(img, 0, 0);
    }
    // ---------- 색감·인쇄·윤곽 효과 (픽셀마다 계산) ----------
    const NEWFX = ['cyanotype', 'sepia', 'infrared', 'crossprocess', 'bleach', 'solarize', 'lomo', 'chroma', 'glassblock', 'emboss', 'sketch', 'crosshatch', 'neon', 'tiltshift'];
    if (NEWFX.includes(st.fx)) {
      const img = x.getImageData(0, 0, w, h), d = img.data, ref = new Uint8ClampedArray(d), N = w * h, Lr = new Float32Array(N);
      for (let p = 0, i = 0; p < N; p++, i += 4) Lr[p] = (.299 * ref[i] + .587 * ref[i + 1] + .114 * ref[i + 2]) / 255;
      const at = (X, Y) => Math.max(0, Math.min(h - 1, Y | 0)) * w + Math.max(0, Math.min(w - 1, X | 0));
      const ramp = list => { const S2 = list.map(hx); return t => { t = Math.max(0, Math.min(1, t)); const k = Math.min(S2.length - 2, Math.floor(t * (S2.length - 1))), f = t * (S2.length - 1) - k; return [0, 1, 2].map(j => S2[k][j] + (S2[k + 1][j] - S2[k][j]) * f); }; };
      // S자 곡선: 어두운 곳은 더 어둡게, 밝은 곳은 더 밝게
      const sig = (v, k) => { const f = t => 1 / (1 + Math.exp(-k * (t - .5))); return (f(v) - f(0)) / (f(1) - f(0)); };
      const CYAN = ramp(['#081a3a', '#1c4f8f', '#79a6d8', '#eef4fb']), SEPIA = ramp(['#24160c', '#6f4c2c', '#c4a274', '#f4e8cf']);
      const uu = Math.min(w, h) / 1200, cx0 = w / 2, cy0 = h / 2, Rm = Math.hypot(cx0, cy0);
      const cell = Math.max(w, h) / 26, gap = Math.max(1, 3 * uu), per = Math.max(3, 9 * uu);
      const sobel = p => { const X = p % w, Y = (p - X) / w, g = (a, b) => Lr[at(X + a, Y + b)]; const gx = -g(-1, -1) - 2 * g(-1, 0) - g(-1, 1) + g(1, -1) + 2 * g(1, 0) + g(1, 1), gy = -g(-1, -1) - 2 * g(0, -1) - g(1, -1) + g(-1, 1) + 2 * g(0, 1) + g(1, 1); return Math.min(1, Math.hypot(gx, gy)); };
      for (let p = 0, i = 0; p < N; p++, i += 4) {
        const X = p % w, Y = (p - X) / w, L = Lr[p], r = ref[i], g = ref[i + 1], b = ref[i + 2];
        const vx = X / w - .5, vy = Y / h - .5, vig = vx * vx + vy * vy;
        let o;
        switch (st.fx) {
          case 'cyanotype': o = CYAN(sig(L, 5)); break;
          case 'sepia': { const n = (rnd(p % 2087) - .5) * 14; o = SEPIA(sig(L, 4)).map(v => v * (1 - vig * .9) + n); break; }
          // 적외선(에어로크롬): 초록 잎이 붉은 분홍으로 바뀌어요
          case 'infrared': o = [Math.min(255, g * 1.25 + 20), r * .75, b * 1.05].map((v, k) => 255 * sig(v / 255, k === 0 ? 4 : 5)); break;
          // 크로스 프로세스: 채널마다 다른 곡선 → 그림자는 청록, 밝은 곳은 노랗게
          case 'crossprocess': o = [255 * sig(r / 255, 7), 255 * sig(g / 255, 5), 40 + b * .7]; break;
          // 블리치 바이패스: 흑백을 색 위에 겹친 듯, 채도는 낮고 대비는 높게
          case 'bleach': { const m = 255 * sig(L, 7); o = [r, g, b].map(v => m * .62 + v * .38); break; }
          // 솔라리제이션(만 레이): 밝은 부분의 명암이 뒤집혀요
          case 'solarize': { const v = L < .55 ? L : 1.1 - L; o = [255 * sig(v * 1.8, 4)].concat(255 * sig(v * 1.8, 4), 255 * sig(v * 1.8, 4)); break; }
          case 'lomo': { const avg = (r + g + b) / 3, k = 1 - vig * 1.6; o = [r, g, b].map((v, j) => 255 * sig(Math.max(0, (avg + (v - avg) * 1.5) / 255), 6) * Math.max(0, k) + (j === 2 ? 8 : 0)); break; }
          // 색수차: 가장자리로 갈수록 빨강·파랑이 바깥·안쪽으로 어긋나요
          case 'chroma': { const s1 = 1 + .035 * Math.hypot(X - cx0, Y - cy0) / Rm, s2 = 1 - .035 * Math.hypot(X - cx0, Y - cy0) / Rm; const jr = at(cx0 + (X - cx0) / s1, cy0 + (Y - cy0) / s1) * 4, jb = at(cx0 + (X - cx0) / s2, cy0 + (Y - cy0) / s2) * 4; o = [ref[jr], g, ref[jb + 2]]; break; }
          // 유리 블록: 칸마다 작은 렌즈처럼 안쪽이 확대되고, 칸 사이에 밝은 줄
          case 'glassblock': { const gx0 = Math.floor(X / cell) * cell + cell / 2, gy0 = Math.floor(Y / cell) * cell + cell / 2, j = at(gx0 + (X - gx0) * .55, gy0 + (Y - gy0) * .55) * 4, edge = (X % cell < gap || Y % cell < gap) ? 40 : 0; o = [ref[j] + edge, ref[j + 1] + edge, ref[j + 2] + edge]; break; }
          case 'emboss': { const v = 128 + (Lr[at(X - 1, Y - 1)] - Lr[at(X + 1, Y + 1)]) * 255 * 2.2; o = [v, v, v - 6]; break; }
          case 'sketch': { const e = sobel(p), n = (rnd(p % 1931) - .5) * 10, v = 246 - Math.pow(e, .7) * 255 * 1.1 - (1 - L) * 30 + n; o = [v, v, v - 4]; break; }
          // 크로스해치: 어두울수록 선 방향이 한 겹씩 더해져요
          case 'crosshatch': { const d1 = (X + Y) % per < per * .22, d2 = (X - Y + 99999) % per < per * .22, d3 = Y % per < per * .22; const ink = (L < .78 && d1) || (L < .52 && d2) || (L < .3 && d3) || L < .1; o = ink ? [28, 26, 24] : [244, 240, 230]; break; }
          // 네온 윤곽: 윤곽선만 남기고, 가로 위치에 따라 분홍→하늘 색으로 빛나요
          case 'neon': { const e = Math.min(1, Math.pow(sobel(p) * 2.6, .8)), t = X / w; o = [255 * (1 - t) * e + 30 * e, 80 * e, 255 * t * e + 120 * e * (1 - t)]; break; }
          // 미니어처: 채도를 올리고 (흐림은 아래에서 위·아래만)
          case 'tiltshift': { const avg = (r + g + b) / 3; o = [r, g, b].map(v => avg + (v - avg) * 1.45); break; }
        }
        d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
      }
      x.putImageData(img, 0, 0);
      if (st.fx === 'tiltshift') {
        // 위·아래만 흐리게: 흐린 사진에 가운데가 비는 그라디언트 마스크를 씌워 덮어요
        const bl = blurC(can, 22), bx2 = bl.getContext('2d'), gm = bx2.createLinearGradient(0, 0, 0, h);
        gm.addColorStop(0, 'rgba(0,0,0,1)'); gm.addColorStop(.3, 'rgba(0,0,0,.85)'); gm.addColorStop(.44, 'rgba(0,0,0,0)'); gm.addColorStop(.56, 'rgba(0,0,0,0)'); gm.addColorStop(.7, 'rgba(0,0,0,.85)'); gm.addColorStop(1, 'rgba(0,0,0,1)');
        bx2.globalCompositeOperation = 'destination-in'; bx2.fillStyle = gm; bx2.fillRect(0, 0, w, h);
        x.drawImage(bl, 0, 0);
      }
    }
    if (st.fx === 'lightleak') {
      // 빛 번짐: 필름 끝이 빛에 샌 것처럼 주황·빨강 빛이 가장자리에서 번져요
      x.globalCompositeOperation = 'screen';
      [[rnd(1) < .5 ? 0 : w, h * rnd(2), '255,120,40'], [w * rnd(3), rnd(4) < .5 ? 0 : h, '255,60,60'], [rnd(5) < .5 ? 0 : w, h * rnd(6), '255,200,80']].forEach(([lx, ly, c2], k) => {
        const rg = x.createRadialGradient(lx, ly, 0, lx, ly, Math.max(w, h) * (.55 - k * .1));
        rg.addColorStop(0, `rgba(${c2},.85)`); rg.addColorStop(1, `rgba(${c2},0)`); x.fillStyle = rg; x.fillRect(0, 0, w, h);
      });
      x.globalCompositeOperation = 'source-over';
    }
    if (st.ov && st.ov.on) drawOverlay(x, w, h, c);
    cache = { key, c: can };
    return can;
  }

  // ---------- 글씨 ----------
  function wrap(x, t, maxW, meas = s0 => x.measureText(s0).width) {
    const lines = [];
    t.split('\n').forEach(par => {
      // 빈 줄은 그대로 한 줄 띄워요 (작가 정보와 작품 정보 사이처럼)
      if (!par.trim()) { if (lines.length) lines.push(''); return; }
      let cur = '';
      const push = () => { if (cur.trim()) lines.push(cur.trim()); cur = ''; };
      for (const word of par.split(/\s+/).filter(Boolean)) {
        const next = cur ? cur + ' ' + word : word;
        if (meas(next) <= maxW) { cur = next; continue; }
        push();
        if (meas(word) <= maxW) { cur = word; continue; }
        for (const ch of word) { if (cur && meas(cur + ch) > maxW) push(); cur += ch; }
      }
      push();
    });
    return lines;
  }
  // 서식 있는 글씨를 낱말 단위로 줄에 채워요. 줄마다 가장 큰 글자에 맞춰 높이를 정해요
  function richLayout(x, rich, base, maxW, fontOf, ls, upper) {
    const out = [];
    const finish = items => { while (items.length && /^\s+$/.test(items[items.length - 1].t)) items.pop(); return { items, w: items.reduce((a, m) => a + m.w, 0), sz: Math.max(base * .5, ...items.map(m => m.sz)) }; };
    rich.forEach(runs => {
      if (!runs.length) { out.push({ items: [], w: 0, sz: base, gap: true }); return; }
      const toks = []; runs.forEach(r => (upper ? r.t.toUpperCase() : r.t).split(/(\s+)/).forEach(t => t && toks.push({ t, r })));
      let cur = [], cw = 0;
      toks.forEach(tk => {
        const sz = Math.round(base * (tk.r.s || 1)), f = fontOf(tk.r, sz); x.font = f.font;
        const chs = [...tk.t], w = ls ? chs.reduce((a, ch) => a + x.measureText(ch).width, 0) + ls * (tk.r.s || 1) * chs.length : x.measureText(tk.t).width;
        const m = { t: tk.t, sz, f, w, ls: ls * (tk.r.s || 1) }, space = /^\s+$/.test(tk.t);
        if (cur.length && !space && cw + w > maxW) { out.push(finish(cur)); cur = []; cw = 0; }
        if (!cur.length && space) return;
        cur.push(m); cw += w;
      });
      if (cur.length) out.push(finish(cur));
    });
    return out;
  }
  const richHeight = (L, lineH, first = .8, last = .22) => L.length ? L[0].sz * first + L.slice(1).reduce((a, l) => a + l.sz * lineH, 0) + L[L.length - 1].sz * last : 0;
  // R 영역 안의 o.pos 자리에 제목 + 작은 글씨 + 날짜 줄을 한 덩어리로 그려요.
  // 정렬을 따로 고르면(st.align) 그쪽으로 붙이고, 끌어 옮긴 만큼(st.ox, st.oy) 더 움직여요.
  function block(x, R, o) {
    const [, , k, lh] = FONT[st.font], u = o.u;
    let t = o.title || ''; if (st.upper) t = t.toUpperCase();
    const size = Math.round(o.size * u * k * st.size), f = face(size);
    // 글씨 색을 직접 고르면 큰 글씨와 작은 글씨에 그 색을 써요
    const titleInk = st.tcolor || o.ink, subInk = st.tcolor || o.subInk || o.ink;
    const pos = o.pos || 'tl', row = pos[0], col = st.align || pos[1];
    x.font = f.font;
    // 자간(글자 사이)은 글씨 크기에 대한 비율, 행간(줄 사이)은 글꼴 기본값에 곱해요
    const ls = st.track * size, LH = lh * st.lead;
    const RANS = st.font === 'ransom';
    const lineW = l => RANS ? ransomEstW(x, l, size, ls) : ls ? [...l].reduce((a, ch) => a + x.measureText(ch).width, 0) + ls * Math.max(0, [...l].length - 1) : x.measureText(l).width;
    // 부분 서식이 있으면(굵게·기울임·크기) 서식 있는 줄로, 없으면 지금까지처럼 그려요
    const titleFont = (r, sz) => { const [sty, fam, , , lo, hi] = FONT[st.font], want = r.w || st.weight, w = Math.max(lo, Math.min(hi, want)); return { font: `${r.i === true ? 'italic' : r.i === false ? '' : sty} ${w} ${sz}px ${fam}`, extra: want > hi ? (want - hi) / 100 * sz * .014 : 0 }; };
    const subFont = (r, sz) => ({ font: `${r.i ? 'italic ' : ''}${r.w || 400} ${sz}px Pretendard, sans-serif`, extra: 0 });
    const richT = !RANS && o.rt && o.title === o.rtText ? richLayout(x, o.rt, size, R.w, titleFont, ls, st.upper) : null;
    x.font = f.font;
    const lines = richT ? [] : wrap(x, t, R.w, lineW);
    const subSize = Math.max(Math.round(size * .24), Math.round(26 * u)), metaSize = Math.round(21 * u);
    x.font = `400 ${subSize}px Pretendard, sans-serif`;
    const richS = o.rs && o.sub === o.rsText ? richLayout(x, o.rs, subSize, Math.min(R.w, 900 * u), subFont, 0, false) : null;
    x.font = `400 ${subSize}px Pretendard, sans-serif`;
    const subs = richS ? [] : o.sub ? wrap(x, o.sub, Math.min(R.w, 900 * u)) : [];
    const titleH = richT ? richHeight(richT, LH) : lines.length ? size * .8 + (lines.length - 1) * size * LH + size * .22 : 0;
    const subH = richS ? richHeight(richS, 1.5, 1.1, .4) + (titleH ? size * .2 : 0) : subs.length ? subSize * 1.5 * subs.length + (titleH ? size * .2 : 0) : 0;
    const metaH = o.meta ? metaSize * 1.2 + ((titleH || subH) ? metaSize * 1.6 : 0) : 0;
    const H = titleH + subH + metaH;
    let y = (row === 't' ? R.y : row === 'm' ? R.y + (R.h - H) / 2 : R.y + R.h - H) + st.oy;
    const X = (col === 'l' ? R.x : col === 'c' ? R.x + R.w / 2 : R.x + R.w) + st.ox;
    if (o.shadow) { x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 28 * u; }
    x.textAlign = col === 'l' ? 'left' : col === 'c' ? 'center' : 'right'; x.textBaseline = 'alphabetic';
    // 실제로 잉크가 묻는 범위(글자 모양 그대로)를 모아 두었다가 점선 상자와 그리드 맞춤에 써요
    let bl = Infinity, bt = Infinity, br = -Infinity, bb = -Infinity;
    const ink = (s0, X0, Y0, pad) => { const mt = x.measureText(s0); bl = Math.min(bl, X0 - mt.actualBoundingBoxLeft - pad); br = Math.max(br, X0 + mt.actualBoundingBoxRight + pad); bt = Math.min(bt, Y0 - mt.actualBoundingBoxAscent - pad); bb = Math.max(bb, Y0 + mt.actualBoundingBoxDescent + pad); };
    // 테두리: 글씨 뒤에 굵은 선을 먼저 그리고 그 위에 글씨를 덮어요 (색은 고르거나, 글씨와 반대되는 색)
    const ow = st.outline * size * .012, oc = st.ocolor || (lum(titleInk) > .5 ? '#141413' : '#fbfaf6');
    const outline = (str, X0, Y0, w0) => { if (!w0) return; x.save(); x.shadowColor = 'transparent'; x.lineJoin = 'round'; x.lineWidth = w0 * 2; x.strokeStyle = oc; x.strokeText(str, X0, Y0); x.restore(); };
    x.fillStyle = titleInk; x.font = f.font;
    // 오려 붙인 글자: 띄어쓰기를 뺀 글자 순서대로 모양을 정해 두고, 줄마다 실제 조각 너비로 정렬해요
    const rplan = RANS ? ransomPlan([...lines.join('')].filter(ch => ch.trim()), st.rseed, !st.upper) : null;
    let rk = 0;
    let vine = null;
    if (st.vine && st.vine.on) {
      const spans = [], at = w => col === 'l' ? X : col === 'c' ? X - w / 2 : X - w;
      if (richT) { let Y0 = y; richT.forEach((ln, i) => { Y0 += i ? ln.sz * LH : ln.sz * .8; if (!ln.gap && ln.items.length) spans.push([at(ln.w), ln.w, Y0, ln.sz]); }); }
      else { let k0 = 0; lines.forEach((l, i) => { if (!l) return; const w = RANS ? [...l].reduce((a, ch) => a + (ch.trim() ? ransomPieceW(x, rplan[k0++], size) : size * .38), 0) + ls * Math.max(0, [...l].length - 1) : lineW(l); spans.push([at(w), w, y + size * .8 + i * size * LH, size]); }); }
      x.font = f.font;
      vine = vinePlan(x, spans, st.vine); vine.back(); x.fillStyle = titleInk; x.font = f.font;
    }
    if (RANS && !rnReady) loadRansom().then(ok => { if (ok && im) { cache = {}; draw(); } });
    lines.forEach((l, i) => {
      if (!l) return;
      const Y0 = y + size * .8 + i * size * LH;
      if (RANS) {
        const items = [...l].map(ch => ch.trim() ? rplan[rk++] : null), ws = items.map(it => it ? ransomPieceW(x, it, size) : size * .38), w = ws.reduce((a, b) => a + b, 0) + ls * Math.max(0, items.length - 1);
        let cx = col === 'l' ? X : col === 'c' ? X - w / 2 : X - w; const sx = cx;
        const sh = x.shadowColor; x.shadowColor = 'transparent';
        items.forEach((it, k2) => { if (it) ransomGlyph(x, it, cx + ws[k2] / 2, Y0, size); cx += ws[k2] + ls; });
        x.shadowColor = sh; x.font = f.font;
        bl = Math.min(bl, sx); br = Math.max(br, sx + w); bt = Math.min(bt, Y0 - size * 1.05); bb = Math.max(bb, Y0 + size * .35);
        return;
      }
      if (!ls) { outline(l, X, Y0, ow); fill(x, f, l, X, Y0); ink(l, X, Y0, f.extra / 2 + ow); return; }
      // 자간이 있으면 한 글자씩 놓아요 (어느 브라우저에서나 똑같이 보이게)
      const w = lineW(l), mt = x.measureText(l); let cx = col === 'l' ? X : col === 'c' ? X - w / 2 : X - w;
      const a0 = x.textAlign; x.textAlign = 'left';
      for (const ch of l) { outline(ch, cx, Y0, ow); fill(x, f, ch, cx, Y0); cx += x.measureText(ch).width + ls; }
      x.textAlign = a0;
      const sx = col === 'l' ? X : col === 'c' ? X - w / 2 : X - w, pad = f.extra / 2 + ow;
      bl = Math.min(bl, sx - pad); br = Math.max(br, sx + w + pad); bt = Math.min(bt, Y0 - mt.actualBoundingBoxAscent - pad); bb = Math.max(bb, Y0 + mt.actualBoundingBoxDescent + pad);
    });
    // 서식 있는 줄 그리기: 줄 시작점을 정렬에 맞춰 잡고, 낱말마다 자기 글꼴로 이어 그려요
    const drawRich = (L, y0, lineH, first, ow0) => {
      let Y0 = y0;
      L.forEach((ln, i) => {
        Y0 += i ? ln.sz * lineH : ln.sz * first;
        if (ln.gap || !ln.items.length) return;
        let cx = col === 'l' ? X : col === 'c' ? X - ln.w / 2 : X - ln.w;
        const a0 = x.textAlign; x.textAlign = 'left';
        bl = Math.min(bl, cx - ow0); br = Math.max(br, cx + ln.w + ow0); bt = Math.min(bt, Y0 - ln.sz * .8 - ow0); bb = Math.max(bb, Y0 + ln.sz * .22 + ow0);
        ln.items.forEach(m => {
          x.font = m.f.font;
          if (!m.ls) { outline(m.t, cx, Y0, ow0 * m.sz / ln.sz); fill(x, m.f, m.t, cx, Y0); cx += m.w; return; }
          for (const ch of m.t) { outline(ch, cx, Y0, ow0 * m.sz / ln.sz); fill(x, m.f, ch, cx, Y0); cx += x.measureText(ch).width + m.ls; }
        });
        x.textAlign = a0;
      });
    };
    if (richT) { x.fillStyle = titleInk; drawRich(richT, y, LH, .8, ow); }
    if (vine) vine.front();
    y += titleH + ((subs.length || richS) && titleH ? size * .2 : 0);
    x.fillStyle = subInk; x.font = `400 ${subSize}px Pretendard, sans-serif`;
    const sow = st.outline * subSize * .02;
    if (richS) { drawRich(richS, y, 1.5, 1.1, sow); y += richHeight(richS, 1.5, 1.1, .4); }
    subs.forEach((l, i) => { if (!l) return; const Y0 = y + subSize * (1.1 + i * 1.5); outline(l, X, Y0, sow); x.fillText(l, X, Y0); ink(l, X, Y0, sow); });
    y += subs.length ? subSize * 1.5 * subs.length : 0;
    if (o.meta) { const Y0 = y + metaH - metaSize * .2; x.fillStyle = o.muted; x.font = `${metaSize}px "JetBrains Mono", monospace`; x.fillText(o.meta, X, Y0); ink(o.meta, X, Y0, 0); }
    if (bl < Infinity) markBox(x, bl, bt, br - bl, bb - bt);
    x.shadowColor = 'transparent'; x.shadowBlur = 0; x.textAlign = 'left';
  }
  // 글씨 영역을 캔버스 좌표로 기억해 두면, 미리보기 위에 점선 상자로 보여 줄 수 있어요
  function markBox(x, bx, by, bw, bh) {
    const M = x.getTransform(), pts = [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]].map(([a, b]) => [M.a * a + M.c * b + M.e, M.b * a + M.d * b + M.f]);
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    st.box = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  }
  // 고른 두께를 글꼴이 가진 범위 안에서 쓰고, 더 굵게 원하면 테두리를 덧그려 굵어 보이게 해요
  function face(size) {
    const [sty, fam, , , lo, hi] = FONT[st.font], w = Math.max(lo, Math.min(hi, st.weight));
    return { font: `${sty} ${w} ${size}px ${fam}`, extra: st.weight > hi ? (st.weight - hi) / 100 * size * .014 : 0 };
  }
  function fill(x, f, t, X, Y) {
    x.fillText(t, X, Y);
    if (f.extra) { x.lineWidth = f.extra; x.lineJoin = 'round'; x.strokeStyle = x.fillStyle; x.strokeText(t, X, Y); }
  }
  const fitFont = (x, font, text, maxW) => { x.font = font.replace('$', 100); return Math.floor(100 * maxW / Math.max(1, x.measureText(text).width)); };
  const mono = (x, px, color) => { x.font = `${Math.round(px)}px "JetBrains Mono", monospace`; x.fillStyle = color; };
  // 신문·잡지의 본문 자리를 회색 줄로 채워요
  function greek(x, X, Y, w, h, cols, color, u) {
    const g = 30 * u, cw = (w - g * (cols - 1)) / cols, lh = 17 * u;
    let n = 0;
    for (let ci = 0; ci < cols; ci++) {
      const cx = X + ci * (cw + g);
      if (ci) { x.fillStyle = color; x.globalAlpha = .5; x.fillRect(cx - g / 2, Y, Math.max(1, u), h); x.globalAlpha = 1; }
      for (let y = Y; y + lh < Y + h; y += lh, n++) {
        const end = rnd(n + 700) < .12;
        x.fillStyle = color; x.fillRect(cx, y, cw * (end ? .35 + rnd(n) * .4 : .92 + rnd(n) * .08), 6 * u);
        if (end) y += lh * .6;
      }
    }
  }

  // ---------- 그리기 ----------
  function draw() {
    if (!im) return;
    const [W, H] = dims(), u = Math.min(W, H) / 1200, m = Math.round(Math.min(W, H) * .06), land = W > H;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const x = cv.getContext('2d'), c = scheme(), p = st.p, L = LAYOUT[st.layout];
    const pic = (X, Y, w, h) => { if (!st.picR || w * h > st.picR[2] * st.picR[3]) st.picR = [X, Y, w, h]; x.drawImage(fxCanvas(w, h, c), X, Y, Math.round(w), Math.round(h)); };
    const from = $('#pcFrom').value.trim(), date = fmtDate(p.date), host = (location.hostname || 'hamihamoo.com').toUpperCase();
    const meta = [date, from ? 'FROM ' + from.toUpperCase() : ''].filter(Boolean).join('   ·   ');
    const month = p.date ? +p.date.slice(5, 7) - 1 : new Date().getMonth(), idx = S.photos.indexOf(p) + 1;
    const title = rtPlain($('#pcText')), sub = rtPlain($('#pcSub'));
    // 부분 서식이 있으면 그 정보도 함께 넘겨요 (글씨가 바뀌지 않은 경우에만 쓰여요)
    const rt = rtStyled($('#pcText')) ? rtLines($('#pcText')) : null, rs = rtStyled($('#pcSub')) ? rtLines($('#pcSub')) : null;
    if (rt) ensureRich(rt); if (rs) ensureRich(rs, true);
    const T = { rt, rtText: title, rs, rsText: sub, u, title, sub, meta, ink: c.ink, muted: c.muted, size: L.size };
    const grad = (y0, y1, a) => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0)); };
    // 사진 위에 올리는 글씨: 고른 색(검정이면 검정, 아니면 밝은 색) + 그림자
    const lightInk = st.color === 'black' ? '#141413' : (lum(c.bg) > .55 ? c.bg : '#fbfaf6');
    const onPhoto = { ink: lightInk, muted: mix(lightInk, '#000000', .2), subInk: lightInk, shadow: lightInk !== '#141413' };
    // 추천 자리 목록: [영역, 자리, 덮어쓸 설정]. 고른 번호(st.spot)의 자리에 글씨를 놓아요
    const spots = [];
    const pick = list => list[st.spot % list.length];
    const flat = (ctx, R) => { const M = ctx.getTransform(), xs = [R.x, R.x + R.w].flatMap(a => [R.y, R.y + R.h].map(b => [M.a * a + M.c * b + M.e, M.b * a + M.d * b + M.f])); const X = xs.map(q => q[0]), Y = xs.map(q => q[1]); return { x: Math.min(...X), y: Math.min(...Y), w: Math.max(...X) - Math.min(...X), h: Math.max(...Y) - Math.min(...Y) }; };
    const put = (list, o = {}, ctx = x) => { list.forEach(s => spots.push({ R: flat(ctx, s[0]), pos: s[1] })); const s = pick(list); block(ctx, s[0], { ...T, ...o, ...(s[2] || {}), pos: s[1] }); return s; };
    const inset = (k = 1) => ({ x: m * k, y: m * k, w: W - m * k * 2, h: H - m * k * 2 });
    st.box = null; st.frame = null; st.picR = null;
    x.fillStyle = c.bg; x.fillRect(0, 0, W, H);

    if (st.layout === 'card') {
      const bottom = Math.round(Math.min(W, H) * .2);
      pic(m, m, W - m * 2, H - m - bottom);
      const sw2 = 112 * u, sh2 = 132 * u, sx = W - m - sw2, sy = H - bottom + bottom * .18;
      x.strokeStyle = c.muted; x.setLineDash([5 * u, 5 * u]); x.lineWidth = 2 * u; x.strokeRect(sx, sy, sw2, sh2); x.setLineDash([]);
      drawLogo(x, sx + sw2 / 2, sy + sh2 / 2, 88 * u, c.ink); x.textAlign = 'center';
      mono(x, 13 * u, c.muted); x.fillText(host, sx + sw2 / 2, sy + sh2 + 24 * u); x.textAlign = 'left';
      const Rb = { x: m, y: H - bottom + 16 * u, w: W - m * 2 - sw2 - 40 * u, h: bottom - 32 * u }, Rp = { x: m * 1.7, y: m * 1.7, w: W - m * 3.4, h: H - bottom - m * 2.4 };
      put([[Rb, 'ml'], [Rb, 'mc'], [Rp, 'bl', onPhoto], [Rp, 'tl', onPhoto], [Rp, 'mc', onPhoto]]);
    } else if (st.layout === 'gallery') {
      let R, Rp;
      if (land) { pic(m, m, W * .56 - m, H - m * 2); R = { x: W * .56 + m * .8, y: m, w: W * .44 - m * 1.8, h: H - m * 2 - 110 * u }; Rp = { x: m * 1.7, y: m * 1.7, w: W * .56 - m * 2.4, h: H - m * 3.4 }; }
      else { const ph = H * .58; pic(m, m, W - m * 2, ph); R = { x: m, y: m + ph + 50 * u, w: W - m * 2, h: H - (m + ph + 50 * u) - m - 110 * u }; Rp = { x: m * 1.7, y: m * 1.7, w: W - m * 3.4, h: ph - m * 1.4 }; }
      put(land ? [[R, 'tl'], [R, 'ml'], [R, 'bl'], [Rp, 'bl', onPhoto]] : [[R, 'tl'], [R, 'tc'], [R, 'ml'], [Rp, 'bl', onPhoto], [Rp, 'tl', onPhoto]], { meta: '' });
      const infoX = R.x, y0 = H - m - 70 * u, cw = (W - m - infoX) / 3;
      x.fillStyle = c.ink; x.fillRect(infoX, y0, W - m - infoX, Math.max(1, 2 * u));
      mono(x, 19 * u, c.muted);
      [[date || '—', 'DATE'], [(p.info || '').split(/[,·|]/)[0].trim().toUpperCase().slice(0, 22) || 'PHOTOGRAPH', 'CAMERA'], [from ? 'FROM ' + from.toUpperCase() : host, from ? 'SENDER' : 'ARCHIVE']].forEach(([v, k], i) => {
        x.fillStyle = c.muted; x.fillText(k, infoX + cw * i, y0 + 34 * u); x.fillStyle = c.ink; x.fillText(v, infoX + cw * i, y0 + 62 * u);
      });
    } else if (st.layout === 'full') {
      pic(0, 0, W, H);
      const R = inset(1.2), list = [[R, 'bl'], [R, 'tl'], [R, 'mc'], [R, 'bc'], [R, 'tr'], [R, 'br'], [R, 'ml']], r = pick(list)[1][0], has = title || sub;
      if (has) { if (r === 'b') grad(H, H * .4, .6); else if (r === 't') grad(0, H * .6, .6); else { x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, 0, W, H); } }
      put(list, { ...onPhoto, shadow: false, meta: has ? meta : '' });
    } else if (st.layout === 'type') {
      // 큰 글자 모양으로 사진을 오려 내요
      const t = document.createElement('canvas'); t.width = W; t.height = H;
      const tx = t.getContext('2d'), R = { x: m, y: m * 1.6, w: W - m * 2, h: H - m * 3.2 };
      put([[R, 'mc'], [R, 'tl'], [R, 'bl'], [R, 'tc'], [R, 'br']], { title: title || MONTH_FULL[month], sub: '', meta: '', ink: '#000' }, tx);
      tx.globalCompositeOperation = 'source-in'; tx.drawImage(fxCanvas(W, H, c), 0, 0, W, H);
      x.drawImage(t, 0, 0);
      mono(x, 20 * u, c.muted);
      x.fillText(`( ${(S.site.brandName || 'Hamihamoo').toUpperCase()} )`, m, m + 10 * u);
      x.textAlign = 'right'; x.fillText(date, W - m, m + 10 * u);
      x.textAlign = 'left'; x.fillText([sub, from ? 'FROM ' + from.toUpperCase() : ''].filter(Boolean).join('   ·   ') || host, m, H - m);
    } else if (st.layout === 'swiss') {
      x.fillStyle = mix(c.ink, c.bg, .85);
      for (let i = 0; i <= 6; i++) x.fillRect(m + (W - m * 2) * i / 6, 0, Math.max(1, u), H);
      let R, Rp;
      if (land) { pic(W * .4, m, W * .6 - m, H - m * 2); R = { x: m, y: H * .36, w: W * .4 - m * 1.8, h: H * .64 - m }; Rp = { x: W * .4 + m * .7, y: m * 1.7, w: W * .6 - m * 2.4, h: H - m * 3.4 }; }
      else { pic(W * .3, m, W * .7 - m, H * .56); R = { x: m, y: m + H * .56 + 44 * u, w: W - m * 2, h: H * .44 - m * 2 - 44 * u }; Rp = { x: W * .3 + m * .7, y: m * 1.7, w: W * .7 - m * 2.4, h: H * .56 - m * 1.4 }; }
      const nSize = Math.round((land ? 230 : 150) * u);
      x.fillStyle = c.accent; x.font = `900 ${nSize}px Pretendard, sans-serif`; x.fillText(String(month + 1).padStart(2, '0'), m - nSize * .04, m + nSize * .74);
      mono(x, 18 * u, c.ink);
      x.fillText(MONTH_FULL[month].toUpperCase(), m, m + nSize * .74 + 40 * u);
      x.fillText('No. ' + String(idx).padStart(3, '0'), m, m + nSize * .74 + 68 * u);
      put([[R, land ? 'bl' : 'tl'], [R, land ? 'tl' : 'bl'], [R, land ? 'ml' : 'tr'], [Rp, 'bl', onPhoto]]);
    } else if (st.layout === 'cover') {
      pic(0, 0, W, H);
      grad(0, H * .34, .5);
      const ink = onPhoto.ink, brand = S.site.brandName || 'Hamihamoo';
      const font = 'italic $px "Instrument Serif", Georgia, serif', ms = fitFont(x, font, brand, W - m * 2);
      x.font = font.replace('$', ms); x.fillStyle = ink; x.fillText(brand, m - ms * .02, m + ms * .7);
      mono(x, 19 * u, ink);
      x.fillText(['VOL. ' + String(idx).padStart(2, '0'), MONTH_FULL[month].toUpperCase() + ' ' + (p.date || '').slice(0, 4), 'PHOTOGRAPHS'].join('   —   '), m, m + ms * .7 + 46 * u);
      const top = m + ms * .7 + 110 * u, R = { x: m, y: top, w: W - m * 2, h: H - top - m }, Rn = { ...R, w: W * .66 - m };
      const list = [[Rn, 'bl'], [Rn, 'ml'], [R, 'br'], [R, 'bc'], [Rn, 'tl']];
      if (pick(list)[1][0] === 'b') grad(H, H * .55, .55);
      put(list, { ...onPhoto, shadow: false });
    } else if (st.layout === 'split') {
      let R;
      if (land) { pic(0, 0, W / 2, H); R = { x: W / 2 + m, y: m, w: W / 2 - m * 2, h: H - m * 2 - 50 * u }; }
      else { pic(0, 0, W, H * .56); R = { x: m, y: H * .56 + m, w: W - m * 2, h: H * .44 - m * 2 - 50 * u }; }
      put([[R, 'tl'], [R, 'ml'], [R, 'bl'], [R, 'mc'], [R, 'tr']], { meta: '' });
      mono(x, 19 * u, c.muted);
      x.fillText(meta || date, R.x, H - m); x.textAlign = 'right'; x.fillText(host, W - m, H - m); x.textAlign = 'left';
    } else if (st.layout === 'frame') {
      // 벽에 걸린 액자 + 옆(아래)에 작품 설명 카드
      const fw = land ? W * .5 : W * .74, fh = land ? H * .74 : H * .6, fx = land ? W * .1 : (W - fw) / 2, fy = land ? (H - fh) / 2 : H * .09;
      const b = 24 * u, mat = Math.min(fw, fh) * .12;
      x.shadowColor = 'rgba(0,0,0,.32)'; x.shadowBlur = 60 * u; x.shadowOffsetY = 26 * u;
      x.fillStyle = '#1b1814'; x.fillRect(fx, fy, fw, fh); x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0;
      x.fillStyle = '#f8f6f0'; x.fillRect(fx + b, fy + b, fw - b * 2, fh - b * 2);
      x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(fx + b + mat - 3 * u, fy + b + mat - 3 * u, fw - (b + mat) * 2 + 6 * u, fh - (b + mat) * 2 + 6 * u);
      pic(fx + b + mat, fy + b + mat, fw - (b + mat) * 2, fh - (b + mat) * 2);
      const R = land ? { x: fx + fw + 80 * u, y: fy, w: W - (fx + fw + 80 * u) - m, h: fh } : { x: fx, y: fy + fh + 60 * u, w: fw, h: H - (fy + fh + 60 * u) - m };
      put(land ? [[R, 'bl'], [R, 'ml'], [R, 'tl']] : [[R, 'tc'], [R, 'tl'], [R, 'tr'], [R, 'mc']]);
    } else if (st.layout === 'polaroid') {
      // 살짝 기울어진 폴라로이드 한 장
      const cw = Math.min(W * .78, H * .68), pad = cw * .06, ph = cw - pad * 2, chh = pad + ph + cw * .3;
      x.save(); x.translate(W / 2, H / 2); x.rotate((rnd(7) - .5) * .1);
      x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 50 * u; x.shadowOffsetY = 18 * u;
      x.fillStyle = '#fbfaf6'; x.fillRect(-cw / 2, -chh / 2, cw, chh); x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0;
      x.drawImage(fxCanvas(ph, ph, c), -cw / 2 + pad, -chh / 2 + pad, Math.round(ph), Math.round(ph));
      const R = { x: -cw / 2 + pad, y: -chh / 2 + pad + ph + pad * .5, w: ph, h: chh - ph - pad * 2.3 }, Rp = { x: -cw / 2 + pad * 2, y: -chh / 2 + pad * 2, w: ph - pad * 2, h: ph - pad * 2 };
      put([[R, 'mc'], [R, 'ml'], [R, 'tl'], [Rp, 'bl', onPhoto]], { ink: '#1c1b18', muted: '#8a877d', subInk: '#3a3833' });
      x.restore();
    } else if (st.layout === 'circle') {
      // 동그랗게 오린 사진 + 둘레를 따라 도는 글씨
      const r = Math.min(W, H) * (land ? .36 : .34), cx = land ? W * .34 : W / 2, cy = land ? H / 2 : H * .4;
      x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip(); x.drawImage(fxCanvas(r * 2, r * 2, c), cx - r, cy - r, Math.round(r * 2), Math.round(r * 2)); x.restore();
      const k = FONT[st.font][2], t = (st.upper ? title.toUpperCase() : title).replace(/\n/g, ' ') || MONTH_FULL[month].toUpperCase();
      let size = Math.round(54 * u * k * st.size);
      const widths = () => { x.font = face(size).font; return [...t].map(ch => x.measureText(ch).width + size * .06); };
      let ws = widths(), rr = r + size * .5, tot = ws.reduce((a, b) => a + b, 0);
      if (tot / rr > Math.PI * 1.9) { size = Math.floor(size * Math.PI * 1.9 * rr / tot); ws = widths(); rr = r + size * .5; tot = ws.reduce((a, b) => a + b, 0); }
      x.fillStyle = c.ink; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      let a = -Math.PI / 2 - tot / rr / 2;
      [...t].forEach((ch, i) => {
        a += ws[i] / 2 / rr;
        x.save(); x.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); x.rotate(a + Math.PI / 2); fill(x, face(size), ch, 0, 0); x.restore();
        a += ws[i] / 2 / rr;
      });
      x.textAlign = 'left';
      const y0 = cy + r + 70 * u, R = land ? { x: W * .7, y: m, w: W * .3 - m, h: H - m * 2 } : { x: m, y: y0, w: W - m * 2, h: H - y0 - m };
      put(land ? [[R, 'ml'], [R, 'tl'], [R, 'bl']] : [[R, 'tc'], [R, 'tl'], [R, 'bc']], { title: '' });
    } else if (st.layout === 'warhol') {
      // 같은 사진을 네 가지 색으로 찍어낸 팝아트
      [['#ff4f9a', '#ffe14d'], ['#2747ff', '#7dffc0'], ['#ff6a00', '#b9a8ff'], ['#00b8a0', '#ffd0e0']].forEach((pr, i) => x.drawImage(popCell(W / 2, H / 2, pr), (i % 2) * W / 2, Math.floor(i / 2) * H / 2));
      const R = inset();
      put([[R, 'mc'], [R, 'bc'], [R, 'tl'], [R, 'bl'], [R, 'tc']], { ...onPhoto, muted: onPhoto.ink, shadow: true });
    } else if (st.layout === 'repeat') {
      // 큰 글자를 꽉 채워 반복하고, 가운데 사진 위를 지나는 줄은 색이 뒤집혀 보여요 (끌면 글자 띠가 움직여요)
      const t0 = ((st.upper ? title.toUpperCase() : title) || MONTH_FULL[month].toUpperCase()).replace(/\n/g, ' ') + '  —  ';
      const size = Math.round(L.size * u * FONT[st.font][2] * st.size), f = face(size), lh = size * .92;
      x.font = f.font; const tw = Math.max(1, x.measureText(t0).width);
      const row = (r, y, outline) => { const off = ((r * tw * .37 - st.ox) % tw + tw) % tw; for (let X = -off; X < W; X += tw) outline ? x.strokeText(t0, X, y) : fill(x, f, t0, X, y); };
      x.textAlign = 'left'; x.fillStyle = c.ink; x.strokeStyle = c.ink; x.lineWidth = Math.max(1.5, size * .02);
      const n = Math.ceil(H / lh) + 1, oy = ((st.oy % lh) + lh) % lh - lh;
      for (let r = 0; r < n + 1; r++) row(r, r * lh + size * .78 + oy, r % 2 === 1);
      const pw = land ? W * .4 : W * .62, ph = land ? H * .66 : H * .48;
      pic((W - pw) / 2, (H - ph) / 2, pw, ph);
      x.globalCompositeOperation = 'difference'; x.fillStyle = '#ffffff';
      const mr = Math.floor(n / 2); x.font = f.font;
      { const off = ((mr * tw * .37 - st.ox) % tw + tw) % tw; for (let X = -off; X < W; X += tw) x.fillText(t0, X, mr * lh + size * .78 + oy); }
      x.globalCompositeOperation = 'source-over';
      x.fillStyle = c.bg; x.fillRect(0, H - m - 40 * u, W, m + 40 * u);
      mono(x, 20 * u, c.ink);
      x.fillText([sub, meta].filter(Boolean).join('   ·   ') || host, m, H - m * .7); x.textAlign = 'right'; x.fillText(host, W - m, H - m * .7); x.textAlign = 'left';
    } else if (st.layout === 'ticket') {
      // 입장권: 절취선과 반원 홈, 번호와 바코드가 있는 뜯는 쪽
      const cut = land ? W * .76 : H * .78, num = 'No. ' + String(idx).padStart(4, '0');
      let R;
      if (land) { pic(m, m, cut * .46 - m, H - m * 2); R = { x: cut * .46 + m * .8, y: m, w: cut * .54 - m * 1.6, h: H - m * 2 }; }
      else { pic(m, m, W - m * 2, cut * .58 - m); R = { x: m, y: cut * .58 + m * .6, w: W - m * 2, h: cut * .42 - m * 1.4 }; }
      put(land ? [[R, 'bl'], [R, 'tl'], [R, 'ml']] : [[R, 'tl'], [R, 'bl'], [R, 'tc']]);
      x.strokeStyle = c.muted; x.lineWidth = 3 * u; x.setLineDash([10 * u, 10 * u]); x.beginPath();
      land ? (x.moveTo(cut, 0), x.lineTo(cut, H)) : (x.moveTo(0, cut), x.lineTo(W, cut)); x.stroke(); x.setLineDash([]);
      x.fillStyle = c.ink; x.save();
      if (land) { x.translate(cut + (W - cut) / 2, H / 2); x.rotate(Math.PI / 2); } else x.translate(W / 2, cut + (H - cut) / 2);
      x.textAlign = 'center'; x.font = `800 ${Math.round(46 * u)}px Unbounded, Pretendard, sans-serif`; x.fillText('ADMIT ONE', 0, -40 * u);
      mono(x, 22 * u, c.muted); x.fillText(num + '   ·   ' + (date || host), 0, -4 * u);
      x.fillStyle = c.ink; let bx = -260 * u;
      for (let i = 0; bx < 260 * u; i++) { const bw = (1 + Math.floor(rnd(i + 500) * 4)) * 3 * u; if (i % 2 === 0) x.fillRect(bx, 20 * u, bw, 70 * u); bx += bw; }
      x.restore(); x.textAlign = 'left';
      // 반원 홈과 둥근 모서리는 투명하게 뚫어요
      x.globalCompositeOperation = 'destination-out'; const nr = 34 * u;
      x.beginPath(); land ? (x.arc(cut, 0, nr, 0, Math.PI * 2), x.arc(cut, H, nr, 0, Math.PI * 2)) : (x.arc(0, cut, nr, 0, Math.PI * 2), x.arc(W, cut, nr, 0, Math.PI * 2)); x.fill();
      const cr = 28 * u; [[0, 0], [W, 0], [0, H], [W, H]].forEach(([qx, qy]) => { const ax = qx + (qx ? -cr : cr), ay = qy + (qy ? -cr : cr); x.beginPath(); x.rect(qx - cr, qy - cr, cr * 2, cr * 2); x.moveTo(ax + cr, ay); x.arc(ax, ay, cr, 0, Math.PI * 2, true); x.fill(); });
      x.globalCompositeOperation = 'source-over';
    } else if (st.layout === 'newspaper') {
      // 신문 1면: 고딕체 제호, 날짜 줄, 큰 제목, 사진과 설명, 단으로 나뉜 본문
      const ink = '#151412', gray = 'rgba(21,20,18,.28)';
      if (PAPER[st.color] === PAPER.cream || st.color === 'white') { x.fillStyle = '#f0ece2'; x.fillRect(0, 0, W, H); }
      const mf = '400 $px UnifrakturMaguntia, "Instrument Serif", serif', name = 'The Hamihamoo Times';
      const ms = Math.min(fitFont(x, mf, name, (W - m * 2) * .9), Math.round(H * .09));
      x.font = mf.replace('$', ms); x.fillStyle = ink; x.textAlign = 'center'; x.fillText(name, W / 2, m * .7 + ms * .8);
      let y = m * .7 + ms + 16 * u;
      x.fillRect(m, y, W - m * 2, 4 * u); x.fillRect(m, y + 9 * u, W - m * 2, Math.max(1, 1.5 * u));
      const d = p.date ? new Date(p.date + 'T12:00:00') : new Date();
      const long = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
      x.font = `500 ${Math.round(17 * u)}px "Noto Serif KR", serif`;
      x.fillText(long, W / 2, y + 40 * u); x.textAlign = 'left'; x.fillText('VOL. I · No. ' + idx, m, y + 40 * u); x.textAlign = 'right'; x.fillText('PRICE ₩1,000', W - m, y + 40 * u); x.textAlign = 'left';
      y += 56 * u; x.fillRect(m, y, W - m * 2, Math.max(1, 1.5 * u)); y += 30 * u;
      const cap = sub || (p.info || '').trim();
      const caption = (X, Y, w) => { x.fillStyle = mix(ink, '#f0ece2', .25); x.font = `italic ${Math.round(24 * u)}px "Instrument Serif", "Noto Serif KR", serif`; wrap(x, cap, w).slice(0, 2).forEach((l, i) => x.fillText(l, X, Y + 26 * u + i * 30 * u)); };
      const byline = { ink, muted: mix(ink, '#f0ece2', .4), sub: '', meta: from ? 'BY ' + from.toUpperCase() : '' };
      if (land) {
        const pw = W * .5 - m, ph = H - y - m - 80 * u;
        pic(m, y, pw, ph); caption(m, y + ph, pw);
        const rx = W * .5 + m * .6, rw = W - rx - m, R = { x: rx, y, w: rw, h: (H - y) * .42 };
        put([[R, 'tl'], [R, 'bl'], [R, 'ml']], byline);
        greek(x, rx, y + R.h + 30 * u, rw, H - (y + R.h + 30 * u) - m, 2, gray, u);
      } else {
        const R = { x: m, y, w: W - m * 2, h: H * .17 };
        put([[R, 'tl'], [R, 'tc'], [R, 'bl']], byline);
        y += R.h + 24 * u;
        const pw = (W - m * 2) * .66, ph = H * .34;
        pic(m, y, pw, ph); caption(m, y + ph, pw);
        greek(x, m + pw + 30 * u, y, W - m * 2 - pw - 30 * u, ph + 70 * u, 1, gray, u);
        y += ph + 100 * u; x.fillStyle = ink; x.fillRect(m, y - 18 * u, W - m * 2, Math.max(1, 1.5 * u));
        greek(x, m, y, W - m * 2, H - y - m, 3, gray, u);
      }
    } else if (st.layout === 'movie') {
      // 영화 포스터: 꽉 찬 사진, 위에 한 줄 문구, 큰 제목, 개봉일, 맨 아래 길쭉한 글씨의 크레딧 블록
      pic(0, 0, W, H);
      grad(0, H * .25, .5); grad(H, H * .4, .88);
      const ink = onPhoto.ink, billH = Math.max(H * .085, 90 * u);
      if (sub) { x.textAlign = 'center'; x.fillStyle = ink; x.font = `500 ${Math.round(24 * u)}px Pretendard, sans-serif`; if ('letterSpacing' in x) x.letterSpacing = `${Math.round(6 * u)}px`; x.fillText(sub.toUpperCase(), W / 2, m + 20 * u); if ('letterSpacing' in x) x.letterSpacing = '0px'; x.textAlign = 'left'; }
      const R = { x: m, y: m * 2, w: W - m * 2, h: H - m - billH - 110 * u - m * 2 };
      put([[R, 'bc'], [R, 'mc'], [R, 'bl'], [R, 'tc']], { ...onPhoto, sub: '', meta: '' });
      x.textAlign = 'center'; x.fillStyle = ink; x.font = `700 ${Math.round(30 * u)}px Pretendard, sans-serif`;
      if ('letterSpacing' in x) x.letterSpacing = `${Math.round(5 * u)}px`;
      x.fillText(p.date ? MONTH_FULL[month].toUpperCase() + ' ' + +p.date.slice(8, 10) + ' · ONLY IN THIS ARCHIVE' : 'COMING SOON', W / 2, H - m - billH - 40 * u);
      if ('letterSpacing' in x) x.letterSpacing = '0px';
      // 크레딧은 짧게 한 줄: 제목은 위에 크게 있으니 다시 넣지 않고, 아래에 사이트 주소만 작게
      const who = (from || 'HAMIHAMOO').toUpperCase();
      const credits = [`A HAMIHAMOO PICTURE   ·   PHOTOGRAPHED BY ${who}`, host];
      credits.forEach((line, i) => {
        const bh = Math.round(billH * (i ? .2 : .32)); x.font = `400 ${bh}px Anton, sans-serif`;
        const k = Math.min(.5, (W - m * 2) / Math.max(1, x.measureText(line).width));
        x.save(); x.translate(W / 2, H - m - billH + billH * [.5, .92][i]); x.scale(k, 1); x.fillStyle = mix(ink, '#000000', .1); x.fillText(line, 0, 0); x.restore();
      });
      x.textAlign = 'left';
    } else if (st.layout === 'editorial') {
      // 잡지 지면: 한쪽은 꽉 찬 사진, 다른 쪽은 여백 넉넉한 제목과 첫 글자를 크게 키운 본문
      const story = (p.story || '').replace(/\s+/g, ' ').trim();
      let page, Rp;
      if (land) { pic(0, 0, W / 2, H); page = { x: W / 2 + m, y: m, w: W / 2 - m * 2, h: H - m * 2 }; Rp = { x: m, y: m, w: W / 2 - m * 2, h: H - m * 2 }; const g = x.createLinearGradient(W / 2, 0, W / 2 + 60 * u, 0); g.addColorStop(0, 'rgba(0,0,0,.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(W / 2, 0, 60 * u, H); }
      else { pic(0, 0, W, H * .52); page = { x: m, y: H * .52 + m * .7, w: W - m * 2, h: H * .48 - m * 1.7 }; Rp = { x: m, y: m, w: W - m * 2, h: H * .52 - m * 2 }; }
      mono(x, 18 * u, c.muted);
      x.fillText('( FEATURE )', page.x, land ? page.y + 6 * u : page.y - 14 * u); x.textAlign = 'right'; x.fillText('No. ' + String(idx).padStart(2, '0'), page.x + page.w, land ? page.y + 6 * u : page.y - 14 * u); x.textAlign = 'left';
      x.fillText(String(idx * 2) + '   HAMIHAMOO — ' + MONTH_FULL[month].toUpperCase(), page.x, H - m * .6);
      const Rt = { x: page.x, y: page.y + (land ? 40 * u : 20 * u), w: page.w, h: page.h * (story ? .42 : .8) };
      put([[Rt, 'tl'], [Rt, 'bl'], [Rt, 'tc'], [Rp, 'bl', onPhoto]]);
      if (story) {
        // 첫 글자를 세 줄 높이로 키우고, 나머지를 두 단에 흘려 넣어요
        const by = Rt.y + Rt.h + 30 * u, bh = page.y + page.h - by - 30 * u, fs = Math.round(22 * u), lh = fs * 1.7, g = 40 * u, cw = (page.w - g) / 2;
        const capF = `italic 600 ${Math.round(lh * 3.1)}px "Bodoni Moda", "Noto Serif KR", serif`, first = story[0], rest = story.slice(1);
        x.font = capF; const dw = x.measureText(first).width + 14 * u;
        x.fillStyle = c.ink; x.fillText(first, page.x, by + lh * 2.75);
        x.font = `400 ${fs}px "Noto Serif KR", serif`;
        const maxRows = Math.max(1, Math.floor(bh / lh)), lines = [];
        let cur = '';
        for (const ch of rest) { const wmax = lines.length < 3 ? cw - dw : cw; if (x.measureText(cur + ch).width > wmax) { lines.push(cur); cur = ch.trim() ? ch : ''; } else cur += ch; if (lines.length >= maxRows * 2) break; }
        if (cur && lines.length < maxRows * 2) lines.push(cur);
        lines.slice(0, maxRows * 2).forEach((l, i) => { const col = i < maxRows ? 0 : 1, rI = i % maxRows; x.fillText(l, page.x + col * (cw + g) + (col === 0 && rI < 3 ? dw : 0), by + lh * (rI + 1)); });
      }
    } else if (st.layout === 'campaign') {
      // 캠페인(패션 브랜드 광고): 꽉 찬 사진 한가운데 작고 굵은 글씨 한 줄
      pic(0, 0, W, H);
      const R = inset(1.2);
      put([[R, 'mc'], [R, 'bc'], [R, 'tc'], [R, 'bl'], [R, 'tl']], { ...onPhoto, shadow: false, meta: '' });
    } else if (st.layout === 'filmstill') {
      // 영화 스틸: 검은 바탕에 2.39:1 화면, 그 아래쪽에 자막처럼 글씨
      const ph = Math.min(W / 2.39, H * .8), py = (H - ph) / 2;
      x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, W, H);
      pic(0, py, W, ph);
      mono(x, 18 * u, 'rgba(255,255,255,.55)');
      x.fillText(`SCENE ${String(idx).padStart(3, '0')}`, m, py - 24 * u); x.textAlign = 'right';
      x.fillText(`00:${String(12 + idx % 47).padStart(2, '0')}:${String((idx * 7) % 60).padStart(2, '0')}:${String((idx * 13) % 24).padStart(2, '0')}`, W - m, py - 24 * u); x.textAlign = 'left';
      const Rs = { x: m * 2, y: py + ph * .62, w: W - m * 4, h: ph * .34 }, Rb = { x: m, y: py + ph + 30 * u, w: W - m * 2, h: H - (py + ph + 30 * u) - m };
      put([[Rs, 'bc'], [Rs, 'mc'], [Rb, 'tc']], { ink: '#fff6c8', muted: 'rgba(255,255,255,.6)', subInk: '#fff6c8', shadow: true, meta: '' });
    } else if (st.layout === 'calendar') {
      // 달력: 사진 아래(가로형은 옆)에 그 사진을 찍은 달의 달력, 찍은 날에 동그라미
      const dd = p.date ? new Date(p.date + 'T12:00:00') : new Date(), yy = st.calYear || dd.getFullYear(), mo = st.calMonth != null ? st.calMonth : dd.getMonth(), day = yy === dd.getFullYear() && mo === dd.getMonth() ? dd.getDate() : 0;
      const first = new Date(yy, mo, 1).getDay(), days = new Date(yy, mo + 1, 0).getDate();
      let Rp, G;
      if (land) { Rp = { x: m, y: m, w: W * .5 - m, h: H - m * 2 }; G = { x: W * .5 + m, y: m, w: W * .5 - m * 2, h: H - m * 2 }; }
      else { Rp = { x: m, y: m, w: W - m * 2, h: H * .5 }; G = { x: m, y: m + H * .5 + 40 * u, w: W - m * 2, h: H * .5 - m * 2 - 40 * u }; }
      pic(Rp.x, Rp.y, Rp.w, Rp.h);
      const hs = Math.round(Math.min(G.h * .2, G.w * .16));
      x.fillStyle = c.ink; x.font = `italic ${hs}px "Instrument Serif", Georgia, serif`; x.fillText(MONTH_FULL[mo], G.x, G.y + hs * .8);
      mono(x, 20 * u, c.muted); x.textAlign = 'right'; x.fillText(String(yy), G.x + G.w, G.y + hs * .8); x.textAlign = 'left';
      const gy = G.y + hs + 30 * u, cw = G.w / 7, rows = Math.ceil((first + days) / 7), rh = Math.min((G.h - hs - 60 * u) / (rows + 1), cw * .8);
      x.textAlign = 'center'; mono(x, 17 * u, c.muted);
      'SMTWTFS'.split('').forEach((d2, k) => x.fillText(d2, G.x + cw * (k + .5), gy + rh * .5));
      x.font = `500 ${Math.round(Math.min(30 * u, rh * .45))}px Pretendard, sans-serif`;
      for (let n = 1; n <= days; n++) {
        const k = first + n - 1, cx = G.x + cw * (k % 7 + .5), cy = gy + rh * (Math.floor(k / 7) + 1.5);
        if (n === day) { x.fillStyle = c.accent; x.beginPath(); x.arc(cx, cy - rh * .14, rh * .36, 0, Math.PI * 2); x.fill(); x.fillStyle = lum(c.accent) > .55 ? '#1c1b18' : '#fbfaf6'; }
        else x.fillStyle = k % 7 === 0 ? c.accent : c.ink;
        x.fillText(String(n), cx, cy);
      }
      x.textAlign = 'left';
      const Rph = { x: Rp.x + m * .7, y: Rp.y + m * .7, w: Rp.w - m * 1.4, h: Rp.h - m * 1.4 };
      put([[Rph, 'bl', onPhoto], [Rph, 'tl', onPhoto], [Rph, 'bc', onPhoto]], { meta: '' });
    } else if (st.layout === 'receipt') {
      // 영수증: 톱니처럼 찢긴 감열지 위에 흑백 사진, 항목 줄, 합계, 바코드
      const rw = land ? H * .62 : W * .66, rx = (W - rw) / 2, ry = m * .6, rh = H - m * 1.2, pad = rw * .08, ink = '#1d1c1a';
      x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 40 * u; x.shadowOffsetY = 14 * u;
      x.fillStyle = '#f7f5ef'; x.beginPath();
      const zz = rw / 28; x.moveTo(rx, ry + zz);
      for (let k = 0; k < 28; k++) { x.lineTo(rx + zz * (k + .5), ry); x.lineTo(rx + zz * (k + 1), ry + zz); }
      x.lineTo(rx + rw, ry + rh - zz);
      for (let k = 28; k > 0; k--) { x.lineTo(rx + zz * (k - .5), ry + rh); x.lineTo(rx + zz * (k - 1), ry + rh - zz); }
      x.closePath(); x.fill(); x.restore();
      const inner = rw - pad * 2; let y = ry + pad;
      x.fillStyle = ink; x.textAlign = 'center'; x.font = `700 ${Math.round(rw * .065)}px "Space Mono", monospace`; x.fillText('HAMIHAMOO', W / 2, y + rw * .05);
      x.font = `${Math.round(rw * .03)}px "Space Mono", monospace`; x.fillText('PHOTO ARCHIVE · NO. ' + String(idx).padStart(4, '0'), W / 2, y + rw * .1);
      x.fillText((date || '') + '  ' + String(9 + idx % 12).padStart(2, '0') + ':' + String((idx * 7) % 60).padStart(2, '0'), W / 2, y + rw * .145);
      y += rw * .19;
      const dash = yy2 => { x.save(); x.strokeStyle = ink; x.setLineDash([6 * u, 6 * u]); x.lineWidth = 2 * u; x.beginPath(); x.moveTo(rx + pad, yy2); x.lineTo(rx + rw - pad, yy2); x.stroke(); x.restore(); };
      dash(y); y += 20 * u;
      const phh = inner * .78; pic(rx + pad, y, inner, phh);
      x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(rx + pad, y, inner, phh); x.globalCompositeOperation = 'source-over';
      y += phh + 30 * u;
      x.textAlign = 'left'; x.font = `${Math.round(rw * .032)}px "Space Mono", monospace`;
      const rows = [['1 x PHOTOGRAPH', '1'], ...((p.info || '').split(/[,·|]/).map(t2 => t2.trim()).filter(Boolean).slice(0, 3).map(t2 => [t2.toUpperCase().slice(0, 24), '✓'])), ['LIGHT', '100%']];
      rows.forEach(([k2, v2]) => { x.fillText(k2, rx + pad, y); x.textAlign = 'right'; x.fillText(v2, rx + rw - pad, y); x.textAlign = 'left'; y += rw * .05; });
      dash(y - rw * .02); y += 10 * u;
      const Rt = { x: rx + pad, y, w: inner, h: Math.max(60 * u, ry + rh - y - rw * .2) };
      put([[Rt, 'tl'], [Rt, 'tc']], { ink, muted: '#6b6860', subInk: ink, meta: from ? 'SERVED BY ' + from.toUpperCase() : '' });
      let bx2 = rx + pad; const by2 = ry + rh - rw * .16;
      for (let k = 0; bx2 < rx + rw - pad; k++) { const bw2 = (1 + Math.floor(rnd(k + 300) * 3)) * 2.4 * u; if (k % 2 === 0) { x.fillStyle = ink; x.fillRect(bx2, by2, bw2, rw * .07); } bx2 += bw2; }
      x.fillStyle = ink; x.textAlign = 'center'; x.font = `${Math.round(rw * .028)}px "Space Mono", monospace`; x.fillText('THANK YOU · ' + host, W / 2, by2 + rw * .11); x.textAlign = 'left';
    } else if (st.layout === 'nowplaying') {
      // 음악 재생 화면: 흐린 사진 배경, 둥근 앨범 표지, 곡 제목, 재생 막대와 버튼
      x.drawImage(blurC(fxCanvas(W, H, c), 28), 0, 0, W, H); x.fillStyle = 'rgba(0,0,0,.42)'; x.fillRect(0, 0, W, H);
      const sz2 = land ? H * .62 : W * .74, ax = land ? m * 1.6 : (W - sz2) / 2, ay = land ? (H - sz2) / 2 : H * .1;
      x.save(); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 50 * u; x.shadowOffsetY = 20 * u;
      x.beginPath(); x.roundRect(ax, ay, sz2, sz2, 28 * u); x.fillStyle = '#000'; x.fill(); x.restore();
      x.save(); x.beginPath(); x.roundRect(ax, ay, sz2, sz2, 28 * u); x.clip(); pic(ax, ay, sz2, sz2); x.restore();
      const tx0 = land ? ax + sz2 + m * 1.2 : ax, tw = land ? W - tx0 - m * 1.6 : sz2, ty = land ? ay + sz2 * .1 : ay + sz2 + 60 * u;
      const Rt = { x: tx0, y: ty, w: tw, h: land ? sz2 * .5 : H * .14 };
      put([[Rt, 'tl'], [Rt, 'tc']], { ink: '#ffffff', muted: 'rgba(255,255,255,.65)', subInk: 'rgba(255,255,255,.75)', meta: '' });
      const py2 = land ? ay + sz2 * .72 : ty + H * .16, total = 180 + idx % 120, now = Math.round(total * .38);
      x.fillStyle = 'rgba(255,255,255,.3)'; x.beginPath(); x.roundRect(tx0, py2, tw, 8 * u, 4 * u); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.roundRect(tx0, py2, tw * .38, 8 * u, 4 * u); x.fill(); x.beginPath(); x.arc(tx0 + tw * .38, py2 + 4 * u, 12 * u, 0, Math.PI * 2); x.fill();
      const tm = v => Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0');
      mono(x, 18 * u, 'rgba(255,255,255,.7)'); x.fillText(tm(now), tx0, py2 + 40 * u); x.textAlign = 'right'; x.fillText('-' + tm(total - now), tx0 + tw, py2 + 40 * u); x.textAlign = 'left';
      // 이전 · 재생 · 다음 버튼
      const bcx = tx0 + tw / 2, bcy = py2 + 110 * u, bs = 34 * u; x.fillStyle = '#fff';
      x.fillRect(bcx - bs * .4, bcy - bs * .6, bs * .28, bs * 1.2); x.fillRect(bcx + bs * .12, bcy - bs * .6, bs * .28, bs * 1.2);
      [[-1, bcx - bs * 2.6], [1, bcx + bs * 2.6]].forEach(([dir, ox2]) => { for (let k = 0; k < 2; k++) { const o2 = ox2 + dir * k * bs * .55 - dir * bs * .3; x.beginPath(); x.moveTo(o2 - dir * bs * .45, bcy - bs * .45); x.lineTo(o2 + dir * bs * .25, bcy); x.lineTo(o2 - dir * bs * .45, bcy + bs * .45); x.fill(); } });
    } else if (st.layout === 'arch') {
      // 아치 창: 위가 둥근 창 모양으로 사진을 오리고, 아래에 고전적인 세리프 제목
      const aw = land ? H * .62 : W * .66, ah = land ? H - m * 2.4 : H * .62, ax = land ? W * .12 : (W - aw) / 2, ay = m * 1.2;
      const archPath = (x0, y0, w0, h0) => { x.beginPath(); x.moveTo(x0, y0 + h0); x.lineTo(x0, y0 + w0 / 2); x.arc(x0 + w0 / 2, y0 + w0 / 2, w0 / 2, Math.PI, 0); x.lineTo(x0 + w0, y0 + h0); x.closePath(); };
      x.save(); archPath(ax, ay, aw, ah); x.clip(); pic(ax, ay, aw, ah); x.restore();
      x.strokeStyle = c.muted; x.lineWidth = 2 * u; archPath(ax - 18 * u, ay - 18 * u, aw + 36 * u, ah + 36 * u); x.stroke();
      const R = land ? { x: ax + aw + m * 1.4, y: m, w: W - (ax + aw + m * 1.4) - m, h: H - m * 2 } : { x: m, y: ay + ah + 70 * u, w: W - m * 2, h: H - (ay + ah + 70 * u) - m };
      put(land ? [[R, 'ml'], [R, 'bl'], [R, 'tl']] : [[R, 'tc'], [R, 'tl'], [R, 'mc']]);
    } else if (st.layout === 'triptych') {
      // 세 폭(트립틱): 사진 한 장을 세로로 세 폭에 나눠 걸어요. 가운데 폭은 살짝 내려서 리듬을
      const gap = Math.max(14 * u, W * .022), top = m, ph = land ? H - m * 2 - 150 * u : H * .7, pw = (W - m * 2 - gap * 2) / 3, src = fxCanvas(W - m * 2, ph, c);
      for (let k = 0; k < 3; k++) { const dy = k === 1 ? ph * .04 : 0; x.drawImage(src, (pw + gap) * k * (src.width / (W - m * 2)), 0, pw * (src.width / (W - m * 2)), src.height, m + (pw + gap) * k, top + dy, pw, ph - ph * .04); }
      const R = { x: m, y: top + ph + 40 * u, w: W - m * 2, h: H - (top + ph + 40 * u) - m }, Rp = { x: m + gap, y: top + gap, w: W - m * 2 - gap * 2, h: ph - gap * 2 };
      put([[R, 'tl'], [R, 'tc'], [Rp, 'bl', onPhoto]]);
    } else if (st.layout === 'museum') {
      // 미술관 배너: 위에는 전시 제목과 기간, 아래(가로형은 오른쪽)는 꽉 찬 사진
      const d0 = p.date ? new Date(p.date + 'T12:00:00') : new Date(), d1 = new Date(d0); d1.setMonth(d1.getMonth() + 3);
      const fd = d2 => `${d2.getFullYear()}.${String(d2.getMonth() + 1).padStart(2, '0')}.${String(d2.getDate()).padStart(2, '0')}`;
      let Rt, Ph;
      if (land) { Ph = [W * .48, 0, W * .52, H]; Rt = { x: m, y: m * 1.6, w: W * .48 - m * 2, h: H - m * 3.2 - 120 * u }; }
      else { Ph = [0, H * .46, W, H * .54]; Rt = { x: m, y: m * 1.6, w: W - m * 2, h: H * .46 - m * 2.6 - 90 * u }; }
      pic(...Ph);
      mono(x, 20 * u, c.ink); x.fillText('HAMIHAMOO MUSEUM OF PHOTOGRAPHY', m, m);
      put([[Rt, 'bl'], [Rt, 'tl']], { meta: '' });
      x.fillStyle = c.ink; x.font = `700 ${Math.round(34 * u)}px Pretendard, sans-serif`;
      x.fillText(fd(d0) + ' — ' + fd(d1), m, land ? H - m * 1.6 : H * .46 - m * .8);
    } else if (st.layout === 'cutstrip') {
      // 잘린 글자: 큰 글씨를 가로로 잘라 띠마다 옆으로 어긋나게 붙이고, 사진은 한쪽에 작게
      const pw = land ? W * .3 : W * .42, ph2 = pw * 1.25;
      pic(W - m - pw, H - m - ph2, pw, ph2);
      const t = document.createElement('canvas'); t.width = W; t.height = H; const tx = t.getContext('2d');
      put([[inset(), 'tl'], [inset(), 'ml'], [inset(), 'bl']], { sub: '', meta: '' }, tx);
      const bands = 9 + Math.floor(rnd(31) * 6);
      for (let k = 0, y0 = 0; k < bands; k++) { const bh = H / bands, dx = (rnd(k + 40) - .5) * W * .08; x.drawImage(t, 0, y0, W, bh + 1, dx, y0, W, bh + 1); y0 += bh; }
      mono(x, 20 * u, c.ink); x.fillText([sub, meta].filter(Boolean).join('   ·   ') || host, m, H - m * .6);
    }
    st.spots = spots.map(s => ({ R: s.R, pos: s.pos, W, H }));
    prepareFile();
    paintSpots(); paintBox();
    ensureFont(title + sub);
    saveDraft();
  }
  // 고른 글꼴의 한글·영문 글자를 내려받은 뒤 한 번 더 그려요
  const seenFaces = new Set();
  const richSeen = new Set();
  function ensureRich(L, sub) {
    const [sty, fam] = FONT[st.font];
    L.flat().forEach(r => {
      const spec = sub ? `${r.i ? 'italic ' : ''}${r.w || 400} 40px Pretendard` : `${r.i === true ? 'italic' : r.i === false ? '' : sty} ${r.w || st.weight} 40px ${fam}`;
      if (richSeen.has(spec)) return; richSeen.add(spec);
      document.fonts.load(spec, r.t + 'Aa가').then(fs => { if (fs.length && im) draw(); }).catch(() => {});
    });
  }
  function ensureFont(text) {
    document.fonts.load(face(40).font, (text || '') + 'Aa가').then(fs => {
      const fresh = fs.filter(f => !seenFaces.has(f)); fresh.forEach(f => seenFaces.add(f));
      if (fresh.length && im) draw();
    }).catch(() => {});
  }
  // 팝아트 한 칸: 그림자·중간·밝은 부분을 세 가지 색으로
  let pop = {};
  function popCell(w, h, [mid, hi]) {
    w = Math.round(w); h = Math.round(h);
    const key = [w, h, mid, hi, st.zoom, st.cx, st.cy].join('|'); if (pop[key]) return pop[key];
    if (Object.keys(pop).length > 8) pop = {};
    const can = document.createElement('canvas'); can.width = w; can.height = h;
    const x = can.getContext('2d', { willReadFrequently: true });
    x.drawImage(placed(w, h), 0, 0);
    const img = x.getImageData(0, 0, w, h), d = img.data, M = hx(mid), Hh = hx(hi), K = [24, 20, 22];
    for (let i = 0; i < d.length; i += 4) {
      const L = ((.299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]) / 255 - .5) * 1.5 + .5, col = L < .38 ? K : L < .66 ? M : Hh;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
    }
    x.putImageData(img, 0, 0);
    return (pop[key] = can);
  }
  let fileTimer = null, file = null, fileUrl = '';
  function prepareFile() {
    file = null; $('#pcSave').disabled = true;
    clearTimeout(fileTimer);
    fileTimer = setTimeout(() => cv.toBlob(blob => {
      if (!blob) return;
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      fileUrl = URL.createObjectURL(blob);
      out.src = fileUrl;
      file = new File([blob], `hamihamoo-${st.layout === 'card' ? 'postcard' : 'poster'}-${st.p.date || 'photo'}.png`, { type: 'image/png' });
      $('#pcSave').disabled = false;
    }, 'image/png'), 250);
  }
  function popIn() { if (!reduced) { sheet.classList.remove('flip'); void sheet.offsetWidth; sheet.classList.add('flip'); } }

  // 추천 자리 버튼: 형태 비율 그대로 작은 그림에, 글씨가 놓일 곳을 막대로 보여 줘요
  let spotSig = '';
  function paintSpots() {
    const list = st.spots || [], on = st.spot % Math.max(1, list.length), sig = [st.layout, fmtKey(), list.length, on].join('|');
    if (sig === spotSig) return; spotSig = sig;
    if (!list.length) { $('#pcPos').innerHTML = '<p class="pc-tip" style="margin:0">이 디자인은 글자가 배경 전체를 채워요. 미리보기를 끌면 글자 띠가 움직여요.</p>'; return; }
    $('#pcPos').innerHTML = list.map(({ R, pos, W, H }, i) => {
      const bw = R.w * .55, bh = Math.max(H * .05, R.h * .14), col = pos[1], row = pos[0];
      const bx = col === 'l' ? R.x : col === 'c' ? R.x + (R.w - bw) / 2 : R.x + R.w - bw, by = row === 't' ? R.y : row === 'm' ? R.y + (R.h - bh) / 2 : R.y + R.h - bh;
      return `<button class="${i === on ? 'on' : ''}" data-v="${i}" aria-label="추천 자리 ${i + 1}"><svg viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" class="pg"/><rect x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}" class="ar"/><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" class="tx"/></svg></button>`;
    }).join('');
  }
  const boxEl = document.createElement('div'); boxEl.className = 'pc-box'; sheet.appendChild(boxEl);
  function paintBox() {
    if (!st.box) { boxEl.hidden = true; return; }
    const k = cv.clientWidth / cv.width, [bx, by, bw, bh] = st.box, pad = .75;
    boxEl.hidden = false;
    Object.assign(boxEl.style, { left: cv.offsetLeft + bx * k - pad + 'px', top: cv.offsetTop + by * k - pad + 'px', width: bw * k + pad * 2 + 'px', height: bh * k + pad * 2 + 'px' });
  }

  // ---------- 조작 ----------
  // 분류 버튼과 목록 버튼을 한 번 그려 둬요 (고른 분류와 접힘 상태는 이 브라우저에 기억해요)
  const ui = store.get('hm-pc-ui', { cats: {}, open: { layout: true, text: true } });
  const ID = { layout: '#pcLayout', fx: '#pcFx', font: '#pcFont' };
  // 형태 버튼: 비율 크게, 쓰임새 작게. 세로/가로를 바꾸면 이름도 바뀌어요
  function paintFmt() {
    $('#pcFmt').innerHTML = Object.entries(RATIO).map(([k, d]) => { const l = st.orient === 'l' && d[3]; return `<button class="pill fmt${st.ratio === k ? ' on' : ''}" data-v="${k}"><b>${l ? d[3] : d[1]}</b><small>${l ? d[4] : d[2]}</small></button>`; }).join('');
    $$('#pcOrient button').forEach(b => { b.classList.toggle('on', b.dataset.v === st.orient); b.disabled = st.ratio === 'orig' || st.ratio === 'sq'; });
  }
  const label = (g, v) => (CAT[g].items.find(it => it[0] === v) || [, v])[1];
  function buildLists() {
    Object.entries(CAT).forEach(([g, { cats, items }]) => {
      const cur = ui.cats[g] || 'all';
      $(ID[g] + 'Cats').innerHTML = [['all', '전체'], ...Object.entries(cats)].map(([k, t]) => `<button type="button" data-cat="${k}" class="${k === cur ? 'on' : ''}">${t}</button>`).join('');
      $(ID[g]).innerHTML = items.map(([k, t, c, sty]) => `<button class="pill${cur !== 'all' && c !== cur ? ' off' : ''}" data-v="${k}" data-c="${c}"${sty ? ` style="${sty}"` : ''}>${t}</button>`).join('');
      $(ID[g] + 'Cats').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        ui.cats[g] = b.dataset.cat; store.set('hm-pc-ui', ui);
        $$('button', $(ID[g] + 'Cats')).forEach(x => x.classList.toggle('on', x === b));
        $$('.pill', $(ID[g])).forEach(x => x.classList.toggle('off', b.dataset.cat !== 'all' && x.dataset.c !== b.dataset.cat));
      });
    });
    $$('.pc-sec', el).forEach(d => {
      d.open = !!ui.open[d.dataset.sec];
      d.addEventListener('toggle', () => { ui.open[d.dataset.sec] = d.open; store.set('hm-pc-ui', ui); });
    });
  }
  buildLists();
  // 접어 둔 묶음 제목 옆에 지금 고른 것을 보여 줘요
  function paintSummary() {
    const sum = (k, t) => { const e = $('#pcSum-' + k); if (e) e.textContent = t; };
    sum('fmt', fmtLabel() + ' · 사진 ' + Math.round(st.zoom * 100) + '%');
    sum('layout', label('layout', st.layout));
    sum('fx', label('fx', st.fx));
    sum('ov', st.ov && st.ov.on ? `켜짐 · 원 ${ovCount}개${st.ov.zones.length ? ' · 모자이크 ' + st.ov.zones.length + '칸' : ''}` : '꺼짐');
    sum('text', (rtPlain($('#pcText')).split('\n')[0] || '(비어 있음)') + (rtStyled($('#pcText')) || rtStyled($('#pcSub')) ? ' · 부분 서식' : ''));
    sum('font', label('font', st.font) + ' · ' + Math.round(st.size * 100) + '% · ' + st.weight + (st.track ? ' · 자간 ' + Math.round(st.track * 100) : ''));
    sum('pos', st.ox || st.oy ? '직접 옮김' : '추천 ' + (st.spot % Math.max(1, (st.spots || []).length) + 1) + '번');
    sum('color', (st.tcolor ? '글씨 ' + st.tcolor : '글씨 자동') + (st.outline ? ' · 테두리' : '') + ' · 바탕 ' + st.color);
  }
  function paintControls() {
    paintSummary();
    // 달력 디자인일 때만 연도 고르기가 보여요
    $('#pcCal').hidden = st.layout !== 'calendar';
    if (st.p) {
      $('#pcCalYear').value = st.calYear || (st.p.date ? +st.p.date.slice(0, 4) : new Date().getFullYear());
      $('#pcCalMonth').value = st.calMonth != null ? st.calMonth : (st.p.date ? +st.p.date.slice(5, 7) - 1 : new Date().getMonth());
    }
    paintFmt(); paintOv();
    [['#pcLayout', 'layout'], ['#pcFx', 'fx'], ['#pcFont', 'font']].forEach(([id, k]) => $$('button', $(id)).forEach(b => b.classList.toggle('on', b.dataset.v === st[k])));
    $$('#pcAlign button').forEach(b => b.classList.toggle('on', b.dataset.v === st.align));
    // 글씨 색: 자동 + 자주 쓰는 색 + 이 사진에서 뽑은 색 + 직접 고르기
    const tcs = ['#fbfaf6', '#141413', '#f1e9d8', '#d8401e', '#f08a24', '#f6c531', '#2f6fd0', '#ff4f9a', ...cols];
    $('#pcTColor').innerHTML = `<button data-v="auto" class="auto ${st.tcolor ? '' : 'on'}" aria-label="자동">자동</button>` + tcs.map(v => `<button data-v="${v}" class="${st.tcolor === v ? 'on' : ''}" style="--c:${v}" aria-label="글씨 색 ${v}"></button>`).join('');
    if (st.tcolor) $('#pcTPick').value = st.tcolor;
    $('#pcUpper').classList.toggle('on', st.upper);
    $('#pcSize').value = Math.round(st.size * 100); $('#pcSizeN').textContent = Math.round(st.size * 100) + '%';
    $('#pcWeight').value = st.weight; paintWeight();
    $('#pcRecut').hidden = st.font !== 'ransom';
    paintVine();
    $('#pcTrack').value = Math.round(st.track * 100); $('#pcTrackN').textContent = (st.track > 0 ? '+' : '') + Math.round(st.track * 100);
    $('#pcLead').value = Math.round(st.lead * 100); $('#pcLeadN').textContent = Math.round(st.lead * 100) + '%';
    $('#pcOut').value = st.outline; $('#pcOutN').textContent = st.outline ? st.outline + (st.ocolor ? '' : ' · 자동 색') : '없음';
    if (st.ocolor) $('#pcOutPick').value = st.ocolor;
    $('#pcOutAuto').classList.toggle('on', !st.ocolor);
    $('#pcZoom').value = Math.round(st.zoom * 100); $('#pcZoomN').textContent = Math.round(st.zoom * 100) + '%';
    $('#pcColor').innerHTML = [...Object.entries(PAPER).map(([k, v]) => [k, v]), ...cols.map((v, i) => ['c' + i, v])]
      .map(([k, v]) => `<button data-v="${k}" class="${st.color === k ? 'on' : ''}" style="--c:${v}" aria-label="색 ${k}"></button>`).join('');
  }
  // 두께 숫자 옆에, 이 글꼴이 실제로 가진 두께 범위를 알려줘요 (범위보다 굵게 하면 테두리로 굵게 만들어요)
  function paintWeight() {
    const [, , , , lo, hi] = FONT[st.font];
    $('#pcWeightN').textContent = st.weight + (st.weight < lo ? ' · 이 글꼴은 더 가늘게 안 돼요' : '');
  }
  function useLayout(l) {
    const L = LAYOUT[l];
    Object.assign(st, { layout: l, font: L.font, spot: 0, align: null, color: L.color, upper: !!L.upper, size: 1, weight: L.weight || FONT[L.font][6], ox: 0, oy: 0 });
    if (st.color[0] === 'c' && !cols.length) st.color = 'cream';
  }
  // ---------- 그래픽 오버레이 조절 칸 ----------
  // [이름, 종류, 보이는 글자, (범위: 최소, 최대, 간격) 또는 (고르기: [[값, 글자]...])]
  const OV_UI = [
    ['기본', [['ink', 'pick', '색', [['white', '흰색'], ['black', '검정'], ['accent', '주황'], ['photo', '사진 색']]], ['alpha', 'range', '그래픽 진하기', 0.1, 1, 0.05], ['fade', 'range', '사진 진하기 (낮을수록 흐리게)', 0.2, 1, 0.05]]],
    ['찾아서 찍기', [['detect', 'pick', '찾는 기준', [['combined', '섞어서'], ['contrast', '대비'], ['bright', '밝은 곳'], ['dark', '어두운 곳']]], ['block', 'range', '세밀도 (작을수록 촘촘)', 6, 48, 1], ['thresh', 'range', '기준 점수 (높을수록 적게)', 0, 100, 1], ['max', 'range', '최대 개수', 0, 200, 1], ['minDist', 'range', '원 사이 간격', 0, 200, 1]]],
    ['모양', [['shape', 'pick', '모양', [['circle', '원'], ['square', '네모']]], ['rMin', 'range', '가장 작은 크기', 1, 40, 1], ['rMax', 'range', '가장 큰 크기', 4, 80, 1], ['stroke', 'range', '선 두께', 0.2, 4, 0.1], ['seed', 'range', '크기 섞기 (숫자를 바꾸면 다르게)', 1, 999, 1], ['label', 'range', '좌표 글씨 크기 (0이면 숨김)', 0, 24, 1]]],
    ['연결선', [['link', 'range', '이을 거리 (0이면 선 없음)', 0, 400, 5], ['linkW', 'range', '선 두께', 0.2, 4, 0.1]]],
    ['원 사슬', [['chain', 'tog', '사슬 보이기'], ['count', 'range', '원 개수', 1, 25, 1], ['angle', 'range', '방향 (0 세로 · 90 가로)', 0, 180, 1], ['base', 'range', '가운데 원 크기', 20, 600, 5], ['ratio', 'range', '이어질수록 크기 배율', 0.4, 1.2, 0.01], ['chainX', 'range', '가로 위치 %', 0, 100, 1], ['chainY', 'range', '세로 위치 %', 0, 100, 1], ['inter', 'tog', '만나는 점 표시'], ['marker', 'range', '점 크기', 1, 15, 0.5]]],
    ['점선 액자', [['frame', 'tog', '액자 보이기'], ['frameSize', 'range', '액자 크기 %', 10, 100, 1], ['dash', 'range', '점선 길이 (0이면 실선)', 0, 40, 1], ['frameStroke', 'range', '선 두께', 0.2, 4, 0.1], ['star', 'range', '가운데 별 크기 (0이면 숨김)', 0, 200, 1], ['points', 'range', '별 줄 수 (2는 +, 4는 8각 별)', 1, 8, 1]]],
    ['귀퉁이 글씨', [['corner', 'tog', '귀퉁이 글씨 보이기'], ['cornerSize', 'range', '글씨 크기', 6, 40, 1], ['texts', 'texts', '네 귀퉁이 (왼쪽 위 · 오른쪽 위 · 왼쪽 아래 · 오른쪽 아래)']]],
    ['모자이크 칸', [['zones', 'zones', '사진 눌러 칸 찍기'], ['pix', 'range', '모자이크 크기', 4, 64, 1], ['zone', 'range', '칸 크기', 20, 400, 5], ['zoneStroke', 'tog', '칸 테두리']]],
    ['질감', [['noise', 'range', '노이즈 질감 진하기 (0이면 없음)', 0, 1, 0.05], ['tex', 'tex', '내 질감 사진']]],
  ];
  let ovPick = false;
  const ovAuto = () => { const p = st.p || {}, inf = parseInfo(p.info); return ['HAMIHAMOO', fmtDate(p.date), inf.camera !== '—' ? inf.camera : '', 'NO. ' + (p._n || '')]; };
  const ovFmt = (k, v) => k === 'alpha' || k === 'fade' || k === 'noise' ? Math.round(v * 100) + '%' : k === 'ratio' ? (+v).toFixed(2) : String(Math.round(v * 10) / 10);
  function buildOv() {
    $('#pcOv').innerHTML = `<div class="pc-row"><button type="button" class="pill" id="pcOvOn">켜기</button><button type="button" class="pill" id="pcOvDice">오버레이 무작위</button><button type="button" class="pill" id="pcOvReset">처음 값으로</button></div>
      <p class="pc-tip">사진의 밝고 어둡거나 대비가 강한 곳을 찾아 원을 찍고, 가까운 원끼리 선으로 이어요. 어떤 디자인·사진 효과와도 함께 쓸 수 있어요.</p>
      <div id="pcOvBody">${OV_UI.map(([g, items], gi) => `<details class="pc-sub"${gi < 1 ? ' open' : ''}><summary>${g}</summary>${items.map(([k, t, label, a, b, c]) => {
        if (t === 'range') return `<div class="mono faint pc-l">${label} <span data-ovn="${k}"></span></div><input type="range" class="pc-range" data-ov="${k}" min="${a}" max="${b}" step="${c}">`;
        if (t === 'pick') return `<div class="mono faint pc-l">${label}</div><div class="pc-chips" data-ovp="${k}">${a.map(([v, tt]) => `<button type="button" class="pill" data-v="${v}">${tt}</button>`).join('')}</div>`;
        if (t === 'tog') return `<div class="pc-row" style="margin-top:8px"><button type="button" class="pill" data-ovt="${k}">${label}</button></div>`;
        if (t === 'texts') return `<div class="mono faint pc-l">${label}</div><div class="pc-ovtexts">${[0, 1, 2, 3].map(i => `<input data-ovx="${i}" maxlength="40">`).join('')}</div>`;
        if (t === 'zones') return `<div class="pc-row"><button type="button" class="pill" id="pcOvPick">${label}</button><button type="button" class="pill" id="pcOvUndo">되돌리기</button><button type="button" class="pill" id="pcOvClear">모두 지우기</button></div><p class="pc-tip" id="pcOvZn"></p>`;
        if (t === 'tex') return `<div class="pc-row"><label class="pill pc-file">${label} 올리기<input type="file" accept="image/*" id="pcOvTex" hidden></label><button type="button" class="pill" id="pcOvTexX">기본 노이즈로</button></div>`;
        return '';
      }).join('')}</details>`).join('')}</div>`;
  }
  function paintVine() {
    const v = st.vine || VINE_DEF(), on = v.on;
    $('#pcVine').textContent = on ? '✓ 🌹 장미 덩굴 켜짐' : '🌹 장미 덩굴 감기'; $('#pcVine').classList.toggle('on', on);
    $('#pcVineRe').hidden = $('#pcVineBody').hidden = !on;
    $$('button', $('#pcVinePal')).forEach(b => b.classList.toggle('on', b.dataset.v === v.pal));
    $$('[data-vine]', el).forEach(i => { i.value = v[i.dataset.vine]; });
  }
  function paintOv() {
    const o = st.ov, on = !!(o && o.on);
    $('#pcOvOn').textContent = on ? '✓ 켜짐' : '켜기'; $('#pcOvOn').title = on ? '누르면 꺼져요' : ''; $('#pcOvOn').classList.toggle('on', on);
    $('#pcOvBody').classList.toggle('pc-off', !on);
    if (!o) return;
    $$('[data-ov]', el).forEach(i => { i.value = o[i.dataset.ov]; });
    $$('[data-ovn]', el).forEach(s => { s.textContent = ovFmt(s.dataset.ovn, o[s.dataset.ovn]); });
    $$('[data-ovp]', el).forEach(g => $$('button', g).forEach(b => b.classList.toggle('on', b.dataset.v === o[g.dataset.ovp])));
    $$('[data-ovt]', el).forEach(b => { const v = o[b.dataset.ovt]; b.classList.toggle('on', v); b.textContent = (v ? '✓ ' : '') + b.textContent.replace(/^✓ /, ''); });
    $$('[data-ovx]', el).forEach(i => { if (document.activeElement !== i) i.value = o.texts[+i.dataset.ovx] || ''; });
    $('#pcOvPick').classList.toggle('on', ovPick); $('#pcOvPick').textContent = ovPick ? '✓ 찍는 중 · 끝내기' : '사진 눌러 칸 찍기';
    $('#pcOvZn').textContent = `${o.zones.length}칸 찍음${ovPick ? ' · 미리보기 사진을 누르세요' : ''}`;
    sheet.classList.toggle('ov-picking', ovPick);
  }
  buildOv();
  const ovSet = (fn, again = true) => { if (!st.ov) st.ov = OV_DEF(); fn(st.ov); cache = {}; if (again) draw(); paintOv(); paintSummary(); };
  $('#pcOvOn').onclick = () => ovSet(o => { if (st.ov && !o.texts.some(Boolean)) o.texts = ovAuto(); o.on = !o.on; if (!o.on) ovPick = false; });
  $('#pcOvReset').onclick = () => { const z = st.ov ? st.ov.zones : []; st.ov = OV_DEF(); st.ov.on = true; st.ov.texts = ovAuto(); st.ov.zones = z; ovSet(() => {}); };
  $('#pcOvDice').onclick = () => ovSet(o => {
    const r = (a, b, s = 1) => Math.round((a + Math.random() * (b - a)) / s) * s, pk = a => a[Math.floor(Math.random() * a.length)];
    Object.assign(o, { on: true, ink: pk(['white', 'white', 'black', 'accent', 'photo']), detect: pk(['combined', 'contrast', 'bright', 'dark']), block: r(10, 30), thresh: r(15, 55), max: r(20, 140), minDist: r(20, 90), shape: pk(['circle', 'circle', 'square']), rMin: r(2, 8), rMax: r(12, 40), seed: r(1, 999), label: pk([0, 7, 8, 10]), link: r(0, 260, 5), chain: Math.random() < .7, count: r(3, 15), angle: r(0, 180), base: r(120, 380, 5), ratio: r(.6, .95, .01), chainX: r(20, 80), chainY: r(15, 85), frame: Math.random() < .6, frameSize: r(35, 85), star: r(0, 80), points: r(2, 6), fade: r(.6, 1, .05) });
    if (!o.texts.some(Boolean)) o.texts = ovAuto();
  });
  el.addEventListener('input', e => {
    const k = e.target.dataset.ov; if (k) return ovSet(o => { o[k] = +e.target.value; });
    const tx = e.target.dataset.ovx; if (tx != null) ovSet(o => { o.texts[+tx] = e.target.value; });
  });
  el.addEventListener('click', e => {
    const p = e.target.closest('[data-ovp] button'); if (p) return ovSet(o => { o[p.parentNode.dataset.ovp] = p.dataset.v; });
    const t = e.target.closest('[data-ovt]'); if (t) return ovSet(o => { o[t.dataset.ovt] = !o[t.dataset.ovt]; });
  });
  $('#pcOvPick').onclick = () => { ovPick = !ovPick; ovSet(o => { o.on = true; if (!o.texts.some(Boolean)) o.texts = ovAuto(); }, false); };
  $('#pcOvUndo').onclick = () => ovSet(o => { o.zones.pop(); });
  $('#pcOvClear').onclick = () => ovSet(o => { o.zones = []; });
  $('#pcOvTex').onchange = e => { const f = e.target.files[0]; if (!f) return; const i = new Image(); i.onload = () => { ovTex = i; ovTexId++; ovSet(o => { o.on = true; if (!o.noise) o.noise = .5; }); }; i.src = URL.createObjectURL(f); };
  $('#pcOvTexX').onclick = () => { ovTex = null; ovTexId++; ovSet(() => {}); };
  // 모자이크 찍기: 미리보기 사진을 누른 자리 (가장 큰 사진 칸 기준 0~1 위치)
  const ovZoneAt = e => {
    if (!ovPick || !st.ov) return false;
    const r = cv.getBoundingClientRect(), k = cv.width / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, [X, Y, w, h] = st.picR || [0, 0, cv.width, cv.height], zu = (px - X) / w, zv = (py - Y) / h;
    if (!(zu >= 0 && zu <= 1 && zv >= 0 && zv <= 1)) { toast('사진 칸 안을 눌러 주세요'); return true; }
    ovSet(o => { o.zones.push([+zu.toFixed(4), +zv.toFixed(4)]); });
    return true;
  };
  api.open = p => {
    paintAdmin(); solo(false); st.fixed = null; drafting = true; changed = false;
    st.p = p; el.hidden = false; im = null; cache = {}; pop = {};
    useLayout('full');
    Object.assign(st, { ratio: 'orig', orient: 'p', fx: 'none', zoom: 1, cx: .5, cy: .5, calYear: null, calMonth: null });
    if (st.ov) Object.assign(st.ov, { on: false, zones: [], texts: ['', '', '', ''] }); ovPick = false;
    $('#pcText').innerHTML = ''; $('#pcSub').innerHTML = '';
    const dr = store.get('hm-pc-draft', null);
    if (dr && dr.photo === p.filename) { restore(dr); toast('만들던 엽서를 이어서 열었어요'); }
    const i = new Image();
    i.onload = () => {
      im = i; cols = photoColors(); if (st.color[0] === 'c' && !cols[+st.color.slice(1)]) st.color = 'cream';
      paintControls();
      fontsReady().then(() => { draw(); popIn(); });
    };
    i.src = imgUrl(p);
    if (!reduced) $('.pc-panel', el).animate([{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
  };
  api.close = () => { el.hidden = true; onUse = null; };
  const fontsReady = () => loadPosterFonts().then(() => Promise.all(['italic 40px "Instrument Serif"', '40px Anton', '900 40px Pretendard', '40px "Noto Serif KR"', '40px "JetBrains Mono"'].map(f => document.fonts.load(f).catch(() => {}))));
  // ---------- 달력 만들기에서 쓰는 편집 모드 ----------
  // 정해진 사진 칸 크기(w×h)로 열고, "이 달에 쓰기"를 누르면 다 그린 그림과 설정을 돌려줘요
  const home = el.parentNode;
  let onUse = null;
  // 임시저장: 직접 연 엽서 창에서, 무언가 바꿨을 때만
  let drafting = false, changed = false, draftT = 0;
  ['input', 'click'].forEach(t => el.addEventListener(t, e => { if (drafting && !e.target.closest('#pcClose')) changed = true; }, true));
  const saveDraft = () => { clearTimeout(draftT); draftT = setTimeout(() => { if (!drafting || !changed || !st.p || el.hidden) return; store.set('hm-pc-draft', { photo: st.p.filename, ...snap() }); Drafts.touch('print'); }, 600); };
  api.draftOf = () => { const d = store.get('hm-pc-draft', null); return d && S.byName.get(d.photo) ? d : null; };
  function solo(on) {
    el.classList.toggle('solo', on);
    if (on && el.parentNode !== document.body) document.body.appendChild(el);
    if (!on && el.parentNode !== home) home.appendChild(el);
    $('#pcUse').hidden = !on;
  }
  // 지금 설정을 저장해 둘 수 있는 모양으로 (사진은 파일 이름만)
  const snap = () => { const { p, frame, box, spots, fixed, ...rest } = st; return { st: JSON.parse(JSON.stringify(rest)), text: $('#pcText').innerHTML, sub: $('#pcSub').innerHTML, from: $('#pcFrom').value }; };
  function restore(sv) {
    useLayout('full');
    Object.assign(st, { ratio: 'orig', orient: 'p', fx: 'none', zoom: 1, cx: .5, cy: .5, calYear: null, calMonth: null, tcolor: null, track: 0, lead: 1, outline: 0, ocolor: null, seed: 1, ov: null }); ovPick = false;
    $('#pcText').innerHTML = ''; $('#pcSub').innerHTML = ''; $('#pcFrom').value = '';
    if (sv) { Object.assign(st, sv.st); $('#pcText').innerHTML = sv.text || ''; $('#pcSub').innerHTML = sv.sub || ''; $('#pcFrom').value = sv.from || ''; }
  }
  const loadPhoto = p => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = imgUrl(p); });
  const copyCv = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0); return c; };
  api.edit = (p, w, h, sv, done) => {
    paintAdmin(); solo(true); drafting = false;
    st.p = p; el.hidden = false; im = null; cache = {}; pop = {};
    restore(sv); st.fixed = [Math.round(w), Math.round(h)]; onUse = done;
    loadPhoto(p).then(i => {
      im = i; cols = photoColors(); if (st.color[0] === 'c' && !cols[+st.color.slice(1)]) st.color = 'cream';
      paintControls(); fontsReady().then(() => { draw(); popIn(); });
    });
    if (!reduced) $('.pc-panel', el).animate([{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22,1,.36,1)' });
  };
  $('#pcUse').onclick = () => { if (!im || !onUse) return; const f = onUse, c = copyCv(), sv = snap(); api.close(); f(c, sv); };
  // 화면에 띄우지 않고 저장해 둔 설정대로 다시 그려요 (여러 개를 부탁해도 하나씩 차례로)
  let queue = Promise.resolve();
  api.render = (p, w, h, sv) => (queue = queue.catch(() => {}).then(async () => {
    drafting = false;
    const i = await loadPhoto(p);
    st.p = p; im = i; cache = {}; pop = {}; cols = photoColors();
    restore(sv); st.fixed = [Math.round(w), Math.round(h)];
    await fontsReady(); draw(); await document.fonts.ready; draw();
    return copyCv();
  }));
  const chips = (id, fn) => $(id).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; fn(b.dataset.v); paintControls(); draw(); });
  chips('#pcFmt', v => { st.ratio = v; st.ox = st.oy = 0; popIn(); });
  chips('#pcOrient', v => { st.orient = v; st.ox = st.oy = 0; popIn(); });
  chips('#pcLayout', v => { useLayout(v); popIn(); });
  // 같은 효과를 한 번 더 누르면 조각 배치·색 묶음이 바뀌어요
  chips('#pcFx', v => { if (v === st.fx) st.seed++; st.fx = v; });
  const setYear = y => { st.calYear = Math.max(1900, Math.min(2200, Math.round(y) || new Date().getFullYear())); paintControls(); draw(); };
  $('#pcCalYear').addEventListener('change', e => setYear(+e.target.value));
  $('#pcCalMonth').addEventListener('change', e => { st.calMonth = +e.target.value; st.calYear = +$('#pcCalYear').value; paintControls(); draw(); });
  const stepMonth = d => { let y = +$('#pcCalYear').value, mo = +$('#pcCalMonth').value + d; if (mo < 0) { mo = 11; y--; } if (mo > 11) { mo = 0; y++; } st.calMonth = mo; setYear(y); };
  $('#pcCalPrev').onclick = () => stepMonth(-1);
  $('#pcCalNext').onclick = () => stepMonth(1);
  $('#pcCalToday').onclick = () => { const t = new Date(); st.calMonth = t.getMonth(); setYear(t.getFullYear()); };
  $('#pcCalPhoto').onclick = () => { st.calYear = null; st.calMonth = null; paintControls(); draw(); };
  chips('#pcFont', v => { if (v === 'ransom' && st.font !== 'ransom') st.rseed = Math.floor(Math.random() * 1e6); st.font = v; st.weight = FONT[v][6]; });
  // 다시 오리기: 글자마다 글꼴·종이를 새로 섞어요
  $('#pcRecut').onclick = () => { st.rseed = Math.floor(Math.random() * 1e6); draw(); };
  // 장미 덩굴: 켜기/끄기 · 다시 감기 · 색 · 막대들
  $('#pcVinePal').innerHTML = Object.entries(VINE_PAL).map(([k, [t, c]]) => `<button type="button" class="pill" data-v="${k}"><i class="pc-vdot" style="background:${c.rose}"></i><i class="pc-vdot" style="background:${c.leaf}"></i>${t}</button>`).join('');
  const vineSet = fn => { if (!st.vine) st.vine = VINE_DEF(); fn(st.vine); draw(); paintVine(); };
  $('#pcVine').onclick = () => vineSet(v => { v.on = !v.on; });
  $('#pcVineRe').onclick = () => vineSet(v => { v.seed = 1 + Math.floor(Math.random() * 1e6); });
  $('#pcVinePal').onclick = e => { const b = e.target.closest('button'); if (b) vineSet(v => { v.pal = b.dataset.v; }); };
  $$('[data-vine]', el).forEach(i => i.addEventListener('input', () => vineSet(v => { v[i.dataset.vine] = +i.value; })));
  chips('#pcTColor', v => { st.tcolor = v === 'auto' ? null : v; });
  $('#pcTPick').addEventListener('input', e => { st.tcolor = e.target.value; paintControls(); draw(); });
  chips('#pcPos', v => { st.spot = +v; st.ox = st.oy = 0; });
  chips('#pcAlign', v => { st.align = st.align === v ? null : v; });
  $('#pcReset').onclick = () => { st.ox = st.oy = 0; st.align = null; paintControls(); draw(); };
  chips('#pcColor', v => { st.color = v; });
  $('#pcUpper').onclick = () => { st.upper = !st.upper; paintControls(); draw(); };
  $('#pcTrack').addEventListener('input', e => { st.track = e.target.value / 100; paintControls(); draw(); });
  $('#pcLead').addEventListener('input', e => { st.lead = e.target.value / 100; paintControls(); draw(); });
  $('#pcOut').addEventListener('input', e => { st.outline = +e.target.value; paintControls(); draw(); });
  $('#pcOutPick').addEventListener('input', e => { st.ocolor = e.target.value; if (!st.outline) st.outline = 3; paintControls(); draw(); });
  $('#pcOutAuto').onclick = () => { st.ocolor = null; paintControls(); draw(); };
  $('#pcWeight').addEventListener('input', e => { st.weight = +e.target.value; paintWeight(); draw(); });
  $('#pcSize').addEventListener('input', e => { st.size = e.target.value / 100; $('#pcSizeN').textContent = e.target.value + '%'; draw(); });
  ['#pcText', '#pcSub'].forEach(id => rtInit($(id)));
  // 버튼을 눌러도 고른 글자가 풀리지 않게, 누르는 순간의 기본 동작(포커스 이동)을 막아요
  $('#pcRtBar').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  $('#pcRtBar').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; rtApply(b.dataset.rt, b.dataset.rt === 's' ? +b.dataset.v : b.dataset.v); });
  ['#pcText', '#pcSub', '#pcFrom'].forEach(id => $(id).addEventListener('input', () => { draw(); paintSummary(); }));
  $('#pcDice').onclick = () => {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    useLayout(pick(Object.keys(LAYOUT).filter(l => l !== st.layout)));
    st.fx = pick(['none', 'none', ...CAT.fx.items.map(it => it[0])]);
    if (Math.random() < .5) { st.font = pick(Object.keys(FONT)); st.weight = FONT[st.font][6]; }
    st.color = pick([...Object.keys(PAPER), ...cols.map((v, i) => 'c' + i)]);
    st.seed = Math.floor(Math.random() * 1000);
    paintControls(); draw(); popIn();
  };
  // 엽서 그림 위에서 글씨 끌어 옮기기
  // 투명 저장용 사진이 브라우저의 "사진 끌어가기"로 잡히면 끌기가 몇 픽셀 만에 끊겨요. 그래서 막아 둬요.
  out.draggable = false; out.addEventListener('dragstart', e => e.preventDefault());
  // 끄는 동안 보이는 디자인 그리드: 여백 안을 6단으로 나누고, 칸이 거의 정사각형이 되게 줄 수를 정해요
  const gridEl = document.createElement('canvas'); gridEl.className = 'pc-grid'; sheet.appendChild(gridEl);
  function gridLines() {
    const W = cv.width, H = cv.height, m = Math.round(Math.min(W, H) * .06), cw = (W - m * 2) / 6, rows = Math.max(3, Math.round((H - m * 2) / cw));
    return { xs: Array.from({ length: 7 }, (_, i) => m + cw * i), ys: Array.from({ length: rows + 1 }, (_, j) => m + (H - m * 2) * j / rows), th: Math.min(W, H) * .035 };
  }
  // 글씨 상자의 왼쪽·가운데·오른쪽(위·가운데·아래) 중 그리드 선에 가장 가까운 것을 찾아요
  function snapOf(box) {
    if (!box) return null;
    const { xs, ys, th } = gridLines(), [bx, by, bw, bh] = box;
    const near = (lines, a, len) => { let best = null; lines.forEach(L => [0, len / 2, len].forEach(o => { const d = L - (a + o); if (Math.abs(d) < th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, L }; })); return best; };
    return { x: near(xs, bx, bw), y: near(ys, by, bh) };
  }
  function paintGrid(sn) {
    const k = cv.clientWidth / cv.width, dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (gridEl.width !== Math.round(w * dpr)) { gridEl.width = Math.round(w * dpr); gridEl.height = Math.round(h * dpr); }
    Object.assign(gridEl.style, { left: cv.offsetLeft + 'px', top: cv.offsetTop + 'px', width: w + 'px', height: h + 'px' });
    const g = gridEl.getContext('2d'), { xs, ys } = gridLines();
    g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    // 밝은 사진·어두운 사진 어디서든 보이게 어두운 줄 위에 밝은 줄을 겹쳐요. 붙을 선은 주황색
    const line = (x0, y0, x1, y1, hot) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = (hot ? 4 : 3) / k; g.stroke(); g.strokeStyle = hot ? '#ff5a36' : 'rgba(255,255,255,.55)'; g.lineWidth = (hot ? 2 : 1) / k; g.stroke(); };
    xs.forEach(X => line(X, 0, X, cv.height, sn && sn.x && sn.x.L === X));
    ys.forEach(Y => line(0, Y, cv.width, Y, sn && sn.y && sn.y.L === Y));
  }
  // 끌기: 글씨 상자 위를 잡으면 글씨가, 그 밖을 잡으면 사진이 움직여요. 두 손가락으로 벌리면 확대·축소
  let drag = null, raf = 0, pinch = null;
  const touches = new Map();
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const redraw = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); if (drag && drag.mode === 'text' && st.box) paintGrid(snapOf(st.box)); }); };
  const setZoom = z => { st.zoom = Math.max(.3, Math.min(4, z)); $('#pcZoom').value = Math.round(st.zoom * 100); $('#pcZoomN').textContent = Math.round(st.zoom * 100) + '%'; };
  function onText(e) {
    if (!st.box) return st.layout === 'repeat';
    const r = cv.getBoundingClientRect(), k = cv.width / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, pad = Math.min(cv.width, cv.height) * .03, [bx, by, bw, bh] = st.box;
    return px > bx - pad && px < bx + bw + pad && py > by - pad && py < by + bh + pad;
  }
  sheet.addEventListener('pointerdown', e => {
    if (!im) return;
    if (ovZoneAt(e)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { sheet.setPointerCapture(e.pointerId); } catch (err) {}
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: st.zoom }; drag = null; sheet.classList.remove('dragging', 'panning');
      return;
    }
    if (!e.isPrimary) return;
    const mode = onText(e) ? 'text' : 'photo';
    drag = { mode, x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy, cx: st.cx, cy: st.cy, k: cv.width / cv.getBoundingClientRect().width };
    sheet.classList.add(mode === 'text' ? 'dragging' : 'panning');
    if (mode === 'text' && st.box) paintGrid(snapOf(st.box));
  });
  sheet.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) { const [a, b] = [...touches.values()]; setZoom(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d); return redraw(); }
    if (!drag) return;
    const dx = (e.clientX - drag.x) * drag.k, dy = (e.clientY - drag.y) * drag.k;
    if (drag.mode === 'text') { st.ox = drag.ox + dx; st.oy = drag.oy + dy; }
    else {
      // 사진이 틀보다 크면 남는 만큼, 작으면 빈 만큼 안에서만 움직여요
      const fr = st.frame; if (!fr) return;
      const ex = fr.w - im.naturalWidth * fr.s, ey = fr.h - im.naturalHeight * fr.s;
      if (Math.abs(ex) > 1) st.cx = clamp01(drag.cx + dx / ex);
      if (Math.abs(ey) > 1) st.cy = clamp01(drag.cy + dy / ey);
    }
    redraw();
  });
  sheet.addEventListener('wheel', e => { if (!im) return; e.preventDefault(); setZoom(st.zoom * Math.exp(-e.deltaY * .0015)); redraw(); }, { passive: false });
  const end = e => {
    touches.delete(e.pointerId);
    if (pinch) { if (touches.size < 2) pinch = null; return; }
    if (!drag) return;
    const mode = drag.mode;
    drag = null; cancelAnimationFrame(raf); raf = 0; draw(); paintSummary();
    if (mode === 'photo') return sheet.classList.remove('panning');
    // 그리드 선 가까이에서 놓으면 그 선에 맞춰 짧게 미끄러져 붙어요
    const sn = snapOf(st.box), dx = sn && sn.x ? sn.x.d : 0, dy = sn && sn.y ? sn.y.d : 0;
    const done = () => sheet.classList.remove('dragging');
    if (!dx && !dy) return done();
    const sx = st.ox, sy = st.oy, t0 = performance.now(), dur = reduced ? 0 : 140;
    const step = now => { const t = dur ? Math.min(1, (now - t0) / dur) : 1, e2 = 1 - Math.pow(1 - t, 3); st.ox = sx + dx * e2; st.oy = sy + dy * e2; draw(); paintGrid(sn); t < 1 ? requestAnimationFrame(step) : setTimeout(done, 120); };
    requestAnimationFrame(step);
  };
  // 사진 맞추기 버튼: 꽉 채우기 / 사진 전체 보기 / 크기 슬라이더
  $('#pcZoom').addEventListener('input', e => { setZoom(e.target.value / 100); draw(); });
  $('#pcFill').onclick = () => { st.cx = st.cy = .5; setZoom(1); draw(); };
  $('#pcFit').onclick = () => {
    const fr = st.frame; if (!fr || !im) return;
    const nw = im.naturalWidth, nh = im.naturalHeight;
    st.cx = st.cy = .5; setZoom(Math.min(fr.w / nw, fr.h / nh) / Math.max(fr.w / nw, fr.h / nh)); draw();
  };
  sheet.addEventListener('pointerup', end); sheet.addEventListener('pointercancel', end);
  // 관리자(로그인한 사람)에게만 "전시에 올리기"를 보여 주고, 아니면 작은 로그인 안내를 보여 줘요
  function paintAdmin() { $('#pcPublish').hidden = !Studio.authed; $('#pcAdmin').hidden = Studio.authed; }
  $('#pcAdminBtn').onclick = () => { $('#pcAdminForm').hidden = false; $('#pcAdminToken').focus(); };
  $('#pcAdminForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('#pcAdminMsg'); msg.textContent = '확인하는 중…';
    const ok = await adminLogin($('#pcAdminToken').value.trim()).catch(() => false);
    if (!ok) { msg.textContent = '열쇠가 맞지 않거나, 저장할 권한이 없어요.'; return; }
    $('#pcAdminToken').value = ''; msg.textContent = ''; $('#pcAdminForm').hidden = true; paintAdmin(); toast('관리자로 들어왔어요. 이제 전시에 올릴 수 있어요');
  });
  $('#pcPublish').onclick = async () => {
    if (!im) return;
    const b = $('#pcPublish'), label = b.innerHTML; b.disabled = true; b.textContent = '올리는 중…';
    try {
      // 전시용은 가볍게: 긴 쪽 1600px JPEG (투명한 곳은 종이색으로 채워요)
      const k = Math.min(1, 1600 / Math.max(cv.width, cv.height)), o = document.createElement('canvas');
      o.width = Math.round(cv.width * k); o.height = Math.round(cv.height * k);
      const ox = o.getContext('2d'); ox.fillStyle = '#f1e9d8'; ox.fillRect(0, 0, o.width, o.height); ox.drawImage(cv, 0, 0, o.width, o.height);
      const blob = await new Promise(r => o.toBlob(r, 'image/jpeg', .88));
      const d = new Date(), date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      await publishPoster(blob, { photo: st.p.filename, title: rtPlain($('#pcText')).split('\n')[0], layout: st.layout, fmt: fmtKey(), date, w: o.width, h: o.height });
      toast('전시(Projects › Prints)에 올렸어요 · 1~2분 뒤 홈페이지에도 반영돼요', 4200);
      Drafts.clear('print'); changed = false;
    } catch (err) { console.error(err); toast('올리지 못했어요: ' + err.message, 6000); paintAdmin(); }
    finally { b.disabled = false; b.innerHTML = label; }
  };
  $('#pcClose').onclick = api.close;
  el.addEventListener('click', e => { if (e.target === el) api.close(); });
  $('#pcSave').onclick = async () => {
    if (!file) return;
    // 휴대폰: 공유 창을 띄워요 (아이폰은 여기서 "이미지 저장"을 누르면 사진 앱에 저장돼요)
    if (isTouch && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Hamihamoo' }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.download = file.name; a.href = fileUrl;
    document.body.appendChild(a); a.click(); a.remove();
    toast(isTouch ? '저장 창이 뜨지 않으면 미리보기를 길게 눌러 저장하세요' : '이미지를 저장했어요', 4200);
  };
  return api;
})();

/* ============================================================
   계절 지도 (월별 사진 수와 대표 색)
   ============================================================ */
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function renderSeasons(view) {
  const yrs = years(S.photos);
  let year = 'all', sel = null;
  view.innerHTML = `<section class="page">
    <div class="page-head">
      <div><div class="page-kicker mono">( A year in color )</div><h1 class="page-title split">${splitChars('Seasons')}</h1></div>
      <p class="page-sub">1년 12달을 원으로 펼쳤어요. 막대가 길수록 그 달에 사진을 많이 찍었고, 막대 색은 그 달 사진에서 가장 많이 나온 색이에요.</p>
    </div>
    <div class="toolbar-row" style="margin-bottom:22px"><div class="seg" id="seaYear"><span class="seg-ind"></span>${[['all', '모든 해'], ...yrs.map(y => [y, y])].map(([v, l]) => `<button data-v="${v}" class="${v === 'all' ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="season">
      <div class="season-chart"><svg id="seaSvg" viewBox="-315 -315 630 630" role="img" aria-label="월별 사진 수와 대표 색"></svg></div>
      <div class="season-side" id="seaSide"></div>
    </div>
    <details class="season-table mono"><summary>표로 보기</summary><table id="seaTable"></table></details>
  </section>`;
  const tip = document.createElement('div'); tip.className = 'cons-tip'; tip.style.position = 'fixed'; document.body.appendChild(tip);
  pageCleanup.push(() => tip.remove());
  $('#seaYear', view).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#seaYear button').forEach(x => x.classList.toggle('on', x === b)); syncSeg($('#seaYear')); year = b.dataset.v; sel = null; paint(); });
  const seasonOf = k => [11, 0, 1].includes(k) ? '겨울' : k < 5 ? '봄' : k < 8 ? '여름' : '가을';
  function paint() {
    const list = S.photos.filter(p => p.date && (year === 'all' || p.date.startsWith(year)));
    const months = MONTHS.map((m, k) => {
      const ps = list.filter(p => +p.date.slice(5, 7) === k + 1), cnt = {};
      ps.forEach(p => { const k = mainShade(p); cnt[k] = (cnt[k] || 0) + 1; });
      const ranked = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
      return { m, k, ps, ranked, color: ranked[0] ? ranked[0][0] : null };
    });
    const max = Math.max(1, ...months.map(d => d.ps.length));
    if (sel == null || !months[sel].ps.length) sel = months.reduce((a, b) => b.ps.length > a.ps.length ? b : a).k;
    const R0 = 92, R1 = 262, step = Math.PI * 2 / 12, gap = 0.05;
    const pt = (a, r) => `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
    const arc = (a0, a1, r0, r1) => `M${pt(a0, r0)} L${pt(a0, r1)} A${r1} ${r1} 0 0 1 ${pt(a1, r1)} L${pt(a1, r0)} A${r0} ${r0} 0 0 0 ${pt(a0, r0)}Z`;
    let svg = `<circle r="${R1}" fill="none" stroke="var(--line)" stroke-dasharray="2 6"/><circle r="${(R0 + R1) / 2}" fill="none" stroke="var(--line)" stroke-dasharray="2 6"/><circle r="${R0 - 6}" fill="none" stroke="var(--line)"/>`;
    ['겨울', '봄', '여름', '가을'].forEach((s, i) => { const a = (i * 3 + 0.5) * step; svg += `<text x="${(Math.sin(a) * 296).toFixed(1)}" y="${(-Math.cos(a) * 296 + 4).toFixed(1)}" text-anchor="middle" fill="var(--ink-3)" font-size="12" font-family="Pretendard">${s}</text>`; });
    months.forEach(d => {
      const a0 = d.k * step + gap, a1 = (d.k + 1) * step - gap, r1 = R0 + (R1 - R0) * Math.max(d.ps.length / max, 0.015), am = (d.k + 0.5) * step;
      svg += `<g class="sea-seg ${d.k === sel ? 'sel' : ''}" data-k="${d.k}" tabindex="0" role="button" aria-label="${d.m} ${d.ps.length}장"><path d="${arc(a0, a1, R0, R1)}" fill="transparent"/><path class="bar" d="${arc(a0, a1, R0, r1)}" fill="${d.color ? shadeHex(d.color) : 'var(--bg-3)'}" stroke="var(--line-2)" stroke-width="1" style="--dl:${d.k * 50}ms"/>
        <text x="${(Math.sin(am) * (R0 - 22)).toFixed(1)}" y="${(-Math.cos(am) * (R0 - 22) + 4).toFixed(1)}" text-anchor="middle" fill="${d.k === sel ? 'var(--accent)' : 'var(--ink-2)'}" font-size="11" font-family="JetBrains Mono">${d.m.toUpperCase()}</text></g>`;
    });
    const cur = months[sel];
    svg += `<text y="-2" text-anchor="middle" fill="var(--ink)" font-size="32" font-family="Instrument Serif">${cur.ps.length}</text><text y="18" text-anchor="middle" fill="var(--ink-3)" font-size="10" font-family="JetBrains Mono">FRAMES</text>`;
    $('#seaSvg').innerHTML = svg;
    $$('#seaSvg .sea-seg').forEach(g => {
      const d = months[+g.dataset.k];
      g.addEventListener('mousemove', e => { tip.textContent = `${d.m} · ${d.ps.length}장${d.color ? ' · 대표 색 ' + shadeKo(d.color) : ''}`; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; tip.classList.add('on'); });
      g.addEventListener('mouseleave', () => tip.classList.remove('on'));
      const pick = () => { if (!d.ps.length) return; sel = d.k; tip.classList.remove('on'); paint(); };
      g.addEventListener('click', pick); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    lists.season = cur.ps;
    $('#seaSide').innerHTML = `<div class="mono accent">${seasonOf(cur.k)} · ${year === 'all' ? '모든 해' : year}</div><h2>${MONTH_FULL[cur.k]}</h2>
      <div class="sub">${cur.ps.length}장을 찍었어요${cur.color ? ` · 가장 많이 나온 색은 ${shadeKo(cur.color)}` : ''}</div>
      <div class="chips">${cur.ranked.slice(0, 5).map(([c, n]) => `<span class="chip-c"><i style="--c:${shadeHex(c)}"></i>${shadeKo(c)} ${n}</span>`).join('')}</div>
      <div class="sea-thumbs" id="seaThumbs">${cur.ps.slice(0, 12).map((p, n) => card(p, { cap: false, d: n * 35 })).join('')}</div>
      ${cur.ps.length > 12 ? `<button class="pill" id="seaMore" style="margin-top:12px">${cur.ps.length}장 모두 크게 보기 →</button>` : ''}`;
    wireImages($('#seaSide')); observeReveal($('#seaSide'));
    const more = $('#seaMore'); if (more) more.onclick = () => Lightbox.open(cur.ps, 0);
    $('#seaTable').innerHTML = '<tr><th>달</th><th>사진 수</th><th>대표 색</th></tr>' + months.map(d => `<tr><td>${d.m}</td><td>${d.ps.length}</td><td>${d.color ? shadeKo(d.color) : '—'}</td></tr>`).join('');
  }
  bindPhotoClicks($('#seaSide', view), 'season');
  paint();
  requestAnimationFrame(() => syncSeg($('#seaYear')));
}

/* ============================================================
   관리 (스튜디오) — GitHub 저장소에 직접 저장해요
   ============================================================ */
const REPO = 'Helios0513/Photo_Archive.github.io';
const TOKEN_KEY = 'photoArchiveGithubToken';
const getToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } };
const setToken = t => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch (e) {} };
const b64encode = str => { const b = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const b64decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, '')), c => c.charCodeAt(0)));
async function gh(file, opt = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${file}`, {
    ...opt, cache: 'no-store',
    headers: { Authorization: `token ${getToken()}`, Accept: 'application/vnd.github+json', ...(opt.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (r.status === 404 && !opt.method) return null;
  if (r.status === 401) { setToken(''); Studio.authed = false; throw new Error('열쇠(토큰)가 맞지 않거나 만료됐어요. 다시 들어와 주세요.'); }
  if (!r.ok) { const e = await r.json().catch(() => ({})); const err = new Error(e.message || `GitHub 오류 ${r.status}`); err.status = r.status; throw err; }
  return r.json();
}
async function readJson(file) {
  const f = await gh(file); if (!f) return { sha: null, data: null };
  const text = f.content ? b64decode(f.content) : await (await fetch(f.download_url, { cache: 'no-store' })).text();
  return { sha: f.sha, data: JSON.parse(text) };
}
// 항상 GitHub의 최신 내용을 받아서 고친 뒤 저장해요 (다른 곳에서 바꾼 내용을 덮어쓰지 않게)
async function updateJson(file, mutate, message) {
  for (let attempt = 0; ; attempt++) {
    const { sha, data } = await readJson(file);
    const next = mutate(data);
    if (next === false) return data;
    try {
      await gh(file, { method: 'PUT', body: JSON.stringify({ message, content: b64encode(JSON.stringify(next, null, 2)), ...(sha ? { sha } : {}) }) });
      return next;
    } catch (e) { if (attempt >= 2 || ![409, 422].includes(e.status)) throw e; }
  }
}
const imagePath = name => 'images/digital/' + encodeURIComponent(name);
const thumbPath = name => 'images/thumbs/' + encodeURIComponent(name);
async function putImage(name, base64, thumb) { return gh((thumb ? thumbPath : imagePath)(name), { method: 'PUT', body: JSON.stringify({ message: `${thumb ? 'Thumbnail' : 'Upload'}: ${name}`, content: base64 }) }); }
async function deleteImage(name) {
  for (const path of [imagePath(name), thumbPath(name)]) {
    const f = await gh(path); if (!f) continue;
    await gh(path, { method: 'DELETE', body: JSON.stringify({ message: `Delete ${path}`, sha: f.sha }) });
  }
}
function optimizeImage(file, max = 1920, quality = 0.85) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      let w = im.naturalWidth, h = im.naturalHeight;
      const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(im, 0, 0, w, h); URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('사진 변환 실패')), 'image/jpeg', quality);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('사진을 읽지 못했어요')); };
    im.src = url;
  });
}
const blobToBase64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
// 저장 버튼 공통 처리: 저장 중 표시 → 성공/실패 알림
async function saving(btn, doneMsg, fn) {
  const label = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = '저장 중…'; }
  try { await fn(); toast(`${doneMsg} · 1~2분 뒤 홈페이지에 반영돼요`, 3800); return true; }
  catch (e) { console.error(e); toast('저장하지 못했어요: ' + e.message, 6000); if (!Studio.authed) render(); return false; }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
}
const sortPhotos = () => S.photos.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.filename.localeCompare(b.filename));

const Studio = { authed: !!getToken(), tab: 'upload', queue: [], dirty: new Map(), selected: new Set(), page: 1, filter: { q: '', month: 'all', color: 'all' }, fx: null, pj: null };

function renderStudio(view) {
  if (!Studio.authed) {
    view.innerHTML = `<section class="studio"><div class="gate"><form class="gate-box rv" id="gate" autocomplete="off">
      <div class="logo-mark is-logo">${logoSvg()}</div>
      <h1>Studio</h1>
      <p>사진을 올리고, 정보를 고치고, 대표작과 프로젝트를 정리하는 곳이에요.</p>
      <label class="field"><span>GitHub 열쇠 (토큰)</span><input type="password" id="gateToken" required placeholder="ghp_… 또는 github_pat_…"></label>
      <button class="btn block" id="gateBtn">들어가기 <span class="arrow">→</span></button>
      <p class="mono faint" style="margin-top:16px;text-transform:none;letter-spacing:0" id="gateMsg">열쇠는 이 브라우저 창을 닫으면 잊어버려요.</p>
    </form></div></section>`;
    $('#gate', view).addEventListener('submit', async e => {
      e.preventDefault();
      const t = $('#gateToken', view).value.trim(), msg = $('#gateMsg', view), btn = $('#gateBtn', view);
      btn.disabled = true; msg.textContent = '확인하는 중…';
      try {
        const r = await fetch(`https://api.github.com/repos/${REPO}`, { headers: { Authorization: `token ${t}` }, cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !(j.permissions && j.permissions.push)) throw new Error();
        setToken(t); Studio.authed = true; render();
      } catch (err) { btn.disabled = false; msg.textContent = '열쇠가 맞지 않거나, 이 저장소에 저장할 권한이 없어요.'; }
    });
    return;
  }
  const TABS = [['upload', '사진 올리기'], ['photos', '사진 관리'], ['featured', '대표작'], ['projects', '프로젝트'], ['works', '프린트 · 전시 · 달력'], ['settings', '사이트 문구']];
  view.innerHTML = `<section class="studio">
    <div class="st-head"><div><div class="mono accent" style="margin-bottom:10px">( Studio )</div><h1>Manage the archive</h1></div>
      <div style="display:flex;gap:14px;align-items:center"><span class="mono faint">${S.photos.length} photos · ${S.projects.length} projects</span><button class="pill" id="stLogout">나가기</button></div></div>
    <div class="st-tabs" id="stTabs">${TABS.map(([k, l]) => `<button data-t="${k}" class="${k === Studio.tab ? 'on' : ''}">${l}${k === 'upload' && Studio.queue.length ? `<i>${Studio.queue.length}</i>` : ''}${k === 'photos' && Studio.dirty.size ? `<i>${Studio.dirty.size}</i>` : ''}</button>`).join('')}</div>
    <div id="stBody"></div>
  </section>`;
  $('#stTabs', view).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Studio.tab = b.dataset.t; renderStudio(view); wireImages(view); observeReveal(view); });
  $('#stLogout', view).onclick = () => { setToken(''); Studio.authed = false; render(); };
  const body = $('#stBody', view);
  ({ upload: stUpload, photos: stPhotos, featured: stFeatured, projects: stProjects, works: stWorks, settings: stSettings })[Studio.tab](body, view);
}


/* 1) 사진 올리기 */
function stUpload(body, view) {
  body.innerHTML = `
    <label class="drop" id="drop"><input type="file" id="fileIn" accept="image/*" multiple>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 16V4M7 9l5-5 5 5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
      <b>사진을 여기로 끌어 놓으세요</b>
      <span>또는 눌러서 고르기 · 여러 장 한 번에 · 촬영 날짜·카메라·색을 자동으로 채워요 (위치 정보는 읽지 않아요)</span>
    </label>
    <div class="queue" id="queue"></div>
    <div class="st-actions" id="qActions" style="display:none">
      <span class="mono faint" id="qInfo"></span>
      <button class="btn ghost small" id="qClear">모두 비우기</button>
      <button class="btn" id="qGo">GitHub에 올리기 <span class="arrow">→</span></button>
    </div>`;
  const drop = $('#drop', body), q = $('#queue', body);
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); addFiles(e.dataTransfer.files); });
  $('#fileIn', body).addEventListener('change', e => addFiles(e.target.files));
  const paint = () => {
    q.innerHTML = Studio.queue.map((it, i) => `<div class="qitem ${it.done ? 'done' : ''}" data-i="${i}">
      <img src="${it.url}" alt="">
      <div><div class="qfields">
        <label class="field"><span>촬영 날짜</span><input type="date" data-k="date" value="${esc(it.date)}"></label>
        <label class="field"><span>카메라 · 설정</span><input data-k="info" value="${esc(it.info)}" placeholder="예: Nikon Z fc f2.8 1/250s iso 100"></label>
        <div class="field"><span>색 구성 (자동)</span>${it.palette ? paletteStrip(it, 'q-pal') : '<span class="mono faint">계산 중…</span>'}</div>
      </div><div class="qmeta mono">${esc(it.name)} · ${(it.size / 1048576).toFixed(1)}MB → 약 ${(Math.min(it.size, 900000) / 1048576).toFixed(1)}MB로 줄여서 올려요${it.reading ? ' · 정보 읽는 중…' : ''}</div></div>
      <div class="qside">${it.done ? '<span class="mono accent">올림 ✓</span>' : `<button class="link-danger" data-rm="${i}">빼기</button>`}</div>
      <div class="qbar" style="width:${it.progress || 0}%"></div>
    </div>`).join('');
    const pending = Studio.queue.filter(x => !x.done).length;
    $('#qActions', body).style.display = Studio.queue.length ? '' : 'none';
    $('#qInfo', body).textContent = `${pending}장 올릴 준비됨`;
    $('#qGo', body).disabled = !pending;
  };
  q.addEventListener('input', e => { const f = e.target.closest('[data-k]'); if (!f) return; Studio.queue[+f.closest('.qitem').dataset.i][f.dataset.k] = f.value; });
  q.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; Studio.queue.splice(+b.dataset.rm, 1); paint(); });
  $('#qClear', body).onclick = () => { Studio.queue = []; paint(); };
  $('#qGo', body).onclick = async () => {
    const items = Studio.queue.filter(x => !x.done && !x.reading);
    if (!items.length) return;
    const go = $('#qGo', body); go.disabled = true; go.textContent = '올리는 중…';
    const setBar = (it, p) => { it.progress = p; const bar = $(`.qitem[data-i="${Studio.queue.indexOf(it)}"] .qbar`, body); if (bar) bar.style.width = p + '%'; };
    const added = [], stamp = Date.now();
    try {
      for (const [k, it] of items.entries()) {
        setBar(it, 12);
        const blob = await optimizeImage(it.file); setBar(it, 45);
        const name = it.name.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') + '_' + stamp + '_' + k + '.jpg';
        await putImage(name, await blobToBase64(blob)); setBar(it, 75);
        await putImage(name, await blobToBase64(await optimizeImage(it.file, 900, 0.8)), true); setBar(it, 90);
        it.filename = name; added.push({ filename: name, info: it.info, date: it.date, color: it.color || 'gray', palette: it.palette, light: it.light });
      }
    } catch (e) { console.error(e); toast('올리는 중 문제가 생겼어요: ' + e.message, 6000); }
    if (added.length) {
      try {
        await updateJson('photos.json', data => {
          data = data || []; const have = new Set(data.map(p => p.filename));
          added.forEach(a => { if (!have.has(a.filename)) data.push(a); });
          return data;
        }, `Batch upload ${added.length} photos`);
        added.forEach(a => { const it = items.find(x => x.filename === a.filename); it.done = true; it.progress = 100; S.photos.push({ ...a, _local: it.url }); });
        sortPhotos(); reindex();
        toast(`${added.length}장을 올렸어요 · 1~2분 뒤 홈페이지에 나타나요`, 4200);
      } catch (e) { console.error(e); toast('사진 목록(photos.json)을 저장하지 못했어요: ' + e.message, 6000); }
    }
    paint();
    if (!Studio.authed) render();
  };
  async function addFiles(files) {
    for (const file of [...files].filter(f => f.type.startsWith('image/'))) {
      const it = { file, name: file.name, size: file.size, url: URL.createObjectURL(file), date: '', info: '', reading: true };
      Studio.queue.push(it); paint();
      try {
        if (!window.exifr) await loadScript(EXIFR_URL).catch(() => {});
        if (window.exifr) {
          const x = await exifr.parse(file); // GPS(위치)는 읽어도 쓰지 않아요
          if (x) {
            const d = x.DateTimeOriginal || x.CreateDate;
            if (d instanceof Date && !isNaN(d)) it.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const model = String(x.Model || '').trim(), make = String(x.Make || '').trim();
            const cam = model.toLowerCase().startsWith(make.toLowerCase().split(' ')[0]) ? model : `${make} ${model}`.trim();
            const sh = x.ExposureTime ? (x.ExposureTime < 1 ? `1/${Math.round(1 / x.ExposureTime)}s` : `${x.ExposureTime}s`) : '';
            it.info = [cam, x.FocalLength ? `${Math.round(x.FocalLength)}mm` : '', x.FNumber ? `f${x.FNumber}` : '', sh, x.ISO ? `iso ${x.ISO}` : ''].filter(Boolean).join(' ');
          }
        }
      } catch (e) {}
      if (!it.date) { const d = new Date(file.lastModified); it.date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
      Object.assign(it, await analyzeUrl(it.url));
      it.reading = false; paint();
    }
  }
  paint();
}
/* 2) 사진 관리 */
function stPhotos(body, view) {
  const f = Studio.filter, PER = 48;
  const months = [...new Set(S.photos.map(p => monthKey(p.date)).filter(Boolean))];
  const list = S.photos.filter(p => {
    const e = Studio.dirty.get(p.filename) || {};
    const blob = [p.filename, e.date ?? p.date, e.info ?? p.info, ...paletteOf(p).map(([k]) => shadeKo(k)), e.story ?? p.story ?? ''].join(' ').toLowerCase();
    return (!f.q || blob.includes(f.q.toLowerCase())) && (f.month === 'all' || (p.date || '').startsWith(f.month)) && (f.color === 'all' || familyShare(p, f.color) >= minShare(f.color));
  });
  const shown = list.slice(0, Studio.page * PER);
  body.innerHTML = `
    <div class="toolbar" style="position:static;margin:0 0 18px;padding:0">
      <input class="cons-search" id="mq" style="max-width:280px" placeholder="파일 이름, 날짜, 카메라로 찾기" value="${esc(f.q)}">
      <span class="select"><select id="mm"><option value="all">전체 기간</option>${months.map(m => `<option value="${m}" ${m === f.month ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select></span>
      <span class="select"><select id="mc"><option value="all">모든 색</option>${FAMILIES.map(([c, ko]) => `<option value="${c}" ${c === f.color ? 'selected' : ''}>${ko}</option>`).join('')}</select></span>
      <span class="spacer"></span>
      <span class="mono faint">${list.length}장${Studio.selected.size ? ` · ${Studio.selected.size}장 선택` : ''}</span>
      ${Studio.selected.size ? `<button class="pill" id="mSelClear">선택 해제</button><button class="pill" id="mDel" style="color:#ff6b5a">선택 삭제</button>` : ''}
      <button class="btn small" id="mSave" ${Studio.dirty.size ? '' : 'disabled'}>변경 사항 저장${Studio.dirty.size ? ` (${Studio.dirty.size})` : ''}</button>
    </div>
    <div class="mgr-grid" id="mgr">${shown.map(p => {
      const e = Studio.dirty.get(p.filename) || {};
      return `<div class="mcard ${Studio.dirty.has(p.filename) ? 'dirty' : ''} ${Studio.selected.has(p.filename) ? 'sel' : ''}" data-f="${esc(p.filename)}">
        <button class="mcheck" data-act="sel">${Studio.selected.has(p.filename) ? '✓' : ''}</button>
        <img src="${esc(thumbUrl(p))}" loading="lazy" alt="" data-act="view">
        <div class="mbody">
          <div class="mrow"><input type="date" data-k="date" value="${esc(e.date ?? p.date ?? '')}">${paletteStrip(p, 'm-pal')}</div>
          <input data-k="info" value="${esc(e.info ?? p.info ?? '')}" placeholder="카메라 · 설정">
          <textarea data-k="story" rows="2" placeholder="이 사진의 이야기 (선택)">${esc(e.story ?? p.story ?? '')}</textarea>
          <div class="mfoot"><span class="mono faint">${p._n}</span><button class="link-danger" data-act="del">삭제</button></div>
        </div></div>`;
    }).join('')}</div>
    ${shown.length < list.length ? `<div style="text-align:center;margin-top:24px"><button class="btn ghost" id="mMore">더 보기 (${list.length - shown.length}장 남음)</button></div>` : ''}`;
  const rerender = () => { renderStudio(view); };
  $('#mq', body).addEventListener('input', e => { f.q = e.target.value; Studio.page = 1; clearTimeout(stPhotos._t); stPhotos._t = setTimeout(() => { rerender(); const i = $('#mq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); });
  $('#mm', body).onchange = e => { f.month = e.target.value; Studio.page = 1; rerender(); };
  $('#mc', body).onchange = e => { f.color = e.target.value; Studio.page = 1; rerender(); };
  const more = $('#mMore', body); if (more) more.onclick = () => { Studio.page++; rerender(); };
  const mgr = $('#mgr', body);
  mgr.addEventListener('change', e => {
    const k = e.target.dataset.k; if (!k) return;
    const fn = e.target.closest('.mcard').dataset.f, p = S.byName.get(fn);
    const cur = Studio.dirty.get(fn) || {}; cur[k] = e.target.value;
    if (Object.keys(cur).every(key => cur[key] === (p[key] || ''))) Studio.dirty.delete(fn); else Studio.dirty.set(fn, cur);
    e.target.closest('.mcard').classList.toggle('dirty', Studio.dirty.has(fn));
    const btn = $('#mSave', body); btn.disabled = !Studio.dirty.size; btn.textContent = `변경 사항 저장${Studio.dirty.size ? ` (${Studio.dirty.size})` : ''}`;
  });
  mgr.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    const fn = a.closest('.mcard').dataset.f;
    if (a.dataset.act === 'sel') { Studio.selected.has(fn) ? Studio.selected.delete(fn) : Studio.selected.add(fn); rerender(); }
    if (a.dataset.act === 'view') Lightbox.open(list, list.findIndex(p => p.filename === fn), a);
    if (a.dataset.act === 'del' && confirm('이 사진을 홈페이지에서 완전히 삭제할까요?')) saving(null, '사진을 삭제했어요', () => removePhotos([fn])).then(rerender);
  });
  const del = $('#mDel', body); if (del) del.onclick = () => { if (confirm(`${Studio.selected.size}장을 홈페이지에서 완전히 삭제할까요?`)) saving(del, `${Studio.selected.size}장을 삭제했어요`, () => removePhotos([...Studio.selected])).then(ok => { if (ok) Studio.selected.clear(); rerender(); }); };
  const sc = $('#mSelClear', body); if (sc) sc.onclick = () => { Studio.selected.clear(); rerender(); };
  $('#mSave', body).onclick = () => {
    const changes = new Map(Studio.dirty);
    saving($('#mSave', body), `${changes.size}장의 정보를 고쳤어요`, async () => {
      await updateJson('photos.json', data => { (data || []).forEach(p => { const c = changes.get(p.filename); if (c) Object.assign(p, c); }); return data || []; }, `Update info for ${changes.size} photos`);
      changes.forEach((ch, fn) => { const p = S.byName.get(fn); if (p) Object.assign(p, ch); Studio.dirty.delete(fn); });
      sortPhotos(); reindex();
    }).then(rerender);
  };
}
async function removePhotos(names) {
  const set = new Set(names);
  await updateJson('photos.json', data => (data || []).filter(p => !set.has(p.filename)), names.length === 1 ? `Delete ${names[0]}` : `Delete ${names.length} photos`);
  for (const n of names) { try { await deleteImage(n); } catch (e) { console.warn('사진 파일 삭제 실패', n, e); } }
  await updateJson('site.json', d => {
    d = d || {}; const before = (d.featuredPhotos || []).length;
    d.featuredPhotos = (d.featuredPhotos || []).filter(f => !set.has(f));
    return d.featuredPhotos.length === before ? false : d;
  }, 'Remove deleted photos from featured');
  await updateJson('projects.json', d => {
    let changed = false;
    (d || []).forEach(pr => {
      const before = (pr.photos || []).length; pr.photos = (pr.photos || []).filter(f => !set.has(f));
      if (pr.photos.length !== before) changed = true;
      if (set.has(pr.cover)) { pr.cover = pr.photos[0] || ''; changed = true; }
    });
    return changed ? d : false;
  }, 'Remove deleted photos from projects');
  S.photos = S.photos.filter(p => !set.has(p.filename));
  S.site.featuredPhotos = (S.site.featuredPhotos || []).filter(f => !set.has(f));
  S.projects.forEach(pr => { pr.photos = (pr.photos || []).filter(f => !set.has(f)); if (set.has(pr.cover)) pr.cover = pr.photos[0] || ''; });
  names.forEach(n => Studio.dirty.delete(n));
  reindex();
}

/* 사진 고르기 + 순서 정하기 (대표작·프로젝트 공용) */
function photoPicker(container, state, opt = {}) {
  const months = [...new Set(S.photos.map(p => monthKey(p.date)).filter(Boolean))];
  let month = 'all';
  container.innerHTML = `
    <div class="fx-cols">
      <div class="fx-box"><h3>${opt.leftTitle}</h3><p>${opt.leftHint}</p><div class="fx-list" id="fxList"></div></div>
      <div class="fx-box"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px"><h3 style="margin:0">사진 고르기</h3>
        <span class="select"><select id="fxMonth"><option value="all">전체 기간</option>${months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('')}</select></span></div>
        <div class="pick-grid" id="fxPick"></div></div>
    </div>`;
  const listEl = $('#fxList', container), pick = $('#fxPick', container);
  const paintList = () => {
    listEl.innerHTML = state.list.map((f, i) => { const p = S.byName.get(f); if (!p) return ''; return `<div class="fx-item" draggable="true" data-i="${i}">
      <span class="n mono">${pad(i + 1)}</span><img src="${esc(thumbUrl(p))}" alt=""><span><span class="mono">${fmtDate(p.date)}</span>${opt.cover ? `<br><button class="mono ${state.cover === f ? 'accent' : 'faint'}" data-cover="${esc(f)}">${state.cover === f ? '★ 표지' : '☆ 표지로'}</button>` : ''}</span>
      <span class="ctl"><button data-mv="-1" title="위로">↑</button><button data-mv="1" title="아래로">↓</button><button data-rm title="빼기">✕</button></span></div>`; }).join('') || `<div class="empty" style="padding:30px 0">오른쪽에서 사진을 눌러 추가하세요.</div>`;
  };
  const paintPick = () => {
    const ps = S.photos.filter(p => month === 'all' || (p.date || '').startsWith(month));
    pick.innerHTML = ps.map(p => { const n = state.list.indexOf(p.filename); return `<div class="pick ${n >= 0 ? 'on' : ''}" data-f="${esc(p.filename)}" data-n="${n + 1}">${opt.cover && state.cover === p.filename ? '<span class="cover-tag">표지</span>' : ''}<img src="${esc(thumbUrl(p))}" loading="lazy" alt=""></div>`; }).join('');
  };
  const changed = () => { paintList(); paintPick(); opt.onChange && opt.onChange(); };
  $('#fxMonth', container).onchange = e => { month = e.target.value; paintPick(); };
  pick.addEventListener('click', e => {
    const t = e.target.closest('.pick'); if (!t) return;
    const f = t.dataset.f, i = state.list.indexOf(f);
    if (i >= 0) state.list.splice(i, 1); else { if (opt.max && state.list.length >= opt.max) return toast(`최대 ${opt.max}장까지 고를 수 있어요`); state.list.push(f); }
    if (opt.cover && !state.list.includes(state.cover)) state.cover = state.list[0] || '';
    changed();
  });
  listEl.addEventListener('click', e => {
    const it = e.target.closest('.fx-item'); if (!it) return; const i = +it.dataset.i;
    const mv = e.target.closest('[data-mv]'), rm = e.target.closest('[data-rm]'), cv = e.target.closest('[data-cover]');
    if (mv) { const j = i + +mv.dataset.mv; if (j < 0 || j >= state.list.length) return; [state.list[i], state.list[j]] = [state.list[j], state.list[i]]; }
    else if (rm) { state.list.splice(i, 1); if (opt.cover && state.cover && !state.list.includes(state.cover)) state.cover = state.list[0] || ''; }
    else if (cv) state.cover = cv.dataset.cover;
    else return;
    changed();
  });
  let dragI = null;
  listEl.addEventListener('dragstart', e => { const it = e.target.closest('.fx-item'); if (!it) return; dragI = +it.dataset.i; it.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  listEl.addEventListener('dragover', e => { e.preventDefault(); });
  listEl.addEventListener('drop', e => {
    e.preventDefault(); const it = e.target.closest('.fx-item'); if (dragI == null || !it) return;
    const to = +it.dataset.i; const [m] = state.list.splice(dragI, 1); state.list.splice(to, 0, m); dragI = null; changed();
  });
  listEl.addEventListener('dragend', () => { dragI = null; $$('.dragging', listEl).forEach(x => x.classList.remove('dragging')); });
  paintList(); paintPick();
}

/* 3) 대표작 */
function stFeatured(body) {
  if (!Studio.fx) Studio.fx = { list: [...(S.site.featuredPhotos || [])].filter(f => S.byName.has(f)) };
  body.innerHTML = `<div id="fxWrap"></div><div class="st-actions"><span class="mono faint" id="fxCount"></span><button class="btn ghost small" id="fxReset">처음 상태로</button><button class="btn" id="fxSave">대표작 저장</button></div>`;
  const upd = () => { $('#fxCount', body).textContent = `${Studio.fx.list.length}장 선택 · 홈 첫 화면과 Selected Works에 이 순서대로 나와요`; };
  photoPicker($('#fxWrap', body), Studio.fx, { leftTitle: 'Selected Works', leftHint: '끌어서 순서를 바꾸거나 ↑↓ 버튼을 쓰세요.', max: 12, onChange: upd });
  upd();
  $('#fxReset', body).onclick = () => { Studio.fx = null; stFeatured(body); wireImages(body); };
  $('#fxSave', body).onclick = () => {
    const list = [...Studio.fx.list];
    saving($('#fxSave', body), '대표작을 저장했어요', async () => {
      await updateJson('site.json', d => ({ ...(d || {}), featuredPhotos: list }), 'Update featured photos');
      S.site.featuredPhotos = list;
    });
  };
}

/* 4) 프로젝트 */
const pjDraft = () => store.get('hm-pj-draft', null);
function stProjects(body) {
  const paint = () => {
    const cur = Studio.pj;
    body.innerHTML = `<div class="fx-cols" style="grid-template-columns:minmax(0,.7fr) minmax(0,2fr)">
      <div class="fx-box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">Projects</h3><button class="btn small" id="pjNew">+ 새 프로젝트</button></div>
        <div class="pj-list">${S.projects.map((pr, i) => { const c = projectCover(pr); return `<button class="pj-item ${cur && cur.origId === pr.id ? 'on' : ''}" data-i="${i}">${c ? `<img src="${esc(thumbUrl(c))}" alt="">` : '<span></span>'}<span><b>${esc(pr.title || '(제목 없음)')}</b><span class="mono faint">${(pr.photos || []).length} frames</span></span><span>→</span></button>`; }).join('') || '<div class="empty">아직 없어요</div>'}</div></div>
      <div>${cur ? `
        <div class="fx-box" style="margin-bottom:16px"><div class="settings-form" style="max-width:none">
          <label class="field"><span>제목</span><input id="pjTitle" value="${esc(cur.title)}"></label>
          <label class="field"><span>부제목 (예: April 2026)</span><input id="pjSub" value="${esc(cur.subtitle)}"></label>
          <label class="field wide"><span>소개 글</span><textarea id="pjDesc" style="min-height:90px">${esc(cur.description)}</textarea></label>
        </div></div>
        <div id="pjPicker"></div>
        <div class="st-actions">${Drafts.tag('series')}${cur.origId ? '<button class="link-danger" id="pjDel" style="margin-right:auto">이 프로젝트 삭제</button>' : ''}<button class="btn ghost small" id="pjCancel">닫기</button><button class="btn" id="pjSave">프로젝트 저장</button></div>`
        : (pjDraft() ? `<div class="fx-box draft-bar"><span>임시저장된 시리즈 <b>「${esc(pjDraft().title || '제목 없음')}」</b>${pjDraft().origId ? ' (고치던 중)' : ' (새로 만들던 중)'}</span><button class="btn small" id="pjResume">이어서 하기</button><button class="pc-link" id="pjDrop">지우기</button></div>` : '') + '<div class="empty fx-box">왼쪽에서 프로젝트를 고르거나 새로 만드세요.</div>'}</div>
    </div>`;
    wireImages(body);
    // 고칠 때마다 임시저장 (사진 고르기·순서 바꾸기도)
    if (!body._draftHook) { body._draftHook = true; ['input', 'click'].forEach(t => body.addEventListener(t, () => setTimeout(() => { if (Studio.pj && body.isConnected) { store.set('hm-pj-draft', Studio.pj); Drafts.touch('series'); } }))); }
    if ($('#pjResume', body)) $('#pjResume', body).onclick = () => { const d = pjDraft(); Studio.pj = { ...d, list: (d.list || []).filter(f => S.byName.has(f)) }; paint(); };
    if ($('#pjDrop', body)) $('#pjDrop', body).onclick = () => { if (!confirm('임시저장된 시리즈를 지울까요?')) return; Drafts.clear('series'); paint(); };
    $('#pjNew', body).onclick = () => { Studio.pj = { origId: null, title: '', subtitle: '', description: '', list: [], cover: '' }; paint(); };
    $$('.pj-item', body).forEach(b => b.onclick = () => { const pr = S.projects[+b.dataset.i]; Studio.pj = { origId: pr.id, title: pr.title || '', subtitle: pr.subtitle || '', description: pr.description || '', list: (pr.photos || []).filter(f => S.byName.has(f)), cover: pr.cover }; paint(); });
    if (!cur) return;
    photoPicker($('#pjPicker', body), cur, { leftTitle: '프로젝트 사진', leftHint: '순서대로 보여요. ☆를 눌러 표지를 정하세요.', cover: true });
    ['Title', 'Sub', 'Desc'].forEach(k => $('#pj' + k, body).addEventListener('input', e => { cur[{ Title: 'title', Sub: 'subtitle', Desc: 'description' }[k]] = e.target.value; }));
    $('#pjCancel', body).onclick = () => { Studio.pj = null; paint(); };
    $('#pjSave', body).onclick = () => {
      if (!cur.title.trim()) return toast('제목을 적어주세요');
      if (!cur.list.length) return toast('사진을 한 장 이상 골라주세요');
      const now = new Date().toISOString();
      const data = { title: cur.title.trim(), subtitle: cur.subtitle.trim(), description: cur.description.trim(), photos: [...cur.list], cover: cur.cover || cur.list[0], updatedAt: now };
      const id = cur.origId || (data.title.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '') || 'project') + '-' + Date.now();
      saving($('#pjSave', body), '프로젝트를 저장했어요', async () => {
        await updateJson('projects.json', arr => {
          arr = arr || []; const i = arr.findIndex(p => p.id === id);
          if (i >= 0) Object.assign(arr[i], data); else arr.unshift({ id, ...data, createdAt: now });
          return arr;
        }, `Save project: ${data.title}`);
        const local = S.projects.find(p => p.id === id);
        if (local) Object.assign(local, data); else S.projects.unshift({ id, ...data, createdAt: now });
        cur.origId = id; reindex(); Drafts.clear('series');
      }).then(paint);
    };
    const del = $('#pjDel', body); if (del) del.onclick = () => {
      if (!confirm('이 프로젝트를 삭제할까요? 사진은 지워지지 않아요.')) return;
      const id = cur.origId;
      saving(del, '프로젝트를 삭제했어요', async () => {
        await updateJson('projects.json', arr => (arr || []).filter(p => p.id !== id), 'Delete project');
        S.projects = S.projects.filter(p => p.id !== id); Studio.pj = null; reindex(); Drafts.clear('series');
      }).then(paint);
    };
  };
  paint();
}

/* 5) 프린트 · 전시 · 달력: 제목 고치기, 다시 편집, 삭제 */
function stWorks(body) {
  const posters = [...(S.posters || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const exs = [...(S.exhibitions || [])].sort((a, b) => (b.from || '').localeCompare(a.from || ''));
  const cals = [...(S.calendars || [])].sort((a, b) => (+b.year - +a.year) || (b.date || '').localeCompare(a.date || ''));
  const row = (kind, i, img, main, meta, extra = '') => `<div class="wk-row" data-kind="${kind}" data-i="${i}">
      <div class="wk-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}</div>
      <div class="wk-main">${main}<span class="mono faint">${meta}</span></div>
      <div class="wk-act">${extra}<button class="link-danger" data-act="del">삭제</button></div></div>`;
  const titleIn = v => `<input class="wk-title" maxlength="80" value="${esc(v || '')}" placeholder="제목 없음" aria-label="제목">`;
  const sec = (h, n, list, sub) => `<div class="fx-box wk-sec"><h3>${h} <span class="mono faint">${n}</span></h3><p class="faint wk-sub">${sub}</p>${list || '<div class="empty">아직 없어요</div>'}</div>`;
  body.innerHTML = sec('Prints', posters.length, posters.map((p, i) => row('poster', i, p._local || S.posterBase + p.file, titleIn(p.title), esc(fmtDate(p.date)), '<button class="btn small ghost" data-act="save">제목 저장</button>')).join(''), '제목을 고치거나 지울 수 있어요. 그림 자체를 바꾸려면 엽서 창에서 새로 만들어 올려 주세요.')
    + sec('Exhibitions', exs.length, exs.map((ex, i) => { const c = exCover(ex); return row('ex', i, c && thumbUrl(c), `<b>${esc(ex.title)}</b>`, `${esc(exPeriod(ex))} · ${exWorks(ex).length}점`, `<a class="btn small ghost" href="#/exhibitions/${encodeURIComponent(ex.id)}/edit">수정</a>`); }).join(''), '수정을 누르면 기획 화면에서 글 · 방 · 작품을 고칠 수 있어요. 삭제해도 사진은 지워지지 않아요.')
    + sec('Calendars', cals.length, cals.map((c, i) => row('cal', i, calSrc(c, c.pages[0]), titleIn(c.title), `${esc(c.year)} · ${c.pages.length}쪽`, `<button class="btn small ghost" data-act="save">제목 저장</button>${c.recipe ? '<button class="btn small ghost" data-act="edit">다시 편집</button>' : ''}`)).join(''), '다시 편집: 만들기 화면에서 고친 뒤 올리면 원래 달력이 새 버전으로 바뀌어요.');
  wireImages(body);
  const run = async (btn, msg, fn) => {
    const h = btn.innerHTML; btn.disabled = true; btn.textContent = '저장 중…';
    try { await fn(); toast(msg + ' · 1~2분 뒤 홈페이지에 반영돼요', 3800); stWorks(body); }
    catch (err) { console.error(err); toast('저장하지 못했어요: ' + err.message, 6000); if (btn.isConnected) { btn.disabled = false; btn.innerHTML = h; } }
  };
  body.onclick = e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const r = b.closest('.wk-row'), kind = r.dataset.kind, item = (kind === 'poster' ? posters : kind === 'ex' ? exs : cals)[+r.dataset.i];
    const t = $('.wk-title', r), tv = t ? t.value.trim() : '';
    if (b.dataset.act === 'save') return run(b, '제목을 고쳤어요', () => kind === 'poster' ? updatePoster(item, { title: tv }) : updateCalendar(item, { title: tv, ...(item.recipe ? { recipe: { ...item.recipe, title: tv } } : {}) }));
    if (b.dataset.act === 'edit') {
      if (!confirm('이 달력을 만들기 화면으로 불러올까요? 지금 만들던 달력이 있다면 바뀌어요.')) return;
      store.set('hm-cal-draft', calFix(JSON.parse(JSON.stringify(item.recipe)))); store.set('hm-cal-edit', item.id); location.hash = '#/calendars/new'; return;
    }
    if (b.dataset.act === 'del') {
      const what = { poster: '이 프린트를', ex: '이 전시를', cal: '이 달력을' }[kind];
      if (!confirm(`${what} 삭제할까요? 되돌릴 수 없어요.${kind === 'ex' ? ' (사진은 지워지지 않아요)' : ''}`)) return;
      run(b, '삭제했어요', () => kind === 'poster' ? deletePoster(item) : kind === 'ex' ? unpublishExhibition(item.id) : deleteCalendar(item));
    }
  };
}

/* 6) 사이트 문구 */
function stSettings(body) {
  const F = [
    ['h', '이름'], ['brandName', '사이트 이름'], ['brandSubtitle', '이름 아래 작은 글씨'],
    ['h', '첫 화면'], ['archiveKicker', '맨 위 작은 문구'], ['heroCredit', '사진가 표기'], ['heroPrefix', '큰 제목 앞부분'], ['heroEmphasis', '큰 제목 기울임 부분'], ['heroNote', '짧은 소개 (줄바꿈 가능)', 'wide', 'area'],
    ['galleryTitle', '사진 목록 제목'], ['featuredTitle', '대표작 제목'], ['featuredDescription', '대표작 설명', 'wide'],
    ['h', '작가 소개'], ['aboutKicker', '작은 머리말'], ['aboutTitle', '이름'], ['aboutRole', '역할'], ['aboutIntro', '한 줄 소개'], ['aboutBody', '본문', 'wide', 'area'], ['aboutSignoff', '마무리 문장'],
    ['h', '바닥글'], ['footerCopyright', '저작권 문구', 'wide'],
  ];
  const draft = { ...S.site };
  body.innerHTML = `<form class="settings-form" id="setForm">${F.map(([k, l, w, t]) => k === 'h' ? `<h4>${l}</h4>` : `<label class="field ${w || ''}"><span>${l}</span>${t === 'area' ? `<textarea data-k="${k}" style="min-height:100px">${esc(draft[k] || '')}</textarea>` : `<input data-k="${k}" value="${esc(draft[k] || '')}">`}</label>`).join('')}</form>
    <div class="st-actions"><span class="mono faint">저장하면 홈·작가 소개에 바로 반영돼요</span><button class="btn" id="setSave">문구 저장</button></div>`;
  $('#setForm', body).addEventListener('input', e => { const k = e.target.dataset.k; if (k) draft[k] = e.target.value; });
  $('#setSave', body).onclick = () => {
    const patch = Object.fromEntries(F.filter(([k]) => k !== 'h').map(([k]) => [k, draft[k] ?? '']));
    saving($('#setSave', body), '사이트 문구를 저장했어요', async () => {
      await updateJson('site.json', d => ({ ...(d || {}), ...patch }), 'Update site text');
      Object.assign(S.site, patch); applyBrand();
    });
  };
}

/* ---------- 임시저장: 종류마다 하나 ----------
   고칠 때마다 이 기기에 바로 저장하고, 관리자로 들어와 있으면 잠시 뒤 GitHub에도 저장해요.
   다른 기기에서 관리자로 들어오면 더 최근 것을 불러와요 */
const Drafts = {
  KEYS: { cal: ['hm-cal-draft', 'hm-cal-edit'], ex: ['hm-ex-draft'], series: ['hm-pj-draft'], print: ['hm-pc-draft'] },
  NAME: { cal: '달력', ex: '전시', series: '시리즈', print: '엽서' },
  timers: {}, pulled: null,
  touch(kind) {
    store.set('hm-draft-at-' + kind, Date.now());
    if (!Studio.authed) return this.say(kind, '이 기기에 임시저장됨');
    clearTimeout(this.timers[kind]); this.timers[kind] = setTimeout(() => this.push(kind), 8000);
    this.say(kind, '이 기기에 임시저장됨 · 곧 GitHub에도 저장해요');
  },
  async push(kind) {
    clearTimeout(this.timers[kind]); delete this.timers[kind];
    if (!Studio.authed) return;
    await this.pull();
    const data = Object.fromEntries(this.KEYS[kind].map(k => [k, store.get(k, null)]));
    const entry = { at: store.get('hm-draft-at-' + kind, Date.now()), data: this.KEYS[kind].every(k => data[k] == null) ? null : data };
    this.say(kind, 'GitHub에 임시저장 중…');
    try { await saveDraftRemote(kind, entry); const d = new Date(); this.say(kind, `GitHub에 임시저장됨 · ${pad(d.getHours())}:${pad(d.getMinutes())}`); }
    catch (e) { console.warn(e); this.say(kind, 'GitHub 임시저장 실패 · 이 기기에는 저장돼 있어요'); }
  },
  clear(kind) { this.KEYS[kind].forEach(k => store.set(k, null)); this.touch(kind); },
  flush() { Object.keys(this.timers).forEach(k => this.push(k)); },
  // GitHub에 있는 것이 이 기기 것보다 최근이면 가져와요 (한 번만). 가져온 종류 목록을 돌려줘요
  pull() {
    if (!Studio.authed) return Promise.resolve([]);
    return this.pulled || (this.pulled = loadDraftsRemote().then(all => {
      const got = [];
      Object.entries(all || {}).forEach(([kind, r]) => {
        if (!this.KEYS[kind] || !r || (r.at || 0) <= store.get('hm-draft-at-' + kind, 0)) return;
        this.KEYS[kind].forEach(k => store.set(k, r.data ? r.data[k] ?? null : null));
        store.set('hm-draft-at-' + kind, r.at);
        if (r.data) got.push(kind);
      });
      return got;
    }).catch(e => { console.warn(e); this.pulled = null; return []; }));
  },
  say(kind, t) { $$(`[data-draft="${kind}"]`).forEach(el => { el.textContent = t; }); },
  tag(kind) { return `<span class="faint draft-st" data-draft="${kind}">${Studio.authed ? '임시저장: 고치면 자동으로 GitHub에 저장돼요' : '임시저장: 고치면 이 기기에 자동으로 저장돼요'}</span>`; },
};
addEventListener('pagehide', () => Drafts.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) Drafts.flush(); });

/* ============================================================
   공통: 커서, 테마, 복사, 시작
   ============================================================ */
const shareLink = hash => location.href.split('#')[0] + hash;
function copyText(text, msg) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(msg)).catch(() => {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast(msg); } catch (e) { toast('복사하지 못했어요'); } ta.remove();
  });
}
function setupCursor() {
  if (isTouch || reduced) return;
  const c = $('#cursor'); let x = -100, y = -100, tx = -100, ty = -100;
  addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
  (function loop() { x += (tx - x) * 0.2; y += (ty - y) * 0.2; c.style.left = x + 'px'; c.style.top = y + 'px'; requestAnimationFrame(loop); })();
  document.addEventListener('mouseover', e => {
    if (Lightbox.isOpen) return c.classList.remove('on');
    const el = e.target.closest('#view .ph, #view .prow, .hero-slide, #view .pd-hero img');
    const inStudio = document.body.dataset.route === 'studio';
    c.textContent = e.target.closest('.prow') ? 'Open' : 'View';
    c.classList.toggle('on', !!el && !inStudio && !e.target.closest('.hero-inner .hero-bars'));
  });
}
function applyBrand() {
  $('#brandMark').innerHTML = logoSvg();
  $('#brandName').textContent = S.site.brandName || 'Hamihamoo';
  $('#brandSub').textContent = S.site.brandSubtitle || 'PHOTOGRAPHY';
  document.title = `${S.site.brandName || 'Hamihamoo'} — Photographs`;
}
function setupChrome() {
  $('#themeBtn').onclick = () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    const flip = () => { document.documentElement.dataset.theme = next; dispatchEvent(new Event('themechange')); };
    if (document.startViewTransition && !reduced) {
      const r = $('#themeBtn').getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      document.documentElement.classList.add('theme-vt');
      const vt = document.startViewTransition(flip); vt.ready.catch(() => {});
      vt.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] }, { duration: 750, easing: 'cubic-bezier(.77,0,.18,1)', pseudoElement: '::view-transition-new(root)' }));
      vt.finished.finally(() => document.documentElement.classList.remove('theme-vt'));
    } else flip();
    try { localStorage.setItem('hm-theme', next); } catch (e) {}
    $('meta[name="theme-color"]').content = next === 'light' ? '#f3f0e9' : '#0e0e0d';
  };
  $('#aboutBtn').onclick = openDrawer;
  $('#drawerClose').onclick = closeDrawer;
  $('#drawerBack').onclick = closeDrawer;
}

(async function start() {
  setupChrome(); setupCursor();
  await loadData();
  applyBrand();
  render();
  setTimeout(initSocial, 600);
  const want = new URL(location.href).searchParams.get('photo');
  if (want) { const i = S.photos.findIndex(p => p.filename === want); if (i >= 0) setTimeout(() => Lightbox.open(S.photos, i), 300); }
})();
