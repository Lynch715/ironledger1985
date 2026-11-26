// =============================================================
//  铁道春秋 · 界面与地图
// =============================================================
(() => {
  const $ = s => document.querySelector(s);
  // 只阻止浏览器缩放；触摸事件继续传递给地图。
  for (const type of ['gesturestart', 'gesturechange', 'touchmove']) {
    document.addEventListener(type, e => {
      if (e.cancelable && (type !== 'touchmove' || e.touches.length > 1)) e.preventDefault();
    }, { capture:true, passive:false });
  }
  const G = Game, C = G.cities, E = G.edges;
  const icon = Art.icon;
  const W = G.fmtW;
  const fmtY = y => W(y) + '元';
  const NW = v => Math.abs(v||0) < 500 ? W(0) : '−' + W(v);  // 支出类：负号 + 金额，零值不带负号
  const financialClass = value => value > 0 ? 'gain' : value < 0 ? 'loss' : '';
  const financeColors = (() => {
    const css = getComputedStyle(document.documentElement);
    const read = name => css.getPropertyValue(`--${name}`).trim();
    return { gain:read('gain'), loss:read('loss'), neutral:read('finance-neutral'), revenue:read('finance-revenue'), expense:read('finance-expense') };
  })();
  const financialColor = value => financeColors[financialClass(value) || 'neutral'];
  const pct = x => (x*100).toFixed(0) + '%';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const measureText = text => esc(text).replace(
    /[+−-]?\d[\d,]*(?:\.\d+)?[ \u00a0]*(?:万人次|亿元(?:\/年)?|万元(?:\/km)?|万吨(?:\/月)?|km\/h|km|kW|公里|小时|个月|年月|年|月|日|元|列|天|次|人|吨|座|[%％])/g,
    '<span class="measure">$&</span>');
  const SPEEDS = [0, 1, 3, 7, 15];
  const ui = { tab:'overview', speed:1, lastSpeed:1, selCity:null, selEdge:null, selRoute:null, mode:'view', draft:[], openDetails:{}, idleOnly:false,
    layers:{ state:true, rivals:true, cand:true, trains:true, labels:true, flow:false, industry:false }, mf:{ use:'all', type:'all', origin:'all', show:'sale', cat:'loco', ck:'all' },
    buyRoute:null, sig:'', confirm:null, modalOpen:false, floaters:[], lastEvt:0, newsTop:null };
  const RIVAL = {}; RIVALS.forEach(r => RIVAL[r.id] = r);
  const ownerName = o => o==='P' ? (G.S.company) : o==='S' ? '国家铁路' : (RIVAL[o] ? RIVAL[o].name : o);
  const ownerColor = o => o==='P' ? P.own : o==='S' ? '#8095b0' : (RIVAL[o] ? RIVAL[o].color : '#999');
  const trackUse = t => G.isHighSpeed(t.v) ? '高速客运专线' : '客货共用线';
  const hasBothTrackUses = ts => ts.some(t => G.isHighSpeed(t.v)) && ts.some(t => !G.isHighSpeed(t.v));
  const mapTrackRank = t => (t.status === 'ok' ? 4 : 0) + (t.owner === 'P' ? 2 : 0) + (G.isHighSpeed(t.v) ? 1 : 0);
  const artCache = {};
  // 车辆立绘：优先加载 img/trains/<车型ID>.png，没有图片时显示程序生成的SVG
  // 自主设计车型用平台立绘（m.img）
  // 性能：优先用压缩后的 WebP（img/trains/s|m/<ID>.webp：s 给列表小图，m 给卡片大图），没有就退回原 PNG，再没有才用 SVG。
  // 图片加载成功过一次后，后续重绘不再附带隐藏的 SVG，减少面板每次重绘的节点数。
  const artModel = {}, carCache = {}, imgOK = {};
  const svgOf = k => k[0] === 'c' ? (carCache[k.slice(2)] || (carCache[k.slice(2)] = Art.car(G.carById[k.slice(2)]))) : (artCache[k.slice(2)] || (artCache[k.slice(2)] = Art.svg(artModel[k.slice(2)])));
  window.__artOk = img => { imgOK[img.dataset.k] = img.getAttribute('src'); img.parentNode.classList.add('has-img'); };
  window.__artErr = img => { const d = img.parentNode; if (img.dataset.png){ const p = img.dataset.png; img.removeAttribute('data-png'); img.src = p; return; }
    delete imgOK[img.dataset.k]; const k = img.dataset.k.split('|')[0]; img.remove(); if (d){ d.classList.remove('has-img'); if (!d.querySelector('svg')) d.insertAdjacentHTML('beforeend', svgOf(k)); } };
  function tartHTML(dir, id, k, sz){ const ik = k + '|' + sz, ok = imgOK[ik];
    if (ok) return `<div class="tart has-img"><img src="${ok}" alt="" data-k="${ik}" onerror="__artErr(this)"></div>`;
    return `<div class="tart"><img src="img/${dir}/${sz}/${id}.webp" data-png="img/${dir}/${id}.png" alt="" data-k="${ik}" onload="__artOk(this)" onerror="__artErr(this)">${svgOf(k)}</div>`; }
  const artOf = (m, key, sz) => { artModel[key] = m; return tartHTML('trains', (m && m.img) || m.id, 't:' + key, sz || 'm'); };
  const art = (id, sz) => artOf(G.trainById[id], id, sz);
  const carArt = (id, sz) => tartHTML('cars', id, 'c:' + id, sz || 'm');
  // 性能：线路下拉框先只放当前选项（车队 180 列 × 60 条线路时可省下上万个 <option>），点开或聚焦时再补全
  const fleetOptLabel = r => `${G.isBranch(r) ? '［支线］' : ''}${esc(r.name)}`;
  const fleetOpts = sel => `<option value="">— 未分配 —</option>` + G.S.routes.map(r => `<option value="${r.id}" ${sel===r.id?'selected':''}>${fleetOptLabel(r)}</option>`).join('');
  const lazyOpts = r => `<option value="">— 未分配 —</option>` + (r ? `<option value="${r.id}" selected>${fleetOptLabel(r)}</option>` : '');
  const buyOpts = () => `<option value="">暂不分配</option>` + G.S.routes.map(r => `<option value="${r.id}" ${ui.buyRoute===r.id?'selected':''}>${esc(r.name)}</option>`).join('');
  const buyLazy = () => { const r = ui.buyRoute && G.S.routes.find(x => x.id === ui.buyRoute); return `<option value="">暂不分配</option>` + (r ? `<option value="${r.id}" selected>${esc(r.name)}</option>` : ''); };
  function fillLazy(el){ if (!el || !el.dataset.lazy) return; const kind = el.dataset.lazy; el.removeAttribute('data-lazy'); const v = el.value;
    el.innerHTML = kind === 'fleet' ? fleetOpts(v ? +v : null) : buyOpts(); el.value = v; }
  ['pointerdown','mousedown','touchstart','focusin','keydown'].forEach(ev => document.addEventListener(ev, e => { const t = e.target; if (t && t.closest) fillLazy(t.closest('select[data-lazy]')); }, true));
  const consistText = t => { const m = G.trainById[t.model]; if (G.isUnit(m)) return '固定编组'; const c = (t.cars||[]).filter(x => x.n); return c.length ? c.map(x => `${(G.carById[x.id]||{name:x.id}).name}×${x.n}`).join(' + ') : '<span class="neg">未编组</span>'; };
  const typeName = { steam:'蒸汽', diesel:'内燃', electric:'电力', emu:'电动车组', dmu:'内燃动车组' };
  const powerName = m => m.fuel === 'h2' ? '氢能' : m.fuel === 'hybrid' ? '氢电混合' : typeName[m.type];
  const useName = { pax:'客运', freight:'货运' };

  // ---------------- 地图 ----------------
  const cv = $('#map'), mainCtx = cv.getContext('2d');
  let ctx = mainCtx;   // 绘图目标：平时是地图画布，缓存静态图层时临时切到离屏画布
  let DPR = window.devicePixelRatio || 1;
  const view = { s: 18, ox: 0, oy: 0 };
  const COS = Math.cos(35 * Math.PI/180);
  const wx = lon => (lon - 104) * COS, wy = lat => -(lat - 35);
  const sx = lon => wx(lon) * view.s + view.ox, sy = lat => wy(lat) * view.s + view.oy;
  const fitBounds = { x0:wx(86), x1:wx(128.5), y0:wy(48.5), y1:wy(21) };
  const fitScale = (w,h) => Math.min(w / (fitBounds.x1-fitBounds.x0), (h-34) / (fitBounds.y1-fitBounds.y0)) * 0.95;
  function resize(){ const r = cv.getBoundingClientRect(); DPR = window.devicePixelRatio || 1; cv.width = r.width*DPR; cv.height = r.height*DPR; ui.mapDrawn = false; }
  function fit(){ const { width, height } = cv.getBoundingClientRect();
    const { x0, x1, y0, y1 } = fitBounds;
    view.s = fitScale(width,height); view.ox = width/2 - (x0+x1)/2*view.s; view.oy = (height-34)/2 - (y0+y1)/2*view.s; }
  window.addEventListener('resize', () => { resize(); if (ui.selEdge !== null) renderInspector(); });

  const RIVERS = [
    { name:'长江', pts:[[91,33.2],[95,33],[97.5,32.5],[99.2,29.5],[100.2,26.9],[101.8,26.5],[103.3,28.2],[104.6,28.8],[105.8,28.9],[106.6,29.6],[108.4,30.7],[110.2,31],[111.3,30.7],[112.5,30.2],[113.6,29.8],[114.3,30.6],[115.4,29.9],[116.2,29.8],[117.1,30.5],[118.2,31.4],[118.8,32.1],[119.8,32.3],[120.9,31.9],[121.9,31.3]] },
    { name:'黄河', pts:[[96.2,34.9],[98.5,35.2],[100.6,36],[101.8,36.1],[103.8,36.1],[104.6,37.2],[105.2,37.5],[106.3,38.5],[106.8,39.5],[107.5,40.6],[109.8,40.5],[111.2,40.2],[111.3,39.1],[110.6,37.6],[110.4,35.7],[110.3,34.6],[111.6,34.8],[113.6,34.9],[114.8,35.1],[116,35.8],[117,36.7],[118.2,37.4],[119.1,37.7]] },
    { name:'珠江', pts:[[104.5,25.2],[106.5,25],[108.4,23.4],[109.6,23.6],[111.3,23.5],[112.5,23.1],[113.3,23.1],[113.7,22.5]] },
    { name:'淮河', pts:[[113.2,32.4],[115,32.4],[116.5,32.7],[117.5,33],[118.7,33.3],[119.2,33.8]] },
    { name:'松花江', pts:[[124.2,45.5],[125.5,45.4],[126.6,45.8],[128,46],[130,46.8]] },
    { name:'湘江', pts:[[111.2,25.6],[112.6,26.9],[113,27.9],[112.9,28.7],[113,29.2]] },
  ];
  const PLATEAU = [[78,35.5],[80.5,31],[85,28.6],[89,27.8],[92.5,27.6],[96,28.2],[98.6,28.8],[100.5,30.5],[102.2,32.2],[102.5,34.2],[101.5,36.8],[98.5,38.4],[94,38.8],[90,37.6],[86,36.6],[81,36.3]];
  const DESERT = [[79,39],[83,41.2],[88,42],[92,41],[93,39.6],[90,38.4],[85,37.6],[81,37.4]];
  const REGION_LABELS = [['华北',114.5,41.6],['东北',127,44.5],['华东',119.6,33.6],['华中',112.0,30.0],['华南',110.5,23.4],['西北',100.5,40],['西南',99.0,27.2]];

  const trackOrd = o => o==='S' ? 0 : o==='P' ? 9 : 5;
  let tIdx = null;   // 仅在一帧绘制期间有效：走廊号 → 已排序的轨道
  function buildTrackIdx(){ const m = new Map(); G.S.tracks.forEach(t => { let a = m.get(t.e); if (!a) m.set(t.e, a = []); a.push(t); });
    m.forEach(a => a.sort((x,y) => trackOrd(x.owner)-trackOrd(y.owner))); return m; }
  function edgeTracks(e){ if (tIdx) return (tIdx.get(e.i) || []).slice();
    const S = G.S; const ts = S.tracks.filter(t => t.e === e.i); return ts.sort((a,b) => trackOrd(a.owner)-trackOrd(b.owner)); }

  const P = {};
  function loadPalette(){ const cs = getComputedStyle(document.documentElement); const d = { grid:'rgba(120,150,190,.07)', gridText:'rgba(140,165,200,.28)', plateau:'rgba(150,120,80,.10)', plateauLine:'rgba(170,140,90,.16)', terrText:'rgba(190,160,110,.22)', river:'rgba(80,150,220,.28)', region:'rgba(160,185,220,.07)', cand:'rgba(160,180,210,.25)', stateHsr:'#b8cdea', stateElec:'#7f97b8', state:'#55657d', own:'#f2b544', cityLit:'#ffd88a', city:'#26344b', cityLitLine:'#fff6dc', cityLine:'#7488a6', halo:'rgba(8,13,22,.85)', labelLit:'#ffe3a6', label:'#b9c6da', glow:'rgba(255,205,110,A)', font:'sans-serif' };
    Object.keys(d).forEach(k => { const v = cs.getPropertyValue('--m-' + k).trim(); P[k] = v || d[k]; }); }
  loadPalette();
  let terr = null, terrState = 'init';
  function startTerrain(){
    terrState = 'loading'; let done = false;
    const ready = t => { done = true; terr = t; terrState = 'ready'; ui.mapDrawn = false; };
    const buildNow = () => { if (done) return; ready(HexMap.build(72)); setTimeout(() => HexMap.saveCache(terr), 2000); };
    const timer = setTimeout(buildNow, 3000);   // 缓存读不出来（浏览器异常）时不久等
    let p; try { p = HexMap.loadCached(72); } catch(e) { p = Promise.resolve(null); }
    p.then(t => { if (done) return; clearTimeout(timer); if (t) ready(t); else buildNow(); }, () => { if (done) return; clearTimeout(timer); buildNow(); });
  }
  // —— 性能：地形底图预先缩成多级（每级 1/2），按当前缩放挑最接近的一级，只画屏幕可见部分 ——
  function terrLevels(){ if (terr.levels) return terr.levels; const L = [{ cv:terr.canvas, k:1 }]; let src = terr.canvas, k = 1;
    while (src.width > 1600 && src.height > 800){ const c = document.createElement('canvas'); c.width = Math.ceil(src.width/2); c.height = Math.ceil(src.height/2);
      const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height); k *= 2; L.push({ cv:c, k, sx:c.width/terr.canvas.width, sy:c.height/terr.canvas.height }); src = c; }
    L[0].sx = L[0].sy = 1; return terr.levels = L; }
  function drawTerrain(w, h){
    const L = terrLevels(); const need = terr.K / (view.s * DPR);   // 每个屏幕像素对应几个原图像素
    let lv = L[0]; for (const x of L) if (x.k <= need * 1.0001) lv = x;
    const fx = terr.canvas.width/terr.K*view.s, fy = terr.canvas.height/terr.K*view.s;   // 整张底图在屏幕上的尺寸
    const X0 = terr.x0*view.s+view.ox, Y0 = terr.y0*view.s+view.oy;
    const ax = Math.max(0, -X0), ay = Math.max(0, -Y0), bx = Math.min(fx, w - X0), by = Math.min(fy, h - Y0);
    if (bx <= ax || by <= ay) return;
    const kx = lv.cv.width / fx, ky = lv.cv.height / fy;
    // 源矩形向外取整一像素，避免边缘出现细缝
    const s0x = Math.max(0, Math.floor(ax*kx) - 1), s0y = Math.max(0, Math.floor(ay*ky) - 1), s1x = Math.min(lv.cv.width, Math.ceil(bx*kx) + 1), s1y = Math.min(lv.cv.height, Math.ceil(by*ky) + 1);
    ctx.drawImage(lv.cv, s0x, s0y, s1x - s0x, s1y - s0y, X0 + s0x/kx, Y0 + s0y/ky, (s1x - s0x)/kx, (s1y - s0y)/ky);
  }
  // —— 性能：静态图层缓存 ——
  // 底层（地形、地名、走廊与轨道、线路高亮、流量/产业图层）和城市名标签层各画到一张离屏画布，
  // 只有视角、轨道、图层开关、选中对象等变化时才重画；每帧只把它们贴上去，再画会动的城市光晕和列车。
  const layerCv = { base:document.createElement('canvas'), label:document.createElement('canvas') };
  const layerSt = { base:{ key:'', ok:false, prev:'', t:0 }, label:{ key:'', ok:false, prev:'', t:0 } };
  let econSeen = null, econStamp = 0;
  function baseKey(w, h){ const S = G.S;
    if (G.econ !== econSeen){ econSeen = G.econ; econStamp++; }
    const trk = S.tracks.map(t => t.e + t.owner + t.status + t.v + (t.elec ? 1 : 0)).join(',');
    const selR = ui.selRoute && S.routes.find(r => r.id === ui.selRoute);
    return [w, h, DPR, view.s, view.ox, view.oy, JSON.stringify(ui.layers), ui.selEdge, selR ? selR.color + selR.stops.join('-') : '', ui.mode, ui.draft.join('-'),
      trk, Object.keys(S.unlock || {}).length, S.lastYM, (ui.layers.flow || ui.layers.industry) ? econStamp : 0, P.font].join('|'); }
  function labelKey(w, h){ const S = G.S;
    return [w, h, DPR, view.s, view.ox, view.oy, ui.layers.labels ? 1 : 0, ui.selCity, ui.draft.join('-'), Object.keys(S.lit).join(','),
      Object.keys(S.stations).map(c => c + ':' + G.stationLv(+c)).join(','), G.ym(S.day).y, P.font].join('|'); }
  // 视角连续变化（拖动、缩放）时直接画到地图上；停下来的那一帧再写进缓存，之后每帧只贴图
  function cachedLayer(name, key, w, h, draw){
    const st = layerSt[name], lc = layerCv[name], now = performance.now();
    const moving = key !== st.prev; st.prev = key;
    if (st.ok && key === st.key && now - st.t < 4000){ ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(lc, 0, 0); ctx.setTransform(DPR,0,0,DPR,0,0); return; }
    if (moving){ st.ok = false; draw(); return; }
    if (lc.width !== cv.width || lc.height !== cv.height){ lc.width = cv.width; lc.height = cv.height; }
    const g = lc.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.clearRect(0, 0, lc.width, lc.height); g.setTransform(DPR,0,0,DPR,0,0);
    const keep = ctx; ['lineCap','lineJoin','textAlign','textBaseline'].forEach(k => g[k] = keep[k]);
    ctx = g; try { draw(); } finally { ctx = keep; ['lineCap','lineJoin','textAlign','textBaseline'].forEach(k => keep[k] = g[k]); }
    st.key = key; st.ok = true; st.t = now;
    ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(lc, 0, 0); ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  // 城市光晕：同半径的径向渐变预先画成小图，每帧按呼吸亮度贴图（与逐帧建渐变的效果一致）
  const glowCache = {};
  function glowSprite(R){ const q = Math.max(1, Math.round(R*2)/2), key = q + P.glow; let g = glowCache[key]; if (g) return g;
    const sc = Math.min(3, Math.max(1, DPR)), n = Math.ceil(q*2*sc) + 2, c = document.createElement('canvas'); c.width = c.height = n;
    const x = c.getContext('2d'), m = n/2, gr = x.createRadialGradient(m, m, 0, m, m, q*sc); gr.addColorStop(0, P.glow.replace('A', '1')); gr.addColorStop(1, P.glow.replace('A', '0'));
    x.fillStyle = gr; x.beginPath(); x.arc(m, m, q*sc, 0, Math.PI*2); x.fill(); return glowCache[key] = { c, r:n/2/sc }; }
  function drawGlow(x, y, R, a){ const g = glowSprite(R); ctx.globalAlpha = a; ctx.drawImage(g.c, x - g.r, y - g.r, g.r*2, g.r*2); ctx.globalAlpha = 1; }
  function drawMap(now){
    const S = G.S; if (!S) return;
    const w = cv.width/DPR, h = cv.height/DPR;
    if (!w || !h) return;   // 手机「面板全屏」时地图隐藏，不必绘制
    ctx = mainCtx;
    ctx.setTransform(DPR,0,0,DPR,0,0);
    ctx.clearRect(0,0,w,h);
    // 六边形地形底图：先读浏览器里的缓存图，没有再现场生成
    if (!terr){ if (terrState === 'init') startTerrain(); if (!terr){ ctx.fillStyle = '#a7c1c6'; ctx.fillRect(0,0,w,h); return; } }
    tIdx = buildTrackIdx();
    try {
    cachedLayer('base', baseKey(w, h), w, h, () => drawBase(w, h));
    drawLive(now, w, h);
    } finally { tIdx = null; }
  }
  function drawBase(w, h){
    const S = G.S;
    ctx.fillStyle = '#a7c1c6'; ctx.fillRect(0,0,w,h);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    drawTerrain(w, h);
    // 地名（分层：按缩放显示，纸色描边）
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const SERIF = '"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC",serif';
    const LST = { region:['600', 'rgba(96,68,36,.62)', 46], desert:['600', 'rgba(132,96,48,.62)', 34], range:['600', 'rgba(78,54,30,.82)', 26],
      sea:['400', 'rgba(44,82,98,.72)', 40], cape:['400', 'rgba(84,62,40,.78)', 16], island:['600', 'rgba(84,62,40,.8)', 18], lake:['400', 'rgba(36,76,96,.85)', 15], river:['400', 'rgba(36,76,96,.85)', 15] };
    HexMap.LABELS.forEach(([n,lo,la,sz,ty,rot,mn,mx]) => {
      if (view.s < mn || view.s > mx) return;
      const st = LST[ty]; const fs = Math.min(st[2], Math.max(10, view.s*sz));
      const fade = ty === 'region' ? Math.max(0.25, Math.min(1, 1.6 - view.s/40)) : 1;
      ctx.save(); ctx.translate(sx(lo), sy(la)); if (rot) ctx.rotate(rot*Math.PI/180); ctx.globalAlpha = fade;
      ctx.font = `${st[0]} ${fs}px ${SERIF}`;
      ctx.lineWidth = Math.max(2, fs*0.16); ctx.strokeStyle = ty === 'sea' || ty === 'lake' || ty === 'river' ? 'rgba(214,228,226,.55)' : 'rgba(244,236,214,.6)'; ctx.strokeText(n, 0, 0);
      ctx.fillStyle = st[1]; ctx.fillText(n, 0, 0); ctx.restore();
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    // 走廊与轨道
    const selR = ui.selRoute && S.routes.find(r => r.id === ui.selRoute);
    E.forEach(e => {
      const a = C[e.a], b = C[e.b]; const x1 = sx(a.lon), y1 = sy(a.lat), x2 = sx(b.lon), y2 = sy(b.lat);
      const all = edgeTracks(e); if (e.sup && !all.length) return;
      const ts = all.filter(t => (t.owner==='S' ? ui.layers.state : t.owner==='P' ? true : ui.layers.rivals));
      const locked = e.pol && G.edgeLock(e);
      if (!all.length){ if (ui.layers.cand || ui.selEdge === e.i){ ctx.setLineDash(locked ? [1,6] : [2,5]); ctx.strokeStyle = ui.selEdge===e.i ? '#ffd27a' : (e.abroad || e.xb) ? (locked ? 'rgba(140,70,50,.32)' : 'rgba(150,62,40,.6)') : P.cand; ctx.lineWidth = 1.2; line(x1,y1,x2,y2); ctx.setLineDash([]); } }
      if (e.xb && (all.length || ui.layers.cand)){ // 口岸标记：走廊中点画一道关卡短线
        const mx = (x1+x2)/2, my = (y1+y2)/2, L0 = Math.hypot(x2-x1, y2-y1) || 1, qx = -(y2-y1)/L0, qy = (x2-x1)/L0, k = 5;
        ctx.strokeStyle = locked ? 'rgba(122,42,18,.35)' : 'rgba(122,42,18,.85)'; ctx.lineWidth = 1.6;
        line(mx - qx*k - (x2-x1)/L0*1.6, my - qy*k - (y2-y1)/L0*1.6, mx + qx*k - (x2-x1)/L0*1.6, my + qy*k - (y2-y1)/L0*1.6);
        line(mx - qx*k + (x2-x1)/L0*1.6, my - qy*k + (y2-y1)/L0*1.6, mx + qx*k + (x2-x1)/L0*1.6, my + qy*k + (y2-y1)/L0*1.6); }
      // 高铁和客货共用线共用走廊轮廓，点开后仍可查看各条线路。
      const mixed = hasBothTrackUses(ts);
      const shown = mixed ? [ts.reduce((best, t) => mapTrackRank(t) > mapTrackRank(best) ? t : best)] : ts;
      const highSpeedOpen = mixed && ts.some(t => t.status === 'ok' && G.isHighSpeed(t.v));
      const n = shown.length, dx = x2-x1, dy = y2-y1, L = Math.hypot(dx,dy) || 1, nx = -dy/L, ny = dx/L;
      shown.forEach((t, k) => {
        const off = (k - (n-1)/2) * 3.4; const ox = nx*off, oy = ny*off;
        const highSpeed = G.isHighSpeed(t.v) || highSpeedOpen;
        let col, lw;
        if (t.owner === 'S'){ col = highSpeed ? P.stateHsr : t.elec ? P.stateElec : P.state; lw = highSpeed ? 2.4 : 1.6; }
        else if (t.owner === 'P'){ col = P.own; lw = highSpeed ? 4 : 3; }
        else { col = ownerColor(t.owner); lw = highSpeed ? 3 : 2.2; }
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = t.status === 'build' ? 0.75 : locked ? 0.4 : 1;
        if (t.status === 'build') ctx.setLineDash([6,4]);
        line(x1+ox, y1+oy, x2+ox, y2+oy); ctx.setLineDash([]);
        if (highSpeed && t.status === 'ok'){ ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 0.9; line(x1+ox,y1+oy,x2+ox,y2+oy); }
        if (t.owner === 'P' && t.elec && !highSpeed && t.status==='ok'){ ctx.strokeStyle = 'rgba(40,25,5,.8)'; ctx.lineWidth = 0.8; ctx.setLineDash([2,6]); line(x1+ox,y1+oy,x2+ox,y2+oy); ctx.setLineDash([]); }
        ctx.globalAlpha = 1;
      });
      if (ui.selEdge === e.i && all.length){ ctx.strokeStyle = 'rgba(255,210,122,.35)'; ctx.lineWidth = 12; line(x1,y1,x2,y2); }
    });
    // 选中线路高亮
    if (selR){ ctx.strokeStyle = selR.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 11; pathStops(selR.stops); ctx.globalAlpha = 1; ctx.lineWidth = 2.5; ctx.setLineDash([]); pathStops(selR.stops); }
    // 新建线路草稿
    if (ui.mode === 'route' && ui.draft.length){
      ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 4; ctx.setLineDash([8,5]); pathStops(ui.draft); ctx.setLineDash([]);
      const last = ui.draft[ui.draft.length-1];
      G.adj[last].forEach(e => { const o = e.a===last ? e.b : e.a; if (ui.draft.includes(o)) return; const ok = G.routeAllowed(last, o);
        ctx.beginPath(); ctx.arc(sx(C[o].lon), sy(C[o].lat), 11, 0, Math.PI*2); ctx.strokeStyle = ok ? 'rgba(126,226,176,.9)' : 'rgba(255,120,120,.5)'; ctx.lineWidth = 2; ctx.stroke(); });
    }
    if (ui.layers.flow) drawFlows();
    if (ui.layers.industry) drawIndustry();
  }
  function drawLive(now, w, h){
    const S = G.S;
    // 城市
    const pulse = 0.5 + 0.5*Math.sin(now/600);
    const yNow = G.ym(S.day).y;
    C.forEach(c => {
      const x = sx(c.lon), y = sy(c.lat);
      if (x < -80 || y < -80 || x > w + 80 || y > h + 80) return;   // 屏幕外的城市不画
      const pop = G.popOf(c, yNow);
      if (c.tier > 1){ // 二三线城市：方形站标
        const lv = G.stationLv(c.i), lit = !!S.lit[c.i], st = S.stations[c.i];
        const r = (c.tier === 2 ? 3.4 : 2.7) + Math.min(1.5, view.s/40);
        if (lit) drawGlow(x, y, r*3.4, +(0.45+0.2*pulse).toFixed(2));
        ctx.beginPath(); ctx.rect(x-r, y-r, r*2, r*2);
        if (lv >= 1){ ctx.fillStyle = lit ? P.cityLit : P.city; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = lit ? P.cityLitLine : P.cityLine; ctx.stroke();
          for (let k = 0; k < lv; k++){ ctx.fillStyle = lit ? '#7a2a12' : '#f3e7c9'; ctx.fillRect(x - r + 1.2 + k*(r*2-2.4)/3, y + r - 2.2, (r*2-2.4)/3 - 0.8, 1.4); } }
        else { ctx.fillStyle = 'rgba(243,231,201,.85)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = P.cityLine; if (st && st.pend) ctx.setLineDash([2,2]); ctx.stroke(); ctx.setLineDash([]); }
        if (ui.selCity === c.i){ ctx.strokeStyle = '#7a2a12'; ctx.lineWidth = 2; ctx.strokeRect(x-r-4, y-r-4, r*2+8, r*2+8); }
        return;
      }
      const r = 2.6 + Math.sqrt(pop)/6.5;
      const lit = !!S.lit[c.i];
      if (lit) drawGlow(x, y, r*4.2, +(0.55+0.2*pulse).toFixed(2));
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle = lit ? P.cityLit : P.city; ctx.fill();
      ctx.lineWidth = lit ? 1.6 : 1.2; ctx.strokeStyle = lit ? P.cityLitLine : P.cityLine; ctx.stroke();
      if (c.tag === '特区' && !lit){ ctx.strokeStyle = 'rgba(255,120,120,.7)'; ctx.beginPath(); ctx.arc(x,y,r+2.5,0,Math.PI*2); ctx.stroke(); }
      if (ui.selCity === c.i){ ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x,y,r+5,0,Math.PI*2); ctx.stroke(); }
    });
    // 机务段标记
    (S.depots || []).forEach(d => { const c = C[d.ci], x = sx(c.lon), y = sy(c.lat) - 10 - (d.lv >= 2 ? 1 : 0), w = d.lv >= 2 ? 6 : 5;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = d.pend && !d.lv ? 'rgba(120,120,120,.8)' : '#2f4f3a'; ctx.strokeStyle = '#f4e9cf'; ctx.lineWidth = 1.2;
      ctx.fillRect(-w/2, -w/2, w, w); ctx.strokeRect(-w/2, -w/2, w, w); ctx.restore(); });
    // 列车
    if (ui.layers.trains) drawTrains(now, w, h);
    // 标签
    if (ui.layers.labels) cachedLayer('label', labelKey(w, h), w, h, () => drawLabels(w, h));
    // 浮动收入
    drawFloaters(now);
  }
  function drawLabels(w, h){
    const S = G.S; const yNow = G.ym(S.day).y;
    {
      ctx.textBaseline = 'middle';
      C.forEach(c => {
        const pop = c.pop0; const lit = !!S.lit[c.i];
        const town = c.tier > 1, hasSt = town && G.stationLv(c.i) >= 1;
        if (town ? !(lit || hasSt || view.s > 30 || (c.tier === 2 && view.s > 22) || ui.selCity === c.i || ui.draft.includes(c.i))
                 : !(lit || pop >= 100 || view.s > 26 || ui.selCity === c.i || ui.draft.includes(c.i))) return;
        const x = sx(c.lon), y = sy(c.lat); if (x < -260 || y < -30 || x > w + 30 || y > h + 30) return;
        const r = town ? 4 : 2.6 + Math.sqrt(G.popOf(c, yNow))/6.5;
        ctx.font = `${lit ? '600 ' : ''}${town ? 11 : pop >= 300 ? 13 : 12}px ${P.font}`;
        ctx.lineWidth = 3; ctx.strokeStyle = P.halo; ctx.strokeText(c.name, x + r + 4, y);
        ctx.fillStyle = lit ? P.labelLit : P.label; ctx.fillText(c.name, x + r + 4, y);
      });
      ctx.textBaseline = 'alphabetic';
    }
  }
  function drawFloaters(now){
    if (!ui.floaters.length) return;
    ctx.font = '600 11px ' + 'Menlo, monospace';
    ui.floaters = ui.floaters.filter(f => now - f.t0 < 1600);
    ui.floaters.forEach(f => { const k = (now - f.t0)/1600; ctx.globalAlpha = 1 - k; ctx.fillStyle = financialColor(f.amt); ctx.fillText((f.amt>0?'+':'') + (f.amt/1e4).toFixed(1) + '万', f.x + 6, f.y - 8 - k*18); });
    ctx.globalAlpha = 1;
  }
  // 本公司客货流量（按区段月运量）
  function drawFlows(){
    const S = G.S; const vol = {};
    S.trains.forEach(t => { const e = G.econ[t.id]; if (!e || !e.plan.ok || !e.legLoad) return; const use = G.trainById[t.model].use;
      e.plan.legs.forEach((l, k) => { const key = l.e; vol[key] = vol[key] || { pax:0, fr:0 }; vol[key][use === 'pax' ? 'pax' : 'fr'] += e.legLoad[k] * e.plan.trips; }); });
    ctx.lineCap = 'butt';
    Object.entries(vol).forEach(([ei, v]) => { const e = E[ei]; const a = C[e.a], b = C[e.b]; const x1 = sx(a.lon), y1 = sy(a.lat), x2 = sx(b.lon), y2 = sy(b.lat);
      const L = Math.hypot(x2-x1, y2-y1) || 1, nx = -(y2-y1)/L, ny = (x2-x1)/L;
      const wp = Math.min(16, Math.sqrt(v.pax) / 28), wf = Math.min(16, Math.sqrt(v.fr) / 32);
      if (wp > 0.5){ ctx.strokeStyle = 'rgba(29,94,158,.55)'; ctx.lineWidth = wp; line(x1 + nx*(wp/2+1), y1 + ny*(wp/2+1), x2 + nx*(wp/2+1), y2 + ny*(wp/2+1)); }
      if (wf > 0.5){ ctx.strokeStyle = 'rgba(150,80,20,.6)'; ctx.lineWidth = wf; line(x1 - nx*(wf/2+1), y1 - ny*(wf/2+1), x2 - nx*(wf/2+1), y2 - ny*(wf/2+1)); }
    });
    ctx.lineCap = 'round';
  }
  // 城市主要货源（小色块）
  function drawIndustry(){
    const y = G.ym(G.S.day).y;
    C.forEach(c => { const sd = G.cargoSD(c, y); const top = CARGO_IDS.filter(g => g !== 'general').map(g => [g, sd.S[g]]).filter(x => x[1] > 2.5).sort((a,b) => b[1]-a[1]).slice(0,3);
      if (!top.length) return; const x = sx(c.lon), yy = sy(c.lat);
      top.forEach(([g, v], i) => { const r = Math.min(9, 2.5 + Math.sqrt(v)); ctx.beginPath(); ctx.arc(x - 10 - i*(r*2+2), yy - 9, r, 0, Math.PI*2); ctx.fillStyle = CARGO[g].color; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = '#f3e7c9'; ctx.lineWidth = 1; ctx.stroke(); });
    });
  }
  function poly(pts, fill, stroke){ ctx.beginPath(); pts.forEach((p,k) => k ? ctx.lineTo(sx(p[0]),sy(p[1])) : ctx.moveTo(sx(p[0]),sy(p[1]))); ctx.closePath(); if (fill){ ctx.fillStyle = fill; ctx.fill(); } if (stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } }
  function line(x1,y1,x2,y2){ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
  function pathStops(stops){ ctx.beginPath(); stops.forEach((c,k) => k ? ctx.lineTo(sx(C[c].lon), sy(C[c].lat)) : ctx.moveTo(sx(C[c].lon), sy(C[c].lat))); ctx.stroke(); }

  const trainSprites = new Map();
  const trainShapes = {
    pax:[[-9,-3.4],[6,-3.4],[9,-1.8],[9,1.8],[6,3.4],[-9,3.4]],
    freight:[[-9,-3],[-3,-3],[-3,-1.6],[-1,-1.6],[-1,-3.4],[6,-3.4],[9,-1.8],[9,1.8],[6,3.4],[-1,3.4],[-1,1.6],[-3,1.6],[-3,3],[-9,3]],
    unit:[[-9,-3.1],[3.5,-3.1],[7,-2.3],[10,0],[7,2.3],[3.5,3.1],[-9,3.1]]
  };
  const trainSpriteWidth = 23, trainSpriteHeight = 11;
  function trainSprite(kind, color){
    const ratio = Math.max(1, Math.min(3, Math.ceil(DPR)));
    const key = `${kind}:${color}:${ratio}`;
    let sprite = trainSprites.get(key);
    if (sprite) return sprite;
    sprite = document.createElement('canvas');
    sprite.width = trainSpriteWidth * ratio;
    sprite.height = trainSpriteHeight * ratio;
    const g = sprite.getContext('2d');
    g.setTransform(ratio, 0, 0, ratio, sprite.width / 2, sprite.height / 2);
    g.lineJoin = 'round';
    g.beginPath();
    trainShapes[kind].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
    g.strokeStyle = '#fdf2d6'; g.lineWidth = 2.6; g.stroke();
    g.fillStyle = '#3e342a';
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = '#3e342a'; g.lineWidth = 0.9; g.stroke();
    g.fillStyle = '#f7eac9';
    if (kind === 'freight'){
      g.fillRect(-7.5, -1.6, 1, 3.2);
      g.fillRect(-5.5, -1.6, 1, 3.2);
    } else {
      g.fillRect(-7.5, -1.1, 2.5, 2.2);
      g.fillRect(-3.5, -1.1, 2.5, 2.2);
      g.fillRect(0.5, -1.1, 2.5, 2.2);
    }
    g.fillStyle = '#292c29'; g.fillRect(5, -1.35, 2.2, 2.7);
    g.fillStyle = '#fff2c0'; g.fillRect(8, -0.6, 1.2, 1.2);
    trainSprites.set(key, sprite);
    return sprite;
  }

  let trainRoutesSource, trainRoutes = new Map();
  function drawTrains(now, w, h){
    const S = G.S;
    if (trainRoutesSource !== S.routes || trainRoutes.size !== S.routes.length){
      trainRoutesSource = S.routes;
      trainRoutes = new Map(S.routes.map(r => [r.id, r]));
    }
    const events = G.events, latest = events[events.length - 1];
    const fresh = ui.speed <= 3 && latest?.at > ui.lastEvt ? events.filter(e => e.at > ui.lastEvt) : null;
    if (latest) ui.lastEvt = latest.at;
    const positions = fresh && new Map();
    const scale = Math.max(0.67, Math.min(1, 0.48 + view.s/60));
    const sw = trainSpriteWidth * scale, sh = trainSpriteHeight * scale;
    // 全图视角下，同一小块屏幕区域只画一个车标，放大后恢复逐列显示。
    const occupied = view.s <= fitScale(w,h)*1.02 ? new Set() : null;
    const cellSize = Math.round(sw * 0.8);
    const columns = Math.ceil((w + 40) / cellSize) + 3;
    const gridX = view.ox % cellSize, gridY = view.oy % cellSize;
    for (const t of S.trains){
      if (t.status !== 'run') continue;
      const plan = G.econ[t.id]?.plan, route = trainRoutes.get(t.route);
      if (!plan?.ok || !plan.legs.length || !route) continue;
      const legs = plan.legs, step = t.dir ? -1 : 1;
      let i = t.dir ? legs.length - 1 : 0;
      let leg = legs[i], time = (t.phase || 0) - 0.6;
      // 返程从末段向前遍历，保留站停以及始发等待的位置。
      while (time > leg.h && legs[i + step]){
        time -= leg.h + plan.dwell;
        if (time <= 0){ time = leg.h; break; }
        i += step;
        leg = legs[i];
      }
      const from = C[t.dir ? leg.to : leg.from], to = C[t.dir ? leg.from : leg.to];
      const ax = sx(from.lon), ay = sy(from.lat), dx = sx(to.lon) - ax, dy = sy(to.lat) - ay;
      const q = Math.max(0, Math.min(1, time / leg.h));
      const x = ax + dx*q, y = ay + dy*q;
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      if (occupied){
        const cell = Math.floor((y + 20 - gridY) / cellSize) * columns + Math.floor((x + 20 - gridX) / cellSize);
        if (occupied.has(cell)) continue;
        occupied.add(cell);
      }
      positions?.set(t.id, { x, y });
      const model = G.trainById[t.model];
      const sprite = trainSprite(G.isUnit(model) ? 'unit' : model.use, route.color);
      const length = Math.hypot(dx, dy) || 1;
      const cos = dx / length * DPR, sin = dy / length * DPR;
      ctx.setTransform(cos, sin, -sin, cos, x*DPR, y*DPR);
      ctx.drawImage(sprite, -sw/2, -sh/2, sw, sh);
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (fresh) for (const ev of fresh){
      const p = positions.get(ev.t);
      if (p) ui.floaters.push({ x:p.x, y:p.y, amt:ev.amt, t0:now });
    }
  }

  // 地图交互
  let drag = null;
  cv.addEventListener('mousedown', e => { drag = { x:e.clientX, y:e.clientY, ox:view.ox, oy:view.oy, moved:false }; });
  window.addEventListener('mousemove', e => { if (!drag) return; const dx = e.clientX-drag.x, dy = e.clientY-drag.y; if (Math.abs(dx)+Math.abs(dy) > 4){ drag.moved = true; cv.classList.add('drag'); } if (drag.moved){ view.ox = drag.ox + dx; view.oy = drag.oy + dy; } });
  window.addEventListener('mouseup', e => { if (!drag) return; const d = drag; drag = null; cv.classList.remove('drag'); if (!d.moved && e.target === cv) mapClick(e); });
  // 触屏：单指拖动，双指缩放，轻点选择
  let tch = null;
  const tpts = e => [...e.touches].map(t => ({ x:t.clientX, y:t.clientY }));
  cv.addEventListener('touchstart', e => { e.preventDefault(); const p = tpts(e);
    if (p.length === 1) tch = { mode:'pan', x:p[0].x, y:p[0].y, ox:view.ox, oy:view.oy, moved:false, t:performance.now() };
    else if (p.length >= 2) { const r = cv.getBoundingClientRect(); tch = { mode:'pinch', d:Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y), s:view.s, ox:view.ox, oy:view.oy, mx:(p[0].x+p[1].x)/2 - r.left, my:(p[0].y+p[1].y)/2 - r.top, moved:true }; } }, { passive:false });
  cv.addEventListener('touchmove', e => { e.preventDefault(); if (!tch) return; const p = tpts(e);
    if (tch.mode === 'pan' && p.length === 1){ const dx = p[0].x-tch.x, dy = p[0].y-tch.y; if (Math.abs(dx)+Math.abs(dy) > 8) tch.moved = true; if (tch.moved){ view.ox = tch.ox + dx; view.oy = tch.oy + dy; } }
    else if (tch.mode === 'pinch' && p.length >= 2){ const r = cv.getBoundingClientRect(); const d = Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y); const mx = (p[0].x+p[1].x)/2 - r.left, my = (p[0].y+p[1].y)/2 - r.top;
      const ns = Math.max(4, Math.min(72, tch.s * d / Math.max(10, tch.d))); const k = ns / tch.s;
      view.s = ns; view.ox = mx - (tch.mx - tch.ox)*k; view.oy = my - (tch.my - tch.oy)*k; } }, { passive:false });
  cv.addEventListener('touchend', e => { e.preventDefault(); if (!tch) return;
    if (tch.mode === 'pan' && !tch.moved && !e.touches.length) mapClick({ clientX:tch.x, clientY:tch.y, target:cv });
    if (!e.touches.length) tch = null; else if (e.touches.length === 1){ const p = tpts(e); tch = { mode:'pan', x:p[0].x, y:p[0].y, ox:view.ox, oy:view.oy, moved:true }; } }, { passive:false });
  cv.addEventListener('touchcancel', () => { tch = null; });
  if (window.ResizeObserver) new ResizeObserver(() => { const r = cv.getBoundingClientRect(); if (r.width && (Math.abs(r.width*DPR - cv.width) > 1 || Math.abs(r.height*DPR - cv.height) > 1)) resize(); }).observe($('#mapwrap'));
  // 手机布局：地图 / 分屏 / 面板 三档
  const SHEET = ['m-map', '', 'm-full']; let sheet = 1;
  function setSheet(k){ sheet = Math.max(0, Math.min(2, k)); document.body.classList.remove('m-map','m-full'); if (SHEET[sheet]) document.body.classList.add(SHEET[sheet]); }
  $('#bSheetUp').onclick = () => setSheet(sheet + 1);
  $('#bSheetDn').onclick = () => setSheet(sheet - 1);
  const menuButton = $('#bMenu');
  const top = $('#top');
  function setMenu(open){
    top.classList.toggle('menu', open);
    menuButton.setAttribute('aria-expanded', open);
  }
  menuButton.onclick = e => { e.stopPropagation(); setMenu(!top.classList.contains('menu')); };
  document.addEventListener('click', e => { if (!e.target.closest('.topbtns')) setMenu(false); });
  top.querySelector('.topbtns').addEventListener('click', () => setMenu(false));
  ui.setSheet = setSheet; ui.sheet = () => sheet;
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1/1.15); }, { passive:false });
  function zoomAt(px, py, k){ const ns = Math.max(4, Math.min(72, view.s * k)); k = ns / view.s; view.ox = px - (px - view.ox)*k; view.oy = py - (py - view.oy)*k; view.s = ns; }
  document.querySelectorAll('#zoom button').forEach(b => b.onclick = () => { const z = +b.dataset.z; const r = cv.getBoundingClientRect(); if (!z) fit(); else zoomAt(r.width/2, r.height/2, z); });
  function hit(mx, my){
    const TT = matchMedia('(pointer:coarse)').matches; let best = null, bd = TT ? 24 : 14;
    C.forEach(c => { const d = Math.hypot(sx(c.lon)-mx, sy(c.lat)-my); if (d < bd){ bd = d; best = { city:c.i }; } });
    if (best) return best;
    let be = null, bed = TT ? 14 : 7;
    E.forEach(e => { if (e.sup && !edgeTracks(e).length) return; const a = C[e.a], b = C[e.b]; const d = segDist(mx,my,sx(a.lon),sy(a.lat),sx(b.lon),sy(b.lat)); if (d < bed){ bed = d; be = { edge:e.i }; } });
    return be;
  }
  function segDist(px,py,x1,y1,x2,y2){ const dx=x2-x1, dy=y2-y1; const t = Math.max(0, Math.min(1, ((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy))); return Math.hypot(px-(x1+t*dx), py-(y1+t*dy)); }
  function selectEdge(eid){
    ui.selEdge = eid; ui.selCity = null; ui.tab = 'build';
    if (window.innerWidth <= 760) setSheet(2);
    renderTabs(); renderPanel(true); renderInspector();
    $('#panelBody').scrollTop = 0;
  }
  function selectCity(ci){
    const wasBuilding = ui.tab === 'build' && ui.selEdge !== null;
    ui.selCity = ci; ui.selEdge = null;
    if (wasBuilding) renderPanel(true);
    renderInspector();
  }
  function mapClick(e){
    const r = cv.getBoundingClientRect(); const h = hit(e.clientX - r.left, e.clientY - r.top);
    if (ui.mode === 'route'){
      if (!h || h.city === undefined) return;
      const c = h.city;
      if (!ui.draft.length){ ui.draft.push(c); renderRouteBar(); return; }
      const last = ui.draft[ui.draft.length-1];
      if (c === last) return;
      if (ui.draft.length >= 2 && c === ui.draft[ui.draft.length-2]){ ui.draft.pop(); renderRouteBar(); return; }
      if (ui.draft.includes(c)) return toast('不能重复经过同一车站', '一条运营线路中每座城市只能停靠一次。', 'bad');
      if (G.edgeByPair[last+'-'+c] && G.routeAllowed(last, c)){ ui.draft.push(c); renderRouteBar(); return; }
      const path = G.findPath(last, c, ui.draft);
      if (!path) return toast('找不到可通行的轨道', `${C[last].name} 到 ${C[c].name} 之间没有连通的已建线路。可在「建设」页修建。`, 'bad');
      path.slice(1).forEach(v => ui.draft.push(v)); renderRouteBar(); return;
    }
    if (h && h.edge !== undefined){ selectEdge(h.edge); return; }
    selectCity(h ? h.city : null);
  }

  // ---------------- 顶栏 ----------------
  function eraName(y){ return y < 1992 ? '改革开放 · 试点阶段' : y < 2001 ? '市场化改革 · 提速年代' : y < 2008 ? '入世 · 跨越发展' : y < 2016 ? '高铁时代' : '新时代 · 复兴'; }
  function renderTop(){
    const S = G.S; const d = G.dateOf(S.day);
    $('#date').textContent = `${d.getFullYear()}年${String(d.getMonth()+1).padStart(2,'0')}月${String(d.getDate()).padStart(2,'0')}日`;
    $('#era').textContent = eraName(d.getFullYear());
    $('#coName').textContent = S.company;
    $('#coName').title = S.company;
    $('#kCash').textContent = W(S.cash); $('#kCash').className = S.cash < 0 ? 'loss' : '';
    $('#kDebt').textContent = W(S.debt + (S.bonds || []).reduce((a, b) => a + b.amt, 0)); $('#kDebt').title = `银行借款 ${W(S.debt)}元 · 企业债 ${W((S.bonds || []).reduce((a, b) => a + b.amt, 0))}元`;
    $('#kWorth').textContent = W(G.netWorth());
    const h = S.history[S.history.length-1]; const net = h ? h.net : 0;
    $('#kNet').textContent = (net>0?'+':'') + W(net); $('#kNet').className = financialClass(net);
    $('#kLit').textContent = `${Object.keys(S.lit).length} / ${C.length}`;
    document.querySelectorAll('#speed button').forEach(b => {
      const active = +b.dataset.s === ui.speed;
      b.classList.toggle('on', active);
      b.setAttribute('aria-pressed', active);
    });
  }
  document.querySelectorAll('#speed button').forEach(b => b.onclick = () => setSpeed(+b.dataset.s));
  function setSpeed(s){ ui.speed = s; if (s) ui.lastSpeed = s; renderTop(); }
  window.addEventListener('keydown', e => {
    if (['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (e.code === 'Space'){ e.preventDefault(); setSpeed(ui.speed ? 0 : ui.lastSpeed || 1); }
    if (e.key >= '1' && e.key <= '4') setSpeed(+e.key);
    if (e.key === 'Escape'){ if (ui.mode === 'route') cancelRoute(); else selectCity(null); }
  });

  // 地图图层开关与图例
  function renderTools(){
    const L = ui.layers;
    const it = [['state','国铁线路','国铁'],['rivals','同业线路','同业'],['cand','规划走廊','走廊'],['trains','列车','列车'],['labels','城市名','地名'],['flow','客货流量','流量'],['industry','城市产业','产业']];
    const tools = $('#maptools');
    const scroll = tools.scrollLeft;
    const focused = tools.contains(document.activeElement) ? document.activeElement.dataset.layer : null;
    tools.innerHTML = it.map(([k,n,short]) => `<button class="chip" data-layer="${k}" aria-label="${n}" title="${n}" aria-pressed="${L[k]}"><span class="layer-check" aria-hidden="true">${icon('check')}</span><span class="layer-label">${n}</span><span class="layer-label-short">${short}</span></button>`).join('');
    tools.scrollLeft = scroll;
    if (focused) tools.querySelector(`[data-layer="${focused}"]`)?.focus({ preventScroll:true });
    tools.querySelectorAll('button').forEach(b => b.onclick = () => {
      const k = b.dataset.layer;
      L[k] = !L[k];
      if (k === 'trains') clearTrainFloaters();
      renderTools();
    });
    const extraLeg = (L.flow ? `<div><i style="background:rgba(29,94,158,.6);height:5px"></i>本公司客流</div><div><i style="background:rgba(140,82,30,.6);height:5px"></i>本公司货流</div>` : '')
      + (L.industry ? CARGO_IDS.filter(g => g !== 'general').map(g => `<div><i style="background:${CARGO[g].color};height:8px;width:8px;border-radius:50%"></i>产${CARGO[g].name}</div>`).join('') : '');
    $('#legend').innerHTML = extraLeg + `
      <div><i style="background:${P.own};height:4px"></i>自有线路</div>
      <div><i style="background:${P.state}"></i>国铁（非电化）</div>
      <div><i style="background:${P.stateElec}"></i>国铁（电气化）</div>
      <div><i style="background:${P.stateHsr};height:4px;box-shadow:inset 0 0 0 1px #fff"></i>高速铁路</div>
      ${RIVALS.map(r => `<div><i style="background:${r.color}"></i>${r.name}</div>`).join('')}
      <div><i style="background:repeating-linear-gradient(90deg,#aaa 0 5px,transparent 5px 9px)"></i>在建</div>
      <div><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${P.cityLit};box-shadow:0 0 8px ${P.cityLit};margin:0 6px 0 6px"></span>已点亮城市</div>`;
  }

  // ---------------- 检查器（地图浮窗） ----------------
  function cityEconBox(c, y){
    const S = G.S; const sd = G.cargoSD(c, y); const pop = G.popOf(c, y); const lv = cityLevel(pop);
    const b = (S.boost||{})[c.i] || 0; const tr = (S.cityTrips||{})[c.i] || 0;
    const fmt = o => CARGO_IDS.map(g => [g, o[g]]).filter(x => x[1] >= 1).sort((a,b) => b[1]-a[1]).slice(0,4)
      .map(([g,v]) => `<span class="tag" style="border-color:${CARGO[g].color};color:${CARGO[g].color}">${CARGO[g].name} ${v.toFixed(0)}</span>`).join(' ') || '<span class="dim">—</span>';
    return `<div class="row sb" style="margin-top:8px"><span><b>${CITY_LEVELS[lv][1]}</b>${lv < CITY_LEVELS.length-1 ? `<span class="dim">（${CITY_LEVELS[lv+1][0]} 万人升级为${CITY_LEVELS[lv+1][1]}）</span>` : ''}</span>
      <span class="dim">铁路带动人口 ${b > 0 ? '<span class="gain">+' + (b*100).toFixed(1) + '%</span>' : '—'}${tr ? ` · 月停站 ${tr.toFixed(0)} 次` : ''}</span></div>
      <div style="margin-top:6px;font-size:12px"><span class="dim">发送货物：</span>${fmt(sd.S)}</div>
      <div style="margin-top:4px;font-size:12px"><span class="dim">到达需求：</span>${fmt(sd.D)}</div>`;
  }
  function stationBox(c){
    const S = G.S; const st = S.stations[c.i]; const lv = st ? st.lv : 0;
    let h = `<h3>车站 · ${c.tier === 2 ? '二线城市' : '三线城市'}</h3>`;
    h += `<div class="row sb"><div>${lv ? `<b>${c.name}站</b> <span class="tag gold">${STATION_LEVELS[lv].name}</span>` : '<span class="tag">尚未开站</span>'}
      ${st && st.pend ? ` <span class="tag blue">施工中 → ${STATION_LEVELS[st.pend.lv].name} · ${Math.max(0,Math.ceil((st.pend.done-S.day)/30))}个月</span>` : ''}</div>
      ${lv ? `<span class="num muted">月客流 ${((st.load||0)/1e4).toFixed(1)} / ${STATION_LEVELS[lv].paxCap*2} 万人次</span>` : ''}</div>`;
    if (lv && st.util > 1) h += `<div class="neg" style="font-size:12px;margin-top:4px">车站能力已饱和（${Math.round(st.util*100)}%），扩建可多收旅客。</div>`;
    h += `<div class="table-scroll" tabindex="0" role="region" aria-label="数据表" style="margin-top:6px"><table class="t">` + [1,2,3].map(L => { const D = STATION_LEVELS[L]; const q = G.stationQuote(c.i, L); const done = lv >= L; const busy = st && st.pend;
      return `<tr><td><b>${D.name}</b><br><span class="dim">${D.desc}；客流上限 ${D.paxCap*2} 万人次/月${D.freight?'':'；不办货运'}</span></td>
        <td class="num r">${done ? '<span class="dim">已建</span>' : fmtY(q.cost) + `<br><span class="dim">${q.months} 个月</span>`}</td>
        <td>${done ? '' : `<button class="btn sm ${L===lv+1?'primary':''}" data-act="station" data-c="${c.i}" data-lv="${L}" ${busy?'disabled':''}>${lv ? '扩建' : '开站'}</button>`}</td></tr>`; }).join('') + `</table></div>`;
    h += `<div class="dim" style="font-size:11px;margin-top:4px">小城市客流不大，但在本公司枢纽换乘其他线路时客流有接驳加成，车站等级越高加成越大。</div>`;
    return h;
  }
  function renderInspector(){
    const box = $('#inspector'); const S = G.S; const y = G.ym(S.day).y;
    if (ui.selCity !== null && ui.selCity !== undefined){
      const c = C[ui.selCity]; const pop = G.popOf(c, y);
      const conns = G.adj[c.i].map(e => { const o = e.a===c.i ? e.b : e.a; const ts = edgeTracks(e); return { o, e, ts }; });
      const dem = C.filter(o => o.i !== c.i).map(o => { const d = Math.round(hav(c, o)*1.2); return { o, d, D: G.paxDemand(c.i, o.i, d, y, 70) }; }).sort((a,b) => b.D - a.D).slice(0,5);
      const routes = S.routes.filter(r => r.stops.includes(c.i));
      box.innerHTML = `<button class="x" data-close aria-label="关闭详情">${icon('close')}</button>
        <h2>${c.name} ${S.lit[c.i] ? '<span class="tag gold">已点亮</span>' : '<span class="tag">未点亮</span>'} ${c.tag ? `<span class="tag ${c.tag==='特区'?'red':'blue'}">${c.tag}</span>`:''}</h2>
        <div class="grid3">
          <div class="stat"><label>市区人口</label><b>${pop.toFixed(0)}</b><small>&nbsp;万</small></div>
          <div class="stat"><label>货运指数</label><b>${G.freightOf(c, y).toFixed(1)}</b></div>
          <div class="stat"><label>${c.abroad ? '国家' : '地区'}</label><b style="font-size:14px">${c.abroad || c.region}</b></div>
        </div>
        ${cityEconBox(c, y)}
        ${cityEstateBox(c, y)}
        ${c.tier > 1 ? stationBox(c) : `<div class="dim" style="font-size:11px;margin-top:6px">大城市可直接使用国铁车站，无需自建。</div>` + depotBox(c)}
        <h3>相邻走廊 <span class="dim" style="font-weight:400">（点击查看或修建）</span></h3>
        <div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t">${conns.map(x => `<tr style="cursor:pointer" data-act="selEdge" data-e="${x.e.i}" title="查看/修建该走廊"><td>→ ${C[x.o].name}</td><td class="num r">${x.e.dist} km</td><td>${x.ts.length ? x.ts.map(t => `<span class="swatch" style="background:${ownerColor(t.owner)}" title="${ownerName(t.owner)}"></span>`).join('') + `<span class="dim">${Math.max(...x.ts.map(t=>t.v))} km/h</span>` : '<span class="dim">未建</span>'}</td></tr>`).join('')}</table></div>
        <h3>客流潜力最高的目的地（月客流，全方式）</h3>
        <div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t">${dem.map(x => `<tr><td>${x.o.name}</td><td class="num r">${x.d} km</td><td class="num r">${(x.D/1e4).toFixed(1)} 万人次</td></tr>`).join('')}</table></div>
        ${routes.length ? `<h3>途经本站的线路</h3>${routes.map(r => `<div class="row"><span class="swatch" style="background:${r.color}"></span><span class="clip-name" title="${esc(r.name)}">${esc(r.name)}</span></div>`).join('')}` : ''}
        <div class="sep"></div>
        <button class="btn primary sm" data-act="routeFrom" data-c="${c.i}">以此为起点新建运营线路</button>`;
      box.classList.add('show');
    } else if (ui.selEdge !== null && ui.selEdge !== undefined && window.innerWidth > 760){
      const e = E[ui.selEdge]; const ts = edgeTracks(e);
      box.innerHTML = `<button class="x" data-close aria-label="关闭详情">${icon('close')}</button>
        <h2>${C[e.a].name} — ${C[e.b].name}</h2>
        <div class="muted">${e.dist} km · 地形系数 ${e.terrain}${(()=>{ const h = HexMap.edgeTerrain(C[e.a], C[e.b]); return ` · 沿线地形 ×${h.factor}（最难路段：${h.worst}）`; })()}${e.plateau ? ' · <span class="gold">高原线路</span>' : ''}${e.line ? ' · ' + e.line : ''}</div>
        ${e.xb || e.abroad ? `<div class="muted">${e.xb ? '跨境' : '境外'} · ${e.country}${G.edgeLock(e) ? ` · <span class="neg">${G.lockText(e)}</span>` : ''}</div>` : ''}
        <div class="table-scroll" tabindex="0" role="region" aria-label="数据表" style="margin-top:8px"><table class="t"><tr><th>产权</th><th class="r">速度</th><th>电气化</th><th class="r">过轨费(客)</th></tr>
        ${ts.map(t => `<tr><td><span class="swatch" style="background:${ownerColor(t.owner)}"></span>${t.owner === 'S' && e.abroad ? e.country + '国家铁路' : ownerName(t.owner)}${t.status==='build'?' <span class="tag">在建</span>':''}<div class="dim">${trackUse(t)}</div></td><td class="num r">${t.v}</td><td>${t.elec?'是':'否'}</td><td class="num r">${t.owner==='P'?'—':G.feeRate(t,'pax',y).toFixed(0)+' 元/列km'}</td></tr>`).join('') || '<tr><td colspan="4" class="dim">尚无线路，可抢先修建</td></tr>'}
        </table></div><div class="sep"></div><div class="muted">修建或改造请在右侧「建设」页操作。</div>`;
      box.classList.add('show');
    } else box.classList.remove('show');
  }
  function hav(a,b){ const R=6371,t=Math.PI/180; const dLa=(b.lat-a.lat)*t, dLo=(b.lon-a.lon)*t; const x=Math.sin(dLa/2)**2+Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(x)); }
  $('#inspector').addEventListener('click', e => { if (e.target.closest('[data-close]')){ selectCity(null); return; } act(e); });

  // ---------------- 新建线路 ----------------
  function startRoute(first){ ui.mode = 'route'; ui.draft = first !== undefined ? [first] : []; ui.selCity = ui.selEdge = null; renderInspector(); cv.classList.add('routing'); renderRouteBar(); }
  function cancelRoute(){ ui.mode = 'view'; ui.draft = []; cv.classList.remove('routing'); renderRouteBar(); }
  function renderRouteBar(){
    const b = $('#routebar');
    if (ui.mode !== 'route'){ b.classList.remove('show'); return; }
    if (ui.sheet && ui.sheet() === 2) ui.setSheet(1);
    let dist = 0; for (let k = 0; k < ui.draft.length-1; k++) dist += G.edgeByPair[ui.draft[k]+'-'+ui.draft[k+1]].dist;
    const n = ui.draft.length, long = n > 6, open = !!(long && ui.rbOpen);
    b.classList.toggle('open', open);
    b.innerHTML = `<div class="routebar-content"><div class="rb-head"><b class="gold">新建运营线路</b>
      ${n > 1 ? `<span class="num muted">${n}&nbsp;站 · ${dist}&nbsp;km</span>` : ''}
      ${long ? `<button class="btn sm rb-toggle" data-rb="toggle" aria-expanded="${open}">${open ? '收起' : '展开全部'}</button>` : ''}</div>
      <div class="stops rb-stops">${n ? (() => { const st = G.stopFlags({ stops:ui.draft }); return ui.draft.map((c,k) => (k?`<span class="arr">${icon('next')}</span>`:'') + `<span class="s${st[k]?'':' pass'}" title="${st[k]?'停靠':'未开站，列车通过不停'}">${C[c].name}</span>`).join(''); })() : '<span class="muted">点击起点城市，再点击下一座目的城市（可跨越多站，自动沿已建轨道寻路）</span>'}</div></div>
      <div class="routebar-actions"><button class="btn sm" data-rb="undo">撤销</button><button class="btn sm" data-rb="cancel">取消</button>
      <button class="btn sm primary" data-rb="ok" ${n < 2 ? 'disabled' : ''}>完成</button></div>`;
    b.classList.add('show');
    { const sv = b.querySelector('.rb-stops'); if (sv){ if (open) sv.scrollTop = sv.scrollHeight; else sv.scrollLeft = sv.scrollWidth; } }
    b.querySelectorAll('[data-rb]').forEach(x => x.onclick = () => {
      const k = x.dataset.rb;
      if (k === 'toggle'){ ui.rbOpen = !ui.rbOpen; renderRouteBar(); }
      if (k === 'undo'){ ui.draft.pop(); renderRouteBar(); }
      if (k === 'cancel') cancelRoute();
      if (k === 'ok'){
        const r = G.createRoute(ui.draft);
        ui.selRoute = r.id;
        ui.openDetails.routes = String(r.id);
        cancelRoute();
        ui.tab = 'routes';
        renderTabs(); renderPanel(true);
        document.getElementById(`fold-routes-${r.id}`).scrollIntoView({ block:'nearest' });
        toast('线路已创建', `${r.name}。现在可以为它购买或分配列车。`, 'good'); snd('horn');
      }
    });
  }

  // ---------------- 面板 ----------------
  const TABS = [['overview','总览'],['build','建设'],['routes','线路'],['fleet','车队'],['market','购车'],['contracts','合同'],['estate','产业'],['mgmt','管理'],['finance','财务'],['policy','政策'],['projects','项目'],['rivals','同业']];
  function renderTabs(){ $('#tabs').innerHTML = TABS.map(([k,n]) => `<button class="${ui.tab===k?'on':''}" data-tab="${k}">${n}</button>`).join('');
    { const tb = $('#tabs'), on = tb.querySelector('.on'); if (on && tb.scrollWidth > tb.clientWidth) tb.scrollLeft = Math.max(0, on.offsetLeft - (tb.clientWidth - on.offsetWidth)/2); }
    $('#tabs').querySelectorAll('button').forEach(b => b.onclick = () => { ui.tab = b.dataset.tab; if (ui.sheet && ui.sheet() === 0) ui.setSheet(1); renderTabs(); renderPanel(true); $('#panelBody').scrollTop = 0; }); }
  function signature(){ const S = G.S; return [ui.tab, S.lastYM, S.trains.map(t => t.status + t.route).join(','), S.tracks.filter(t => t.status==='ok').length, S.tracks.length, S.routes.length, S.tracks.filter(t=>t.upg).length, (S.offers||[]).length, (S.contracts||[]).length, (S.bonds||[]).length, !!S.ipo, S.ipo ? S.ipo.payoutLv : '', S.rivals.filter(r=>r.acquired).length, S.routes.map(r=>r.svc).join(''), S.tracks.filter(t=>t.sigUpg).length, (S.locals||[]).length, JSON.stringify(S.biz||{}), JSON.stringify(S.land||{}), S.routes.map(r=>r.slow?1:0).join(''), JSON.stringify(S.execs||{}), (S.cands||[]).length, S.trainLv||0, JSON.stringify(S.rd||{}), (S.gov||[]).map(g=>g.id+g.st).join(','), (S.wars||[]).map(w=>w.rid+(w.resp||'')+(w.ended?'x':'')).join(','), S.rivals.map(r=>(r.plan?r.plan.e:'')+':'+Math.round((r.stake||0)/1e6)).join(','), S.ipo?S.ipo.shares:0, JSON.stringify((S.franch||[]).map(f=>[f.uid,f.st,f.bid,f.holder])), JSON.stringify(S.supers||{}).length, (S.overseas||[]).map(x=>x.id+x.st).join(','), (S.depots||[]).map(d=>d.ci+':'+d.lv+(d.pend?'p':'')).join(','), S.routes.map(r=>r.grade||'').join(''), (S.usedOffers||[]).map(o=>o.id).join(',')].join('|'); }
  function renderPanel(force){
    if (!force && document.body.classList.contains('m-map')) return;   // 手机「全屏地图」时面板收起，等展开再刷新
    const sig = signature();
    if (!force){ if (sig === ui.sig) return; const ae = document.activeElement; if (ae && $('#panelBody').contains(ae) && ['SELECT','INPUT'].includes(ae.tagName)) return; }
    ui.sig = sig;
    const body = $('#panelBody'); const st = body.scrollTop;
    const focused = document.activeElement?.classList.contains('fold-toggle') ? document.activeElement.id : '';
    body.innerHTML = ({ overview:pOverview, build:pBuild, routes:pRoutes, fleet:pFleet, market:pMarket, contracts:pContracts, estate:pEstate, mgmt:pMgmt, finance:pFinance, policy:pPolicy, projects:pProjects, rivals:pRivals })[ui.tab]();
    body.scrollTop = st;
    if (focused) document.getElementById(focused)?.focus({ preventScroll:true });
    if (ui.tab === 'finance'){ requestAnimationFrame(drawFinanceCharts); setTimeout(drawFinanceCharts, 60); setTimeout(drawStockChart, 70); }
    if (ui.tab === 'overview'){ requestAnimationFrame(drawMiniChart); setTimeout(drawMiniChart, 60); }
  }

  function foldCard(group, id, summary, detail, className = 'card', color = ''){
    const key = `fold-${group}-${id}`;
    const open = ui.openDetails[group] === String(id);
    return `<div class="${className}"${color ? ` style="border-color:${esc(color)}"` : ''}>
      <button class="fold-toggle" type="button" id="${key}" data-act="toggleDetail" data-group="${group}" data-id="${id}" aria-expanded="${open}" aria-controls="${key}-body">
        <span class="fold-summary">${summary}</span><span class="fold-chevron">${icon('down')}</span>
      </button>
      <div class="fold-body" id="${key}-body"${open ? '' : ' hidden'}>${open ? detail() : ''}</div>
    </div>`;
  }

  // —— 总览 ——
  function pOverview(){
    const S = G.S; const y = G.ym(S.day).y;
    const own = S.tracks.filter(t => t.owner==='P');
    const km = own.filter(t => t.status==='ok').reduce((a,t) => a + E[t.e].dist, 0);
    const regions = {}; C.forEach(c => { regions[c.region] = regions[c.region] || { n:0, lit:0 }; regions[c.region].n++; if (S.lit[c.i]) regions[c.region].lit++; });
    const h = S.history[S.history.length-1];
    const runCount = S.trains.filter(t => t.status==='run').length;
    const guide = !S.routes.length || !S.trains.length;
    return `
      <h2>${esc(S.company)} <span class="tag gold">${y}年</span></h2>
      ${scnBox()}
      ${guide ? `<div class="hint"><b>开局指南</b><br>
        ① 打开「线路」页，点击 <b>新建运营线路</b>，在地图上点起点和终点城市，系统自动沿已建轨道寻路（可直接使用国铁线路，按列·公里付过轨费）。<br>
        ② 打开「购车」页挑选车型并分配到线路，交付后自动开行，沿线城市随之 <b>点亮</b>。<br>
        ③ 在「车队」关注载客率与单车利润；客流旺的干线越早进入越好。<br>
        ④ 点击地图上的走廊，在「建设」页修建 <b>自有线路</b>：省下过轨费，还能向国铁和同业收取过轨费。<br>
        ⑤ 政策会随年代推进解锁快速线、高速线与进口车型。空格键暂停，1–4 调整速度。</div><div style="height:10px"></div>` : ''}
      <div class="grid3">
        <div class="stat"><label>运营线路</label><b>${S.routes.length}</b><small> 条</small></div>
        <div class="stat"><label>列车（运营/总数）</label><b>${runCount}/${S.trains.length}</b></div>
        <div class="stat"><label>自有线路</label><b>${km.toLocaleString()}</b><small>&nbsp;km</small></div>
        <div class="stat"><label>上月客运量</label><b>${h ? (h.paxN/1e4).toFixed(1) : '0'}</b><small>&nbsp;万人次</small></div>
        <div class="stat"><label>上月货运量</label><b>${h ? (h.tons/1e4).toFixed(1) : '0'}</b><small>&nbsp;万吨</small></div>
        <div class="stat"><label>上月收入</label><b>${h ? W(h.rev) : '0'}</b></div>
      </div>
      <h3>净资产走势</h3><canvas class="chart" id="miniChart" style="height:120px"></canvas>
      <h3>点亮地图 · 地区进度</h3>
      ${Object.entries(regions).map(([k,v]) => `<div class="region"><span>${k}</span><div class="bar"><i style="width:${v.lit/v.n*100}%"></i></div><span class="num r muted">${v.lit}/${v.n}</span></div>`).join('')}
      <h3>成就</h3>
      ${G.ACH.map(a => `<div class="ach ${S.achievements[a.id]?'on':''}"><span class="ic">${icon('medal', S.achievements[a.id] ? '已达成' : '未达成')}</span><div><b>${a.name}</b> <span class="muted">${a.desc}</span></div><span class="num dim" style="margin-left:auto">${S.achievements[a.id]||''}</span></div>`).join('')}
      <h3>大事记</h3>
      <div class="newslist">${S.news.slice(0,14).map(n => `<div class="n ${n.kind}"><span class="d">${n.date}</span><b>${esc(n.title)}</b><div class="muted">${measureText(n.text)}</div></div>`).join('')}</div>`;
  }
  function drawMiniChart(){ const c = $('#miniChart'); if (!c) return; const H = G.S.history.slice(-60);
    chart(c, H.map(h => `${h.y}.${h.m}`), [{ color:financeColors.neutral, data:H.map(h => h.worth), movement:true, fill:true }]); }

  function signalHTML(tr, suffix){ const cur = G.sigOf(tr); const u = G.trackUtil[tr.id];
    return `<h3>信号与通过能力${suffix}</h3><div class="card"><dl class="kv"><dt>当前信号</dt><dd>${G.SIGNALS[cur].name}${tr.sigUpg ? ` <span class="tag blue">改造中 · ${Math.max(0,Math.ceil((tr.sigUpg.done-G.S.day)/30))}个月</span>` : ''}</dd>
      <dt>通过能力</dt><dd>${G.capOf(tr)} 列/日</dd>${u ? `<dt>当前利用率</dt><dd>${utilTag(tr.id)}（本公司 ${u.own.toFixed(1)} + 过轨 ${u.bg.toFixed(1)} 列/日）</dd>` : ''}</dl>
      ${G.SIGNALS.filter(x => x.id > cur).map(x => { const q = G.signalQuote(tr.id, x.id); return `<div class="row sb" style="padding:6px 0;border-top:1px solid var(--line)"><div><b>${x.name}</b> <span class="dim">${x.cap} 列/日 · ${x.desc}</span>${q.ok ? '' : `<br><span class="dim">${x.from} 年起可用</span>`}</div><div class="row"><span class="num">${q.ok ? fmtY(q.cost) : '—'}</span><button class="btn sm" data-act="signal" data-tr="${tr.id}" data-v="${x.id}" ${q.ok && !tr.sigUpg ? '' : 'disabled'}>改造</button></div></div>`; }).join('')}
      <div class="dim" style="font-size:11px;margin-top:4px">利用率超过 72% 开始晚点，超过 100% 严重拥堵：单程时间变长、每月趟数减少、正点率和满意度下降、事故风险上升。国铁线路的信号随年代自动升级。</div></div>`; }

  // —— 建设 ——
  function buildOptionsHTML(e, ts){
    if (G.edgeLock(e)) return '';
    if (e.sup && !ts.some(t => t.status === 'ok')) return '<div class="hint">超级工程通车后可增建并行线路。请在「项目」页查看工程进度。</div>';

    const g = G.groups[e.grp];
    const choices = G.TRACK_CLASSES.map(cl => {
      const here = !G.buildTrackBlock(e, cl.id);
      const q = g && g.edges.length > 1 ? G.groupQuote(g.i, cl.id, ui.bElec) : null;
      const group = q && q.segs.some(i => i !== e.i) ? q : null;
      return { cl, here, group, ok:G.canBuildClass(cl.id) };
    }).filter(o => o.here || o.group);
    if (!choices.length) return '';

    const selected = choices.find(o => o.ok && o.cl.id === ui.bCls) || choices.find(o => o.ok && o.here) || choices.find(o => o.ok);
    let html = `<h3>修建自有线路</h3><div class="card">` + choices.map(o => {
      const { cl, here, ok } = o, pol = G.policyById[cl.unlock];
      const q = G.buildQuote(e, cl.id, ui.bElec);
      return `<label class="row" style="padding:6px 0;border-bottom:1px solid var(--line);${ok?'':'opacity:.45'}">
        <input type="radio" name="bCls" value="${cl.id}" ${ok?'':'disabled'} ${o === selected ? 'checked':''} data-act="bCls">
        <div style="flex:1"><b>${cl.name}</b> <span class="dim">${cl.desc}</span>${ok ? (here ? '' : '<br><span class="dim">补建走廊其他区段</span>') : `<br><span class="dim">需政策：${pol.title}（${pol.y}年）</span>`}</div>
        <div class="num r">${ok && here ? fmtY(q.cost) : '—'}<br><span class="dim">${ok && here ? q.months + ' 个月' : ''}</span></div></label>`;
    }).join('');
    if (selected){
      const { cl, here, group } = selected;
      html += `<label class="row" style="margin-top:8px"><input type="checkbox" data-act="bElec" ${ui.bElec || G.isHighSpeed(cl.v) ? 'checked':''} ${G.isHighSpeed(cl.v) ? 'disabled':''}> 同步电气化（高速线默认电气化）</label>`;
      if (here){
        const q = G.buildQuote(e, cl.id, ui.bElec);
        html += `<div class="kv" style="margin-top:8px"><dt>单价</dt><dd>${q.unit.toFixed(1)} 万元/km</dd><dt>补贴</dt><dd>${pct(q.sub)}</dd><dt>总投资</dt><dd class="gold"><span class="measure">${fmtY(q.cost)}</span></dd><dt>可用现金</dt><dd><span class="measure">${fmtY(G.S.cash)}</span></dd></div>
          ${fundBtn(q.cost, `data-act="build" data-e="${e.i}" data-c="${cl.id}"`, '开工建设（仅本区段）', 'btn primary', 'margin-top:10px;width:100%')}`;
      }
      if (group){
        html += `<div class="build-group"><b>${C[g.a].name}—${C[g.b].name}</b><p class="muted"><span class="measure">${group.segs.length}&nbsp;段</span> · <span class="measure">${group.km}&nbsp;km</span> · <span class="measure">${fmtY(group.cost)}</span> · <span class="measure">${group.months}&nbsp;个月</span></p>${fundBtn(group.cost, `data-act="buildGrp" data-g="${g.i}" data-c="${cl.id}"`, '整段修建', 'btn', 'width:100%', true)}</div>`;
      }
    }
    return html + '</div>';
  }

  function pBuild(){
    const S = G.S; const y = G.ym(S.day).y;
    let html = '';
    if (ui.selEdge === null || ui.selEdge === undefined){
      html += `<div class="hint">在地图上 <b>点击两座城市之间的走廊</b>（实线为已建线路，虚线为可修建的走廊）以查看修建与改造选项。<br>拥有自有线路后，自己的列车免交过轨费，国铁与同业列车经过时还会向你付费。</div>`;
    } else {
      const e = E[ui.selEdge]; const ts = edgeTracks(e); const own = ts.filter(t => t.owner === 'P');
      html += `<h2>${C[e.a].name} — ${C[e.b].name} <span class="tag">${e.dist} km</span></h2>
        <div class="muted" style="margin-bottom:8px">地形系数 ${e.terrain}${e.west ? ' · 中西部' : ''}${e.plateau ? ' · <span class="gold">高原线路（需高原型机车）</span>' : ''}${e.xb ? ` · <span class="gold">跨境 · ${e.country}</span>（口岸通关${e.gauge ? '并换轮' : ''}，单程多 ${e.gauge ? 4 : 1.5} 小时）` : e.abroad ? ` · <span class="gold">境外 · ${e.country}</span>` : ''}</div>
        ${G.edgeLock(e) ? `<div class="hint">${icon('warning', '未开放')} ${G.lockText(e)}。政策出台前，这条走廊不能修建，也不能开行本公司列车。</div>` : (e.abroad || e.xb) ? `<div class="hint">境外与跨境线路不享受国内建设补贴${S.unlock.X4 ? '，可获丝路合作基金补贴 20%' : ''}；跨境旅客受签证限制，客流低于国内同等城市。</div>` : ''}
        <div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t"><tr><th>产权方</th><th class="r">最高速度</th><th>电气化</th><th class="r">过轨费 客/货</th></tr>
        ${ts.map(t => `<tr><td><span class="swatch" style="background:${ownerColor(t.owner)}"></span>${t.owner === 'S' && e.abroad ? e.country + '国家铁路' : t.owner === 'S' && e.xb ? '国家铁路（跨境联运）' : ownerName(t.owner)} ${t.status==='build'?`<span class="tag">在建 · ${Math.max(0,Math.ceil((t.done-S.day)/30))}个月</span>`:''}${t.upg?`<span class="tag blue">改造中</span>`:''}<div class="dim">${trackUse(t)}</div></td><td class="num r">${t.v} km/h</td><td>${t.elec ? icon('check', '已电气化') : '—'}</td><td class="num r">${G.feeRate(t,'pax',y).toFixed(0)} / ${G.isHighSpeed(t.v) ? '—' : G.feeRate(t,'freight',y).toFixed(0)}</td></tr>`).join('') || '<tr><td colspan="4" class="dim">该走廊尚无任何线路 —— 抢先修建可独享并收取过轨费</td></tr>'}
        </table></div><div class="dim" style="font-size:11px;margin-top:4px">过轨费单位：元/列·公里（按当年物价）</div>`;
      if (ts.some(t => G.isHighSpeed(t.v))) html += '<div class="hint">货车走普速或快速线。两类线路可以并行建设，地图共用一条走廊线。</div>';
      else if (own.length) html += '<div class="hint">新建高速客运专线会保留原有客货共用线。</div>';
      html += buildOptionsHTML(e, ts);
      for (const tr of own.filter(t => t.status === 'ok')){
        const suffix = own.length > 1 ? ` · ${trackUse(tr)}（${tr.v} km/h）` : '';
        html += signalHTML(tr, suffix);
        const upgrades = G.TRACK_CLASSES.filter(cl => G.isHighSpeed(cl.v) === G.isHighSpeed(tr.v) && (cl.v > tr.v || (cl.v === tr.v && !tr.elec)));
        if (tr.upg || !upgrades.length) continue;
        html += `<h3>改造自有线路${suffix}</h3><div class="card">` + upgrades.map(cl => {
          const ok = G.canBuildClass(cl.id); const q = G.upgradeQuote(tr, cl.id, true);
          const name = cl.v === tr.v ? '仅电气化改造' : '升级为 ' + cl.name + (tr.elec ? '' : '并电气化');
          return `<div class="row sb" style="padding:6px 0;border-bottom:1px solid var(--line);${ok?'':'opacity:.45'}"><div><b>${name}</b><br><span class="dim">${ok ? q.months+' 个月' : '需政策：'+G.policyById[cl.unlock].title}</span></div>
            <div class="row"><span class="num">${ok ? fmtY(q.cost) : '—'}</span><button class="btn sm" data-act="upgrade" data-tr="${tr.id}" data-c="${cl.id}" ${ok ? '' : 'disabled'}>改造</button></div></div>`; }).join('') + '</div>';
      }
    }
    // 自有线路清单
    const own = S.tracks.filter(t => t.owner==='P');
    html += `<h3>自有线路资产（${own.length} 段）</h3>`;
    if (!own.length) html += `<div class="dim">暂无</div>`;
    else html += `<div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t"><tr><th>区段</th><th class="r">里程</th><th class="r">速度</th><th class="r">月过轨列数</th><th>状态</th></tr>
      ${own.map(t => { const e = E[t.e]; return `<tr style="cursor:pointer" data-act="selEdge" data-e="${e.i}"><td>${C[e.a].name}—${C[e.b].name}<div class="dim">${trackUse(t)}</div></td><td class="num r">${e.dist}</td><td class="num r">${t.v}${t.elec ? icon('electric', '已电气化') : ''}</td><td class="num r">${t.usage ? t.usage.toFixed(0) : '—'}</td><td>${t.status==='build' ? `<span class="tag">在建 ${Math.max(0,Math.ceil((t.done-S.day)/30))}月</span>` : t.upg ? '<span class="tag blue">改造中</span>' : '<span class="tag green">运营</span>'}</td></tr>`; }).join('')}</table></div>`;
    return html;
  }

  // —— 线路 ——
  function odTable(r){
    const PI = G.pairInfo; const set = new Set(r.stops); const rows = [];
    Object.values(PI).forEach(x => { if (x.ci === undefined || !set.has(x.ci) || !set.has(x.cj)) return; rows.push(x); });
    const pax = rows.filter(x => x.use === 'pax').sort((a,b) => b.served - a.served).slice(0, 10);
    const fr = rows.filter(x => x.use === 'freight').sort((a,b) => b.served - a.served).slice(0, 8);
    const tr = x => `<tr><td>${C[x.ci].name}—${C[x.cj].name}</td>${x.use==='freight' ? `<td><span class="tag" style="color:${CARGO[x.g].color};border-color:${CARGO[x.g].color}">${CARGO[x.g].name}</span></td>` : ''}<td class="num r">${(x.D/1e4).toFixed(1)}</td><td class="num r">${(x.share*100).toFixed(0)}%</td><td class="num r">${(x.served/1e4).toFixed(1)}</td></tr>`;
    return `<div class="card" style="margin-top:6px">
      ${pax.length ? `<b>客流（万人次/月）</b><div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t"><tr><th>起讫</th><th class="r">总需求</th><th class="r">可争取</th><th class="r">本公司承运</th></tr>${pax.map(tr).join('')}</table></div>` : ''}
      ${fr.length ? `<b style="display:block;margin-top:8px">货流（万吨/月）</b><div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t"><tr><th>起讫</th><th>货种</th><th class="r">总需求</th><th class="r">可争取</th><th class="r">本公司承运</th></tr>${fr.map(tr).join('')}</table></div>` : ''}
      ${!pax.length && !fr.length ? '<div class="dim">列车运行后显示。</div>' : ''}
      <div class="dim" style="font-size:11px;margin-top:4px">「可争取」是相对国铁的竞争份额：你的列车比国铁越快，份额越高。货运只统计本线货车厢能装的货种。</div></div>`;
  }
  function pRoutes(){
    const S = G.S;
    let html = `<div class="row sb"><h2>运营线路</h2><button class="btn primary sm" data-act="newRoute">${icon('plus')} 新建运营线路</button></div>`;
    if (!S.routes.length) html += `<div class="hint">还没有运营线路。点击 <b>新建运营线路</b>，然后在地图上点击起点和终点（中途可再点几个城市），系统会沿已建轨道自动寻路。线路可以经过国铁、同业或自有轨道，系统会为每列车自动选择最优轨道（自有优先）。</div>`;
    const assigned = new Map();
    for (const t of S.trains){
      if (!t.route) continue;
      if (!assigned.has(t.route)) assigned.set(t.route, []);
      assigned.get(t.route).push(t);
    }
    S.routes.forEach(r => {
      const trains = assigned.get(r.id) || [];
      const run = trains.filter(t => t.status==='run' && G.econ[t.id] && G.econ[t.id].plan.ok);
      let dist = 0; for (let k = 0; k < r.stops.length-1; k++) dist += G.edgeByPair[r.stops[k]+'-'+r.stops[k+1]].dist;
      const lf = run.length ? run.reduce((a,t) => a + G.econ[t.id].lf, 0) / run.length : 0;
      const monthly = run.reduce((a,t) => a + G.econ[t.id].monthly, 0);
      const summary = `<span class="fold-heading"><span class="swatch" style="background:${esc(r.color)}"></span><b class="clip-name" title="${esc(r.name)}">${esc(r.name)}</b>${G.isBranch(r) ? '<span class="tag" title="起讫有二三线城市或全程 200 km 以内：适合安排旧型车，旧车不打折、维修更省">支线</span>' : ''}</span>
        <span class="fold-meta"><span>${dist}&nbsp;km</span><span>列车 ${run.length}/${trains.length}</span><span>平均载客/载重 ${pct(lf)}</span><span class="${financialClass(monthly)}">预计月净利 ${W(monthly)}</span></span>`;
      html += foldCard('routes', r.id, summary, () => {
        // 区段产权以首列运营车辆为准，没有运营车辆时用首列已分配车辆。
        const sample = run[0] || trains[0];
        const plan = G.econ[sample?.id]?.plan;
        return `<div class="row route-actions"><button class="btn sm" data-act="selRoute" data-id="${r.id}">${ui.selRoute===r.id?'取消高亮':'地图高亮'}</button>
          <button class="btn sm danger" data-act="delRoute" data-id="${r.id}">${ui.confirm==='r'+r.id?'确认删除?':'删除'}</button></div>
        ${routeTrainsHTML(trains)}
        <div class="stops" style="margin:8px 0">${(() => { const st = G.stopFlags(r); return r.stops.map((c,k) => { const town = C[c].tier > 1, lv = G.stationLv(c); const mid = k > 0 && k < r.stops.length-1;
          const cls = st[k] ? 's' : 's pass'; const tip = !town ? '大城市车站' : lv < 1 ? '未开设车站，列车通过' : mid ? (st[k] ? '停靠（点击改为通过）' : '通过（点击改为停靠）') : '始发/终到站';
          return (k?`<span class="arr">${icon('next')}</span>`:'') + `<span class="${cls}${town?' town':''}" title="${tip}" ${town && lv >= 1 && mid ? `data-act="skip" data-id="${r.id}" data-c="${c}" style="cursor:pointer"` : ''}>${C[c].name}</span>`; }).join(''); })()}</div>
        <div class="dim" style="font-size:11px;margin:-4px 0 6px">方框为二三线城市：需先开设车站才能停靠；已开站的中途小站可点击切换「停靠 / 通过」。</div>
        <div class="grid3">
          <div class="stat"><label>上月收入</label><b>${W(r.lastRev||0)}</b></div>
          <div class="stat"><label>上月运行+过轨</label><b>${W(r.lastCost||0)}</b></div>
          ${(() => { const mg = run.length ? G.marginalOf(r.id) : null; if (!mg) return ''; return `<div class="stat" title="在这条线再加一列 ${G.trainById[mg.model].name}（同编组）后，全公司预计月净利的变化。新车自身约 ${W(mg.own)}；区段拥堵时会挤占已有列车的班次。"><label>再加一列的边际月利润</label><b class="${financialClass(mg.gain)}">${W(mg.gain)}</b></div>`; })()}
          ${routeQual(r)}
        </div>
        ${svcRow(r)}
        <div class="row" style="margin-top:8px"><button class="btn sm" data-act="od" data-id="${r.id}">${ui.odRoute===r.id?'收起起讫客货流表':'起讫客货流表'}</button></div>
        ${ui.odRoute===r.id ? odTable(r) : ''}
        ${plan && plan.ok ? `<h3>区段明细（${G.trainById[sample.model].name}）</h3><div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t"><tr><th>区段</th><th>使用轨道</th><th class="r">限速</th><th class="r">能力利用</th><th class="r">单程过轨费</th></tr>
          ${plan.legs.map(l => `<tr><td>${C[l.from].name}—${C[l.to].name}</td><td><span class="swatch" style="background:${ownerColor(l.owner)}"></span>${ownerName(l.owner)}</td><td class="num r">${Math.round(l.v)}</td><td class="num r">${utilTag(l.tr)}</td><td class="num r">${l.fee ? W(l.fee) : '<span class="pos">免</span>'}</td></tr>`).join('')}
          </table></div><div class="muted" style="margin-top:6px">${plan.delay > 0.05 ? `<span class="neg">拥堵晚点 +${plan.delay.toFixed(1)} 小时</span> · ` : ''}单程 <span class="measure">${plan.oneWay.toFixed(1)}&nbsp;小时</span> · 旅速 <span class="measure">${plan.vavg.toFixed(0)}&nbsp;km/h</span> · 每月 <span class="measure">${plan.trips.toFixed(1)}&nbsp;个单程</span></div>` : (plan ? `<div class="hint" style="margin-top:8px">${icon('warning')} ${esc(plan.why)}</div>` : '')}
        <div class="route-tools"><span class="muted">轨道选择</span><select data-act="routePref" data-id="${r.id}"><option value="fast" ${r.pref==='fast'?'selected':''}>自有优先 · 速度优先</option><option value="cheap" ${r.pref==='cheap'?'selected':''}>自有优先 · 费用优先</option></select>
          <button class="btn sm" data-act="buyFor" data-id="${r.id}">为此线路购车 →</button></div>`;
      }, 'card', ui.selRoute===r.id ? r.color : '');
    });
    return html;
  }

  // 资金按钮：现金不足时提示差额，额度够则一键借款开工
  function fundBtn(cost, attrs, label, cls, style, quiet){
    const S = G.S; const short = cost - S.cash; if (short <= 0) return `<button class="${cls}" style="${style}" ${attrs}>${label}</button>`;
    const room = G.creditLimit() - S.debt; const need = Math.ceil(short / 1e5) * 1e5;
    if (room >= need) return `${quiet ? '' : `<div class="hint" style="margin-top:10px">现金还差 <b>${fmtY(short)}</b>。可以向银行借款补足后开工（剩余贷款额度 ${fmtY(room)}）。</div>`}<button class="${cls}" style="${style}" ${attrs} data-loan="${need}">借款 ${W(need)} 并${label.replace(/^开工建设/, '开工')}</button>`;
    return `${quiet ? '' : `<div class="hint" style="margin-top:10px"><span class="neg">资金不足：</span>还差 <b>${fmtY(short)}</b>，贷款额度只剩 ${fmtY(Math.max(0, room))}。可以先修一条更短的区段、等运营攒钱，或发行债券、上市融资（「财务」页）。</div>`}<button class="${cls}" style="${style}" disabled>${label}</button>${quiet ? '<div class="dim" style="font-size:11px;margin-top:2px;text-align:center">整段投资超出现金与贷款额度</div>' : ''}`;
  }
  function utilTag(trId){ const u = G.trackUtil[trId]; if (!u) return '—'; const c = u.u > 1 ? 'neg' : u.u > 0.72 ? 'gold' : 'dim'; return `<span class="${c}" title="本公司 ${u.own.toFixed(1)} 列/日 + 其他 ${u.bg.toFixed(1)} 列/日 / 能力 ${u.cap} 列/日">${pct(u.u)}</span>`; }
  function satTag(v){ const c = v >= 70 ? 'pos' : v >= 45 ? '' : 'neg'; return `<b class="${c}">${Math.round(v)}</b>`; }
  function routeQual(r){ const st = G.routeStats(r); if (!st) return '';
    return `<div class="stat"><label>正点率</label><b class="${st.punct >= 0.9 ? 'pos' : st.punct >= 0.75 ? '' : 'neg'}">${pct(st.punct)}</b></div>
      <div class="stat"><label>旅客/货主满意度</label>${satTag(r.sat === undefined ? 60 : r.sat)}<small> / 100</small></div>
      <div class="stat"><label>最忙区段利用率</label><b class="${st.uMax > 1 ? 'neg' : st.uMax > 0.72 ? 'gold' : ''}">${pct(st.uMax)}</b></div>`; }
  function gradeRow(r){ const S = G.S, gd = G.gradeOf(r), D = G.GRADES[gd];
    const ts = S.trains.filter(t => t.route === r.id && G.trainById[t.model].use === 'pax');
    const warn = [];
    if (gd === 'night') { const sf = ts.length ? ts.reduce((a, t) => a + G.sleeperFrac(t), 0) / ts.length : 0; const p = ts.map(t => G.econ[t.id] && G.econ[t.id].plan).find(p => p && p.ok);
      if (ts.length && sf < 0.6) warn.push(`卧铺车只占 ${Math.round(sf*100)}%，编组里多挂硬卧、软卧才能拿到全部卧铺票价和客源加成`);
      if (p && p.oneWay < 6) warn.push(`全程只要 ${p.oneWay.toFixed(1)} 小时，太短：卧铺加成按各站对乘车时长计，6 小时以下递减，4 小时以下没有`);
      if (p && p.oneWay > 18) warn.push(`全程 ${p.oneWay.toFixed(0)} 小时，超过一夜：乘车超过 16 小时的站对卧铺加成递减`);
      if (ts.some(t => G.isUnit(G.trainById[t.model]) && !G.trainById[t.model].sleeper)) warn.push('动车组没有卧铺，不适合开行夜车'); }
    if (gd === 'direct' && r.stops.length > 2) warn.push('中途各站一律通过，只服务起讫两站之间的客流');
    return `<div class="row" style="margin-top:8px;gap:6px;align-items:center;flex-wrap:wrap"><span class="muted">列车等级</span>${Object.entries(G.GRADES).map(([k, x]) => `<button class="btn sm ${gd===k?'primary':''}" data-act="grade" data-id="${r.id}" data-v="${k}" title="${x.desc}">${x.name}</button>`).join('')}</div>
      <div class="dim" style="font-size:11px;margin-top:3px">${D.desc}</div>${warn.map(w => `<div class="neg" style="font-size:11px">· ${w}</div>`).join('')}`; }
  function svcRow(r){ const st = G.routeStats(r); if (st && !st.pax) return ''; const lv = r.svc === undefined ? 1 : r.svc;
    return gradeRow(r) + `<div class="row" style="margin-top:8px;gap:6px;align-items:center;flex-wrap:wrap"><span class="muted">服务等级</span>${G.SVC.map((x,i) => `<button class="btn sm ${lv===i?'primary':''}" data-act="svc" data-id="${r.id}" data-v="${i}" title="${x.desc}；票价 ×${x.fare}，运行成本 ×${x.cost}">${x.name}</button>`).join('')}<span class="dim" style="font-size:11px">${G.SVC[lv].desc}</span></div>
      <label class="row" style="margin-top:6px;font-size:12px;gap:6px"><input type="checkbox" data-act="slow" data-id="${r.id}" ${r.slow?'checked':''}> 公益慢车：全部已开站的小站停车，票价 65 折，领取地方补贴</label>`; }

  // —— 车队 ——
  function isIdleTrain(t){ return t.status === 'idle' && !t.route; }
  function trainStatus(t, plan){
    const day = G.S.day;
    if (t.status === 'delivery') return `<span class="tag blue">交付中 ${Math.max(0, Math.ceil(t.arrive - day))}天</span>`;
    if (t.status === 'overhaul') return `<span class="tag blue">大修中 ${Math.max(0, Math.ceil(t.ovhDone - day))}天</span>`;
    if (t.status === 'repair') return `<span class="tag red">故障临修 ${Math.max(0, Math.ceil(t.ovhDone - day))}天</span>`;
    if (!t.route) return '<span class="tag">闲置</span>';
    if (t.status !== 'run' || !plan?.ok) return '<span class="tag red">停运</span>';
    return '<span class="tag green">运营</span>';
  }
  function canWithdrawTrain(t){ return t.status === 'run' && !!t.route; }
  function withdrawTrainButton(t){
    return canWithdrawTrain(t) ? `<button class="btn sm" data-act="withdrawTrain" data-id="${t.id}" aria-label="${esc(t.name)} 下线备用">下线备用</button>` : '';
  }
  function routeTrainsHTML(trains){
    const title = '<h3>配属列车</h3>';
    if (!trains.length) return title + '<div class="dim">这条线路还没有配属列车，可在车队中调入车辆。</div>';
    return title + `<div class="route-trains">${trains.map(t => {
      const model = G.trainById[t.model].name;
      return `<div class="route-train">
        <div class="route-train-info"><div class="fold-heading"><b class="clip-name" title="${esc(t.name)}">${esc(t.name)}</b>${trainStatus(t, G.econ[t.id]?.plan)}</div>
          <div class="dim clip-name" title="${esc(model)}">${esc(model)}</div></div>
        ${withdrawTrainButton(t)}
      </div>`;
    }).join('')}</div>`;
  }

  // —— 机务段 ——
  function depotBox(c){ const S = G.S, d = G.depotsOf().find(x => x.ci === c.i), L = G.DEPOT_LV;
    if (d) { const nx = d.lv < 2 && !d.pend ? G.depotQuote(c.i, 2) : null;
      return `<div class="card" style="margin-top:8px;padding:8px 10px"><div class="row sb"><b>${icon('depot')} ${d.pend ? L[d.pend.lv].name + '（施工中，' + Math.max(0, Math.ceil((d.pend.done - S.day)/30)) + ' 个月）' : L[d.lv].name}</b>${d.lv ? `<span class="dim">检修 ${d.used||0}/${L[d.lv].cap} 列</span>` : ''}</div>
        ${nx ? `<div class="row sb" style="margin-top:6px;font-size:12px"><span class="dim">扩建为机务段：半径 ${L[2].radius} km，容量 ${L[2].cap} 列</span><button class="btn sm" data-act="depot" data-c="${c.i}" data-v="2">扩建 ${W(nx.cost)}</button></div>` : ''}</div>`; }
    const q = G.depotQuote(c.i, 1);
    return `<div class="row sb" style="margin-top:6px;font-size:12px"><span class="dim">在此建机务折返段：半径 ${L[1].radius} km 内的本公司列车就近检修</span><button class="btn sm" data-act="depot" data-c="${c.i}" data-v="1">建机务段 ${W(q.cost)}</button></div>`; }
  function depotHTML(){ const S = G.S, L = G.DEPOT_LV, D = G.depotsOf(), y = G.ym(S.day).y;
    const cov = S.trains.filter(t => G.depotCover[t.id]).length;
    let h = `<h3>机务段</h3><div class="hint">自建机务段后，半径范围内线路上的本公司列车就近检修：可用率更高、老车衰减减半、日常维修费 −20%、大修停运从 30 天缩短到 18 天。每座机务段有检修容量，超出容量的列车不享受加成。</div>`;
    if (D.length) h += `<div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t"><tr><th>所在城市</th><th>等级</th><th class="r">检修列车</th><th class="r">月维护费</th><th></th></tr>${D.map(d => { const lv = d.lv || (d.pend && d.pend.lv);
      return `<tr><td><b>${C[d.ci].name}</b></td><td>${d.pend ? `<span class="tag">施工中 ${Math.max(0, Math.ceil((d.pend.done - S.day)/30))}月</span>` : L[d.lv].name}</td><td class="num r ${d.lv && d.used > L[d.lv].cap ? 'neg' : ''}">${d.lv ? `${d.used||0} / ${L[d.lv].cap}` : '—'}</td><td class="num r">${d.lv ? W(L[d.lv].upkeep * 1e4 * G.cpi(y)) : '—'}</td>
        <td class="r">${d.lv === 1 && !d.pend ? `<button class="btn sm" data-act="depot" data-c="${d.ci}" data-v="2">扩建</button>` : ''}</td></tr>`; }).join('')}</table></div>
      <div class="dim" style="font-size:12px;margin:4px 0">本公司 ${S.trains.length} 列车中，${cov} 列由自有机务段检修。</div>`;
    const cand = G.depotCandidates();
    if (cand.length) h += `<div style="font-size:12px;margin:8px 0 4px"><b>推荐选址</b> <span class="dim">（按附近尚未覆盖的列车数）</span></div>${cand.slice(0, 3).map(x => { const q = G.depotQuote(x.ci, 1);
      return `<div class="row sb" style="padding:5px 0;border-bottom:1px solid var(--line);font-size:12px"><span><b>${C[x.ci].name}</b> <span class="dim">可覆盖约 ${x.n} 列</span></span><button class="btn sm" data-act="depot" data-c="${x.ci}" data-v="1">建机务折返段 ${W(q.cost)}</button></div>`; }).join('')}`;
    else if (!D.length) h += `<div class="dim">有了运营列车后，这里会推荐机务段选址。也可以在地图上点击大城市，在城市详情里直接修建。</div>`;
    return h; }
  function pFleet(){
    const S = G.S; const y = G.ym(S.day).y;
    const run = S.trains.filter(t => t.status==='run' && G.econ[t.id] && G.econ[t.id].plan && G.econ[t.id].plan.ok);
    const lf = run.length ? run.reduce((a,t) => a + G.econ[t.id].lf, 0)/run.length : 0;
    const mon = run.reduce((a,t) => a + G.econ[t.id].monthly, 0);
    let html = `<h2>车队管理</h2>
      <div class="grid3"><div class="stat"><label>列车总数</label><b>${S.trains.length}</b></div><div class="stat"><label>平均载客/载重率</label><b>${pct(lf)}</b></div><div class="stat"><label>预计月净利</label><b class="${financialClass(mon)}">${W(mon)}</b></div></div>`;
    if (!S.trains.length) return html + `<div class="hint" style="margin-top:10px">车队为空。前往「购车」页采购第一列车。</div>` + depotHTML();
    const idle = S.trains.filter(isIdleTrain);
    const list = ui.idleOnly ? idle : S.trains;
    html += `<div class="filters fleet-filters" role="group" aria-label="车队筛选">
      <button class="chip ${ui.idleOnly?'':'on'}" data-act="fleetFilter" data-v="all" aria-pressed="${!ui.idleOnly}">全部 ${S.trains.length}</button>
      <button class="chip ${ui.idleOnly?'on':''}" data-act="fleetFilter" data-v="idle" aria-pressed="${ui.idleOnly}">闲置 ${idle.length}</button>
    </div>`;
    if (!list.length) return html + `<div class="dim">暂无闲置列车。可在线路或车队中将运营车辆下线备用。</div>`;
    const routeById = new Map(S.routes.map(r => [r.id, r]));
    const old = ui.idleOnly ? [] : S.trains.filter(t => ['ended','obsolete'].includes(G.eraOf(t))), oldMain = old.filter(t => t.route && !G.trainOnBranch(t));
    if (old.length) html += `<div class="card" style="margin-top:10px;padding:8px 10px;font-size:12px"><b>车型换代</b>　车队里有 <b>${old.length}</b> 列车属于已停产或淘汰车型${oldMain.length ? `，其中 ${oldMain.length} 列仍跑干线：在干线上旧车票价打折、维修费更高` : ''}。<br><span class="dim">把旧车调到<b>支线</b>（起讫有二三线城市，或全程 200 km 以内）就没有票价折扣，维修费还能降 10%；也可以直接出售，或等同业来求购。</span>${(() => { const ss = [...new Set(old.map(t => { const s = G.successorOf(G.trainById[t.model]); return s ? s.name : ''; }).filter(Boolean))]; return ss.length ? `<br>同级别可换的新车：<b>${ss.map(esc).join('、')}</b>` : ''; })()}</div>`;
    const uo = ui.idleOnly ? [] : (S.usedOffers || []).filter(o => S.trains.some(t => t.id === o.tid) && o.expire > S.day);
    if (uo.length) html += `<h3>同业求购</h3>${uo.map(o => { const t = S.trains.find(x => x.id === o.tid), q = G.sellQuote(t), rv = (G.RIVALS||RIVALS).find(x => x.id === o.rid);
      return `<div class="card" style="padding:8px 10px"><div class="row sb" style="flex-wrap:wrap;gap:6px"><span><b>${esc(rv ? rv.name : '同业')}</b> 求购 <b>${esc(t.name)}</b> <span class="dim">${G.trainById[t.model].name}</span></span><span class="num gold">${W(o.price)}</span></div>
        <div class="row sb" style="margin-top:6px;font-size:12px;flex-wrap:wrap;gap:6px"><span class="dim">二手市场回收价 ${W(q)}，${o.price >= q ? '多卖 ' + W(o.price - q) : '少 ' + W(q - o.price)} · 还剩 ${Math.max(0, Math.ceil((o.expire - S.day)))} 天</span><span><button class="btn sm" data-act="declineUsed" data-id="${o.id}">婉拒</button> <button class="btn sm primary" data-act="acceptUsed" data-id="${o.id}">成交</button></span></div></div>`; }).join('')}`;
    html += `<div class="flist">`;
    list.forEach(t => {
      const m = G.trainById[t.model]; const e = G.econ[t.id] || { plan:{ ok:false, why:'计划未生成' }, lf:0, monthly:0 };
      const st = trainStatus(t, e.plan);
      const running = t.status==='run' && e.plan.ok;
      const money = running ? W(e.monthly) : W(-G.maintOf(t,y));
      const route = routeById.get(t.route);
      const summary = `<span class="fc-top">
        <span class="fc-name"><span class="fold-heading"><b class="clip-name" title="${esc(t.name)}">${esc(t.name)}</b>${st}</span>
          <small class="dim clip-name" title="${esc(route?.name || '未分配线路')}">${esc(route?.name || '未分配线路')}</small></span>
        <span class="fc-mon"><b class="num ${running ? financialClass(e.monthly) : 'dim'}">${money}</b><small class="dim">${running ? '月净利' : '月维护'}</small></span></span>`;
      html += foldCard('fleet', t.id, summary, () => {
        const canOvh = G.yrsSinceOvh(t) >= 2 && t.status !== 'delivery' && t.status !== 'overhaul';
        return `<div class="fc-art"><span class="thumb">${art(t.model, 's')}</span><div class="dim fc-sub" title="${esc(m.name)}">${esc(m.name)}${/[（(]/.test(m.name) ? '' : ' · ' + useName[m.use]}</div>${eraTag(t)}</div>
        <div class="fc-meta"><span class="dim">${consistText(t)}</span><span>${ageText(t)}</span></div>
        ${t.route && e.plan && !e.plan.ok && !['delivery','overhaul','repair'].includes(t.status) ? `<div class="neg fc-why">${icon('warning')} ${esc(e.plan.why)}</div>`:''}
        <div class="fc-act">${isIdleTrain(t) ? `<label class="muted" for="fleet-assign-${t.id}">选择线路上线</label>` : ''}
          <select id="fleet-assign-${t.id}" data-act="assign" data-id="${t.id}" data-lazy="fleet" aria-label="${isIdleTrain(t) ? '选择线路上线' : '分配线路'}" title="${esc(route?.name || '未分配')}">${lazyOpts(route)}</select>
          <div class="fc-lf" title="载客/载重率"><div class="bar ${m.use==='freight'?'g':''}"><i style="width:${Math.min(100,(e.lf||0)*100)}%"></i></div><span class="num dim">${pct(e.lf||0)}</span></div>
          <div class="fc-btns">${withdrawTrainButton(t)}${G.isUnit(m)?'':`<button class="btn sm" data-act="consist" data-id="${t.id}">编组</button>`}${canOvh ? `<button class="btn sm" data-act="overhaul" data-id="${t.id}" title="费用 ${W(G.overhaulQuote(t))}元，停运 ${G.depotCover[t.id] ? 18 : 30} 天${G.depotCover[t.id] ? '（就近机务段）' : ''}">大修</button>` : ''}<button class="btn sm danger" data-act="sell" data-id="${t.id}" title="二手市场回收价 ${W(G.sellQuote(t))}元">${ui.confirm==='t'+t.id ? '确认 ' + W(G.sellQuote(t)) : '出售'}</button></div></div>`;
      }, 'fcard');
    });
    html += `</div><div class="hint" style="margin-top:10px">月净利已扣除运行成本、过轨费和车辆维护费。车辆距上次大修越久，可用率越低、故障越多；大修约花费购价的 15%，停运 30 天后焕然一新。出售时按残值回收：在产车型八折，已停产七折，淘汰车型只有五折。同业有时会出更高的价钱求购旧车。</div>`;
    return html + depotHTML();
  }

  function eraTag(t){ const e = G.eraOf(t), br = t.route && G.trainOnBranch(t);
    if (e === 'new') return '<span class="tag green">新型</span>';
    if (e === 'ended') return `<span class="tag" title="${br ? '在支线上运营，不受影响' : '在干线上票价 −5%，维修费 +15%'}">已停产${br ? ' · 支线' : ''}</span>`;
    if (e === 'obsolete') return `<span class="tag red" title="${br ? '在支线上运营，票价不打折，维修费 −10%' : '在干线上票价 −12%，维修费 +35%'}">淘汰车型${br ? ' · 支线' : ''}</span>`;
    return ''; }
  function ageText(t){ const S = G.S; const age = (S.day - t.bought) / 365, so = G.yrsSinceOvh(t), av = G.availOf(t);
    return `<span style="font-size:11px" class="${av < 0.85 ? 'neg' : 'dim'}" title="车龄 ${age.toFixed(1)} 年，距上次大修 ${so.toFixed(1)} 年">${Math.floor(so)}年未修 · 可用 ${pct(av)}${G.depotCover[t.id] ? ' · 机务段检修' : ''}</span>`; }
  // —— 管理：管理层、员工培训、科研 ——
  function pMgmt(){
    const S = G.S; const y = G.ym(S.day).y; const h = S.history[S.history.length-1] || {}; const rd = G.rdState();
    const star = icon('star');
    const stars = n => `<span class="rating" role="img" aria-label="等级 ${n} / 3">${star.repeat(n)}<span class="dim">${star.repeat(3 - n)}</span></span>`;
    let html = `<h2>经营管理</h2><div class="grid3"><div class="stat"><label>上月人力费用</label><b>${W(h.staff||0)}</b></div><div class="stat"><label>上月研发投入</label><b>${W(h.rd||0)}</b></div><div class="stat"><label>培训等级</label><b>${G.TRAIN_LV[S.trainLv||0].name}</b></div></div>
      <h3>管理层</h3><div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t"><tr><th>职位</th><th>现任</th><th>效果</th><th></th></tr>${Object.entries(G.ROLES).map(([k,r]) => { const e = (S.execs||{})[k];
        return `<tr><td><b>${r.name}</b></td><td>${e ? `${esc(e.name)} ${stars(e.lv)}<br><span class="dim" style="font-size:11px">${esc(e.bg)} · 年薪 ${W(G.execSalary(e.lv, y))}</span>` : '<span class="dim">空缺</span>'}</td><td style="font-size:12px">${e ? r.desc(e.lv) : '—'}</td><td>${e ? `<button class="btn sm danger" data-act="fire" data-v="${k}">解聘</button>` : ''}</td></tr>`; }).join('')}</table></div>
      <h3>人才市场 <span class="dim" style="font-size:12px;font-weight:normal">每年 1 月更新</span></h3>${(S.cands||[]).map(c => `<div class="card"><div class="row sb"><span><b>${esc(c.name)}</b> ${stars(c.lv)} <span class="tag">${G.ROLES[c.role].name}</span></span><span class="dim">${c.age} 岁</span></div>
        <p class="detail-copy">${esc(c.bg)}。${G.ROLES[c.role].desc(c.lv)}</p><div class="row sb"><span class="dim" style="font-size:12px">年薪 ${W(G.execSalary(c.lv, y))} · 签约金 ${W(G.execSalary(c.lv, y)*0.5)}</span><button class="btn sm primary" data-act="hire" data-id="${c.id}">聘请</button></div></div>`).join('') || '<div class="dim">暂无候选人。</div>'}
      <h3>员工培训</h3><div class="row" style="gap:6px;flex-wrap:wrap">${G.TRAIN_LV.map((t,i) => `<button class="btn sm ${(S.trainLv||0)===i?'primary':''}" data-act="trainLv" data-v="${i}">${t.name}${t.cost ? `（${t.cost} 万/列·月）` : ''}</button>`).join('')}</div>
      <div class="dim" style="font-size:11px;margin-top:4px">每提高一级：正点率 +1 个百分点，运行成本 −3%，机车故障 −18%，行车事故 −20%。费用按列车数和物价计算。</div>
      <h3>科研与国产化</h3><div class="row" style="gap:6px;flex-wrap:wrap;align-items:center"><span class="muted">研发投入</span>${['不投入','营收 1%','营收 2.5%','营收 5%'].map((n,i) => `<button class="btn sm ${rd.lv===i?'primary':''}" data-act="rdLv" data-v="${i}">${n}</button>`).join('')}</div>
      <div class="dim" style="font-size:11px;margin:4px 0 8px">每投入 10 万元（1985 年价格）产生 1 个研发点，总工程师可以加快研发。</div>`;
    const ps = G.rdProjects(); const cur = ps.find(p => p.key === rd.cur);
    if (cur) html += `<div class="card"><div class="row sb"><b>进行中：${esc(cur.name)}</b><span class="num">${Math.floor(rd.pts)} / ${cur.pts}</span></div><div class="bar g" style="margin:6px 0"><i style="width:${Math.min(100, rd.pts/cur.pts*100)}%"></i></div><div class="dim" style="font-size:12px">${rd.lastGain ? `每月约 ${rd.lastGain.toFixed(1)} 点，预计 ${Math.ceil((cur.pts - rd.pts)/rd.lastGain)} 个月完成` : rd.lv ? '下月结算后显示进度' : '<span class="neg">研发投入为 0，项目停滞</span>'}</div></div>`;
    html += ps.filter(p => p.key !== rd.cur).map(p => `<div class="row sb" style="padding:6px 0;border-bottom:1px solid var(--line)"><div><b>${esc(p.name)}</b> <span class="dim">${p.pts} 点</span><br><span class="dim" style="font-size:12px">${p.desc}${p.m ? ' · ' + esc(p.m.name) : ''}</span>${p.locked ? `<br><span class="neg" style="font-size:12px">${p.locked}</span>` : ''}</div><button class="btn sm" data-act="rdStart" data-v="${p.key}" ${p.locked ? 'disabled' : ''}>${rd.cur ? '切换到此项目' : '立项'}</button></div>`).join('');
    if (!ps.length) html += '<div class="dim">暂无可立项的项目。购买 2 台以上同型进口车后，可立项国产化。</div>';
    const done = Object.keys(rd.done||{}); if (done.length) html += `<div style="font-size:12px;margin-top:8px">已完成：${done.map(k => k.startsWith('loc_') ? (G.trainById[k.slice(4)]||{}).name + ' 国产化' : k.startsWith('dz_') ? ((rd.designs||[]).find(d => d.research === k) || { name:'自主设计' }).name : (G.OWN_MODELS.find(o => o.id===k)||{}).name).join('、')}</div>`;
    html += `<div class="dim" style="font-size:11px;margin-top:6px">切换项目时，已积累的点数会保留在原项目上。</div>`;
    html += designHTML();
    return html;
  }

  // —— 产业：车站商业与沿线地产 ——
  function cityEstateBox(c, y){ const S = G.S; if (y < 1988) return ''; const L = (S.land||{})[c.i] || { n:0, cost:0 }; const p = G.landPrice(c.i);
    return `<div class="row sb" style="margin-top:6px;font-size:12px"><span>站前地价 <b>${W(p)}</b>/块${L.n ? ` · 持有 ${L.n} 块` : ''}</span><span><button class="btn sm" data-act="land" data-c="${c.i}">买地</button>${L.n ? ` <button class="btn sm" data-act="sellLand" data-c="${c.i}">卖地</button>` : ''}</span></div>`; }
  function pEstate(){
    const S = G.S; const y = G.ym(S.day).y; const h = S.history[S.history.length-1] || {};
    const lit = Object.keys(S.lit).map(Number).sort((a,b) => (G.cityPax[b]||0) - (G.cityPax[a]||0));
    let html = `<h2>车站商业与沿线地产</h2>
      <div class="grid3"><div class="stat"><label>上月商业收入</label><b class="${financialClass(h.biz)}">${W(h.biz||0)}</b></div><div class="stat"><label>上月地产租金</label><b class="${financialClass(h.rent)}">${W(h.rent||0)}</b></div><div class="stat"><label>土地市值</label><b class="gold">${W(G.landValue())}</b></div></div>
      <h3>车站商业</h3><div class="hint" style="margin-bottom:8px">在本公司列车停靠的车站开设商铺、投放广告。收入取决于该站旅客量、城市人口和旅客满意度。</div>`;
    if (!lit.length) html += `<div class="dim">还没有开通列车服务的车站。</div>`;
    else html += `<div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t"><tr><th>车站</th><th class="r">月旅客</th><th>现有商业</th><th class="r">月收入</th><th></th></tr>${lit.slice(0, 30).map(ci => { const lv = G.shopLv(ci); const nx = lv + 1 < G.SHOP_LV.length ? G.shopQuote(ci, lv + 1) : null;
      return `<tr><td><b>${C[ci].name}</b></td><td class="num r">${((G.cityPax[ci]||0)/1e4).toFixed(1)} 万</td><td>${lv ? G.SHOP_LV[lv].name : '<span class="dim">—</span>'}</td><td class="num r">${lv ? W(G.shopIncome(ci, y)) : '—'}</td>
        <td>${nx ? `<button class="btn sm" data-act="shop" data-c="${ci}" data-v="${lv+1}" ${nx.why ? 'disabled' : ''} title="${nx.why || G.SHOP_LV[lv+1].name}">${nx.why ? nx.why : (lv ? '升级' : '开设') + ' ' + W(nx.cost)}</button>` : ''}</td></tr>`; }).join('')}</table></div>`;
    html += `<h3>沿线地产</h3><div class="hint" style="margin-bottom:8px">${y < 1988 ? '1988 年起土地使用权才可以有偿转让。' : '提前在规划线路的站前买地，通车后地价上涨 25%，之后每年再涨约 4%。2000 年后全国地价进入快速上涨期。持有期间可以收取租金。也可以在地图上点击城市直接买地。'}</div>`;
    const own = Object.entries(S.land||{}).filter(([c,L]) => L.n);
    if (own.length) html += `<div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t"><tr><th>城市</th><th class="r">块数</th><th class="r mhide">成本</th><th class="r">市值</th><th class="r">浮盈</th><th></th></tr>${own.map(([c,L]) => { const v = L.n * G.landPrice(+c); return `<tr><td><b>${C[c].name}</b>${S.lit[c] ? ' <span class="tag green">通车</span>' : ''}</td><td class="num r">${L.n}</td><td class="num r mhide">${W(L.cost)}</td><td class="num r">${W(v)}</td><td class="num r ${financialClass(v - L.cost)}">${W(v - L.cost)}</td><td class="r"><div class="tbtns"><button class="btn sm" data-act="land" data-c="${c}">加购</button><button class="btn sm" data-act="sellLand" data-c="${c}">卖一块</button></div></td></tr>`; }).join('')}</table></div>`;
    if (y >= 1988) { const cand = C.filter(c => !S.lit[c.i]).map(c => ({ c, p:G.landPrice(c.i), near: G.adj[c.i].some(e => S.tracks.some(t => t.e === e.i && t.owner === 'P')) || G.adj[c.i].some(e => G.adj[e.a === c.i ? e.b : e.a].length && S.lit[e.a === c.i ? e.b : e.a]) }))
        .filter(x => x.near).sort((a,b) => G.popOf(b.c,y) - G.popOf(a.c,y)).slice(0, 12);
      if (cand.length) html += `<h3>尚未通车的邻近城市（适合提前买地）</h3><div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t">${cand.map(x => `<tr><td><b>${x.c.name}</b> <span class="dim">${Math.round(G.popOf(x.c,y))} 万人</span></td><td class="num r">${W(x.p)}/块</td><td><button class="btn sm" data-act="land" data-c="${x.c.i}">买地</button></td></tr>`).join('')}</table></div>`; }
    return html;
  }
  // —— 地方政府提议（合同页） ——
  function localHTML(){
    const S = G.S; const L = (S.locals||[]).filter(o => o.expire > S.day);
    let h = `<h3>地方政府合作</h3>`;
    if (!L.length) h += `<div class="dim">暂无提议。地方政府每半年会提出合资建线、设站补贴或公益慢车补贴。</div>`;
    h += L.map(o => { let t = '', d = '';
      if (o.kind === 'jv'){ const g = G.groups[o.gi]; t = `${C[o.host].name}市 · 合资修建 ${C[g.a].name}—${C[g.b].name}`; d = `修建这条走廊时，地方政府出资 <b>${Math.round(o.sub*100)}%</b>。条件：通车后 12 个月内开行客车，否则退还出资并损失商誉。`; }
      if (o.kind === 'station'){ t = `${C[o.ci].name}市 · 请求设站`; d = `在${C[o.ci].name}开设车站时，市政府承担 <b>50%</b> 建站费用，没有附加条件。`; }
      if (o.kind === 'slow'){ t = `${C[o.ci].name}地区 · 公益慢车补贴`; d = `把一条途经${C[o.ci].name}的客运线路设为「公益慢车」（全部小站停车，票价打 65 折），地方按每列·公里 <b>${o.rate} 元</b> 给予补贴。`; }
      return `<div class="card"><div class="row sb"><b>${t}</b><span class="dim">剩 ${Math.ceil(o.expire - S.day)} 天</span></div><p class="detail-copy">${d}</p><div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sm" data-act="declineL" data-id="${o.id}">婉拒</button><button class="btn sm primary" data-act="acceptL" data-id="${o.id}">同意</button></div></div>`; }).join('');
    const jv = S.jv || []; if (jv.length) h += `<div style="font-size:12px;margin-top:6px">${jv.map(j => { const g = G.groups[j.gi]; return `· 合资协议：${C[g.a].name}—${C[g.b].name}，地方出资 ${Math.round(j.sub*100)}%${j.since !== null ? `，已通车，需在 ${Math.max(0, Math.ceil((j.since + 365 - S.day)/30))} 个月内开行客车` : '，等待你开工（${Math.max(0, Math.ceil(((j.until||0) - S.day)/30))} 个月内有效）'}`; }).join('<br>')}</div>`;
    return h;
  }

  // —— 政府任务 ——
  function nowMK(){ const t = G.ym(G.S.day); return t.y * 12 + t.m; }
  function govWhere(g){ return g.k === 'relief' ? `进出 ${C[g.city].name} 的全部货运` : g.k === 'coal' ? `${C[g.ci].name}—${C[g.cj].name} 煤炭` : `${C[g.ci].name}—${C[g.cj].name} 旅客`; }
  function govCard(g, inModal){
    const S = G.S, D = G.GOV[g.k], unit = D.unit, f = v => (v/1e4).toFixed(1);
    const head = `<div class="row sb task-heading"><b class="clip-name" title="${esc(g.title)}">${esc(g.title)}</b><span class="tag ${g.k==='relief'?'red':g.k==='coal'?'':'blue'}">${D.name}</span></div>`;
    const kv = `<dl class="kv"><dt>考核口径</dt><dd>${govWhere(g)}</dd><dt>执行期</dt><dd><span class="measure">${G.mkStr(g.from)}</span> – <span class="measure">${G.mkStr(g.to)}</span></dd><dt>累计目标</dt><dd class="num">${f(g.target)} ${unit}</dd><dt>完成奖励</dt><dd class="gain"><span class="measure">${W(g.cash)}元</span> · <span class="measure">商誉 +${D.rep}</span></dd><dt>基本完成（≥85%）</dt><dd>奖励的 40%</dd><dt>未完成</dt><dd class="neg">商誉 −${D.fail}</dd></dl>`;
    if (g.st === 'offer') return `<div class="card gov">${head}<p class="task-copy">${esc(g.text)}</p>${kv}
      <div class="row sb" style="margin-top:6px"><span class="dim" style="font-size:12px">${g.k==='relief' ? '婉拒将损失商誉 1 点 · ' : ''}剩 ${Math.max(0, Math.ceil(g.expire - S.day))} 天答复</span>
      <span class="row" style="gap:6px"><button class="btn sm" ${inModal?'data-m':'data-act'}="govDec" data-id="${g.id}">婉拒</button><button class="btn sm primary" ${inModal?'data-m':'data-act'}="govAcc" data-id="${g.id}">接受任务</button></span></div></div>`;
    const cur = G.govProgressNow(g), r = Math.min(1, cur / g.target), mk = nowMK();
    const left = g.to - mk + 1, started = mk >= g.from;
    const need = started && left > 0 ? Math.max(0, g.target - g.prog) / left : 0, rate = G.govMetric(g, 'plan');   // 按运行计划预计的月运量；累计进度只算实际完成
    const st = g.st === 'part' ? '<span class="tag green">基本完成</span>' : g.st === 'done' ? '<span class="tag green">已完成</span>' : g.st === 'fail' ? '<span class="tag red">未完成</span>' : started ? `<span class="tag">剩 ${left} 个月</span>` : `<span class="tag">${G.mkStr(g.from)} 开始</span>`;
    return `<div class="card gov"><div class="row sb task-heading"><b class="clip-name" title="${esc(g.title)}">${esc(g.title)}</b>${st}</div>
      <p class="detail-copy">${govWhere(g)} · 目标 ${f(g.target)} ${unit} · 奖励 ${W(g.cash)}元</p>
      <div class="region"><span>${g.st==='active'?'实际累计':'完成量'}</span><div class="bar ${r>=1?'g':''}"><i style="width:${r*100}%"></i></div><span class="num r ${r>=1?'pos':''}">${f(Math.min(cur, g.target*9.99))} / ${f(g.target)}</span></div>
      ${g.st==='active' ? `<div style="font-size:12px" class="${!started || rate >= need ? 'dim' : 'neg'}">${started ? `按计划预计运量约 ${f(rate)} ${unit}/月（以实际完成量考核），按期完成需要每月 ${f(need)} ${unit}。${rate < need ? '运力不足：可加开列车、增加编组或提高服务频次。' : ''}` : `执行期尚未开始，当前运量约 ${f(rate)} ${unit}/月，按期完成需要平均每月 ${f(g.target/(g.to-g.from+1))} ${unit}。可以提前调配运力。`}</div>` : ''}</div>`;
  }
  function govHTML(){
    const S = G.S; G.ensureT4();
    const offers = S.gov.filter(g => g.st === 'offer'), act = S.gov.filter(g => g.st === 'active'), past = S.gov.filter(g => g.st === 'done' || g.st === 'fail' || g.st === 'part');
    let h = `<h3>政府任务与特运</h3>`;
    if (!offers.length && !act.length) h += `<div class="dim">暂无任务。每年 11 月下达次年春运加开，9 月下达冬季电煤保供；汛期和重大灾害时会下达抢险运输任务。任务只会派给已有相应运量的线路。</div>`;
    h += offers.map(g => govCard(g)).join('') + act.map(g => govCard(g)).join('');
    if (past.length) h += `<div style="font-size:12px;margin-top:6px">${past.slice(-4).reverse().map(g => `· ${esc(g.title)}：<span class="${g.st==='fail'?'neg':'pos'}">${g.st==='done' ? `完成，奖励 ${W(g.cash)}元` : g.st==='part' ? `基本完成（${Math.round(g.prog/g.target*100)}%），奖励 ${W(g.paid||0)}元` : `未完成（${Math.round(g.prog/g.target*100)}%）`}</span>`).join('<br>')}</div>`;
    return h;
  }

  // —— 合同 ——
  const CARS_FOR = {}; Object.entries(CAR_CARGO).forEach(([car, gs]) => gs.forEach(g => (CARS_FOR[g] = CARS_FOR[g] || []).push(car)));
  function repTag(){ const r = G.S.rep ?? 50; const [n, c] = r >= 80 ? ['金字招牌','green'] : r >= 60 ? ['商誉良好','green'] : r >= 40 ? ['一般',''] : r >= 20 ? ['欠佳','red'] : ['声名狼藉','red']; return `<span class="tag ${c}">${n}</span>`; }
  function cRoute(o){ const to = o.from === o.a ? o.b : o.a; return `${C[o.from].name} → ${C[to].name}`; }
  function cService(o){
    const pi = G.pairInfo[G.contractKey(o)];
    if (pi && pi.svcap > 0) { const ok = pi.svcap >= o.tons * 0.8; return `<span class="${ok?'pos':'neg'}">现有运力 ${(pi.svcap/1e4).toFixed(1)} 万吨/月${ok ? '' : '，不足 80%'}</span>`; }
    return `<span class="neg">尚无服务</span>。开行一条经停${C[o.a].name}与${C[o.b].name}的货运线路，并编挂${(CARS_FOR[o.g]||[]).map(id => (G.carById[id]||{name:id}).name).join('、')}即可承运`;
  }
  function pContracts(){
    const S = G.S; G.ensureT2();
    const offers = S.offers.filter(o => o.expire > S.day);
    const cap = 4 + Math.floor(S.rep / 25);
    const contractNet = S.history.slice(-12).reduce((a,h)=>a+(h.contract||0),0);
    let html = `<h2>运输合同</h2>
      <div class="grid3">
        <div class="stat"><label>商誉</label><b class="gold">${Math.round(S.rep)}</b><small> / 100</small> ${repTag()}</div>
        <div class="stat"><label>履行中 / 上限</label><b>${S.contracts.length} / ${cap}</b></div>
        <div class="stat"><label>近 12 月合同奖罚</label><b class="${financialClass(contractNet)}">${W(contractNet)}</b></div>
      </div>
      <div class="hint" style="margin-top:8px">货主每季度发来合同邀约，90 天内有效。签约后，合同货量会加进该站对的货源；每月运量达到目标的 80% 即可拿到月度奖金，否则支付违约金（前 2 个月为筹备期，不罚款）。违约 3 次合同解除；履约率达到 75% 的合同到期另有结算奖励。商誉影响贷款额度、债券利率、合同规模和上市估值。</div>
`;
    html += govHTML() + `<h3>合同邀约</h3>`;
    html += offers.length ? offers.map(o => foldCard('offer', o.id,
      `<span class="fold-heading"><b class="clip-name" title="${esc(o.shipper)}">${esc(o.shipper)}</b><span class="tag" style="background:${CARGO[o.g].color};color:#fff">${CARGO[o.g].name}</span></span>
        <span class="fold-meta"><span>${cRoute(o)}</span><span class="gain">月奖 ${W(o.mBonus)}</span><span>邀约剩 ${Math.ceil(o.expire - S.day)} 天</span></span>`,
      () => `<p class="task-copy">约 <span class="measure">${o.d}&nbsp;km</span> · 每月 <b class="measure">${(o.tons/1e4).toFixed(1)}&nbsp;万吨</b> · <span class="measure">${o.months}&nbsp;个月</span></p>
        <dl class="kv"><dt>到期奖励</dt><dd class="gain"><span class="measure">${W(o.fBonus)}</span></dd><dt>违约金/次</dt><dd class="loss"><span class="measure">${W(o.penalty)}</span></dd></dl>
        <p class="detail-copy">${cService(o)}</p>
        <div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sm" data-act="declineC" data-id="${o.id}">婉拒</button><button class="btn sm primary" data-act="acceptC" data-id="${o.id}">签约</button></div>`)).join('')
      : `<div class="dim">暂无邀约。货主每季度末发来新的邀约。</div>`;
    html += `<h3>履行中的合同</h3>`;
    html += S.contracts.length ? S.contracts.map(o => { const pi = G.pairInfo[G.contractKey(o)]; const cur = pi ? Math.min(1, pi.served / o.tons) : 0;
      return foldCard('contract', o.id,
        `<span class="fold-heading"><b class="clip-name" title="${esc(o.shipper)}">${esc(o.shipper)}</b><span class="tag">${CARGO[o.g].name}</span></span>
        <span class="fold-meta"><span>${cRoute(o)}</span><span>剩 ${o.left} 个月</span><span class="${cur>=0.8?'pos':'neg'}">本月预计 ${pct(cur)}</span><span>违约 ${o.strikes}/3</span></span>`,
        () => `<p class="task-copy">合同货量每月 ${(o.tons/1e4).toFixed(1)}&nbsp;万吨</p>
        <div class="cbars">${o.hist.slice(-24).map(h => `<i title="${h}%" style="height:${Math.max(6, Math.min(100,h))}%;background:${h>=80?'#3f8a55':'#c0392b'}"></i>`).join('')}</div>
        <p class="detail-copy">${cService(o)}</p>`); }).join('')
      : `<div class="dim">还没有签约的合同。</div>`;
    return html + localHTML();
  }
  // —— 资本运作 ——
  function capitalHTML(){
    const S = G.S; const y = G.ym(S.day).y; G.ensureT2();
    const bsum = S.bonds.reduce((a,b) => a + b.amt, 0);
    let h = `<h3>企业债券</h3><div class="card">`;
    if (y < 1993) h += `<div class="dim">1993 年起允许企业发行债券。</div>`;
    else h += `<dl class="kv"><dt>当前票面利率</dt><dd>${(G.bondRate()*100).toFixed(2)}%（银行 ${(G.rate(y)*100).toFixed(2)}%）</dd><dt>未到期债券</dt><dd><span class="measure">${fmtY(bsum)}</span></dd><dt>可发行额度</dt><dd><span class="measure">${fmtY(G.bondRoom())}</span></dd></dl>
      ${S.bonds.length ? `<div class="table-scroll" tabindex="0" role="region" aria-label="数据表" style="margin-top:6px"><table class="t"><tr><th>发行</th><th class="r">金额</th><th class="r">利率</th><th class="r">到期</th></tr>${S.bonds.map(b => `<tr><td>${b.y}</td><td class="num r">${W(b.amt)}</td><td class="num r">${(b.rate*100).toFixed(2)}%</td><td class="num r">${G.ym(b.due).y}.${G.ym(b.due).m}</td></tr>`).join('')}</table></div>` : ''}
      <div class="row" style="margin-top:8px;gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="bond" data-v="5e7">发债 5000万</button><button class="btn sm" data-act="bond" data-v="2e8">发债 2亿</button><button class="btn sm" data-act="bond" data-v="1e9">发债 10亿</button></div>
      <div class="dim" style="font-size:11px;margin-top:4px">5 年期，按月付息，到期一次还本。额度为净资产的 30%，商誉越高利率越低。</div>`;
    h += `</div><h3>资本市场</h3><div class="card">`;
    if (!S.ipo) { const c = G.ipoCheck();
      h += `<div>公司尚未上市。上市可一次募集大笔资金，之后可增发、分红和回购。</div>
        <p class="detail-copy">${c.ok ? `<span class="pos">已满足上市条件</span>，按当前估值发行 25% 股份，预计募集约 ${fmtY(G.valuation()*0.25*0.88*0.97)}。` : '上市条件：' + c.why.map(x => `<span class="neg">${x}</span>`).join('；')}</p>
        <button class="btn sm ${c.ok?'primary':''}" data-act="ipo" ${c.ok?'':'disabled'}>申请上市</button>`; }
    else { const I = S.ipo; const q = G.secondaryQuote();
      const chg = I.hist.length > 13 ? Number(((I.price / I.hist[I.hist.length-13].p - 1) * 100).toFixed(0)) : 0;
      h += `<div class="grid3"><div class="stat"><label>股价</label><b class="gold">${I.price.toFixed(2)}</b><small> 元 <span class="${financialClass(chg)}">${chg>0?'+':''}${chg}%/年</span></small></div>
        <div class="stat"><label>总市值</label><b>${W(G.marketCap())}</b></div><div class="stat"><label>市盈率</label><b>${G.ttmProfit() > 0 ? (G.marketCap()/G.ttmProfit()).toFixed(1) : '—'}</b></div></div>
        <canvas class="chart" id="stockChart" style="height:120px"></canvas>
        <div class="legendrow"><span><i style="background:var(--gain)"></i>上涨</span><span><i style="background:var(--loss)"></i>下跌</span></div>
        <dl class="kv"><dt>总股本</dt><dd>${(I.shares/1e4).toFixed(0)} 万股</dd><dt>公众持股</dt><dd>${pct(I.pub/I.shares)}</dd><dt>发行价</dt><dd>${I.ipoPrice.toFixed(2)} 元</dd><dt>市场情绪</dt><dd>${(MARKET_SENT[y]||1) >= 1.2 ? '火热' : (MARKET_SENT[y]||1) <= 0.85 ? '低迷' : '平稳'}</dd></dl>
        <div class="row" style="margin:8px 0;gap:6px;align-items:center"><span>分红率</span>${['不分红','20%','40%'].map((n,i) => `<button class="btn sm ${I.payoutLv===i?'primary':''}" data-act="payout" data-v="${i}">${n}</button>`).join('')}</div>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm" data-act="secondary" ${q.wait>0?'disabled':''}>增发 10%（约 ${W(q.raise)}）${q.wait>0?` · ${Math.ceil(q.wait/30)} 个月后`:''}</button><button class="btn sm" data-act="buyback">回购 2%</button></div>
        <div class="dim" style="font-size:11px;margin-top:4px">股价随净资产、近 12 个月利润、商誉和大盘情绪变动。不分红会被市场打折，高分红提升估值和商誉。</div>`; }
    return h + `</div>`;
  }
  function drawStockChart(){ const c = $('#stockChart'); if (!c || !G.S.ipo) return; const H = G.S.ipo.hist.slice(-120);
    chart(c, H.map(h => { const t = G.ym(h.d); return `${t.y}.${t.m}`; }), [{ color:financeColors.neutral, data:H.map(h => h.p), movement:true, fill:true }], v => v.toFixed(1)); }

  // —— 购车 ——
  function pMarket(){
    const S = G.S; const y = G.ym(S.day).y; const f = ui.mf;
    const chip = (k, v, n) => `<button class="chip ${f[k]===v?'on':''}" data-act="mf" data-k="${k}" data-v="${v}">${n}</button>`;
    const catBar = `<div class="filters" style="margin-bottom:12px">${chip('cat','loco','机车 / 动车组')}${chip('cat','car','客车厢 / 货车厢')}${chip('cat','used','二手车市场')}</div>`;
    if (f.cat === 'car') return pCars(chip, catBar);
    if (f.cat === 'used') return pUsed(chip, catBar);
    let list = TRAINS.filter(m => (f.use==='all'||m.use===f.use) && (f.type==='all'|| (f.type==='emu' ? (m.type==='emu'||m.type==='dmu') : m.type===f.type)) && (f.origin==='all' || (f.origin==='cn' ? !m.imported : !!m.imported)));
    list = list.filter(m => !m.research || (S.rd && S.rd.done[m.research]));
    if (f.show === 'sale') list = list.filter(m => G.available(m));
    else if (f.show === 'soon') list = list.filter(m => m.year > y).sort((a,b) => a.year-b.year);
    list.sort((a,b) => (G.available(b)-G.available(a)) || (f.show === 'sale' ? b.year - a.year : a.year - b.year));
    const quota = S.mods.importQuota >= 99 ? '不限' : `${S.imports.n}/${S.mods.importQuota}`;
    let html = catBar + `<h2>车辆市场 <span class="tag">${y}年</span><span class="tag ${S.mods.tariff>0.3?'red':'green'}">进口关税 ${pct(S.mods.tariff)}</span><span class="tag">进口额度 ${quota}</span></h2>
      <div class="filters">${chip('show','sale','在售')}${chip('show','soon','即将上市')}${chip('show','all','全部图鉴')}</div>
      <div class="filters">${chip('use','all','全部用途')}${chip('use','pax','客运')}${chip('use','freight','货运')}</div>
      <div class="filters">${chip('type','all','全部动力')}${chip('type','steam','蒸汽')}${chip('type','diesel','内燃')}${chip('type','electric','电力')}${chip('type','emu','动车组')}<span aria-hidden="true" style="width:10px"></span>${chip('origin','all','全球')}${chip('origin','cn','国产')}${chip('origin','im','进口')}</div>`;
    if (!list.length) html += `<div class="dim">没有符合条件的车型。</div>`;
    const buyOptsLazy = buyLazy();
    list.forEach(m => {
      const av = G.available(m); const p = G.trainPrice(m);
      const capTxt = m.use==='pax' ? `${m.cap} 人` : `${m.cap.toLocaleString()} t`;
      const needElec = m.type==='electric' || m.type==='emu';
      const soon = av && G.endingSoon(m), succ = (soon || (!av && m.end < y)) ? G.successorOf(m) : null;
      const succHTML = succ ? `<div class="succ" style="margin-top:6px;font-size:12px">${soon ? '推荐替代' : '接替车型'}：<b>${esc(succ.name)}</b> <span class="dim">${succ.vmax} km/h · ${succ.use==='pax' ? (G.isUnit(succ) ? succ.cap + ' 人' : succ.power.toLocaleString() + ' kW') : succ.cap.toLocaleString() + ' t'}${G.available(succ) ? ' · 在售' : ' · ' + succ.year + ' 年上市'}</span> <button class="btn sm" data-act="mfFind" data-v="${succ.id}">查看</button></div>` : '';
      html += `<div class="tcard ${av?'':'na'}" id="tc_${m.id}">
        <div class="art">${art(m.id)}<span class="flag">${m.country}</span><span class="yr">${m.year}–${m.end>=G.FAR_END?'':m.end}</span></div>
        <div class="body">
          <div class="row sb model-heading"><div class="model-title"><div class="model-identity"><span class="name clip-name" title="${esc(m.name)}">${esc(m.name)}</span>${av && y - m.year <= 1 ? ' <span class="tag green">新车</span>' : ''}${soon ? ` <span class="tag red" title="${m.end} 年底停止接受订购，已有车辆照常运营">${m.end === y ? '今年停产' : '即将停产 · ' + m.end}</span>` : ''}${m.design ? ' <span class="tag">自主设计</span>' : ''}</div><span class="en clip-name" title="${esc(m.en)}">${esc(m.en)}</span></div><span class="tag ${m.use==='pax'?'blue':'green'}">${useName[m.use]} · ${powerName(m)}</span></div>
          <div class="specs">
            <div><label>最高速度</label><b>${m.vmax} km/h</b></div>
            <div><label>功率</label><b>${m.power.toLocaleString()} kW</b></div>
            <div><label>${m.use==='pax'?'定员':'牵引定数'}</label><b>${capTxt}</b></div>
            <div><label>轴式</label><b style="font-size:11px">${m.axle}</b></div>
          </div>
          <div class="note">${m.note}<br><span class="dim">制造：${m.maker}${needElec?' · 需电气化线路':''}${m.tilt?' · 摆式车体：普速/快速线上可提速20%':''}${m.plateau?' · 高原适应型':''}${m.fuel==='h2'?' · 不需要电气化':''}</span>${succHTML}</div>
          <div class="buyrow">
            <div class="price"><span class="num gold" style="font-size:15px">${fmtY(p.total)}</span><div class="dim pbrk">${p.consist ? `<span>机车 ${W(p.loco)}</span><span>默认编组 ${p.dc.map(x => G.carById[x.id].name + '×' + x.n).join('、')} ${W(p.consist)}</span>` : '<span>固定编组</span>'}<span>${p.tariff ? '含关税 ' + pct(p.tariff) + ' · ' : ''}运行成本 ${(m.run*1.3*G.cpi(y)).toFixed(0)} 元/列km</span></div></div>
            ${av ? `<div class="buyact"><select id="br_${m.id}" data-lazy="buy">${buyOptsLazy}</select><button class="btn primary sm" data-act="buy" data-m="${m.id}">购买</button></div>` : `<span class="tag" ${m.year > y ? '' : 'title="已有车辆照常运营；想再添同款可去二手车市场"'}>${m.year > y ? m.year + ' 年上市' : '已停产（' + m.end + '）· 可找二手'}</span>`}
          </div>
        </div></div>`;
    });
    return html;
  }

  // —— 二手车市场 ——
  const eraBadge = e => e === 'new' ? '<span class="tag green">新型</span>' : e === 'ended' ? '<span class="tag">已停产</span>' : e === 'obsolete' ? '<span class="tag red">淘汰车型</span>' : '';
  function pUsed(chip, catBar){
    const S = G.S; const y = G.ym(S.day).y; const L = (S.usedMarket || []).filter(o => o.expire > S.day && G.trainById[o.model]);
    const buyOptsLazy = buyLazy();
    let html = catBar + `<h2>二手车市场 <span class="tag">${y}年</span><span class="tag">${L.length} 台挂牌</span></h2>
      <div class="hint" style="margin-bottom:10px">国家铁路和同业公司会把替换下来的旧车挂牌出售，每月更新，每台挂牌 90 天。<b>已经停产的车型也能在这里买到</b>；进口旧车属于国内转让，不收关税、不占进口额度。旧车按车龄折价、15 天交付，但维修费更高、可用率更低，买回来可以先安排一次大修。</div>`;
    if (!L.length) html += '<div class="dim">本月没有挂牌车辆，下个月再来看看。</div>';
    L.forEach(o => { const m = G.trainById[o.model]; const succ = G.successorOf(m);
      const capTxt = m.use==='pax' ? `${m.cap} 人` : `${m.cap.toLocaleString()} t`;
      html += `<div class="tcard"><div class="art">${art(m.id)}<span class="flag">${m.country}</span><span class="yr">车龄 ${o.age} 年</span></div><div class="body">
        <div class="row sb model-heading"><div class="model-title"><div class="model-identity"><span class="name clip-name" title="${esc(m.name)}">${esc(m.name)}</span> ${eraBadge(G.modelEra(m))}</div><span class="en clip-name">${esc(m.en)} · 卖方 ${esc(G.sellerName(o.seller))}</span></div><span class="tag ${m.use==='pax'?'blue':'green'}">${useName[m.use]} · ${powerName(m)}</span></div>
        <div class="specs"><div><label>最高速度</label><b>${m.vmax} km/h</b></div><div><label>${m.use==='pax'?'定员':'牵引定数'}</label><b>${capTxt}</b></div><div><label>距上次大修</label><b>${o.so.toFixed(1)} 年</b></div><div><label>同款新车价</label><b>${W(o.newP || o.price)}</b></div></div>
        <div class="note">${o.cars && o.cars.length ? '随车编组：' + o.cars.map(x => (G.carById[x.id]||{name:x.id}).name + '×' + x.n).join('、') : '固定编组'}${succ ? `<br><span class="dim">同级别新车：${esc(succ.name)}${G.available(succ) ? '（在售）' : '（' + succ.year + ' 年上市）'}</span>` : ''}</div>
        <div class="buyrow"><div class="price"><span class="num gold" style="font-size:15px">${fmtY(o.price)}</span><div class="dim pbrk"><span>约为同款新车价的 ${pct(o.price / (o.newP || o.price))}</span><span>还剩 ${Math.max(0, Math.ceil(o.expire - S.day))} 天下架</span></div></div>
          <div class="buyact"><select id="bu_${o.id}" data-lazy="buy">${buyOptsLazy}</select><button class="btn primary sm" data-act="buyUsed" data-id="${o.id}">购买</button></div></div></div></div>`; });
    return html; }
  // —— 自主设计 ——
  function designHTML(){ const rd = G.rdState(), why = G.designUnlock();
    let h = `<h3>自主设计</h3><div class="dim" style="font-size:12px;margin-bottom:6px">以同级别当前最好的车型为基础，选择提速、加大载客（牵引）或节能，花研发点定型成本公司自己的车型。自主车型长期在产、不会停产，不收关税，30 天交付。同时最多 3 个方案在研，共可保留 ${G.DESIGN_MAX} 款。</div>`;
    if (why) return h + `<div class="neg" style="font-size:12px">${why}</div>`;
    h += G.PLATFORMS.map(p => { const b = G.designBase(p);
      return `<div class="row sb" style="padding:6px 0;border-bottom:1px solid var(--line)"><div><b>${p.name}</b><br><span class="dim" style="font-size:12px">${b ? `参考车型：${esc(b.name)} · ${b.vmax} km/h · ${b.use==='freight' ? b.cap.toLocaleString() + ' t' : (G.isUnit(b) ? b.cap + ' 人' : b.power.toLocaleString() + ' kW')}` : '暂无参考车型'}</span></div><button class="btn sm" data-act="dzNew" data-v="${p.id}" ${b ? '' : 'disabled'}>设计新车</button></div>`; }).join('');
    const ds = rd.designs || [];
    if (ds.length) h += `<div style="font-size:12px;margin-top:8px;line-height:2">本公司设计：${ds.map(d => `<span class="tag" style="margin-right:4px">${esc(d.name)} · ${esc(d.en)} · ${rd.done[d.research] ? '已投产' : '在研'}</span>${rd.done[d.research] ? '' : `<button class="btn sm" data-act="dzCancel" data-v="${d.research}">撤销</button> `}`).join('')}</div>`;
    return h; }
  function designModal(){ const d = ui.dz; const rd = G.rdState(); const q = G.designQuote(d.pid, { sp:d.sp, cap:d.cap, eco:d.eco }); if (!q) { closeModal(); return; }
    const p = q.p, b = q.base;
    const opt = (k, lab, vals) => `<div class="row" style="gap:6px;align-items:center;margin:6px 0;flex-wrap:wrap"><span style="width:72px">${lab}</span>${vals.map((v, i) => `<button class="btn sm ${d[k]===i ? 'primary' : ''}" data-dz="${k}" data-v="${i}" ${k==='sp' && i > 0 && q.spMax ? 'disabled' : ''}>${v}</button>`).join('')}</div>`;
    const capOf = (m, v) => m.use === 'freight' ? v.toLocaleString() + ' t' : v + ' 人';
    modal(`<div class="stamp">自主设计</div><h1>${p.name}</h1><div class="muted">参考车型：${esc(b.name)}（${esc(b.en)}）</div>
      <div class="dz-art" style="max-width:360px;margin:8px auto">${artOf(Object.assign({}, b, { img:p.img }), 'plat_' + p.id + '_' + b.id)}</div>
      ${opt('sp', '提速', ['持平', '+10%', '+20%'])}${opt('cap', p.use === 'freight' ? '牵引' : (G.isUnit(b) ? '载客' : '功率'), ['持平', '+10%', '+20%'])}${opt('eco', '节能', ['持平', '−10%', '−20%'])}
      ${q.spMax ? '<div class="dim" style="font-size:11px">参考车型已经达到这个平台的速度上限，无法再提速。</div>' : ''}
      <label class="row" style="gap:6px;margin:8px 0;align-items:center"><span style="width:72px">车型名称</span><input id="dzName" maxlength="14" placeholder="留空自动命名" value="${esc(d.name || '')}" style="flex:1;min-width:0"></label>
      <dl class="kv"><dt>最高速度</dt><dd>${b.vmax} → <b>${q.vmax}</b> km/h</dd><dt>功率</dt><dd>${b.power.toLocaleString()} → <b>${q.power.toLocaleString()}</b> kW</dd>
        <dt>${p.use === 'pax' ? '定员' : '牵引定数'}</dt><dd>${capOf(b, b.cap)} → <b>${capOf(b, q.cap)}</b>${p.use === 'pax' && !G.isUnit(b) ? '（机车定员取决于编组，功率决定能挂几节）' : ''}</dd>
        <dt>运行成本</dt><dd>${b.run} → <b>${q.run}</b> 元/列km（1985 年价）</dd><dt>新车价格</dt><dd>${fmtY(q.price * 1e4)}</dd>
        <dt>研发需要</dt><dd><b>${q.pts}</b> 研发点${rd.lastGain ? `，按目前投入约 ${Math.ceil(q.pts / rd.lastGain)} 个月` : rd.lv ? '' : '（<span class="neg">目前研发投入为 0</span>）'}</dd></dl>
      <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn" data-m="close">取消</button><button class="btn primary" data-dz="ok">立项</button></div>`); }
  function pCars(chip, catBar){
    const S = G.S; const y = G.ym(S.day).y; const f = ui.mf;
    let list = CARS.filter(c => (f.ck==='all'||!f.ck||c.kind===f.ck) && (f.show==='all' || (f.show==='soon' ? c.year > y : G.carAvailable(c))));
    list.sort((a,b) => (G.carAvailable(b)-G.carAvailable(a)) || a.year-b.year);
    let html = catBar + `<h2>车厢图鉴 <span class="tag">${y}年</span></h2>
      <div class="hint" style="margin-bottom:10px">车厢在 <b>「车队」→ 编组</b> 中按需购买并挂到机车后面。客车的 <b>舒适度</b> 影响票价：长途旅客更愿意为卧铺和空调车付钱，1996 年后无空调车厢吸引力下降。编组总重不能超过机车牵引能力。</div>
      <div class="filters">${chip('show','sale','在售')}${chip('show','soon','即将上市')}${chip('show','all','全部图鉴')}</div>
      <div class="filters">${chip('ck','all','全部')}${chip('ck','pax','客车厢')}${chip('ck','freight','货车厢')}</div>`;
    list.forEach(c => { const av = G.carAvailable(c);
      html += `<div class="tcard ${av?'':'na'}"><div class="art">${carArt(c.id)}<span class="flag">${c.country}</span><span class="yr">${c.year}–${c.end>=G.FAR_END?'':c.end}</span></div><div class="body">
        <div class="row sb model-heading"><b class="name clip-name" title="${esc(c.name)}">${esc(c.name)}</b><span class="tag ${c.kind==='pax'?'blue':'green'}">${c.kind==='pax'?'客车':'货车 · '+c.cargo}</span></div>
        <div class="specs">${c.kind==='pax' ? `<div><label>定员</label><b>${c.seats} 人</b></div><div><label>舒适度</label><b>${c.comfort.toFixed(1)}${c.ac ? ' ' + icon('cooling', '空调') : ''}</b></div>` : `<div><label>载重</label><b>${c.load} t</b></div><div><label>货类</label><b style="font-size:11px">${c.cargo}</b></div>`}
          <div><label>自重</label><b>${c.tare} t</b></div><div><label>构造速度</label><b>${c.vmax} km/h</b></div></div>
        <div class="note">${c.note}</div>
        <div class="row sb"><span class="num gold">${fmtY(G.carPrice(c))} / 辆</span>${av ? '<span class="dim">在「车队」编组中购买</span>' : `<span class="tag">${c.year > y ? c.year + ' 年上市' : '已停产'}</span>`}</div></div></div>`; });
    return html;
  }
  function consistModal(){
    const S = G.S; const d = ui.cdraft; const t = S.trains.find(x => x.id === d.tid); if (!t){ closeModal(); return; }
    const m = G.trainById[t.model]; const cars = Object.entries(d.n).map(([id,n]) => ({ id, n })).filter(x => x.n > 0);
    const cs = G.consistStats(Object.assign({}, t, { cars })); const old = {}; (t.cars||[]).forEach(x => old[x.id] = x.n);
    let cost = 0, refund = 0; Object.keys(Object.assign({}, old, d.n)).forEach(id => { const dd = (d.n[id]||0) - (old[id]||0); const pr = G.carPrice(G.carById[id]); if (dd > 0) cost += pr*dd; else refund += pr*(-dd)*0.6; });
    const over = cs.weight > cs.limit, long = cs.n > G.maxCars(m);
    const avail = CARS.filter(c => c.kind === m.use && (G.carAvailable(c) || old[c.id]));
    const L = 600; const cmf = G.comfortMul(Object.assign({}, t, { cars }), L);
    modal(`<h1 class="named-heading"><span class="measure">列车编组</span> <span class="clip-name" title="${esc(t.name)}">${esc(t.name)}</span></h1><div class="muted">${m.name} · ${useName[m.use]} · 牵引能力 ${cs.limit.toLocaleString()} t · 最多 ${G.maxCars(m)} 辆</div>
      <div class="grid3" style="margin:12px 0">
        <div class="stat"><label>${m.use==='pax'?'总定员':'总载重'}</label><b>${cs.cap.toLocaleString()}</b><small>${m.use==='pax'?'&nbsp;人':'&nbsp;t'}</small></div>
        <div class="stat"><label>编组总重 / 牵引能力</label><b class="${over?'neg':''}">${Math.round(cs.weight).toLocaleString()}</b><small> / ${cs.limit.toLocaleString()} t</small><div class="bar" style="margin-top:4px"><i style="width:${Math.min(100,cs.weight/cs.limit*100)}%;${over?'background:var(--red)':''}"></i></div></div>
        <div class="stat"><label>列车最高速度</label><b>${cs.vmax}</b><small>&nbsp;km/h</small>${m.use==='pax'?`<br><small>长途舒适加成 ×${cmf.toFixed(2)}</small>`:''}</div>
      </div>
      ${m.use==='freight' ? (() => { const cc = G.cargoCaps(Object.assign({}, t, { cars })).caps; const ks = Object.keys(cc); return `<div style="margin:-4px 0 10px;font-size:12px"><span class="dim">可装货种：</span>${ks.length ? ks.map(g => `<span class="tag" style="color:${CARGO[g].color};border-color:${CARGO[g].color}">${CARGO[g].name} ${cc[g].toLocaleString()} t</span>`).join(' ') : '<span class="neg">无</span>'} <span class="dim">· 敞车拉煤和矿石，棚车拉粮食和件杂货，罐车拉油，集装箱车拉集装箱；混编可兼顾多种货</span></div>`; })() : ''}
      <div class="clist">${avail.map(c => `<div class="crow ${(d.n[c.id]||0) ? 'on' : ''}"><span class="thumb cthumb">${carArt(c.id, 's')}</span>
        <div class="cinfo"><b class="clip-name" title="${esc(c.name)}">${esc(c.name)}</b><div class="dim">${c.country}${c.ac?' · 空调':''} · ${c.kind==='pax' ? c.seats + ' 座' : c.load + ' t'} · ${c.vmax} km/h · <span class="num">${W(G.carPrice(c))}</span>/辆${!G.carAvailable(c)?' · <span class="neg">已停产，只能减少</span>':''}</div></div>
        <div class="cstep"><button class="btn sm" data-cm="dec" data-id="${c.id}" aria-label="减少一节车厢">${icon('minus')}</button><b class="num">${d.n[c.id]||0}</b><button class="btn sm" data-cm="inc" data-id="${c.id}" aria-label="增加一节车厢" ${!G.carAvailable(c)?'disabled':''}>${icon('plus')}</button><button class="btn sm" data-cm="inc5" data-id="${c.id}" aria-label="增加五节车厢" ${!G.carAvailable(c)?'disabled':''}>${icon('plus')}5</button></div></div>`).join('')}
      </div>
      <div class="row sb cfoot" style="margin-top:14px"><div class="muted">新购 ${W(cost)} · 回收 ${W(refund)}（按六折）· <b>净支出 ${W(cost-refund)}</b>${over?' · <span class="neg">超出牵引能力</span>':''}${long?' · <span class="neg">编组过长</span>':''}</div>
        <div class="row"><button class="btn" data-m="close">取消</button><button class="btn primary" data-cm="ok" ${over||long?'disabled':''}>确认编组</button></div></div>`, true);
  }

  // —— 财务 ——
  function monthBanner(){
    const mf = G.MF || {}; const evs = mf.evs || []; const t = G.ym(G.S.day);
    const tip = mf.pax > 1.1 ? (t.m <= 2 ? '春运' : t.m === 10 ? '国庆黄金周' : t.m === 5 ? '五一黄金周' : '暑运') : mf.pax < 0.95 ? '客运淡季' : '平稳';
    return `<div class="card" style="margin:8px 0"><div class="row sb"><b>本月市场</b><span class="dim">${t.y}年${t.m}月</span></div>
      <dl class="kv" style="margin-top:6px"><dt>客流系数</dt><dd>×${(mf.pax||1).toFixed(2)}（${tip}）</dd><dt>货运系数</dt><dd>×${(mf.fr||1).toFixed(2)}</dd></dl>
      ${evs.map(ev => `<div style="margin-top:4px"><span class="tag ${ev.block?'red':'blue'}">${ev.title}</span> <span class="dim" style="font-size:12px">${ev.text}</span></div>`).join('')}</div>`;
  }
  function reportHTML(r){
    const tot = Math.max(1, r.tons); const cg = CARGO_IDS.map(g => [g, (r.cargo||{})[g]||0]).filter(x => x[1] > 0).sort((a,b) => b[1]-a[1]);
    return `<div class="stamp">${r.y} 年度报告</div><h1 class="named-heading"><span class="clip-name" title="${esc(G.S.company)}">${esc(G.S.company)}</span> <span class="measure">${r.y}&nbsp;年报</span></h1>
      <div class="grid3">
        <div class="stat"><label>全年营收</label><b>${W(r.rev)}</b></div><div class="stat"><label>净利润</label><b class="${financialClass(r.net)}">${W(r.net)}</b></div><div class="stat"><label>年末净资产</label><b class="gold">${W(r.worth)}</b></div>
        <div class="stat"><label>旅客发送</label><b>${(r.paxN/1e4).toFixed(0)}</b><small>&nbsp;万人次</small></div><div class="stat"><label>货物发送</label><b>${(r.tons/1e4).toFixed(0)}</b><small>&nbsp;万吨</small></div><div class="stat"><label>点亮城市</label><b>${r.lit}</b></div>
      </div>
      <h3>市场份额（占全国铁路）</h3>
      <dl class="kv"><dt>客运</dt><dd>${(r.paxShare*100).toFixed(2)}%</dd><dt>货运</dt><dd>${(r.tonShare*100).toFixed(2)}%</dd><dt>自有线路</dt><dd>${r.km.toLocaleString()} km</dd><dt>列车</dt><dd>${r.trains} 列</dd>${r.rep !== undefined ? `<dt>商誉</dt><dd>${Math.round(r.rep)}</dd>` : ''}${r.sat !== undefined ? `<dt>平均满意度</dt><dd>${Math.round(r.sat)}</dd>` : ''}${r.mcap ? `<dt>年末股价 / 市值</dt><dd>${r.price.toFixed(2)} 元 / ${W(r.mcap)}</dd><dt>派发红利</dt><dd><span class="measure">${W(r.div||0)}</span></dd>` : ''}</dl>
      <h3>营收构成</h3>
      <dl class="kv"><dt>客运</dt><dd><span class="measure">${W(r.pax)}</span></dd><dt>货运</dt><dd><span class="measure">${W(r.freight)}</span></dd><dt>过轨费收入</dt><dd><span class="measure">${W(r.feeIn)}</span></dd>${r.biz ? `<dt>车站商业</dt><dd><span class="measure">${W(r.biz)}</span></dd>` : ''}${r.overseas ? `<dt>海外项目</dt><dd><span class="measure">${W(r.overseas)}</span></dd>` : ''}${r.rent ? `<dt>地产租金</dt><dd><span class="measure">${W(r.rent)}</span></dd>` : ''}${r.subsidy ? `<dt>公益慢车补贴</dt><dd><span class="measure">${W(r.subsidy)}</span></dd>` : ''}${r.contract ? `<dt>合同奖罚</dt><dd class="${financialClass(r.contract)}"><span class="measure">${W(r.contract)}</span></dd>` : ''}<dt>经营支出</dt><dd class="${financialClass(-r.opex)}"><span class="measure">${NW(r.opex)}</span></dd><dt>资本支出</dt><dd class="dim"><span class="measure">${W(r.capex)}</span></dd></dl>
      ${r.fin ? (() => { const F = r.fin, it = [['银行借款', F.loanIn, 1], ['归还贷款', F.loanOut, -1], ['发行债券', F.bondIn, 1], ['兑付债券', F.bondOut, -1], ['股权融资（上市/增发）', F.equityIn, 1], ['回购股份', F.buyback, -1], ['派发红利', F.div, -1]].filter(x => x[1]);
        return `<h3>现金流桥接</h3><dl class="kv"><dt>经营净利</dt><dd class="${financialClass(r.net)}"><span class="measure">${W(r.net)}</span></dd><dt>投资净支出（建设与购车）</dt><dd class="${financialClass(-r.capex)}"><span class="measure">${W(-r.capex)}</span></dd>${it.map(x => `<dt>${x[0]}</dt><dd class="${financialClass(x[1] * x[2])}"><span class="measure">${W(x[1] * x[2])}</span></dd>`).join('')}${r.cashPreDiv !== undefined ? `<dt>年末现金（派息前 / 派息及融资后）</dt><dd>${W(r.cashPreDiv)} / ${W(r.cash)}</dd>` : ''}${r.frFee ? `<dt>其中经营权年费</dt><dd class="${financialClass(-r.frFee)}"><span class="measure">${W(-r.frFee)}</span></dd>` : ''}</dl>`; })() : ''}
      ${cg.length ? `<h3>货物构成</h3>` + cg.map(([g,v]) => `<div class="region"><span>${CARGO[g].name}</span><div class="bar"><i style="width:${v/tot*100}%;background:${CARGO[g].color}"></i></div><span class="num r muted">${(v/1e4).toFixed(0)}&nbsp;万吨</span></div>`).join('') : ''}
      ${r.routes.length ? `<h3>线路排行（全年利润）</h3><div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t fin-table"><tr><th>线路</th><th class="r">收入</th><th class="r">利润</th></tr>${r.routes.slice(0,8).map(x => `<tr><td class="name-cell"><span class="clip-name" title="${esc(x.name)}">${esc(x.name)}</span></td><td class="num r">${W(x.rev)}</td><td class="num r ${financialClass(x.net)}">${W(x.net)}</td></tr>`).join('')}</table></div>` : ''}`;
  }
  function pFinance(){
    const S = G.S; const y = G.ym(S.day).y; const h = S.history[S.history.length-1] || {};
    const yr = S.history.filter(x => x.y === (h.y || y));
    const sum = k => yr.reduce((a,x) => a + (x[k]||0), 0);
    const row = (name, key, expense = false) => {
      const yearValue = sum(key);
      const color = value => expense ? (Math.abs(value) >= 500 ? 'loss' : '') : key === 'contract' ? financialClass(value) : '';
      const format = expense ? NW : W;
      return `<tr><td>${name}</td><td class="num r ${color(h[key])}">${h[key]!==undefined ? format(h[key]) : '—'}</td><td class="num r ${color(yearValue)}">${format(yearValue)}</td></tr>`;
    };
    const trV = S.trains.reduce((a,t) => a + G.trainValue(t), 0), tkV = G.assets() - trV;
    const lim = G.creditLimit();
    const reps = S.reports || []; if (ui.repY === undefined || !reps.find(r => r.y === ui.repY)) ui.repY = reps.length ? reps[reps.length-1].y : null;
    const repSel = reps.length ? `<h3>年度报告</h3><div class="row" style="flex-wrap:wrap;gap:4px;margin-bottom:8px">${reps.map(r => `<button class="btn sm ${r.y===ui.repY?'primary':''}" data-act="repY" data-y="${r.y}">${r.y}</button>`).join('')}</div><div class="card">${reportHTML(reps.find(r => r.y === ui.repY))}</div>` : `<h3>年度报告</h3><div class="dim">每年 12 月底生成年报。</div>`;
    return `<h2>财务中心</h2>
      <div class="grid3">
        <div class="stat"><label>现金</label><b class="${S.cash<0?'loss':''}">${W(S.cash)}</b></div>
        <div class="stat"><label>银行负债</label><b>${W(S.debt)}</b></div>
        <div class="stat"><label>净资产</label><b class="gold">${W(G.netWorth())}</b></div>
        <div class="stat"><label>商誉</label><b>${Math.round(S.rep ?? 50)}</b> ${repTag()}</div>
        <div class="stat"><label>${S.ipo ? '股价' : '公司估值'}</label><b>${S.ipo ? S.ipo.price.toFixed(2) + ' 元' : W(G.valuation())}</b></div>
        <div class="stat"><label>${S.ipo ? '总市值' : '未到期债券'}</label><b>${S.ipo ? W(G.marketCap()) : W((S.bonds||[]).reduce((a,b)=>a+b.amt,0))}</b></div>
      </div>
      ${monthBanner()}
      <h3>月度收支（近 36 个月）</h3>
      <canvas class="chart" id="finChart"></canvas>
      <div class="legendrow"><span><i style="background:var(--finance-revenue)"></i>总收入</span><span><i style="background:var(--finance-expense)"></i>经营支出</span><span><i style="background:var(--gain)"></i>净利为正</span><span><i style="background:var(--loss)"></i>净利为负</span></div>
      <h3>损益表</h3>
      <div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t fin-table"><tr><th>科目</th><th class="r">上月 (${h.y||'—'}.${h.m||''})</th><th class="r">${h.y||y} 年累计</th></tr>
        ${row('客运收入','pax')}${row('货运收入','freight')}${row('过轨费收入','feeIn')}${row('合同奖金/违约金','contract')}${row('车站商业','biz')}${row('地产租金','rent')}${row('公益慢车补贴','subsidy')}
        ${row('列车运行成本','run',1)}${row('过轨费支出','fees',1)}${row('车辆维护','maint',1)}${row('线路养护','trackMaint',1)}${row('人力（高管与培训）','staff',1)}${row('研发投入','rd',1)}${row('贷款与债券利息','interest',1)}
        <tr><td><b>经营净利</b></td><td class="num r ${financialClass(h.net)}"><b>${h.net!==undefined?W(h.net):'—'}</b></td><td class="num r ${financialClass(sum('net'))}"><b>${W(sum('net'))}</b></td></tr>
        <tr><td class="dim">资本支出（建设与购车，扣除出售回款）</td><td class="num r dim">${h.capex!==undefined?W(h.capex):'—'}</td><td class="num r dim">${W(sum('capex'))}</td></tr>
      </table></div>
      <h3>资产负债</h3>
      <dl class="kv"><dt>现金</dt><dd><span class="measure">${fmtY(S.cash)}</span></dd><dt>车辆资产（折旧后）</dt><dd><span class="measure">${fmtY(trV)}</span></dd><dt>线路资产（折旧后）</dt><dd><span class="measure">${fmtY(tkV)}</span></dd><dt>银行负债</dt><dd class="${financialClass(-S.debt)}"><span class="measure">${NW(S.debt)}元</span></dd><dt>土地（市值）</dt><dd><span class="measure">${fmtY(G.landValue())}</span></dd><dt>应付债券</dt><dd class="neg"><span class="measure">${NW((S.bonds||[]).reduce((a,b)=>a+b.amt,0))}元</span></dd><dt><b>净资产</b></dt><dd class="gold"><b>${fmtY(G.netWorth())}</b></dd></dl>
      ${repSel}
      ${capitalHTML()}
      <h3>银行贷款</h3>
      <div class="card"><dl class="kv"><dt>授信额度</dt><dd>${fmtY(lim)}（商誉加成 ${G.repMul()>=1?"+":"−"}${Math.abs(Math.round((G.repMul()-1)*100))}%）</dd><dt>已用</dt><dd>${pct(S.debt/Math.max(1,lim))}</dd><dt>当前年利率</dt><dd>${(G.rate(y)*100).toFixed(2)}%</dd><dt>月利息</dt><dd><span class="measure">${fmtY(S.debt*G.rate(y)/12)}</span></dd></dl>
        <div class="row" style="margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-act="borrow" data-v="1e7">借款 1000万</button><button class="btn sm" data-act="borrow" data-v="5e7">借款 5000万</button><button class="btn sm" data-act="borrow" data-v="2e8">借款 2亿</button>
        <button class="btn sm" data-act="repay" data-v="1e7">还款 1000万</button><button class="btn sm" data-act="repay" data-v="1e12">全部还清</button></div></div>
      <h3>自有线路过轨费率</h3>
      <div class="card"><div class="row sb"><span>相对国铁基准费率</span><b class="num gold">${pct(S.feeMul)}</b></div>
        <input type="range" min="50" max="200" step="10" value="${Math.round(S.feeMul*100)}" data-act="feeMul" style="width:100%;margin-top:6px">
        <div class="dim" style="font-size:11px">费率越高单列收入越高，但国铁与同业的过轨列车会减少。上月过轨费收入：${W(h.feeIn||0)}</div></div>`;
  }
  function drawFinanceCharts(){ const c = $('#finChart'); if (!c) return; const H = G.S.history.slice(-36);
    chart(c, H.map(h => `${h.y}.${h.m}`), [
      { color:financeColors.revenue, data:H.map(h => h.rev), fill:true },
      { color:financeColors.expense, data:H.map(h => h.opex) },
      { color:financeColors.neutral, data:H.map(h => h.net), signed:true } ]); }
  function chart(c, labels, series, fmt){
    const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1; c.width = r.width*dpr; c.height = r.height*dpr;
    const x = c.getContext('2d'); x.setTransform(dpr,0,0,dpr,0,0); const w = r.width, h = r.height, pl = 52, pr = 10, pt = 10, pb = 22;
    x.clearRect(0,0,w,h);
    if (labels.length < 2){ x.fillStyle = '#6d7f99'; x.font = '12px sans-serif'; x.fillText('数据积累中（每月结算后更新）', w/2-90, h/2); return; }
    let mn = 0, mx = 1; series.forEach(s => s.data.forEach(v => { mn = Math.min(mn, v); mx = Math.max(mx, v); }));
    const span = (mx - mn) || 1; mx += span*0.08; if (mn < 0) mn -= span*0.08;
    const X = i => pl + (w-pl-pr) * i/(labels.length-1), Y = v => pt + (h-pt-pb) * (1 - (v-mn)/(mx-mn));
    x.font = '10px Menlo, monospace'; x.fillStyle = '#6d7f99'; x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 1;
    for (let k = 0; k <= 4; k++){ const v = mn + (mx-mn)*k/4; const yy = Y(v); x.beginPath(); x.moveTo(pl, yy); x.lineTo(w-pr, yy); x.stroke(); x.fillText(Math.abs(v) < 1 ? '0' : (fmt || W)(v).replace(' ',''), 4, yy+3); }
    if (mn < 0){ x.strokeStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.moveTo(pl, Y(0)); x.lineTo(w-pr, Y(0)); x.stroke(); }
    const step = Math.ceil(labels.length / 6); labels.forEach((l,i) => { if (i % step === 0) x.fillText(l, X(i)-14, h-6); });
    series.forEach(s => {
      x.beginPath(); s.data.forEach((v,i) => i ? x.lineTo(X(i), Y(v)) : x.moveTo(X(i), Y(v)));
      x.lineWidth = 2;
      if (!s.movement){
        x.strokeStyle = s.color;
        if (s.signed && s.data.some(v => v !== 0)){
          const colors = x.createLinearGradient(0, pt, 0, h-pb);
          const zero = Math.max(0, Math.min(1, (Y(0)-pt)/(h-pb-pt)));
          colors.addColorStop(0, financeColors.gain);
          colors.addColorStop(zero, financeColors.gain);
          colors.addColorStop(zero, financeColors.loss);
          colors.addColorStop(1, financeColors.loss);
          x.strokeStyle = colors;
        }
        x.stroke();
      }
      if (s.fill){ x.lineTo(X(s.data.length-1), Y(Math.max(0,mn))); x.lineTo(X(0), Y(Math.max(0,mn))); x.closePath(); const g = x.createLinearGradient(0,pt,0,h-pb); g.addColorStop(0, s.color+'55'); g.addColorStop(1, s.color+'00'); x.fillStyle = g; x.fill(); }
      if (s.movement){
        for (let i = 1; i < s.data.length; i++){
          x.beginPath(); x.moveTo(X(i-1), Y(s.data[i-1])); x.lineTo(X(i), Y(s.data[i]));
          x.strokeStyle = financialColor(s.data[i] - s.data[i-1]);
          x.stroke();
        }
      }
    });
  }

  // —— 政策 ——
  function pPolicy(){
    const S = G.S; const y = G.ym(S.day).y;
    const done = POLICIES.filter(p => S.policies.includes(p.id)); const next = POLICIES.filter(p => !S.policies.includes(p.id));
    return `<h2>政策环境</h2>
      <div class="hint" style="margin-bottom:10px">国铁的新线与提速按历史进程推进，但如果你抢先修建，历史将被改写。新政策出台时会第一时间通知你。</div>
      <div class="grid2">
        <div class="stat"><label>车辆进口关税</label><b>${pct(S.mods.tariff)}</b></div>
        <div class="stat"><label>年度进口额度</label><b>${S.mods.importQuota>=99?'不限':S.mods.importQuota+' 列'}</b></div>
        <div class="stat"><label>建设补贴（全国/中西部/高铁）</label><b>${pct(S.mods.buildSubsidy)} / ${pct(S.mods.westSubsidy)} / ${pct(S.mods.hsrSubsidy)}</b></div>
        <div class="stat"><label>国铁过轨基准费</label><b>${G.stateFeeBase(y).toFixed(1)}</b><small> 元/列km</small></div>
        <div class="stat"><label>物价指数 (1985=1)</label><b>${G.cpi(y).toFixed(2)}</b></div>
        <div class="stat"><label>贷款年利率</label><b>${(G.rate(y)*100).toFixed(2)}%</b></div>
      </div>
      <h3>政策时间线</h3>
      <div class="timeline">
        ${done.map(p => `<div class="tl"><span class="y">${p.y}.${String(p.m).padStart(2,'0')}</span> <span class="tag gold">${p.tag}</span><div><b>${p.title}</b></div><div class="muted" style="font-size:12px">${p.text}</div><div style="font-size:12px;margin-top:2px">${p.effects.map(x => '· ' + x).join('<br>')}</div></div>`).join('')}
        ${next.slice(0,1).map(p => `<div class="tl future"><span class="y">${p.y} 年前后</span><div class="muted"><b>坊间传闻：</b>${p.tag}方面将有新动向……</div></div>`).join('')}
        ${next.length > 1 ? `<div class="tl future"><span class="y">……</span><div class="dim">还有 ${next.length-1} 项政策尚未公布</div></div>` : ''}
      </div>`;
  }

  function rivalCompHTML(){
    const S = G.S; G.ensureT4(); const act = S.rivals.filter(r => r.active && !r.acquired);
    let h = `<h3>竞争态势</h3>`; const items = [];
    act.forEach(r => { const D = RIVAL[r.id], w = G.warOf(r.id);
      if (w) items.push(`<div class="card warn"><div class="row sb"><b><span class="swatch" style="background:${D.color}"></span>${D.name} · 价格战</b><span class="tag red">剩 ${Math.max(0, Math.ceil((w.until - S.day)/30))} 个月</span></div>
        <p class="detail-copy">波及 ${w.cities.slice(0,6).map(c => C[c].name).join('、')}${w.cities.length>6?' 等':''}。${w.resp==='match' ? '你已跟进降价：重叠城市之间票价 −15%，客源基本保住，对方消耗更快。' : w.resp==='hold' ? '你保持原价：重叠城市间约四分之一客源流失。' : '尚未应对，客源正在流失。'}</p>
        <div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sm ${w.resp==='hold'?'primary':''}" data-act="warResp" data-id="${r.id}" data-v="hold">保持票价</button><button class="btn sm ${w.resp==='match'?'primary':''}" data-act="warResp" data-id="${r.id}" data-v="match">跟进降价</button></div></div>`);
      if (r.plan) { const e = E[r.plan.e]; const d = Math.max(0, Math.ceil((r.plan.at - S.day)/30));
        items.push(`<div class="card"><div class="row sb"><b><span class="swatch" style="background:${D.color}"></span>${D.name} · 筹建情报</b><span class="tag">约 ${d} 个月后开工</span></div>
        <p class="detail-copy">计划修建 ${C[e.a].name}—${C[e.b].name}（${e.dist} km，${G.TRACK_CLASSES[r.plan.cls].name}）。在对方开工前抢先动工，这条走廊就归你。</p>
        <div class="row" style="justify-content:flex-end"><button class="btn sm" data-act="selEdge" data-e="${e.i}">查看走廊 →</button></div></div>`); }
    });
    if (S.ipo) { const ctl = G.controlPct(), dq = G.diluteQuote();
      const holders = act.filter(r => r.stake > 0);
      items.push(`<div class="card"><div class="row sb"><b>股权与控制权</b><span class="num">你方控制 ${(ctl*100).toFixed(1)}%</span></div>
        ${holders.length ? holders.map(r => { const p = G.raidPct(r.id), q = G.greenmailQuote(r.id); return `<div class="region"><span style="white-space:nowrap"><span class="swatch" style="background:${RIVAL[r.id].color}"></span>${RIVAL[r.id].name}</span><div class="bar ${p > ctl*0.8 ? 'r' : ''}"><i style="width:${Math.min(100, p/ctl*100)}%"></i></div><span class="num r ${p > ctl*0.8 ? 'neg' : ''}">${(p*100).toFixed(1)}%</span></div>
          <div class="row" style="justify-content:flex-end;margin-bottom:4px"><button class="btn sm" data-act="greenmail" data-id="${r.id}" ${q && S.cash >= q.cost ? '' : 'disabled'}>溢价回购 ${q ? W(q.cost) : ''}</button></div>`; }).join('')
          : `<p class="detail-copy dim">目前没有同业持有本公司股份。股价明显低于内在价值时，资金充裕的同业可能在二级市场举牌。</p>`}
        <div class="row sb" style="margin-top:6px;font-size:12px"><span class="dim">同业持股一旦超过你方控制比例，公司即被收购。增发会摊薄你方比例。</span>
        <button class="btn sm" data-act="dilute" ${dq && dq.wait <= 0 ? '' : 'disabled'} title="向友好投资者定向增发 12%（每 24 个月一次），股价 −6%，商誉 −1">定向增发 12%${dq && dq.wait > 0 ? ` · ${Math.ceil(dq.wait/30)} 个月后` : ''}</button></div></div>`); }
    h += items.length ? items.join('') : `<div class="dim">各家同业目前按部就班。它们准备修线时会先走漏风声，现金充裕时可能在与你重叠的城市间发起价格战。</div>`;
    return h;
  }
  // —— 重大项目：干线经营权、超级工程、海外项目 ——
  function frCard(f, inModal){ const S = G.S, y = G.ym(S.day).y, A = inModal ? 'data-m' : 'data-act';
    const head = `<div class="row sb"><b>${esc(f.name)}</b><span class="dim">${C[f.a].name}—${C[f.b].name} · ${f.km.toLocaleString()} km</span></div>`;
    const cities = `<div class="dim" style="font-size:11px;margin:3px 0">沿线 ${f.path.filter(c => !G.cities[c].tier || G.cities[c].tier === 1).map(c => C[c].name).join('、')}</div>`;
    if (f.st === 'bid') return `<div class="card gov">${head}${cities}
      <dl class="kv"><dt>经营期</dt><dd>${G.FR_YEARS} 年，独家开行社会资本旅客列车</dd><dt>中标好处</dt><dd>沿线城市之间客源份额 +25%，国铁过轨费减半</dd><dt>履约要求</dt><dd>每月在干线上开行不少于 ${f.minTrips} 趟旅客列车</dd><dt>年费底价</dt><dd class="num">${W(f.reserve)}元</dd><dt>我方报价</dt><dd class="num ${f.bid?'gold':''}">${f.bid ? W(f.bid) + '元/年' : '未投标'}</dd><dt>开标</dt><dd>${Math.max(0, Math.ceil((f.close - S.day)/30))} 个月后</dd></dl>
      <div class="row" style="justify-content:flex-end;gap:6px;margin-top:6px;flex-wrap:wrap">${f.bid ? `<button class="btn sm" ${A}="frBid" data-id="${f.uid}" data-v="0">撤回报价</button>` : ''}${[1, 1.25, 1.5].map(k => `<button class="btn sm ${Math.abs(f.bid - f.reserve*k) < 1 ? 'primary' : ''}" ${A}="frBid" data-id="${f.uid}" data-v="${k}">报价 ${k === 1 ? '底价' : '×' + k}</button>`).join('')}</div>
      <div class="dim" style="font-size:11px;margin-top:4px">报价越高越容易中标；商誉高也有加分。同业公司也会参与竞标。</div></div>`;
    if (f.st === 'held') { const me = f.holder === 'P', left = Math.max(0, Math.ceil((f.until - S.day)/365*10)/10);
      const n = me ? (f.lastTrips !== undefined ? f.lastTrips : G.frTrips(f)) : 0, r = me ? Math.min(1, n / f.minTrips) : 0;
      return `<div class="card ${me ? '' : 'warn'}">${head}<p class="detail-copy">${me ? `<span class="tag green">本公司经营</span> 剩 ${left} 年 · 年费 ${W(f.fee)}元` : `<span class="tag red">${esc((RIVAL[f.holder] || { name:"地方国资联合体" }).name)} 经营</span> 剩 ${left} 年，你在沿线城市之间的客源被分流约 20%`}</p>
        ${me ? `<div class="region"><span>月开行</span><div class="bar ${r>=1?'g':''}"><i style="width:${r*100}%"></i></div><span class="num r ${r>=1?'pos':'neg'}">${Math.round(n)} / ${f.minTrips} 趟</span></div>${f.strikes ? `<div class="neg" style="font-size:11px">未达标 ${f.strikes}/3 次，满 3 次将被收回经营权</div>` : ''}` : ''}</div>`; }
    return ''; }
  function superCard(sp){ const S = G.S, st = (S.supers || {})[sp.id], q = G.superQuote(sp.id), e = E[sp.e];
    let body = '';
    if (!st) body = `<dl class="kv"><dt>线路</dt><dd>${C[e.a].name}—${C[e.b].name} · ${e.dist.toLocaleString()} km · ${sp.v} km/h${sp.plateau ? ' · 高原' : ''}</dd><dt>总投资</dt><dd class="num">${W(q.cost)}元</dd><dt>工期</dt><dd>${Math.round(sp.months/12)} 年</dd><dt>出资方式</dt><dd>首期 15%（${W(q.first)}元），其余每月 ${W(q.monthly)}元</dd><dt>建成奖励</dt><dd>商誉 +8，线路归本公司所有</dd></dl>
      ${q.why.length ? `<div class="neg" style="font-size:12px;margin-top:4px">${q.why.join('；')}</div>` : ''}<div class="row" style="justify-content:flex-end;margin-top:6px"><button class="btn sm ${q.ok?'primary':''}" data-act="super" data-id="${sp.id}" ${q.ok?'':'disabled'}>${ui.confirm==='sp'+sp.id ? '确认立项' : '立项开工'}</button></div>`;
    else if (st.st === 'build') { const tr = S.tracks.find(x => x.id === st.tr); const r = st.paid / st.cost; const ml = tr ? Math.max(0, Math.ceil((tr.done - S.day)/30)) : 0;
      body = `<div class="region"><span>已投资</span><div class="bar"><i style="width:${r*100}%"></i></div><span class="num r">${pct(r)}</span></div><p class="detail-copy">${W(st.paid)} / ${W(st.cost)}元 · 每月拨付 ${W(st.monthly)}元 · 预计 ${ml} 个月后通车${st.late ? `<span class="neg">（因资金不足已顺延 ${st.late} 个月）</span>` : ''}</p>`; }
    else body = `<p class="detail-copy"><span class="tag green">已建成通车</span> ${C[e.a].name}—${C[e.b].name} ${e.dist} km，已并入本公司路网，可以开行列车。</p>`;
    return `<div class="card"><div class="row sb"><b>${sp.name}</b><span class="tag blue">${sp.kind}</span></div><p class="detail-copy">${sp.desc}</p>${body}</div>`; }
  function ovCard(o){ const S = G.S, x = (S.overseas || []).find(q => q.id === o.id), q = G.ovQuote(o.id);
    let body = '';
    if (!x) body = `<dl class="kv"><dt>规模</dt><dd>${o.km} km · ${o.v} km/h</dd><dt>总投资</dt><dd class="num">${W(q.cost)}元</dd><dt>工期</dt><dd>${Math.round(o.months/12)} 年</dd><dt>运营收益</dt><dd class="gain">约 <span class="measure">${W(q.yearly)}元/年</span>，共 <span class="measure">20&nbsp;年</span>（静态回收约 <span class="measure">${q.payback.toFixed(1)}&nbsp;年</span>）</dd><dt>现金节奏</dt><dd>约 3 个月开标；中标后 ${Math.round(o.months/12)} 年内每月投入约 ${W(q.cost / o.months)}元，通车后才有收益${q.endsAfter2020 ? '；通车将晚于 2020 年计分期，可继续自由经营收取' : ''}</dd><dt>投标费用</dt><dd><span class="measure">${W(q.fee)}元</span></dd><dt>中标把握</dt><dd>约 ${pct(q.winP)}</dd></dl>
      ${q.why.length ? `<div class="neg" style="font-size:12px;margin-top:4px">${q.why.join('；')}</div>` : ''}<div class="row" style="justify-content:flex-end;margin-top:6px"><button class="btn sm ${q.ok?'primary':''}" data-act="ovBid" data-id="${o.id}" ${q.ok?'':'disabled'}>参与投标</button></div>`;
    else if (x.st === 'bid') body = `<p class="detail-copy"><span class="tag">已投标</span> 约 ${Math.max(0, Math.ceil((x.at - S.day)/30))} 个月后公布结果</p>`;
    else if (x.st === 'lost') body = `<p class="detail-copy"><span class="tag red">落标</span> 业主国选择了其他方案</p>`;
    else if (x.st === 'build') { const r = x.paid / x.cost; body = `<div class="region"><span>已投资</span><div class="bar"><i style="width:${r*100}%"></i></div><span class="num r">${pct(r)}</span></div><p class="detail-copy">${W(x.paid)} / ${W(x.cost)}元 · 预计 ${Math.max(0, Math.ceil((x.done - S.day)/30))} 个月后通车</p>`; }
    else if (x.st === 'run') body = `<p class="detail-copy"><span class="tag green">运营中</span> 每年收益约 ${W(x.cost * o.ret)}元，运营权剩 ${Math.max(0, Math.ceil((x.until - S.day)/365))} 年</p>`;
    else body = `<p class="detail-copy dim">运营期已结束</p>`;
    return `<div class="card"><div class="row sb"><b>${o.name}</b><span class="tag">海外</span></div><p class="detail-copy">${o.desc}</p>${body}</div>`; }
  function pProjects(){ const S = G.S; G.ensureT6(); const y = G.ym(S.day).y;
    const open = S.franch.filter(f => f.st === 'bid'), held = S.franch.filter(f => f.st === 'held');
    const ovInc = S.history.slice(-12).reduce((a, h) => a + (h.overseas || 0), 0);
    let h = `<h2>重大项目</h2><div class="grid3"><div class="stat"><label>持有干线经营权</label><b>${held.filter(f => f.holder === 'P').length}</b></div><div class="stat"><label>超级工程</label><b>${Object.values(S.supers).filter(x => x.st === 'done').length} / ${G.SUPER.length}</b><small> 建成</small></div><div class="stat"><label>近 12 月海外收益</label><b class="${ovInc>0?'pos':''}">${W(ovInc)}</b></div></div>`;
    h += `<h3>干线经营权招标</h3>`;
    if (y < 1998 && !S.franch.length) h += `<div class="dim">1998 年起，铁路主管部门将陆续招标国铁干线的客运经营权：中标者在 ${G.FR_YEARS} 年内取得优先经营权（沿线客源 +25%、过轨费减半），其他公司仍可开行但客源被分流。</div>`;
    else if (!open.length && !held.length) h += `<div class="dim">目前没有招标中的干线。每年春季和秋季可能发布新的招标。</div>`;
    h += open.map(f => frCard(f)).join('') + held.map(f => frCard(f)).join('');
    h += `<h3>超级工程</h3><div class="hint">国家级重大工程向社会资本开放：投资巨大、工期漫长，但建成后线路归你所有，还能赢得商誉。工程款按月拨付，现金不足的月份会顺延工期。</div>` + G.SUPER.map(superCard).join('');
    h += `<h3>海外项目 · 出口高铁</h3><div class="hint">带着中国标准走出去：中标后按月投资建设，建成后获得 20 年运营收益。高速项目要求你有 300 km 以上自有高铁运营经验，或拥有自主研发的车型。</div>` + G.OVERSEAS.map(ovCard).join('');
    return h; }

  // —— 同业 ——
  function pRivals(){
    const S = G.S;
    const km = o => S.tracks.filter(t => t.owner===o && t.status==='ok').reduce((a,t) => a + E[t.e].dist, 0);
    const rows = [{ name:S.company, color:'#f2b544', km:km('P'), val:G.netWorth(), n:S.tracks.filter(t=>t.owner==='P').length, me:true }]
      .concat(S.rivals.filter(r => r.active).map(r => ({ name:RIVAL[r.id].name, color:RIVAL[r.id].color, km:km(r.id), val:r.value, n:S.tracks.filter(t=>t.owner===r.id).length, home:RIVAL[r.id].home })));
    rows.sort((a,b) => b.val - a.val);
    const stateKm = km('S');
    return `<h2>同业竞争</h2>
      <div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t"><tr><th>#</th><th>公司</th><th class="r">自有线路</th><th class="r">资产估值</th></tr>
      ${rows.map((r,i) => `<tr ${r.me?'style="background:rgba(242,181,68,.07)"':''}><td class="num">${i+1}</td><td><span class="swatch" style="background:${r.color}"></span><b class="clip-name" title="${esc(r.name)}">${esc(r.name)}</b>${r.home?` <span class="dim">总部 ${r.home}</span>`:''}</td><td class="num r">${r.km.toLocaleString()} km</td><td class="num r">${W(r.val)}</td></tr>`).join('')}
      </table></div>
      <div class="dim" style="font-size:11px;margin-top:4px">国家铁路营业里程（本图）：${stateKm.toLocaleString()} km</div>
      ${rivalCompHTML()}
      <h3>兼并收购</h3>
      ${S.rivals.filter(r => r.active).map(r => { const q = G.acquireQuote(r.id); return `<div class="card"><div class="row sb"><span><span class="swatch" style="background:${RIVAL[r.id].color}"></span><b>${RIVAL[r.id].name}</b></span><span class="num">报价 ${W(q.price)}</span></div>
        <p class="detail-copy">线路 ${q.km.toLocaleString()} km · ${q.cash >= 0 ? `对方现金 ${W(q.cash)}（并入本公司）` : `承接对方负债 ${W(-q.cash)}`}· 实际支出 ${W(q.net)}</p>
        ${q.ok ? '' : `<div class="neg" style="font-size:12px">${q.why.join('；')}</div>`}
        <div class="row" style="justify-content:flex-end"><button class="btn sm ${q.ok?'primary':''}" data-act="acquire" data-id="${r.id}" ${q.ok?'':'disabled'}>${ui.confirm==='a'+r.id ? '确认收购' : '发起收购'}</button></div></div>`; }).join('') || '<div class="dim">没有可收购的同业公司。</div>'}
      ${S.rivals.filter(r => r.acquired).map(r => `<div class="dim" style="font-size:12px">· ${RIVAL[r.id].name} 已于 ${r.acquired} 年并入本公司</div>`).join('')}
      <div class="dim" style="font-size:11px;margin-top:4px">1995 年起可收购规模小于本公司净资产 60% 的同业。收购价为对方资产估值的 1.3 倍，另加每公里线路的网络溢价；对方线路并入后，你的列车免付过轨费。</div>
      <h3>同业线路</h3>
      ${S.rivals.filter(r => r.active).map(r => { const ts = S.tracks.filter(t => t.owner===r.id);
        return foldCard('rival', r.id,
          `<span class="fold-heading"><span class="swatch" style="background:${RIVAL[r.id].color}"></span><b class="clip-name">${RIVAL[r.id].name}</b><span class="tag">${ts.length} 段</span></span>`,
          () => ts.length ? `<div style="font-size:12px;line-height:1.9">${ts.map(t => `<span class="tag" style="margin:0 4px 4px 0">${C[E[t.e].a].name}—${C[E[t.e].b].name} · ${t.v}${t.status==='build'?' 在建':''}</span>`).join('')}</div>` : '<div class="dim">尚未修建线路</div>'); }).join('')}
      <div class="hint">同业公司会在其网络周边修建新线。当它们的网络与你的自有线路相连时，会有同业列车过轨并向你付费；你的列车使用同业线路时，费率为国铁基准的 115%。</div>`;
  }

  // ---------------- 操作分发 ----------------
  function act(e){
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act; const S = G.S;
    if (e.type === 'click' && (b.tagName === 'SELECT' || (b.tagName === 'INPUT' && b.type !== 'checkbox' && b.type !== 'radio'))) return;
    if (e.type === 'click' && b.tagName === 'INPUT' && (b.type==='checkbox'||b.type==='radio')) {
      if (a === 'bCls'){ ui.bCls = +b.value; renderPanel(true); }
      if (a === 'bElec'){ ui.bElec = b.checked; renderPanel(true); }
      return;
    }
    switch (a){
      case 'toggleDetail': {
        const { group, id } = b.dataset;
        ui.openDetails[group] = ui.openDetails[group] === id ? null : id;
        renderPanel(true);
        document.getElementById(b.id)?.scrollIntoView({ block:'nearest' });
        break;
      }
      case 'fleetFilter': {
        ui.idleOnly = b.dataset.v === 'idle';
        const focused = document.activeElement === b;
        renderPanel(true);
        if (focused) $('#panelBody .fleet-filters [aria-pressed=true]')?.focus({ preventScroll:true });
        break;
      }
      case 'withdrawTrain': {
        const train = S.trains.find(t => t.id === +b.dataset.id);
        if (!train || !canWithdrawTrain(train)) break;
        const focused = document.activeElement === b;
        const foldId = ui.tab === 'routes' ? train.route : train.id;
        G.assignTrain(train.id, null);
        renderPanel(true);
        if (focused) document.getElementById(`fold-${ui.tab}-${foldId}`)?.focus({ preventScroll:true });
        toast('已下线备用', `${train.name} 可在车队的「闲置」列表重新上线。`, 'good');
        break;
      }
      case 'routeFrom': startRoute(+b.dataset.c); break;
      case 'repY': ui.repY = +b.dataset.y; renderPanel(true); break;
      case 'od': { const id = +b.dataset.id; ui.odRoute = ui.odRoute === id ? null : id; renderPanel(true); break; }
      case 'station': { const r = G.buildStation(+b.dataset.c, +b.dataset.lv); if (!r.ok) toast('无法开站', r.msg, 'bad'); else toast('车站开工', `${C[+b.dataset.c].name}站开始施工。`, 'good'); renderInspector(); renderPanel(true); break; }
      case 'skip': { G.toggleSkip(+b.dataset.id, +b.dataset.c); renderPanel(true); break; }
      case 'buildGrp': { if (b.dataset.loan) G.borrow(+b.dataset.loan); const r = G.buildGroup(+b.dataset.g, +b.dataset.c, !!ui.bElec); if (!r.ok) toast('无法开工', r.msg, 'bad'); else toast('整段开工', '缺少所选用途线路的区段同时开工。', 'good'), snd('build'); renderPanel(true); renderInspector(); break; }
      case 'newRoute': startRoute(); break;
      case 'selEdge': selectEdge(+b.dataset.e); break;
      case 'build': { if (b.dataset.loan) G.borrow(+b.dataset.loan); const r = G.buildTrack(+b.dataset.e, +b.dataset.c, !!ui.bElec); if (!r.ok) toast('无法开工', r.msg, 'bad'); else toast('开工建设', '工程已启动，可在建设页查看工期。', 'good'), snd('build'); renderPanel(true); renderInspector(); break; }
      case 'upgrade': { const r = G.upgradeTrack(+b.dataset.tr, +b.dataset.c, true); if (!r.ok) toast('无法改造', r.msg, 'bad'); renderPanel(true); break; }
      case 'selRoute': { const id = +b.dataset.id; ui.selRoute = ui.selRoute === id ? null : id; renderPanel(true); break; }
      case 'delRoute': { const id = +b.dataset.id; if (ui.confirm === 'r'+id){ G.deleteRoute(id); ui.confirm = null; if (ui.selRoute===id) ui.selRoute = null; } else { ui.confirm = 'r'+id; setTimeout(() => { if (ui.confirm==='r'+id){ ui.confirm = null; renderPanel(true); } }, 3000); } renderPanel(true); break; }
      case 'buyFor': ui.buyRoute = +b.dataset.id; ui.tab = 'market'; renderTabs(); renderPanel(true); $('#panelBody').scrollTop = 0; break;
      case 'consist': { const t = S.trains.find(x => x.id === +b.dataset.id); ui.cdraft = { tid:t.id, n:{} }; (t.cars||[]).forEach(x => ui.cdraft.n[x.id] = x.n); consistModal(); break; }
      case 'acceptUsed': { const r = G.acceptUsed(+b.dataset.id); if (!r.ok) toast('无法成交', r.msg, 'bad'); else { toast('转让成交', `收到 ${W(r.price)}元。`, 'good'); snd('coin'); } renderPanel(true); renderTop(); break; }
      case 'declineUsed': G.declineUsed(+b.dataset.id); renderPanel(true); break;
      case 'buyUsed': { const sel = $('#bu_' + b.dataset.id); const rid = sel && sel.value ? +sel.value : null; const r = G.buyUsed(+b.dataset.id, rid); if (!r.ok) toast('无法购买', r.msg, 'bad'); else { snd('tick'); toast('购入二手车', `${r.train.name} 约 15 天后交付。`, 'good'); } renderPanel(true); renderTop(); break; }
      case 'mfFind': { const m = G.trainById[b.dataset.v]; if (!m) break; Object.assign(ui.mf, { cat:'loco', use:'all', type:'all', origin:'all', show: G.available(m) ? 'sale' : (m.year > G.ym(S.day).y ? 'soon' : 'all') }); renderPanel(true);
        const el = document.getElementById('tc_' + m.id); if (el) { el.scrollIntoView({ block:'center', behavior:'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); } break; }
      case 'dzNew': { ui.dz = { pid:b.dataset.v, sp:0, cap:0, eco:0, name:'' }; designModal(); break; }
      case 'dzCancel': { const k = b.dataset.v; if (ui.confirm === 'dz'+k){ ui.confirm = null; const r = G.cancelDesign(k); if (!r.ok) toast('无法撤销', r.msg, 'bad'); } else { b.textContent = '确认撤销'; ui.confirm = 'dz'+k; setTimeout(() => { if (ui.confirm==='dz'+k){ ui.confirm = null; renderPanel(true); } }, 3000); break; } renderPanel(true); break; }
      case 'sell': { const id = +b.dataset.id; if (ui.confirm === 't'+id){ G.sellTrain(id); ui.confirm = null; } else { ui.confirm = 't'+id; setTimeout(() => { if (ui.confirm==='t'+id){ ui.confirm = null; renderPanel(true); } }, 3000); } renderPanel(true); break; }
      case 'mf': ui.mf[b.dataset.k] = b.dataset.v; renderPanel(true); break;
      case 'buy': { const sel = $('#br_' + b.dataset.m); const rid = sel && sel.value ? +sel.value : null; const r = G.buyTrain(b.dataset.m, rid); if (!r.ok) toast('无法购买', r.msg, 'bad'); else snd('tick'), toast('订购成功', `${G.trainById[b.dataset.m].name} 将于 ${G.trainById[b.dataset.m].imported?'约 75':'约 30'} 天后交付${rid?'，届时自动投入运营':''}。`, 'good'); renderPanel(true); break; }
      case 'acceptC': { const r = G.acceptContract(+b.dataset.id); if (!r.ok) toast('无法签约', r.msg, 'bad'); else snd('coin'), toast('签约成功', '合同货量已计入该站对的货源。', 'good'); renderPanel(true); break; }
      case 'declineC': { G.declineContract(+b.dataset.id); renderPanel(true); break; }
      case 'overhaul': { const r = G.overhaul(+b.dataset.id); if (!r.ok) toast('无法大修', r.msg, 'bad'); else toast('进厂大修', `费用 ${W(r.cost)}元，30 天后出厂。`, 'good'); renderPanel(true); renderTop(); break; }
      case 'bond': { const r = G.issueBond(+b.dataset.v); if (!r.ok) toast('无法发债', r.msg, 'bad'); else toast('发债成功', `利率 ${(r.b.rate*100).toFixed(2)}%，募集 ${W(r.b.amt)}元。`, 'good'); renderPanel(true); renderTop(); break; }
      case 'ipo': { const r = G.doIPO(); if (!r.ok) toast('无法上市', r.msg, 'bad'); renderPanel(true); renderTop(); showPolicyQueue(); break; }
      case 'payout': { G.setPayout(+b.dataset.v); renderPanel(true); break; }
      case 'secondary': { const r = G.secondary(); if (!r.ok) toast('无法增发', r.msg, 'bad'); else toast('增发完成', '募集资金已到账。', 'good'); renderPanel(true); renderTop(); break; }
      case 'buyback': { const r = G.buyback(); if (!r.ok) toast('无法回购', r.msg, 'bad'); else toast('回购完成', `耗资 ${W(r.cost)}元。`, 'good'); renderPanel(true); renderTop(); break; }
      case 'acquire': { const id = b.dataset.id; if (ui.confirm === 'a'+id){ const r = G.acquireRival(id); ui.confirm = null; if (!r.ok) toast('无法收购', r.msg, 'bad'); renderTop(); showPolicyQueue(); } else { ui.confirm = 'a'+id; setTimeout(() => { if (ui.confirm==='a'+id){ ui.confirm = null; renderPanel(true); } }, 3000); } renderPanel(true); break; }
      case 'hire': { const r = G.hireExec(+b.dataset.id); if (!r.ok) toast('无法聘请', r.msg, 'bad'); else toast('聘任成功', '新高管已到任。', 'good'); renderPanel(true); renderTop(); break; }
      case 'fire': { G.fireExec(b.dataset.v); renderPanel(true); renderTop(); break; }
      case 'trainLv': { G.setTraining(+b.dataset.v); renderPanel(true); break; }
      case 'rdLv': { G.setRD(+b.dataset.v); renderPanel(true); break; }
      case 'rdStart': { const r = G.startProject(b.dataset.v); if (!r.ok) toast('无法立项', r.msg, 'bad'); renderPanel(true); break; }
      case 'shop': { const r = G.buildShop(+b.dataset.c, +b.dataset.v); if (!r.ok) toast('无法开设', r.msg, 'bad'); else toast('车站商业开业', C[+b.dataset.c].name + '站商铺开始营业。', 'good'); renderPanel(true); renderTop(); break; }
      case 'land': { const r = G.buyLand(+b.dataset.c); if (!r.ok) toast('无法买地', r.msg, 'bad'); else toast('购入土地', `${C[+b.dataset.c].name} · ${W(r.cost)}元`, 'good'); renderPanel(true); renderInspector(); renderTop(); break; }
      case 'sellLand': { const r = G.sellLand(+b.dataset.c); if (!r.ok) toast('无法卖地', r.msg, 'bad'); else toast('出售土地', (r.gain > 0 ? '增值 ' : r.gain < 0 ? '亏损 ' : '持平 ') + W(Math.abs(r.gain)) + '元', financialClass(r.gain)); renderPanel(true); renderInspector(); renderTop(); break; }
      case 'acceptL': { const r = G.acceptLocal(+b.dataset.id); if (!r.ok) toast('无法同意', r.msg, 'bad'); else toast('达成合作', '协议已生效。', 'good'); renderPanel(true); break; }
      case 'frBid': { const r = G.frBid(+b.dataset.id, +b.dataset.v); if (!r.ok) toast('无法投标', r.msg, 'bad'); renderPanel(true); break; }
      case 'super': { const id = b.dataset.id; if (ui.confirm === 'sp'+id){ ui.confirm = null; const r = G.startSuper(id); if (!r.ok) toast('无法立项', r.msg, 'bad'); else { toast('超级工程开工', G.SUPER.find(x => x.id === id).name + '正式开工。', 'good'); snd('build'); } } else { ui.confirm = 'sp'+id; setTimeout(() => { if (ui.confirm==='sp'+id){ ui.confirm = null; renderPanel(true); } }, 3000); } renderPanel(true); renderTop(); break; }
      case 'ovBid': { const r = G.ovBid(b.dataset.id); if (!r.ok) toast('无法投标', r.msg, 'bad'); else toast('已投标', '约三个月后公布结果。', 'good'); renderPanel(true); renderTop(); break; }
      case 'govAcc': { G.govAccept(+b.dataset.id); toast('接受任务', '可在「合同」页查看进度。', 'good'); renderPanel(true); break; }
      case 'govDec': { G.govDecline(+b.dataset.id); renderPanel(true); break; }
      case 'warResp': { G.warRespond(b.dataset.id, b.dataset.v); renderPanel(true); break; }
      case 'dilute': { const r = G.defendDilute(); if (!r.ok) toast('无法增发', r.msg, 'bad'); else toast('定向增发完成', '同业持股比例已被摊薄。', 'good'); renderPanel(true); break; }
      case 'greenmail': { const r = G.defendGreenmail(b.dataset.id); if (!r.ok) toast('无法回购', r.msg, 'bad'); else toast('回购完成', '对方持股已全部注销。', 'good'); renderPanel(true); break; }
      case 'declineL': { G.declineLocal(+b.dataset.id); renderPanel(true); break; }
      case 'svc': { G.setService(+b.dataset.id, +b.dataset.v); renderPanel(true); break; }
      case 'grade': { G.setGrade(+b.dataset.id, b.dataset.v); renderPanel(true); break; }
      case 'depot': { const r = G.buildDepot(+b.dataset.c, +b.dataset.v); if (!r.ok) toast('无法开工', r.msg, 'bad'); else { toast('机务段开工', `${C[+b.dataset.c].name}${G.DEPOT_LV[+b.dataset.v].name}开工。`, 'good'); snd('build'); } renderPanel(true); renderInspector(); renderTop(); break; }
      case 'signal': { const r = G.upgradeSignal(+b.dataset.tr, +b.dataset.v); if (!r.ok) toast('无法改造', r.msg, 'bad'); else toast('信号改造开工', '完工后通过能力提升。', 'good'); renderPanel(true); renderTop(); break; }
      case 'borrow': { if (!G.borrow(+b.dataset.v)) toast('无法借款', '授信额度不足。', 'bad'); renderPanel(true); break; }
      case 'repay': { if (!G.repay(+b.dataset.v)) toast('无法还款', '没有负债或现金不足。', 'bad'); renderPanel(true); break; }
    }
    renderTop();
  }
  $('#panelBody').addEventListener('click', act);
  $('#panelBody').addEventListener('change', e => {
    const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act; const S = G.S;
    if (a === 'assign'){
      const train = S.trains.find(t => t.id === +b.dataset.id);
      if (!train) return;
      const route = b.value ? S.routes.find(r => r.id === +b.value) : null;
      if (b.value && !route) return;
      const wasIdle = isIdleTrain(train);
      G.assignTrain(train.id, route?.id ?? null);
      b.blur(); renderPanel(true);
      if (wasIdle && route){
        const plan = G.econ[train.id]?.plan;
        if (plan?.ok) toast('已上线', `${train.name} 已分配至 ${route.name}。`, 'good');
        else toast('已分配线路', `${train.name} 暂未开行${plan?.why ? '：' + plan.why : '。'}`, 'warn');
      }
    }
    if (a === 'routePref'){ const r = S.routes.find(r => r.id === +b.dataset.id); r.pref = b.value; G.recompute(); b.blur(); renderPanel(true); }
    if (a === 'slow'){ G.setSlow(+b.dataset.id, b.checked); renderPanel(true); }
    if (a === 'feeMul'){ S.feeMul = +b.value/100; b.blur(); renderPanel(true); }
  });

  // ---------------- 提示与弹窗 ----------------
  const snd = (n, k) => { if (window.Sfx) Sfx.play(n, k); };
  function toast(title, text, kind, symbol){ const el = document.createElement('div'); el.className = 'toast ' + (kind||''); el.innerHTML = `<b>${symbol ? icon(symbol) + ' ' : ''}${esc(title)}</b><span>${esc(text)}</span>`; $('#toast').prepend(el); setTimeout(() => el.remove(), 4200); while ($('#toast').children.length > 4) $('#toast').lastChild.remove(); }
  function modal(html, wide){ $('#modalBox').className = 'box' + (wide ? ' wide' : ''); $('#modalBox').innerHTML = html; $('#modal').classList.add('show'); ui.modalOpen = true; }
  function closeModal(){ $('#modal').classList.remove('show'); ui.modalOpen = false; }
  $('#modal').addEventListener('click', e => {
    const dz = e.target.closest('[data-dz]');
    if (dz && !dz.disabled && ui.dz){ const k = dz.dataset.dz; const nm = $('#dzName'); if (nm) ui.dz.name = nm.value;
      if (k === 'ok'){ const r = G.createDesign(ui.dz.pid, { sp:ui.dz.sp, cap:ui.dz.cap, eco:ui.dz.eco }, ui.dz.name); if (!r.ok) { toast('无法立项', r.msg, 'bad'); return; }
        closeModal(); ui.dz = null; toast('设计立项', `「${r.model.name}」已加入科研项目。`, 'good'); renderPanel(true); return; }
      ui.dz[k] = +dz.dataset.v; designModal(); return; }
    const cb = e.target.closest('[data-cm]');
    if (cb && !cb.disabled){ const k = cb.dataset.cm, d = ui.cdraft, id = cb.dataset.id;
      if (k === 'inc') d.n[id] = (d.n[id]||0) + 1; if (k === 'inc5') d.n[id] = (d.n[id]||0) + 5; if (k === 'dec') d.n[id] = Math.max(0, (d.n[id]||0) - 1);
      if (k === 'ok'){ const r = G.setConsist(d.tid, Object.entries(d.n).map(([id,n]) => ({ id, n }))); if (!r.ok) { toast('无法编组', r.msg, 'bad'); return; } closeModal(); toast('编组完成', r.net >= 0 ? `支出 ${W(r.net)}元` : `回收 ${W(-r.net)}元`, 'good'); renderPanel(true); renderTop(); return; }
      consistModal(); return; }
    const b = e.target.closest('[data-m]'); if (!b) return; const k = b.dataset.m;
    if (k === 'close'){ closeModal(); }
    if (k === 'new'){ const name = ($('#coInput') && $('#coInput').value.trim()) || '华夏铁道实业'; const tut = $('#tutChk') ? $('#tutChk').checked : false; G.newGame(name); afterLoad(); closeModal(); setSpeed(0); showPolicyQueue(); if (window.Tutorial) { if (tut) Tutorial.start(); else Tutorial.stop(false); } }
    if (k === 'tut'){ closeModal(); setSpeed(0); if (window.Tutorial) Tutorial.start(); }
    if (k === 'continue'){ if (G.load('auto')) { afterLoad(); closeModal(); setSpeed(0); } else toast('无法继续', G.lastLoadErr || '自动存档无法读取', 'bad'); }
    if (k === 'load') saveModal(true);
    if (k === 'sv'){ const sl = b.dataset.slot; if (G.hasSave(sl) && ui.confirm !== 'sv'+sl){ ui.confirm = 'sv'+sl; saveModal(false); return; } ui.confirm = null;
      try { G.save(sl); toast('已存档', SLOTNAME(sl) + ' 保存成功。', 'good'); } catch(err) { toast('存档失败', '浏览器存储空间不足，可以删除旧存档或导出到文件。', 'bad'); } saveModal(false); }
    if (k === 'ld'){ const sl = b.dataset.slot; if (G.load(sl)) { afterLoad(); closeModal(); setSpeed(0); toast('读档成功', '已读取' + SLOTNAME(sl) + '。', 'good'); showPolicyQueue(); } else toast('无法读取', G.lastLoadErr || '存档已损坏。', 'bad'); }
    if (k === 'delsv'){ const sl = b.dataset.slot; if (ui.confirm === 'del'+sl){ G.deleteSave(sl); ui.confirm = null; } else ui.confirm = 'del'+sl; saveModal(ui.saveFromStart); }
    if (k === 'exp') exportFile();
    if (k === 'imp') $('#impFile').click();
    if (k === 'resume'){ closeModal(); setSpeed(ui.lastSpeed || 1); showPolicyQueue(); }
    if (k === 'tostart') startScreen();
    const go = () => { closeModal(); setSpeed(ui.lastSpeed || 1); renderPanel(true); renderTop(); showPolicyQueue(); };
    if (k === 'frBid'){ const r = G.frBid(+b.dataset.id, +b.dataset.v); if (!r.ok) { toast('无法投标', r.msg, 'bad'); return; } toast(+b.dataset.v ? '已报价' : '已撤回', '可在「项目」页随时调整。', 'good'); go(); }
    if (k === 'toMarket' || k === 'toFleet'){ ui.tab = k === 'toMarket' ? 'market' : 'fleet'; if (k === 'toMarket') { ui.mf.cat = 'loco'; ui.mf.show = 'sale'; } renderTabs(); closeModal(); setSpeed(0); renderPanel(true); showPolicyQueue(); }
    if (k === 'toProj'){ ui.tab = 'projects'; renderTabs(); closeModal(); setSpeed(0); renderPanel(true); showPolicyQueue(); }
    if (k === 'govAcc'){ G.govAccept(+b.dataset.id); toast('接受任务', '可在「合同」页查看进度。', 'good'); go(); }
    if (k === 'govDec'){ G.govDecline(+b.dataset.id); go(); }
    if (k === 'war'){ G.warRespond(b.dataset.id, b.dataset.v); go(); }
    if (k === 'intel'){ closeModal(); setSpeed(0); selectEdge(+b.dataset.e); showPolicyQueue(); }
    if (k === 'dilute'){ const r = G.defendDilute(); if (!r.ok) { toast('无法增发', r.msg, 'bad'); return; } toast('定向增发完成', '同业持股比例已被摊薄。', 'good'); go(); }
    if (k === 'greenmail'){ const r = G.defendGreenmail(b.dataset.id); if (!r.ok) { toast('无法回购', r.msg, 'bad'); return; } toast('回购完成', '对方持股已全部注销。', 'good'); go(); }
    if (k === 'toRivals'){ ui.tab = 'rivals'; renderTabs(); closeModal(); setSpeed(0); renderPanel(true); showPolicyQueue(); }
    if (k === 'scn'){ const name = ($('#coInput') && $('#coInput').value.trim()) || '华夏铁道实业'; $('#modalBox').innerHTML = '<h1>正在推演历史……</h1><p class="muted">时间快进到剧本开始的年份，请稍候。</p>';
      setTimeout(() => { G.startScenario(b.dataset.id, name); afterLoad(); closeModal(); setSpeed(0); showPolicyQueue(); if (window.Tutorial) Tutorial.stop(false); }, 30); }
    if (k === 'board') boardModal();
    if (k === 'back') startScreen();
  });
  let popupQueue = [];
  function showPolicyQueue(){
    if (ui.modalOpen || !popupQueue.length) return;
    const p = popupQueue.shift();
    snd(({ franch:'chime', franchWin:'coin', superDone:'horn', ovWin:'coin', ovDone:'horn', policy:'chime', event:'alert', report:'chime', war:'alert', raid:'alert', taken:'alert', over:'alert', intel:'chime', gov:'chime', accident:'alert', ipo:'coin', acq:'coin', ach:'coin', rd:'coin', scnWin:'coin', govEnd:'tick', newModels:'horn' })[p.type] || 'tick');
    if (p.type === 'policy'){
      setSpeed(0);
      modal(`<div class="stamp">${p.p.y}年${p.p.m}月 · ${p.p.tag}</div><h1>${p.p.title}</h1><p>${p.p.text}</p><ul>${p.p.effects.map(x => `<li>${x}</li>`).join('')}</ul><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">知道了，继续经营</button></div>`);
    } else if (p.type === 'report'){ setSpeed(0); modal(reportHTML(p.rep) + `<div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" data-m="resume">继续经营</button></div>`, true); }
    else if (p.type === 'event'){ setSpeed(0); modal(`<div class="stamp">${p.ev.from[0]}年${p.ev.from[1]}月 · 时事</div><h1>${p.ev.title}</h1><p>${p.ev.text}</p><p class="dim">受影响区段的列车将暂停运行，请考虑临时绕行。预计 ${p.ev.to[0]}年${p.ev.to[1]}月 后恢复。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">知道了</button></div>`); }
    else if (p.type === 'scnStart'){ setSpeed(0); modal(`<div class="stamp">剧本 · ${p.sc.year}</div><h1>${p.sc.title}</h1><p>${measureText(p.sc.brief)}</p><p><b>目标：</b>${measureText(p.sc.goal)}<br><b>期限：</b>${p.sc.until} 年底<br><b>启动资金：</b>${W(p.sc.cash)}元</p><p class="dim">进度显示在「总览」页顶部。提前完成可以拿到更高的分数。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">开始</button></div>`); }
    else if (p.type === 'scnWin'){ setSpeed(0); modal(`<div class="stamp">剧本完成</div><h1>${p.sc.title} · 目标达成</h1><p>得分 <b class="gold" style="font-size:22px">${p.score}</b>，已记入排行榜。你可以继续经营，也可以挑战其他剧本。</p><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-m="board">查看排行榜</button><button class="btn primary" data-m="resume">继续经营</button></div>`); }
    else if (p.type === 'scnLose'){ setSpeed(0); modal(`<div class="stamp">剧本期限已到</div><h1>${p.sc.title}</h1><p>期限内完成了 ${Math.round(p.p*100)}% 的目标，没有上榜。你可以继续自由经营，或者回到开始界面再试一次。</p><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-m="tostart">重新开始</button><button class="btn primary" data-m="resume">继续经营</button></div>`); }
    else if (p.type === 'rd'){ setSpeed(0); modal(`<div class="stamp">科研成果</div><h1>${esc(p.name)} 完成</h1><p>${p.kind === 'loc' ? `${esc(p.model)} 已实现国产化：今后采购免关税、不占进口额度，价格降低 20%。` : `本公司自主研发的「${esc(p.model)}」研制成功，现在可以在「购车」页采购。`}</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">太好了</button></div>`); }
    else if (p.type === 'accident'){ setSpeed(0); modal(`<div class="stamp">事故通报</div><h1>${esc(p.name)} 发生行车事故</h1><p>事故发生在 ${esc(p.route)}，所幸无人员伤亡。直接损失 <b>${W(p.cost)}元</b>，该车停运 45 天，线路满意度和公司商誉都受到影响。</p><p class="dim">信号落后（半自动闭塞）、车辆长期不大修、线路超负荷运行都会增加事故风险。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">知道了</button></div>`); }
    else if (p.type === 'ipo'){ setSpeed(0); modal(`<div class="stamp">敲钟上市</div><h1>${esc(G.S.company)} 挂牌上市</h1><p>发行价 <b>${p.price.toFixed(2)}</b> 元，募集资金 <b>${W(p.raise)}元</b>。从今天起，股价会随公司业绩、商誉和大盘情绪波动，每年年报时按所选分红率派发红利。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">继续经营</button></div>`); }
    else if (p.type === 'acq'){ setSpeed(0); modal(`<div class="stamp">兼并重组</div><h1>收购 ${esc(p.name)}</h1><p>以 <b>${W(p.price)}元</b> 完成收购，接收自有线路 <b>${p.km.toLocaleString()} km</b>。原同业线路即日起归本公司所有，可升级改造并向国铁过轨列车收费。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">继续经营</button></div>`); }
    else if (p.type === 'ach'){ toast('成就达成：' + p.a.name, p.a.desc, 'good', 'medal'); showPolicyQueue(); }
    else if (p.type === 'war'){ setSpeed(0); modal(`<div class="stamp">商战 · 价格战</div><h1>${esc(p.name)} 发起价格战</h1><p>${esc(p.name)} 在其线路沿线大幅降价，与你争夺 ${p.cities.slice(0,6).map(esc).join('、')}${p.cities.length>6?' 等':''} 之间的旅客，预计持续 8 个月。</p>
      <dl class="kv"><dt>保持票价</dt><dd>重叠城市间约 <b class="neg">28%</b> 的客源被抢走，收入不受降价影响</dd><dt>跟进降价</dt><dd>重叠城市之间的站对票价 <b>−15%</b>，客源基本保住；对方亏损加快，可能提前退出，你还能赢得商誉</dd></dl>
      <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn" data-m="war" data-id="${p.rid}" data-v="hold">保持票价</button><button class="btn primary" data-m="war" data-id="${p.rid}" data-v="match">跟进降价</button></div>`); }
    else if (p.type === 'intel'){ const e = G.edges[p.e]; setSpeed(0); modal(`<div class="stamp">商业情报</div><h1>${esc(p.name)} 准备修建 ${C[e.a].name}—${C[e.b].name}</h1><p>据可靠消息，${esc(p.name)} 已完成 ${C[e.a].name}—${C[e.b].name}（${e.dist} km，${G.TRACK_CLASSES[p.cls].name}）的勘测，约三个月后开工。这条走廊与你的运营线路有关。</p><p class="dim">在对方开工前抢先动工，这条走廊就归你；对方建成后，你的列车经过此段需要付过轨费。</p>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-m="resume">静观其变</button><button class="btn primary" data-m="intel" data-e="${p.e}">查看走廊，考虑抢建</button></div>`); }
    else if (p.type === 'raid'){ const S = G.S, ctl = G.controlPct(), pc = G.raidPct(p.rid), dq = G.diluteQuote(), gq = G.greenmailQuote(p.rid); setSpeed(0); modal(`<div class="stamp">举牌警报</div><h1>${esc(p.name)} 持股达 ${(pc*100).toFixed(1)}%</h1><p>${esc(p.name)} 在二级市场持续买入本公司股票。一旦其持股超过你方控制的 <b>${(ctl*100).toFixed(1)}%</b>，公司控制权将易手，本局结束。</p>
      <dl class="kv"><dt>定向增发 12%</dt><dd>${dq && dq.wait <= 0 ? `募集约 ${W(dq.raise)}元，新股由友好投资者持有并参与分红；股价 −6%，商誉 −1` : `两年内只能增发一次（还需 ${dq ? Math.ceil(dq.wait/30) : '—'} 个月）`}</dd><dt>溢价回购</dt><dd>${gq ? `以 ${W(gq.cost)}元买回对方全部持股并注销；商誉 −2${S.cash < gq.cost ? '（现金不足）' : ''}` : '—'}</dd><dt>其他办法</dt><dd>提高分红、做好业绩推高股价，股价高于内在价值 20% 时对方会停止买入；也可以直接收购对方</dd></dl>
      <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn" data-m="resume">暂不处理</button><button class="btn" data-m="toRivals">去同业页</button><button class="btn" data-m="greenmail" data-id="${p.rid}" ${gq && S.cash >= gq.cost ? '' : 'disabled'}>溢价回购</button><button class="btn primary" data-m="dilute" ${dq && dq.wait <= 0 ? '' : 'disabled'}>定向增发</button></div>`); }
    else if (p.type === 'taken'){ setSpeed(0); modal(`<h1>控制权易手</h1><p>${esc(p.name)} 的持股已超过你方，召开临时股东大会改组了董事会。${esc(G.S.company)} 并入 ${esc(p.name)}，你的经营到此结束。</p><p class="dim">上市后要留意同业举牌：保持股价不被低估、适时定向增发或溢价回购，都能守住控制权。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="tostart">重新开始</button></div>`); }
    else if (p.type === 'gov'){ const g = (G.S.gov||[]).find(x => x.id === p.id); if (!g || g.st !== 'offer') { showPolicyQueue(); return; } setSpeed(0); modal(`<div class="stamp">政府任务 · ${G.GOV[g.k].name}</div>${govCard(g, true)}`); }
    else if (p.type === 'govEnd'){ const g = (G.S.gov||[]).find(x => x.id === p.id); if (g) toast(g.st === 'done' ? '任务完成：' + g.title : g.st === 'part' ? '任务基本完成：' + g.title : '任务未完成：' + g.title, g.st === 'done' ? `奖励 ${W(g.cash)}元，商誉 +${G.GOV[g.k].rep}` : g.st === 'part' ? `完成 ${Math.round(g.prog/g.target*100)}%，部分奖励 ${W(g.paid||0)}元` : `完成 ${Math.round(g.prog/g.target*100)}%，商誉 −${G.GOV[g.k].fail}`, g.st === 'fail' ? 'bad' : 'good'); showPolicyQueue(); }
    else if (p.type === 'franch'){ const f = (G.S.franch||[]).find(x => x.uid === p.uid); if (!f || f.st !== 'bid') { showPolicyQueue(); return; } setSpeed(0); modal(`<div class="stamp">招标公告 · 干线经营权</div>${frCard(f, true)}<div class="row" style="justify-content:flex-end;margin-top:6px"><button class="btn" data-m="resume">暂不投标</button></div>`); }
    else if (p.type === 'franchWin'){ const f = (G.S.franch||[]).find(x => x.uid === p.uid); setSpeed(0); modal(`<div class="stamp">中标通知</div><h1>${f ? esc(f.name) : '干线经营权'} 中标</h1><p>${f ? `本公司以每年 <b>${W(f.fee)}元</b> 中标，${G.FR_YEARS} 年内独家经营 ${C[f.a].name}—${C[f.b].name} 干线客运。沿线城市之间的客源份额提高 25%，本公司旅客列车在该干线上的国铁过轨费减半。<br><br>履约要求：每月在干线上开行不少于 <b>${f.minTrips}</b> 趟旅客列车（中标后有 6 个月准备期），连续 3 次不达标将被收回经营权。` : ''}</p><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-m="toProj">查看项目</button><button class="btn primary" data-m="resume">继续经营</button></div>`); }
    else if (p.type === 'franchLose'){ toast('未能中标', `${p.name} 拿下了干线经营权。`, 'bad'); showPolicyQueue(); }
    else if (p.type === 'newModels'){ setSpeed(0); const T = G.trainById, mini = id => { const m = T[id]; return `<div class="nm"><span class="thumb">${art(id, 's')}</span><div><b>${m.name}</b> <span class="dim">${m.country} · ${useName[m.use]}</span><br><span class="dim" style="font-size:11px">${m.vmax} km/h · ${m.use==='pax' ? m.cap + ' 人' : m.cap.toLocaleString() + ' t'} · ${W(G.trainPrice(m).total)}</span></div></div>`; };
      modal(`<div class="stamp">${p.y} 年 · 车辆市场</div><h1>${p.nw.length ? '新车上市' : '车型换代'}</h1>${p.nw.length ? `<p>今年有 ${p.nw.length} 款新车型开始接受订购。</p><div class="nmgrid">${p.nw.map(mini).join('')}</div>` : ''}
        ${p.ended.length ? `<p style="margin-top:10px"><b>停止生产：</b>${p.ended.map(id => { const s = G.successorOf(T[id]); return T[id].name + (s ? `（可换 ${s.name}）` : ''); }).join('、')}。已有车辆照常运营，但在干线上票价略降、维修费略涨，转卖价格也会走低。</p>` : ''}
        ${p.obs.length ? `<p><b>列为淘汰车型：</b>${p.obs.map(id => T[id].name).join('、')}。在干线上旅客不愿乘坐、配件也难找，建议调到支线运营或出售。</p>` : ''}
        <div class="row" style="justify-content:flex-end;gap:8px;margin-top:8px">${p.ended.length || p.obs.length ? '<button class="btn" data-m="toFleet">查看车队</button>' : ''}${p.nw.length ? '<button class="btn" data-m="toMarket">去购车</button>' : ''}<button class="btn primary" data-m="resume">继续经营</button></div>`); }
    else if (p.type === 'superDone'){ const sp = G.SUPER.find(x => x.id === p.id); const e = E[sp.e]; setSpeed(0); modal(`<div class="stamp">超级工程 · 全线贯通</div><h1>${sp.name} 建成通车</h1><p>历时多年，${sp.name}全线贯通。${C[e.a].name}—${C[e.b].name}（${e.dist} km，${sp.v} km/h）正式并入本公司路网，现在可以规划经过这里的运营线路。公司商誉 +8。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">继续经营</button></div>`); }
    else if (p.type === 'ovWin'){ const o = G.OVERSEAS.find(x => x.id === p.id); setSpeed(0); modal(`<div class="stamp">海外中标</div><h1>${o.name} 中标</h1><p>${o.desc}本公司方案在国际竞标中胜出，即日起按月投入建设资金，建成后获得 20 年运营权。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">继续经营</button></div>`); }
    else if (p.type === 'ovLose'){ const o = G.OVERSEAS.find(x => x.id === p.id); toast('海外落标', `${o.name}：业主国选择了其他方案。`, 'bad'); showPolicyQueue(); }
    else if (p.type === 'ovDone'){ const o = G.OVERSEAS.find(x => x.id === p.id); setSpeed(0); modal(`<div class="stamp">海外项目通车</div><h1>${o.name} 建成通车</h1><p>中国标准的铁路在海外建成运营。今后 20 年，项目运营收益将按月计入公司营收。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">继续经营</button></div>`); }
    else if (p.type === 'over'){ setSpeed(0); modal(`<h1>公司破产清算</h1><p>连续三个月资不抵债且无法获得新的银行贷款，${esc(G.S.company)} 进入破产清算程序。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="tostart">重新开始</button></div>`); }
    else if (p.type === 'end'){ setSpeed(0); const S = G.S; modal(`<h1>2020 · 三十五年回望</h1><p>${esc(S.company)} 从 1985 年的一纸试点许可出发，最终点亮 ${Object.keys(S.litEver).length} 座城市，累计运送旅客 ${(S.lifetime.pax/1e8).toFixed(2)} 亿人次、货物 ${(S.lifetime.tons/1e8).toFixed(2)} 亿吨，净资产 ${W(G.netWorth())}元。</p><p>${p.score ? `自由经营得分 <b class="gold">${p.score}</b>，已记入排行榜。` : ''}你可以继续经营下去。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">继续经营</button></div>`); }
  }
  function startScreen(){
    setSpeed(0);
    const hero = art('DF4B');
    modal(`<h1>铁道春秋 · 1985</h1><div class="muted">一部改革年代的铁路经营模拟</div>
      <div class="hero">${hero}</div>
      <p>1985&nbsp;年，“运力紧张”是全国铁路的头号难题：车站里挤满了买不到票的旅客，煤炭在坑口堆积如山。为此，国家出台《铁路经营权开放试点暂行办法》，允许社会资本组建铁路公司——修线、买车、开行列车，或者向国铁租用线路过轨运营。</p>
      <p class="dim" style="font-size:12px">本作以中国铁路发展史为背景：大提速、入世、路网规划、政企分开等是真实历史节点；公司、试点制度、人物及各项数值效果均为虚构设定。</p>
      <p>你将经营一家首批试点企业，从三十多年的改革浪潮中一路走来：价格闯关、大提速、入世、高铁时代……点亮全国 ${C.filter(c => !c.abroad).length} 座城市，再把列车开到蒙古、俄罗斯、中亚和东南亚，<span class="keep-together">打造属于你的铁路帝国。</span></p>
      <div class="row start-company"><label class="muted" for="coInput">公司名称</label><input id="coInput" value="华夏铁道实业" maxlength="12"></div>
      <label class="row start-options"><input type="checkbox" id="tutChk" ${window.Tutorial && Tutorial.seen() ? '' : 'checked'}> 开启新手引导（自由经营，约 10 分钟）</label>
      <div class="start-actions">
        ${G.hasSave('auto') ? '<button class="btn" data-m="continue">继续上次（自动存档）</button>' : ''}
        ${G.listSaves().some(x => x.has && x.slot !== 'auto') ? '<button class="btn" data-m="load">读取存档</button>' : '<button class="btn" data-m="load">导入存档</button>'}
        <button class="btn" data-m="board">排行榜</button>
        <button class="btn primary" data-m="new">自由经营（1985 年起）</button></div>
      <h3 style="margin-top:14px">剧本挑战</h3>
      <div class="scn-list">${G.SCENARIOS.map(sc => `<div class="card scn-card"><div class="row sb"><b>${sc.title}</b><span class="tag">${sc.year}–${sc.until}</span></div><p class="scn-brief">${measureText(sc.brief)}</p><div class="scn-footer"><p class="dim">目标：${measureText(sc.goal)} · <span class="measure">启动资金 ${W(sc.cash)}元</span></p><button class="btn sm primary" data-m="scn" data-id="${sc.id}">开始</button></div></div>`).join('')}</div>
      <p class="dim start-note">本作故事、政策与公司均为虚构。车型性能参考历史资料，价格与成本按游戏需要设定。</p>`, true);
  }
  function boardModal(){
    const B = G.board(); const groups = {}; B.forEach(e => (groups[e.title] = groups[e.title] || []).push(e));
    modal(`<h1>排行榜</h1><p class="muted">记录保存在本机浏览器中。剧本按达成目标时的剩余年限、净资产、商誉和点亮城市计分；自由经营在 2021 年 1 月结算。</p>
      ${Object.keys(groups).length ? Object.entries(groups).map(([t, L]) => `<h3>${esc(t)}</h3><div class="table-scroll" tabindex="0" role="region" aria-label="数据表"><table class="t"><tr><th>#</th><th>公司</th><th class="r">得分</th><th class="r">达成年份</th><th class="r">净资产</th><th class="r">日期</th></tr>${L.slice(0,10).map((e,i) => `<tr><td class="num">${i+1}</td><td class="name-cell"><span class="clip-name" title="${esc(e.company)}">${esc(e.company)}</span></td><td class="num r gold">${e.score}</td><td class="num r">${e.y}</td><td class="num r">${W(e.worth)}</td><td class="num r dim">${e.date}</td></tr>`).join('')}</table></div>`).join('') : '<div class="dim">还没有记录。完成一个剧本或者经营到 2020 年底就能上榜。</div>'}
      <div class="row" style="justify-content:flex-end;margin-top:10px">${G.S ? '<button class="btn" data-m="close">关闭</button>' : ''}<button class="btn" data-m="back">返回开始界面</button></div>`, true); }
  function scnBox(){ const S = G.S; const sc = G.scenario(); if (!sc) return ''; const p = G.scnProgress(); const y = G.ym(S.day).y;
    return `<div class="card" style="margin-bottom:10px;border-color:var(--gold)"><div class="row sb"><b>剧本 · ${sc.title}</b><span class="tag ${S.scn.done ? 'green' : S.scn.failed ? 'red' : 'gold'}">${S.scn.done ? `${S.scn.done} 年完成` : S.scn.failed ? '已超期' : `剩 ${Math.max(0, sc.until - y + 1)} 年`}</span></div>
      <p class="detail-copy">目标：${measureText(sc.goal)}（${sc.until} 年底前）</p><div class="region"><span>完成度</span><div class="bar g"><i style="width:${p*100}%"></i></div><span class="num r">${Math.round(p*100)}%</span></div></div>`; }
  function help(){
    setSpeed(0);
    modal(`<h1>经营手册</h1>
      <h3>基本循环</h3><ul>
      <li><b>新建运营线路</b>：「线路」页 → 新建，在地图上点起点和终点，系统自动寻路；方框小城市需先开站才停靠。任何已建成的轨道（国铁、同业、自有）都可以使用。</li>
      <li><b>购车并分配</b>：「购车」页选车型，选择线路后购买。国产车约 30 天交付，进口车约 75 天并受关税与年度额度限制。</li>
      <li><b>收入</b>：客流按城市人口、距离、年代增长计算，与国铁同线竞争——你的列车越快，分流越多；国铁未连通的城市对几乎由你独享。货运需求取决于煤炭、钢铁、港口等货运指数。票额按长途优先分配。</li>
      <li><b>成本</b>：运行成本（燃料/电力/乘务）、过轨费（国铁基准 × 线路等级）、车辆维护、线路养护与利息。</li></ul>
      <h3>修建线路</h3><ul>
      <li>点击地图上的走廊（实线为已建线路，虚线为可修建的走廊），在「建设」页选择等级与电气化后开工。</li>
      <li>自有线路：自己的列车免过轨费；国铁与同业列车会过轨并向你付费（可在「财务」调整费率）。</li>
      <li>抢先修建国铁历史上即将修建的线路（如大秦、京九、青藏），国铁会取消计划，转而租用你的线路。</li>
      <li><b>边疆与海外</b>：地图西至中亚和巴基斯坦，北至西伯利亚，南至新加坡。跨境走廊中间有口岸标记，要等开放政策出台才能修建和开车：1992 年沿边开放（俄、蒙、朝、中亚），1996 年中越联运，2010 年泛亚铁路（老挝、泰国、马来西亚、新加坡），2013 年丝路走廊（巴基斯坦、缅甸、尼泊尔、中吉乌），2018 年半岛铁路（虚构）。过境要通关，去宽轨国家还要换轮；跨境客流受签证限制，境外线路不享受国内建设补贴。</li>
      <li>电力机车与动车组需要电气化线路；青藏线格尔木以南需高原型机车（NJ2）。摆式列车在普速/快速线上可提速 20%。</li></ul>
      <h3>列车等级与机务段</h3><ul>
      <li>「线路」页可为每条客运线路选择直达、特快、普快或夜行卧铺。直达只停起讫两站，特快只停大城市；夜行卧铺适合 6–16 小时的行程，需要在编组里多挂硬卧、软卧。</li>
      <li>在大城市修建机务段（城市详情或「车队」页），半径范围内的本公司列车就近检修：可用率更高、维修费更低、大修停运更短。每座机务段有检修容量。</li></ul>
      <h3>车型换代</h3><ul><li>每年 1 月都会有新车型上市，到 2020 年前后可以买到复兴号。车型停产后仍可运营；停产超过 8 年列为淘汰车型。</li><li>旧型车在干线上票价打折、维修费上涨，但在<b>支线</b>（起讫有二三线城市，或全程 200 km 以内）上没有影响，维修还更省。旧车也可以出售，或者卖给前来求购的同业。</li></ul>
      <h3>重大项目</h3><ul><li>1998 年起可竞标国铁干线客运经营权，中标后独家经营若干年，需履行开行承诺。</li><li>后期可以投资跨海大桥、海底隧道、川藏铁路等超级工程，或到海外投标修建高铁，获取长期收益。</li></ul>
      <h3>操作</h3><ul><li>拖拽平移、滚轮缩放地图；空格暂停；1–4 切换速度；Esc 取消。</li><li>手机上单指拖动地图、双指缩放，轻点城市或走廊查看详情；面板顶部的「面板」和「地图」可切换地图与面板的大小。</li><li>每月自动存档。「存档」里有 5 个存档位，还可以把进度导出成文件、在别的设备上导入。</li></ul>
      <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-m="tut">重新播放新手引导</button><button class="btn primary" data-m="resume">回到游戏</button></div>`, true);
  }
  function soundModal(){ setSpeed(0); const c = window.Sfx ? Sfx.cfg : { sfx:false, music:false, sv:0, mv:0 };
    modal(`<h1>设置</h1><h2>声音设置</h2><p class="muted settings-intro">音效和配乐都是实时合成的：内燃机车风笛、车站广播提示音，以及一段五声音阶的慢板配乐。</p>
      <div class="sndrow"><label class="row" style="gap:8px"><input type="checkbox" data-snd="sfx" ${c.sfx?'checked':''}> <b>音效</b></label><input type="range" min="0" max="100" value="${Math.round(c.sv*100)}" data-snd="sv"></div>
      <div class="sndrow"><label class="row" style="gap:8px"><input type="checkbox" data-snd="music" ${c.music?'checked':''}> <b>背景音乐</b></label><input type="range" min="0" max="100" value="${Math.round(c.mv*100)}" data-snd="mv"></div>
      <div class="sound-preview"><span class="muted">试听</span><button class="btn sm" data-sndtry="horn">风笛</button><button class="btn sm" data-sndtry="chime">车站提示音</button><button class="btn sm" data-sndtry="coin">进账</button><button class="btn sm" data-sndtry="build">开工</button></div>
      <section class="card settings-about" aria-labelledby="settings-about-title">
        <h2 id="settings-about-title">关于</h2>
        <p>制作人：大老师</p>
        <p>微信：lynchrrr</p>
        <p>更多游戏：闲鱼 / 小红书 搜索「模拟游戏大全」</p>
      </section>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" data-m="resume">回到游戏</button></div>`); }
  $('#modal').addEventListener('input', e => { const k = e.target.dataset.snd; if (!k || !window.Sfx) return; Sfx.set(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value / 100); });
  $('#modal').addEventListener('change', e => { const k = e.target.dataset.snd; if (!k || !window.Sfx) return; Sfx.set(k, e.target.type === 'checkbox' ? e.target.checked : e.target.value / 100); });
  $('#modal').addEventListener('click', e => { const b = e.target.closest('[data-sndtry]'); if (b && window.Sfx) { Sfx.set('sfx', true); Sfx.play(b.dataset.sndtry); } });
  $('#bSound').onclick = soundModal;
  $('#bHelp').onclick = help;
  // —— 存档管理 ——
  const SLOTNAME = k => k === 'auto' ? '自动存档' : '存档位 ' + (k === 'manual' ? 1 : +k.slice(1));
  function saveModal(fromStart){
    if (!fromStart) setSpeed(0); ui.saveFromStart = !!fromStart;
    const list = G.listSaves(), fmtAt = t => { const d = new Date(t); return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
    modal(`<h1>存档管理</h1><div class="muted" style="margin-bottom:8px">存档保存在本机浏览器里。换设备或清理浏览器前，可以把进度导出成文件备份。</div>
      <div class="slots">${list.map(x => { const m = x.meta;
        return `<div class="slot ${x.has ? '' : 'empty'}"><div class="sl-name"><b>${SLOTNAME(x.slot)}</b>${x.slot==='auto' ? '<span class="dim">每月自动保存</span>' : ''}</div>
          <div class="sl-info">${x.has ? (m ? `<b class="clip-name" title="${esc(m.company)}">${esc(m.company)}</b> · <span class="measure">${m.date}</span>${m.scn ? ' · ' + esc(m.scn) : ''}<br><span class="dim">净资产 ${W(m.worth)} · 点亮 ${m.lit} 城 · 保存于 ${fmtAt(m.at)}</span>` : '<span class="dim">旧版存档</span>') : '<span class="dim">空</span>'}</div>
          <div class="sl-btns">${!fromStart && x.slot !== 'auto' ? `<button class="btn sm ${x.has?'':'primary'}" data-m="sv" data-slot="${x.slot}">${x.has ? (ui.confirm==='sv'+x.slot ? '确认覆盖' : '覆盖') : '保存'}</button>` : ''}${x.has ? `<button class="btn sm primary" data-m="ld" data-slot="${x.slot}">读取</button>` : ''}${x.has && x.slot !== 'auto' ? `<button class="btn sm danger" data-m="delsv" data-slot="${x.slot}">${ui.confirm==='del'+x.slot ? '确认删除' : '删除'}</button>` : ''}</div></div>`; }).join('')}</div>
      <div class="row" style="justify-content:space-between;margin-top:12px;gap:8px;flex-wrap:wrap"><span class="row" style="gap:6px">${fromStart ? '' : '<button class="btn" data-m="exp">导出当前进度</button>'}<button class="btn" data-m="imp">从文件导入</button></span>
      <button class="btn primary" data-m="${fromStart ? 'back' : 'resume'}">${fromStart ? '返回' : '回到游戏'}</button></div>`, true);
  }
  function exportFile(){ const t = G.ym(G.S.day); const blob = new Blob([G.exportSave()], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tdcq-save-${t.y}-${String(t.m).padStart(2,"0")}.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('已导出', '存档文件已下载。以后可在「存档」里导入。', 'good'); }
  $('#impFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const rd = new FileReader(); rd.onload = () => { const r = G.importSave(rd.result); if (!r.ok) { toast('无法导入', r.msg, 'bad'); return; }
      afterLoad(); closeModal(); setSpeed(0); toast('导入成功', `已读取 ${G.S.company} 的进度。`, 'good'); showPolicyQueue(); };
    rd.onerror = () => toast('无法导入', '读取文件失败：' + ((rd.error && rd.error.message) || '未知错误'), 'bad'); rd.readAsText(f); });
  $('#bSave').onclick = () => saveModal(false);
  $('#bLoad').onclick = () => saveModal(false);
  $('#bNew').onclick = startScreen;

  function clearTrainFloaters(){
    ui.floaters = [];
    ui.lastEvt = G.events[G.events.length - 1]?.at || 0;
  }
  function afterLoad(){ if (window.Tutorial && Tutorial.active()) Tutorial.stop(false); ui.selCity = ui.selEdge = ui.selRoute = ui.odRoute = ui.confirm = null; ui.openDetails = {}; ui.idleOnly = false; ui.mode = 'view'; ui.draft = []; ui.newsTop = G.S.news[0]; ui.sig = ''; clearTrainFloaters(); renderTabs(); renderPanel(true); renderInspector(); renderRouteBar(); renderTop(); renderTicker(); popupQueue = G.popups(); }
  function renderTicker(){ const S = G.S; $('#tickerItems').innerHTML = S.news.slice(0,8).map(n => `<span><b>${n.date}</b> ${esc(n.title)} — ${esc(n.text)}</span>`).join(''); }

  // ---------------- 主循环 ----------------
  let last = performance.now(), tAcc = 0;
  function loop(now){
    requestAnimationFrame(loop);   // 先登记下一帧：即使本帧出错，主循环也不会停
    const dt = Math.min(0.1, (now - last)/1000); last = now;
    const S = G.S;
    if (S && !ui.modalOpen && ui.speed > 0 && !S.over){
      let hours = dt * SPEEDS[ui.speed] * 24;
      try { while (hours > 0){ const h = Math.min(4, hours); G.tick(h); hours -= h; } }
      catch(err){ console.error(err); setSpeed(0); toast('模拟出错，已暂停', String(err && err.message || err) + '。可以先存档或导出，再继续。', 'bad'); }
    }
    if (S){
      const ps = G.popups(); if (ps.length){ popupQueue.push(...ps); showPolicyQueue(); }
      // 弹窗打开时游戏暂停、地图被半透明模糊背景盖住：不必逐帧重画（模糊背景每帧重算很费显卡）
      if (!ui.modalOpen || !ui.mapDrawn) { drawMap(now); ui.mapDrawn = true; }
      tAcc += dt;
      if (tAcc > 0.25){ tAcc = 0; renderTop(); renderPanel(false);
        if (S.news[0] !== ui.newsTop){ const fresh = []; for (const n of S.news){ if (n === ui.newsTop) break; fresh.push(n); } ui.newsTop = S.news[0];
          fresh.slice(0,3).forEach(n => { if (['good','bad','warn','state','rival'].includes(n.kind) && !n.title.startsWith('成就')) toast(n.title, n.text, n.kind==='bad'||n.kind==='warn' ? 'bad' : n.kind==='good' ? 'good' : ''); });
          renderTicker(); if (ui.selCity !== null || ui.selEdge !== null) renderInspector(); }
      }
    }
  }

  // 启动
  resize(); fit();
  G.newGame('华夏铁道实业');
  renderTools(); renderTabs(); afterLoad();
  startScreen();
  requestAnimationFrame(loop);
  window.__ui = ui; window.__terrReady = () => !!terr; window.__cityXY = i => [sx(C[i].lon), sy(C[i].lat)];
})();
