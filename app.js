/* ============================================================
   Hamihamoo — "Darkroom" (한 페이지 앱)
   - photos.json / projects.json / site.json / profile.json 을 읽어 화면을 그려요.
   - 관리(Studio)에서 고친 내용은 GitHub 저장소에 바로 저장돼요.
   - 위치·지도 관련 기능은 없어요.
   ============================================================ */

const DATA_BASE = './';
const IMG_BASE = 'images/digital/';

const COLOR_ORDER = ['Black', 'White', 'Gray', 'Brown', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink'];
const COLOR_HEX = { Black: '#202020', White: '#f4f2ec', Gray: '#a7a7a1', Brown: '#8b684f', Red: '#bf463e', Orange: '#d8843c', Yellow: '#d9b440', Green: '#5f8a4f', Blue: '#4a73a8', Purple: '#7c5ca3', Pink: '#d98aa6' };
const COLOR_KO = { Black: '검정', White: '흰색', Gray: '회색', Brown: '갈색', Red: '빨강', Orange: '주황', Yellow: '노랑', Green: '초록', Blue: '파랑', Purple: '보라', Pink: '분홍' };
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
  const [photos, projects, site, profile] = await Promise.all([
    loadJson('photos.json', []), loadJson('projects.json', []), loadJson('site.json', {}), loadJson('profile.json', {}),
  ]);
  S.site = site; S.profile = profile; S.projects = projects;
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
  const go = () => {
    pageCleanup.forEach(f => { try { f(); } catch (e) {} });
    pageCleanup = []; pageScroll = [];
    const view = $('#view');
    view.innerHTML = '';
    document.body.dataset.route = r.name;
    scrollTo(0, 0);
    r.fn(view, ...r.args);
    wireImages(view); observeReveal(view);
    setDock(r.name);
    onScroll();
  };
  if (firstRender || reduced || document.hidden) { firstRender = false; go(); return; }
  if (document.startViewTransition && !document.hidden) { const vt = document.startViewTransition(go); vt.ready.catch(() => {}); vt.finished.catch(() => {}); }
  else {
    const c = $('#curtain');
    c.animate([{ transform: 'scaleY(0)', transformOrigin: 'bottom' }, { transform: 'scaleY(1)', transformOrigin: 'bottom' }], { duration: 380, easing: 'cubic-bezier(.77,0,.18,1)', fill: 'forwards' }).onfinish = () => {
      go();
      c.animate([{ transform: 'scaleY(1)', transformOrigin: 'top' }, { transform: 'scaleY(0)', transformOrigin: 'top' }], { duration: 480, easing: 'cubic-bezier(.77,0,.18,1)', fill: 'forwards' });
    };
  }
}
addEventListener('hashchange', () => { if (Lightbox.isOpen) Lightbox.close(true); closeDrawer(); render(); });

function setDock(name) {
  const dock = $('#dock');
  $$('a', dock).forEach(a => a.classList.toggle('active', a.dataset.route === name));
  const a = $('a.active', dock), ind = $('#dockInd');
  if (!a) { ind.style.width = '0px'; return; }
  ind.style.width = a.offsetWidth + 'px';
  ind.style.transform = `translateX(${a.offsetLeft}px)`;
  if (dock.scrollWidth > dock.clientWidth) dock.scrollTo({ left: a.offsetLeft - dock.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' });
}
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
    ${heroList.map((p, i) => `<div class="hero-slide ${i === 0 ? 'on' : ''}" data-f="${esc(p.filename)}"><img src="${esc(imgUrl(p))}" alt="" ${i > 1 ? 'loading="lazy"' : ''}></div>`).join('')}
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
  const DUR = 6000;
  const show = i => {
    slides[cur].classList.remove('on');
    cur = (i + slides.length) % slides.length;
    slides[cur].classList.add('on');
    const img = $('img', slides[cur]); img.style.animation = 'none'; void img.offsetWidth; img.style.animation = '';
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
  pageCleanup.push(() => clearTimeout(timer));

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
  $('#randomBtn', view).addEventListener('click', () => { const l = archiveList(); if (l.length) Lightbox.open(l, Math.floor(Math.random() * l.length)); });
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
    gh.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.85)' }], { duration: 380, easing: 'ease', fill: 'forwards' }).onfinish = () => gh.remove();
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
          el.animate([{ transformOrigin: '0 0', transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` }, { transformOrigin: '0 0', transform: 'none' }], { duration: 760, easing: EASE });
      } else if (onScreen(now)) {
        // 새로 들어오는 사진: 살짝 커지며 나타나기
        el.classList.add('in');
        el.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 620, delay: 180 + Math.min(k++, 20) * 25, easing: EASE, fill: 'backwards' });
      }
    });
    $$('.tl-date', g).forEach((d, i) => { if (onScreen(d.getBoundingClientRect())) d.animate([{ opacity: 0, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 200 + i * 60, easing: EASE, fill: 'backwards' }); });
  }
  observeReveal(g);
}
/* ============================================================
   프로젝트 목록
   ============================================================ */
function renderProjects(view) {
  const prs = S.projects.filter(pr => projectPhotos(pr).length);
  view.innerHTML = `<section class="page">
    <div class="page-head">
      <div><div class="page-kicker mono">( ${pad(prs.length)} series )</div><h1 class="page-title split">${splitChars('Projects')}</h1></div>
      <p class="page-sub">장소와 계절, 하나의 주제로 엮은 사진 묶음이에요. 제목 위에 마우스를 올려 표지를 미리 보세요.</p>
    </div>
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
  let list = [], idx = 0, img = null, origin = null, playing = false, playTimer = null, zoomed = false;
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
    if (!reduced) {
      // 정보 글자들이 차례로 떠오르기
      [...info.children].forEach((el, k) => el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 120 + k * 55, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
      $('#lbCounter').animate([{ opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'ease' });
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
    if (reduced) return;
    $$('img', strip).slice(Math.max(0, idx - 12), idx + 14).forEach((t, k) => t.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: t.classList.contains('on') ? 1 : .35, transform: t.classList.contains('on') ? 'translateY(-4px)' : 'none' }], { duration: 650, delay: 260 + k * 22, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
    const vis = origin && origin.getBoundingClientRect();
    if (vis && vis.width && vis.bottom > 0 && vis.top < innerHeight && origin.complete) {
      const go = () => {
        const to = img.getBoundingClientRect();
        img.style.visibility = 'hidden';
        const fly = document.createElement('img'); fly.className = 'lb-fly'; fly.src = img.src; document.body.appendChild(fly);
        lb.animate([{ backgroundColor: 'rgba(8,8,7,0)' }, { backgroundColor: 'rgba(8,8,7,.985)' }], { duration: 500, easing: 'ease' });
        $$('.lb-info, .lb-strip, .lb-top, .lb-nav', lb).forEach(el => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 200, fill: 'backwards' }));
        fly.animate([rectFrames(vis), rectFrames(to)], { duration: 620, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => { img.style.visibility = ''; fly.remove(); };
      };
      img.complete && img.naturalWidth ? requestAnimationFrame(go) : img.addEventListener('load', go, { once: true });
    } else {
      lb.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350 });
      img.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.22,1,.36,1)' });
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
      lb.animate([{ backgroundColor: 'rgba(8,8,7,.985)' }, { backgroundColor: 'rgba(8,8,7,0)' }], { duration: 450, fill: 'forwards' });
      $$('.lb-info, .lb-strip, .lb-top, .lb-nav', lb).forEach(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }));
      fly.animate([rectFrames(from), rectFrames(tr)], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }).onfinish = () => {
        target.style.opacity = ''; fly.remove(); $$('.lb-info, .lb-strip, .lb-top, .lb-nav', lb).forEach(el => el.getAnimations().forEach(a => a.cancel())); finish();
      };
    } else {
      lb.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, fill: 'forwards' }).onfinish = finish;
    }
  };
  api.step = dir => {
    if (!list.length) return;
    setZoom(false);
    const old = img;
    idx = (idx + dir + list.length) % list.length;
    img = makeImg(list[idx]); paintInfo();
    if (reduced) { old.remove(); return; }
    const EASE = 'cubic-bezier(.77,0,.18,1)';
    img.animate([{ clipPath: dir > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)', transform: `translateX(${dir * 70}px) scale(1.05)` }, { clipPath: 'inset(0 0 0 0)', transform: 'none' }], { duration: 760, easing: EASE });
    old.animate([{ transform: 'none', filter: 'brightness(1)', opacity: 1 }, { transform: `translateX(${-dir * 140}px) scale(.94)`, filter: 'brightness(.3)', opacity: .2 }], { duration: 760, easing: EASE, fill: 'forwards' }).onfinish = () => old.remove();
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
    else if (e.key === 'ArrowRight') api.step(1);
    else if (e.key === 'ArrowLeft') api.step(-1);
    else if (e.key === ' ') { e.preventDefault(); api.play(); }
    else if (e.key.toLowerCase() === 'f') $('#lbFull').click();
    else if (e.key.toLowerCase() === 'i') $('#lbInfoBtn').click();
  });
  return api;
})();

/* ============================================================
   엽서 만들기
   ============================================================ */
const Postcard = (() => {
  const st = { p: null, shape: 'land', paper: 'white' };
  const PAPER = { white: ['#fbfaf6', '#1c1b18', '#8a877d'], cream: ['#f1e9d8', '#2a241a', '#8f826a'], black: ['#141413', '#efece4', '#8a877d'] };
  const el = $('#pcModal'), cv = $('#pcCanvas'), out = $('#pcImg');
  const api = { get isOpen() { return !el.hidden; } };
  let im = null;
  function draw(flip) {
    if (!im) return;
    const x = cv.getContext('2d');
    const [W, H] = st.shape === 'land' ? [1800, 1200] : st.shape === 'port' ? [1200, 1800] : [1500, 1500];
    cv.width = W; cv.height = H;
    const [bg, ink, muted] = PAPER[st.paper];
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const m = Math.round(Math.min(W, H) * 0.06), bottom = Math.round(Math.min(W, H) * 0.2), iw = W - m * 2, ih = H - m - bottom;
    const s = Math.max(iw / im.naturalWidth, ih / im.naturalHeight), sw = iw / s, sh = ih / s;
    x.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, m, m, iw, ih);
    const u = Math.min(W, H) / 1200, base = H - bottom + bottom * 0.42;
    x.fillStyle = ink; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.font = `italic ${Math.round(46 * u)}px "Instrument Serif", "Noto Serif KR", Georgia, serif`;
    const text = $('#pcText').value.trim(); if (text) x.fillText(text, m, base);
    x.fillStyle = muted; x.font = `${Math.round(19 * u)}px "JetBrains Mono", monospace`;
    const from = $('#pcFrom').value.trim();
    x.fillText([fmtDate(st.p.date), from ? 'FROM ' + from.toUpperCase() : ''].filter(Boolean).join('   ·   '), m, base + 52 * u);
    const sw2 = 112 * u, sh2 = 132 * u, sx = W - m - sw2, sy = H - bottom + bottom * 0.18;
    x.strokeStyle = muted; x.setLineDash([5 * u, 5 * u]); x.lineWidth = 2 * u; x.strokeRect(sx, sy, sw2, sh2); x.setLineDash([]);
    x.fillStyle = ink; x.textAlign = 'center'; x.font = `italic ${Math.round(56 * u)}px "Instrument Serif", Georgia, serif`;
    x.fillText(S.site.brandMark || 'h.', sx + sw2 / 2, sy + sh2 * 0.6);
    x.fillStyle = muted; x.font = `${Math.round(13 * u)}px "JetBrains Mono", monospace`;
    x.fillText(location.hostname.toUpperCase() || 'HAMIHAMOO.COM', sx + sw2 / 2, sy + sh2 + 24 * u); x.textAlign = 'left';
    if (flip && !reduced) { out.classList.remove('flip'); void out.offsetWidth; out.classList.add('flip'); }
    prepareFile();
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
      file = new File([blob], `hamihamoo-postcard-${st.p.date || 'photo'}.png`, { type: 'image/png' });
      $('#pcSave').disabled = false;
    }, 'image/png'), 120);
  }
  api.open = p => {
    st.p = p; el.hidden = false; im = null;
    $('#pcText').value = $('#pcText').value || (S.site.heroNote || '').replace(/\n/g, ' ');
    const i = new Image(); i.onload = () => { im = i; document.fonts.ready.then(() => draw(true)); }; i.src = imgUrl(p);
    if (!reduced) $('.pc-panel', el).animate([{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.22,1,.36,1)' });
    requestAnimationFrame(() => $$('.seg', el).forEach(syncSeg));
  };
  api.close = () => { el.hidden = true; };
  [['#pcShape', 'shape'], ['#pcPaper', 'paper']].forEach(([id, k]) => $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('button', $(id)).forEach(x => x.classList.toggle('on', x === b)); syncSeg($(id)); st[k] = b.dataset.v; draw(k === 'shape');
  }));
  $('#pcText').addEventListener('input', () => draw(false));
  $('#pcFrom').addEventListener('input', () => draw(false));
  $('#pcClose').onclick = api.close;
  el.addEventListener('click', e => { if (e.target === el) api.close(); });
  $('#pcSave').onclick = async () => {
    if (!file) return;
    // 휴대폰: 공유 창을 띄워요 (아이폰은 여기서 "이미지 저장"을 누르면 사진 앱에 저장돼요)
    if (isTouch && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Hamihamoo postcard' }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.download = file.name; a.href = fileUrl;
    document.body.appendChild(a); a.click(); a.remove();
    toast(isTouch ? '저장 창이 뜨지 않으면 엽서 이미지를 길게 눌러 저장하세요' : '엽서를 저장했어요', 4200);
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
      <div class="logo-mark">${esc(S.site.brandMark || 'h.')}</div>
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
  const TABS = [['upload', '사진 올리기'], ['photos', '사진 관리'], ['featured', '대표작'], ['projects', '프로젝트'], ['settings', '사이트 문구']];
  view.innerHTML = `<section class="studio">
    <div class="st-head"><div><div class="mono accent" style="margin-bottom:10px">( Studio )</div><h1>Manage the archive</h1></div>
      <div style="display:flex;gap:14px;align-items:center"><span class="mono faint">${S.photos.length} photos · ${S.projects.length} projects</span><button class="pill" id="stLogout">나가기</button></div></div>
    <div class="st-tabs" id="stTabs">${TABS.map(([k, l]) => `<button data-t="${k}" class="${k === Studio.tab ? 'on' : ''}">${l}${k === 'upload' && Studio.queue.length ? `<i>${Studio.queue.length}</i>` : ''}${k === 'photos' && Studio.dirty.size ? `<i>${Studio.dirty.size}</i>` : ''}</button>`).join('')}</div>
    <div id="stBody"></div>
  </section>`;
  $('#stTabs', view).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; Studio.tab = b.dataset.t; renderStudio(view); wireImages(view); observeReveal(view); });
  $('#stLogout', view).onclick = () => { setToken(''); Studio.authed = false; render(); };
  const body = $('#stBody', view);
  ({ upload: stUpload, photos: stPhotos, featured: stFeatured, projects: stProjects, settings: stSettings })[Studio.tab](body, view);
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
        <div class="st-actions">${cur.origId ? '<button class="link-danger" id="pjDel" style="margin-right:auto">이 프로젝트 삭제</button>' : ''}<button class="btn ghost small" id="pjCancel">닫기</button><button class="btn" id="pjSave">프로젝트 저장</button></div>`
        : '<div class="empty fx-box">왼쪽에서 프로젝트를 고르거나 새로 만드세요.</div>'}</div>
    </div>`;
    wireImages(body);
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
        cur.origId = id; reindex();
      }).then(paint);
    };
    const del = $('#pjDel', body); if (del) del.onclick = () => {
      if (!confirm('이 프로젝트를 삭제할까요? 사진은 지워지지 않아요.')) return;
      const id = cur.origId;
      saving(del, '프로젝트를 삭제했어요', async () => {
        await updateJson('projects.json', arr => (arr || []).filter(p => p.id !== id), 'Delete project');
        S.projects = S.projects.filter(p => p.id !== id); Studio.pj = null; reindex();
      }).then(paint);
    };
  };
  paint();
}

/* 5) 사이트 문구 */
function stSettings(body) {
  const F = [
    ['h', '이름과 로고'], ['brandMark', '로고 글자'], ['brandName', '사이트 이름'], ['brandSubtitle', '이름 아래 작은 글씨'],
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

/* ============================================================
   공통: 커서, 테마, 복사, 시작
   ============================================================ */
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
  $('#brandMark').textContent = S.site.brandMark || 'h.';
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
