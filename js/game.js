// =============================================================
//  铁道春秋 · 模拟引擎
//  货币内部单位：元；界面显示：万元
// =============================================================
const Game = (() => {
  const START = new Date(1985, 0, 1);
  const HOURS_PER_MONTH = 720, AVAIL = 0.9;

  // ---------- 静态数据 ----------
  // 城市按序号存档：原有 62 座大城市 → 二三线城市 → 边疆与海外扩展（frontier.js），新城市只能追加在末尾
  const cities = CITY_RAW.map(c => Object.assign(c.slice(), { tier:1 })).concat(TOWN_RAW.map(c => Object.assign(c.slice(), { tier: c[3] >= 30 ? 2 : 3 })))
    .concat((typeof FRONTIER_RAW !== 'undefined' ? FRONTIER_RAW : []).map(c => Object.assign(c.slice(), { tier: c[8] || 3, abroad: c[9] || '' })))
    .map((c, i) => ({ i, name:c[0], lon:c[1], lat:c[2], pop0:c[3], g:c[4], F0:c[5], region:c[6], tag:c[7], tier:c.tier, abroad:c.abroad || '' }));
  const isTown = ci => cities[ci].tier > 1;
  const cityIdx = {}; cities.forEach(c => cityIdx[c.name] = c.i);
  function hav(a, b){ const R=6371, toR=Math.PI/180; const dLat=(b.lat-a.lat)*toR, dLon=(b.lon-a.lon)*toR;
    const x=Math.sin(dLat/2)**2+Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(x)); }
  // 原走廊按沿途二三线城市拆分为多段；grp 记录所属原走廊，便于整段修建
  const viaOf = {}; VIA.forEach(([a,b,list]) => { viaOf[a+'|'+b] = list; viaOf[b+'|'+a] = list.slice().reverse(); });
  const chainOf = (a, b) => [a, ...(viaOf[a+'|'+b] || []), b];
  const edges = []; const groups = [];
  EDGE_RAW.concat(TOWN_EDGES).forEach((e, gi) => {
    const chain = chainOf(e[0], e[1]); const grp = { i:gi, a:cityIdx[e[0]], b:cityIdx[e[1]], line:e[3], edges:[] }; groups.push(grp);
    for (let k = 0; k < chain.length - 1; k++){
      const a = cityIdx[chain[k]], b = cityIdx[chain[k+1]];
      if (a===undefined || b===undefined) { console.error('edge city missing', e, chain[k], chain[k+1]); continue; }
      const d = hav(cities[a], cities[b]) * (1.16 + Math.max(0, e[2]-1)*0.06);
      const ed = { i:edges.length, a, b, terrain:e[2], line:e[3], v0:e[4], elec0:e[5], plateau:!!e[6], dist:Math.max(8, Math.round(d)),
        west: (cities[a].lon < 110 && cities[b].lon < 110), grp:gi };
      edges.push(ed); grp.edges.push(ed.i);
    }
    grp.dist = grp.edges.reduce((s,i) => s + edges[i].dist, 0);
  });
  // 超级工程走廊：平时不可修建，立项后才出现在地图上
  const SUPER = [
    { id:'hzw', name:'杭州湾跨海铁路大桥', a:'嘉兴', b:'宁波', from:2003, cost:300e8, months:60, v:250, terrain:1.2, k:1.15, kind:'跨海大桥', desc:'从嘉兴跨越杭州湾直达宁波，上海去宁波不必再绕行杭州，缩短约 120 公里。' },
    { id:'bohai', name:'渤海海峡跨海通道', a:'大连', b:'烟台', from:2010, cost:1200e8, months:96, v:250, terrain:1.2, k:1.1, kind:'海底隧道', desc:'穿越渤海海峡，把东北和山东半岛直接连起来，不再绕行京沈、京沪。' },
    { id:'chuanzang', name:'川藏铁路', a:'成都', b:'拉萨', from:2012, cost:1500e8, months:120, v:160, terrain:4.5, k:1.35, plateau:true, kind:'高原铁路', desc:'穿越横断山脉，翻越多座海拔 4000 米以上的山口，世界上地形最复杂的铁路之一。' },
  ];
  SUPER.forEach(sp => { const a = cityIdx[sp.a], b = cityIdx[sp.b]; if (a === undefined || b === undefined) return;
    const ed = { i:edges.length, a, b, terrain:sp.terrain, line:'', v0:0, elec0:0, plateau:!!sp.plateau, dist:Math.round(hav(cities[a], cities[b]) * sp.k), west:(cities[a].lon < 110 && cities[b].lon < 110), grp:-1, sup:sp.id };
    edges.push(ed); sp.e = ed.i; });
  // 边疆与海外走廊（追加在超级工程之后，保持旧存档的走廊序号不变）
  const BASE_EDGES = edges.length;
  (typeof FRONTIER_EDGES !== 'undefined' ? FRONTIER_EDGES : []).forEach(e => {
    const a = cityIdx[e[0]], b = cityIdx[e[1]]; if (a === undefined || b === undefined) { console.error('frontier edge city missing', e); return; }
    const A = cities[a], B = cities[b], gi = groups.length;
    const d = hav(A, B) * (1.16 + Math.max(0, e[2]-1)*0.06);
    const abroad = !!(A.abroad && B.abroad), xb = !!A.abroad !== !!B.abroad;
    const fc = xb ? (A.abroad || B.abroad) : '';
    const ed = { i:edges.length, a, b, terrain:e[2], line:e[3], v0:e[4], elec0:e[5], plateau:!!e[6], dist:Math.max(8, Math.round(d)),
      west: !abroad && !xb && A.lon < 110 && B.lon < 110, grp:gi, pol:e[7] || '', abroad, xb, gauge: xb && BROAD_GAUGE.includes(fc), country: abroad ? A.abroad : fc };
    edges.push(ed); groups.push({ i:gi, a, b, line:e[3], edges:[ed.i], dist:ed.dist, abroad: abroad || xb });
  });  const edgeByPair = {}; edges.forEach(e => { edgeByPair[e.a+'-'+e.b] = e; edgeByPair[e.b+'-'+e.a] = e; });
  const adj = cities.map(() => []); edges.forEach(e => { adj[e.a].push(e); adj[e.b].push(e); });
  const trainById = {}; TRAINS.forEach(t => trainById[t.id] = t);
  const carById = {}; CARS.forEach(c => carById[c.id] = c);

  // ---------- 编组 ----------
  const isUnit = m => m.type === 'emu' || m.type === 'dmu';       // 动车组：固定编组
  const supportsUse = (m, use) => m.use === use || !!(m.dualUse && (use === 'pax' || use === 'freight'));
  const modelForUse = (m, use) => m.dualUse && use === 'pax' ? { ...m, use } : m;
  const trainUse = t => trainById[t.model].dualUse && t.service === 'pax' ? 'pax' : trainById[t.model].use;
  const trainModel = t => modelForUse(trainById[t.model], trainUse(t));
  function trailLimit(m){ return m.use === 'freight' ? m.cap : Math.round(m.power * 0.38); } // 牵引重量上限(t)
  function maxCars(m){ return m.use === 'freight' ? 120 : 20; }
  function consistStats(t){
    const m = trainModel(t);
    if (isUnit(m)) return { cap:m.cap, vmax:m.vmax, weight:0, limit:0, n:0, comfort:1, carPrice:0, unit:true };
    let cap = 0, w = 0, n = 0, vmax = m.vmax, cw = 0;
    (t.cars || []).forEach(x => { const c = carById[x.id]; if (!c || !x.n) return;
      const u = c.kind === 'pax' ? c.seats : c.load; cap += u * x.n; n += x.n;
      w += x.n * (c.tare + (c.kind === 'pax' ? c.seats*0.08 : c.load)); vmax = Math.min(vmax, c.vmax); });
    return { cap, vmax, weight:w, limit:trailLimit(m), n, unit:false };
  }
  function comfortMul(t, L){
    const m = trainModel(t); if (m.use !== 'pax') return 1;
    const y = ym(S.day).y;
    if (isUnit(m)) return m.comfort || (m.year >= 1995 ? 1.3 : 1.15); // 动车组为软座车厢
    let sw = 0, sv = 0;
    (t.cars || []).forEach(x => { const c = carById[x.id]; if (!c || !x.n) return; let cf = c.comfort * ((y >= 1996 && !c.ac) ? 0.85 : 1);
      sw += c.seats * x.n; sv += c.seats * x.n * (1 + (cf - 1) * Math.min(1, L / 600)); });
    return sw ? sv / sw : 1;
  }
  function tmodel(t){ const m = trainModel(t); const cs = consistStats(t); return Object.assign({}, m, { cap:cs.cap, vmax:cs.vmax, nCars:cs.n }); }
  function carAvailable(c){ const y = ym(S.day).y; return y >= c.year && y <= c.end; }
  function carPrice(c){ const y = ym(S.day).y; return c.price * 1e4 * (cpi(y) / cpi(Math.max(1985, c.year))) * (c.imported ? 1 + S.mods.tariff : 1); }
  // 按线路沿途货源挑选最合适的货车厢
  function bestFreightCar(routeId){
    const r = S && S.routes.find(r => r.id === routeId); if (!r) return null;
    const y = ym(S.day).y; const st = stopFlags(r, 'freight'); const stops = r.stops.filter((c,k) => st[k]);
    const SD = {}; stops.forEach(c => SD[c] = cargoSD(cities[c], y));
    const score = {}; CARGO_IDS.forEach(g => { let v = 0; for (let a = 0; a < stops.length; a++) for (let b = a+1; b < stops.length; b++){ const A = SD[stops[a]], B = SD[stops[b]]; v += (A.S[g]*B.D[g] + B.S[g]*A.D[g]) * CARGO[g].k * CARGO[g].rate; } score[g] = v; });
    let best = null, bs = -1;
    CARS.filter(c => c.kind === 'freight' && carAvailable(c) && !c.imported).forEach(c => { const gs = CAR_CARGO[c.id] || ['general']; const v = Math.max(...gs.map(g => score[g])) * c.load / (c.load + c.tare) * (c.vmax >= 100 ? 1.05 : 1); if (v > bs){ bs = v; best = c; } });
    return best;
  }
  function defaultConsist(m, routeId){
    if (isUnit(m)) return [];
    const kind = m.use;
    let c = kind === 'freight' ? bestFreightCar(routeId) : null;
    if (!c){
      const av = CARS.filter(c => c.kind === kind && carAvailable(c) && !c.imported && (kind === 'freight' ? /件杂货/.test(c.cargo) : /^YZ/.test(c.id)));
      av.sort((a,b) => b.year - a.year);
      c = av[0] || CARS.find(c => c.kind === kind && carAvailable(c)); }
    if (!c) return [];
    const per = c.tare + (kind === 'pax' ? c.seats*0.08 : c.load);
    const n = Math.max(1, Math.min(kind === 'pax' ? 16 : 50, Math.floor(trailLimit(m) / per)));
    return [{ id:c.id, n }];
  }
  function consistCost(cars){ return (cars||[]).reduce((a,x) => a + carPrice(carById[x.id]) * x.n, 0); }
  const depotCars = () => S.carDepot || {};
  function carCounts(cars){
    const counts = {};
    for (const { id, n } of cars || []) counts[id] = (counts[id] || 0) + n;
    return counts;
  }
  function checkConsist(m, service, cars){
    if (!supportsUse(m, service)) return '该机车不支持所选用途';
    const ids = new Set();
    for (const { id, n } of cars){
      if (!Number.isSafeInteger(n) || n < 1 || ids.has(id)) return '车厢数量须为非负整数，同型号只能登记一次';
      if (carById[id]?.kind !== service) return '车厢类型与所选用途不符';
      ids.add(id);
    }
    if (isUnit(m)) return cars.length ? '动车组为固定编组' : '';
    const cs = consistStats({ model:m.id, service, cars });
    if (cs.n > maxCars(modelForUse(m, service))) return `编组过长（上限 ${maxCars(modelForUse(m, service))} 辆）`;
    if (cs.weight > cs.limit) return `超出机车牵引能力（${Math.round(cs.weight)} t > ${cs.limit} t）`;
    return '';
  }
  function postDepot(depot, id, n, value){
    if (!n) return;
    const previous = depot[id] || { n:0, value:0 };
    const count = previous.n + n;
    if (count) depot[id] = { n:count, value:Math.max(0, previous.value + value) };
    else delete depot[id];
  }
  function supplyCars(depot, id, n, fromDepot = true){
    const c = carById[id], stock = depot[id];
    const reused = fromDepot && stock ? Math.min(n, stock.n) : 0;
    const bought = n - reused;
    if (bought && !carAvailable(c)) return { msg:`${c.name}已停产，车厢库数量不足（还差 ${bought} 辆）` };
    const value = reused ? stock.value * reused / stock.n : 0;
    const cost = bought ? carPrice(c) * bought : 0;
    postDepot(depot, id, -reused, -value);
    return { reused, bought, cost, value:value + cost };
  }
  const trainDepreciation = t => Math.pow(0.93, (S.day - t.bought) / 365);
  function attachedCarValue(t){
    const counts = carCounts(t.cars), factor = trainDepreciation(t);
    if (t.carBasis) return Object.fromEntries(Object.keys(counts).map(id => [id, (t.carBasis[id] || 0) * factor]));
    // 旧档只有整列购价，按现行车头和车厢报价比例拆分账面价值。
    const costs = Object.entries(counts).map(([id, n]) => [id, carPrice(carById[id]) * n]);
    const total = trainPrice(trainById[t.model], null, []).loco + costs.reduce((sum, [, value]) => sum + value, 0);
    const scale = total > 0 ? trainValue(t) / total : 0;
    return Object.fromEntries(costs.map(([id,value]) => [id, value * scale]));
  }
  function quoteConsist(tid, cars, service){
    const t = S.trains.find(t => t.id === tid);
    if (!t) return { ok:false, msg:'找不到列车' };
    const m = trainById[t.model];
    if (isUnit(m)) return { ok:false, msg:'动车组为固定编组' };
    cars = cars.filter(({ n }) => n !== 0);
    service = service || trainUse(t);
    const issue = checkConsist(m, service, cars);
    if (issue) return { ok:false, msg:issue };
    const old = carCounts(t.cars), desired = carCounts(cars), values = attachedCarValue(t), depot = { ...depotCars() };
    const head = trainValue(t) - Object.values(values).reduce((sum, value) => sum + value, 0);
    let cost = 0, stored = 0, reused = 0, bought = 0;
    for (const id of new Set([...Object.keys(old), ...Object.keys(desired)])){
      const change = (desired[id] || 0) - (old[id] || 0);
      if (change < 0){
        const value = values[id] * (-change) / old[id];
        postDepot(depot, id, -change, value); values[id] -= value; stored -= change;
      } else if (change > 0){
        const supply = supplyCars(depot, id, change);
        if (supply.msg) return { ok:false, msg:supply.msg };
        values[id] = (values[id] || 0) + supply.value;
        cost += supply.cost; reused += supply.reused; bought += supply.bought;
      }
    }
    const factor = trainDepreciation(t);
    const basis = Object.fromEntries(cars.map(({ id }) => [id, Math.max(0, values[id] / factor)]));
    return { ok:S.cash >= cost || !cost, msg:cost > 0 && S.cash < cost ? '现金不足' : '', cost, stored, reused, bought, depot, basis, service, cars, price:Math.max(0, head / factor) + Object.values(basis).reduce((sum, value) => sum + value, 0) };
  }
  function setConsist(tid, cars, service){
    const q = quoteConsist(tid, cars, service); if (!q.ok) return q;
    const t = S.trains.find(t => t.id === tid);
    S.cash -= q.cost; S.month.buy += q.cost; S.carDepot = q.depot;
    t.cars = q.cars.map(({ id, n }) => ({ id, n })); t.carBasis = q.basis; t.price = q.price;
    if (trainById[t.model].dualUse) t.service = q.service;
    recompute();
    return { ok:true, net:q.cost, stored:q.stored, reused:q.reused, bought:q.bought };
  }

  const policyById = {}; POLICIES.forEach(p => policyById[p.id] = p);

  // ---------- 工具 ----------
  function dateOf(day){ const d = new Date(START); d.setDate(d.getDate() + Math.floor(day)); return d; }
  function ym(day){ const d = dateOf(day); return { y:d.getFullYear(), m:d.getMonth()+1, d:d.getDate() }; }
  function cpi(y){ y = Math.max(1985, Math.min(2020, y)); return CPI[y] || CPI[2020]; }
  // 人工与能源成本的实际增速快于物价：运行成本和线路使用费按此额外上涨
  // 客票价格指数：普速客票 1995 年后长期基本冻结，时速 160 以上的快车和高铁按市场定价
  function paxFareIdx(y, vavg){ if (y <= 1995 || vavg >= 160) return cpi(y); return cpi(1995) * (1 + 0.02 * (Math.min(2020, y) - 1995)); }
  function wIdx(y){ return 1 + 0.03 * (Math.max(1985, Math.min(2020, y)) - 1985); }
  function rate(y){ let r = 0.079; Object.keys(RATES).map(Number).sort((a,b)=>a-b).forEach(k => { if (y >= k) r = RATES[k]; }); return r; }
  function popOf(c, y){ return c.pop0 * Math.pow(1 + c.g, y - 1985) * (1 + ((S && S.boost && S.boost[c.i]) || 0)); }
  function freightOf(c, y){ const base = c.F0 || (2 + c.pop0/80); return base * fgrow(c, y); }
  function fgrow(c, y){ return Math.pow(1 + c.g, (y - 1985) * 0.6) * (1 + ((S && S.boost && S.boost[c.i]) || 0)); }
  // 城市各货种的发送(S)与到达(D)指数
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function cargoSD(c, y){
    const p = popOf(c, y), gr = fgrow(c, y), tag = c.tag || '', f = c.F0 || 0, n = c.name;
    const ce = Math.pow(clamp((y - 1988) / 12, 0, 3), 1.4), port = /港口|特区|陆港/.test(tag);
    const S0 = {}, D0 = {};
    S0.coal = (/煤/.test(tag) && tag !== '煤港') ? f * gr : 0;
    D0.coal = p / 40 + (/钢/.test(tag) ? 8 * gr : 0) + (tag === '煤港' ? 35 * gr : /港口/.test(tag) ? 8 * gr : 0);
    S0.ore = ((INDUSTRY.ore[n] || 0) * gr) + (PORT_IMPORT.ore.includes(n) ? 8 * clamp((y - 1995) / 12, 0, 1.5) : 0);
    D0.ore = /钢/.test(tag) ? f * 0.9 * gr : 0;
    S0.steel = /钢/.test(tag) ? f * 0.8 * gr : 0;
    D0.steel = p / 70 + (/汽车|重机|工业|机车/.test(tag) ? 5 : 0);
    S0.grain = (INDUSTRY.grain[n] || 0) + (c.region === '东北' ? 2 + p / 40 : 0) + (c.tier > 1 && /华中|华北|华东/.test(c.region) ? 1.2 : 0);
    D0.grain = p / 55;
    S0.oil = ((INDUSTRY.oil[n] || 0) * gr) + (PORT_IMPORT.oil.includes(n) ? 10 * clamp((y - 2000) / 10, 0, 1.5) : 0);
    D0.oil = p / 70 + (/化工/.test(tag) ? 4 : 0);
    S0.cont = D0.cont = ce * ((port ? f + 10 : 0) + p / 150);
    S0.general = D0.general = p / 60 + 1;
    return { S:S0, D:D0 };
  }
  // 当月大事件
  function activeEvents(y, m){ const k = y*12 + m; return HIST_EVENTS.filter(ev => k >= ev.from[0]*12 + ev.from[1] && k <= ev.to[0]*12 + ev.to[1]); }
  let blocked = {};
  function monthFactors(){
    const t = ym(S.day); const evs = activeEvents(t.y, t.m);
    let pax = seasonPax(t.y, t.m), fr = seasonFreight(t.y, t.m); const city = {}; blocked = {};
    evs.forEach(ev => { if (ev.pax) pax *= ev.pax; if (ev.freight) fr *= ev.freight;
      if (ev.city) Object.entries(ev.city).forEach(([n,v]) => { const i = cityIdx[n]; if (i !== undefined) city[i] = (city[i]||1) * v; });
      if (ev.block) edges.forEach(e => { const inb = c => c.lon >= ev.block.lon[0] && c.lon <= ev.block.lon[1] && c.lat >= ev.block.lat[0] && c.lat <= ev.block.lat[1]; if (inb(cities[e.a]) || inb(cities[e.b])) blocked[e.i] = ev.title; }); });
    return { pax, fr, city, evs };
  }
  function clsOfV(v){ return v <= 120 ? 0 : v <= 160 ? 1 : v <= 250 ? 2 : v <= 350 ? 3 : 4; }
  function clsFeeMul(v){ return [1, 1.3, 1.7, 2.2, 2.6][clsOfV(v)]; }
  const fmtW = yuan => { let w = yuan/10000; const a = Math.abs(w); if (a < 0.05) w = 0;
    if (a >= 10000) return (w/10000).toFixed(2) + ' 亿'; if (a >= 100) return Math.round(w).toLocaleString('zh-CN') + ' 万'; return w.toFixed(1) + ' 万'; };

  let S = null; // 游戏状态

  function newGame(company){
    flushAutoSave();
    registerDesigns(null);
    S = {
      v: 2, mapVer: 2, company: company || '华夏铁道实业', day: 0, cash: 1.5e8, debt: 0,
      mods: { fare:1, tariff:0.6, importQuota:2, westSubsidy:0, buildSubsidy:0, hsrSubsidy:0, credit:1, paxDemand:1, freightDemand:1, stateFee:1, rivalAggro:1 },
      unlock: { P1:true }, policies: [], stateEvents: [], tracks: [], routes: [], trains: [],
      rivals: RIVALS.map(r => ({ id:r.id, cash: 8e7, active: r.from <= 1985, built: 0, value: 0 })),
      history: [], month: blankMonth(), news: [], imports: { y:1985, n:0 }, carDepot:{}, feeMul: 1.0, nid: 1,
      lit: {}, litEver: {}, achievements: {}, stations: {}, boost: {}, cityLv: {}, reports: [], evSeen: {}, rep: 50, sigY: 0, contracts: [], offers: [], bonds: [], ipo: null, negMonths: 0, over: false, lastYM: '1985-1', speed: 1,
      lifetime: { pax:0, tons:0, rev:0, trips:0 }
    };
    edges.forEach(e => { if (e.line) S.tracks.push({ id:S.nid++, e:e.i, owner:'S', v:e.v0, elec:!!e.elec0, status:'ok', line:e.line, cost:0, built:0 }); });
    applyPolicies(true);
    log('公司成立', `${S.company} 获得首批铁路经营许可，注册资本 1.5 亿元。`, 'info');
    recompute();
    return S;
  }
  function blankMonth(){ return { pairs:{}, fin:{}, staff:0, staffPaid:0, rd:0, biz:0, rent:0, subsidy:0, contract:0, ovhCost:0, cargo:{}, pax:0, freight:0, run:0, fees:0, feeIn:0, maint:0, trackMaint:0, interest:0, build:0, buy:0, sell:0, trips:0, paxN:0, tons:0 }; }
  function log(title, text, kind){ const t = ym(S.day); S.news.unshift({ date:`${t.y}.${String(t.m).padStart(2,'0')}`, title, text, kind:kind||'info' }); if (S.news.length > 120) S.news.pop(); }

  // ---------- 政策 ----------
  let pendingPopups = [];
  function applyPolicies(silent){
    const t = ym(S.day);
    POLICIES.forEach(p => {
      if (S.policies.includes(p.id)) return;
      if (t.y > p.y || (t.y === p.y && t.m >= p.m)) {
        S.policies.push(p.id); p.apply(S); S.unlock[p.id] = true;
        if (p.id === 'P4') { const r = S.rivals.find(r => r.id==='R3'); if (r && !r.acquired) r.active = true; }
        log('政策 · ' + p.title, p.effects.join('；'), 'policy');
        if (!silent || p.id === 'P1') pendingPopups.push({ type:'policy', p });
      }
    });
    S.rivals.forEach(r => { const def = RIVALS.find(x => x.id===r.id); if (!r.acquired && def.from <= t.y && def.id !== 'R3') r.active = true; });
  }
  function applyStateEvents(){
    const t = ym(S.day);
    STATE_EVENTS.forEach((ev, k) => {
      if (S.stateEvents.includes(k)) return;
      if (!(t.y > ev.y || (t.y === ev.y && t.m >= ev.m))) return;
      S.stateEvents.push(k);
      if (ev.kind === 'build') {
        let built = 0, pre = 0;
        const segs = []; ev.edges.forEach(([a,b]) => { const ch = chainOf(a, b); for (let k = 0; k < ch.length-1; k++) segs.push([ch[k], ch[k+1]]); });
        segs.forEach(([a,b]) => {
          const e = edgeByPair[cityIdx[a]+'-'+cityIdx[b]]; if (!e) return;
          const playerTrack = ownTrackFor(e.i, ev.v);
          const playerBetter = playerTrack && (playerTrack.upg ? playerTrack.upg.v : playerTrack.v) >= ev.v;
          if (playerBetter) { pre++; return; }
          const ex = S.tracks.find(tr => tr.e===e.i && tr.owner==='S' && isHighSpeed(tr.v) === isHighSpeed(ev.v) && tr.v >= ev.v);
          if (ex) return;
          S.tracks.push({ id:S.nid++, e:e.i, owner:'S', v:ev.v, elec:!!ev.elec, status:'ok', line:ev.name, cost:0, built:S.day });
          built++;
        });
        if (built) log('国铁 · ' + ev.name + ' 开通', `国铁新线投入运营（最高 ${ev.v} km/h${ev.elec?'，电气化':''}）。` + (pre?`其中 ${pre} 段因贵公司已抢先建成而未重复修建。`:''), 'state');
        else if (pre) log('国铁 · ' + ev.name + ' 取消', '贵公司已抢先建成该通道，国铁取消修建计划，转而租用贵公司线路。', 'good');
      } else if (ev.kind === 'speed') {
        S.tracks.forEach(tr => { if (tr.owner==='S' && ev.lines.some(l => (tr.line||'').startsWith(l)) && tr.v < ev.v && tr.v <= 200) tr.v = ev.v; });
        log('国铁 · ' + ev.name, `${ev.lines.join('、')} 最高速度提升至 ${ev.v} km/h。`, 'state');
      } else if (ev.kind === 'elec') {
        S.tracks.forEach(tr => { if (tr.owner==='S' && ev.lines.some(l => (tr.line||'').startsWith(l))) tr.elec = true; });
        log('国铁 · ' + ev.name, `${ev.lines.join('、')} 完成电气化改造，电力机车与动车组可以通行。`, 'state');
      }
    });
  }

  // ---------- 费率 ----------
  function stateFeeBase(y){ return 10 * cpi(y) * S.mods.stateFee; } // 元/列·公里
  // 线路使用费按列车实际能跑到的速度等级收取：慢车走提速线不按高等级收费
  function feeRate(track, use, y, vTrain){
    let base = 10 * cpi(y) * clsFeeMul(Math.min(track.v, vTrain || track.v));
    if (track.owner === 'S') return base * S.mods.stateFee;
    if (track.owner === 'P') return base * S.feeMul;
    return base * 1.15 * (warOf(track.owner) ? 1.4 : 1);
  }
  // 跨境与境外走廊：对应的开放政策出台前，本公司不能修建，也不能开行列车
  function edgeLock(e){ if (!e || !e.pol || (S && S.unlock && S.unlock[e.pol])) return null; return policyById[e.pol] || { title:'对外开放政策', y:'', m:'' }; }
  function lockText(e){ const p = edgeLock(e); return p ? `${e.xb ? '口岸' : '境外线路'}尚未对本公司开放（需政策 ${p.title}${p.y ? `，${p.y} 年` : ''}）` : ''; }
  const isHighSpeed = v => v >= 250;
  // 旧档可能有普速改高铁的在建工程，按竣工后的用途预留位置。
  function ownTrackFor(eid, v){
    return S.tracks.find(t => t.e === eid && t.owner === 'P' && isHighSpeed(t.upg ? t.upg.v : t.v) === isHighSpeed(v));
  }
  function trackUsable(tr, model, e){
    if (tr.status !== 'ok') return false;
    if (e.pol && edgeLock(e)) return false;
    if (blocked[e.i]) return false;
    if ((model.type === 'electric' || model.type === 'emu') && !tr.elec) return false;
    if (e.plateau && !model.plateau && model.type !== 'electric' && model.type !== 'emu') return false;
    if (e.plateau && !model.plateau) return false;
    if (isHighSpeed(tr.v) && model.use === 'freight') return false;
    return true;
  }
  function pickTrack(e, model, pref){
    const cands = S.tracks.filter(tr => tr.e === e.i && trackUsable(tr, model, e));
    if (!cands.length) return null;
    const y = ym(S.day).y;
    const score = tr => {
      const v = Math.min(effVmax(model, tr), tr.v);
      const own = tr.owner === 'P' ? 1 : 0;
      if (pref === 'cheap') return own*1e6 - feeRate(tr, model.use, y, v);
      return own*1e6 + v*10 - feeRate(tr, model.use, y, v)*0.01;
    };
    cands.sort((a,b) => score(b) - score(a));
    return cands[0];
  }
  function effVmax(model, tr){ let v = model.vmax; return (model.tilt && tr.v <= 160) ? Math.min(v, tr.v*1.2) : Math.min(v, tr.v); }

  // ---------- 车站 ----------
  function stationLv(ci){ if (!isTown(ci)) return 9; const s = S.stations[ci]; return s ? s.lv : 0; }
  // 线路各节点是否停靠：大城市总停；二三线城市需已开站且未设为通过
  // use='freight' 时忽略客运等级（直达/特快只约束旅客列车的停站）
  function stopFlags(r, use){ if (r.slow) r.skip = []; const skip = r.skip || []; const gd = (r.slow || use === 'freight') ? 'normal' : (r.grade || 'normal'); return r.stops.map((c, k) => {
    const end = k === 0 || k === r.stops.length-1;
    if (gd === 'direct' && !end) return false;
    if (!isTown(c)) return true; if (stationLv(c) < 1) return false;
    if (gd === 'express' && !end) return false;
    return end ? true : !skip.includes(c); }); }
  // —— 列车等级 ——
  const GRADES = {
    direct:  { name:'直达', fare:1.1, desc:'只停起讫两站，全程最快，票价 +10%；中途客流一概不接' },
    express: { name:'特快', fare:1.04, desc:'只停大城市，小站一律通过，票价 +4%' },
    normal:  { name:'普快', fare:1,    desc:'大城市和已开站的小站都停' },
    night:   { name:'夜行卧铺', fare:1.45, desc:'夕发朝至，省一晚住宿：乘车 6–16 小时的站对客源 ×1.35，卧铺票价最高 +45%（按站对乘车时长计，过短或超过 16 小时递减）；需要卧铺车占 60% 以上' },
  };
  const SLEEPER = c => /^(YW|RW)/.test(c.id) || c.id === 'SU_KUPE' || c.id === 'J24' || !!c.sleeper;
  function sleeperFrac(t){ const m = trainById[t.model]; if (isUnit(m)) return m.sleeper ? 1 : 0; let a = 0, b = 0; (t.cars || []).forEach(x => { const c = carById[x.id]; if (!c || c.kind !== 'pax' || !x.n) return; b += c.seats * x.n; if (SLEEPER(c)) a += c.seats * x.n; }); return b ? a / b : 0; }
  // 夜车卧铺加成的时长窗口：6–16 小时全额，过短或跨两夜递减
  function nightWin(h){ h = h || 0; if (h < 6) return clamp((h - 4) / 2, 0, 1); if (h <= 16) return 1; return clamp(1 - (h - 16) / 8, 0.3, 1); }
  function gradeFare(r, t, hrs){ const g = gradeOf(r); if (g !== 'night') return GRADES[g].fare; return 1 + 0.45 * Math.min(1, sleeperFrac(t) / 0.6) * clamp(((hrs || 10) - 4) / 3, 0, 1); }
  function gradeOf(r){ return r && !r.slow ? (r.grade || 'normal') : 'normal'; }
  function setGrade(rid, g){ const r = S.routes.find(x => x.id === rid); if (!r || !GRADES[g]) return; r.grade = g; if (g !== 'normal') r.slow = false; recompute(); }
  function stationQuote(ci, lv){
    const y = ym(S.day).y; const cur = S.stations[ci]; const L = STATION_LEVELS[lv]; if (!L) return null;
    const has = cur && cur.lv >= 1 && STATION_LEVELS[cur.lv];   // 在建未启用（lv:0）视为尚无既有车站
    const curCost = has ? STATION_LEVELS[cur.lv].cost : 0;
    const cost = Math.max(0, L.cost - curCost * 0.8) * 1e4 * cpi(y) * (1 - Math.min(0.3, S.mods.buildSubsidy)) * (1 - ((S.stSub || {})[ci] || 0));
    return { cost, months: Math.max(1, [0,2,4,8][lv] - (has ? 1 : 0)), lv };
  }
  function buildStation(ci, lv){
    if (!isTown(ci)) return { ok:false, msg:'大城市可直接使用国铁车站' };
    const cur = S.stations[ci];
    if (cur && (cur.lv >= lv || cur.pend)) return { ok:false, msg: cur.pend ? '车站正在施工' : '已达到该等级' };
    const q = stationQuote(ci, lv); if (S.cash < q.cost) return { ok:false, msg:'现金不足' };
    S.cash -= q.cost; S.month.build += q.cost;
    const s = cur || (S.stations[ci] = { lv:0, cost:0, built:S.day });
    s.cost += q.cost; s.pend = { lv, done: S.day + q.months*30 };
    log(cur && cur.lv ? '车站扩建' : '开设车站', cur && cur.lv ? `${cities[ci].name}站扩建为「${STATION_LEVELS[lv].name}」，投资 ${fmtW(q.cost)}元，工期 ${q.months} 个月。` : `${cities[ci].name}站已开工，拟建为「${STATION_LEVELS[lv].name}」，投资 ${fmtW(q.cost)}元，工期 ${q.months} 个月。`, 'info');
    return { ok:true };
  }
  function stationValue(s){ const age = (S.day - (s.built||0))/365; return (s.cost||0) * Math.pow(0.97, age); }
  // 自动寻路：沿已有可用轨道的最短路（公里）
  function findPath(a, b, avoid){
    const n = cities.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
    const ok = {}; S.tracks.forEach(tr => { if (tr.status === 'ok') ok[tr.e] = true; });
    dist[a] = 0;
    for (let it = 0; it < n; it++){
      let u = -1, best = Infinity; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best){ best = dist[i]; u = i; }
      if (u < 0 || u === b) break; done[u] = true;
      adj[u].forEach(e => { if (!ok[e.i] || edgeLock(e)) return; const v = e.a === u ? e.b : e.a; if (avoid && avoid.includes(v) && v !== b) return;
        if (dist[u] + e.dist < dist[v]){ dist[v] = dist[u] + e.dist; prev[v] = u; } });
    }
    if (!isFinite(dist[b])) return null;
    const path = []; for (let v = b; v !== -1; v = prev[v]) path.unshift(v); return path;
  }

  // ---------- 列车运行计划 ----------
  function planTrain(t){
    const model = tmodel(t);
    const r = S.routes.find(r => r.id === t.route);
    if (!isUnit(model) && !model.nCars) return { ok:false, why:'未编组车厢' };
    if (!r || r.stops.length < 2) return { ok:false, why: r ? '线路不完整' : '未分配线路' };
    const legs = []; let dist = 0, hours = 0, fee = 0, vmin = 999;
    const y = ym(S.day).y;
    const dwell = (model.type==='emu') ? 0.12 : (model.use==='freight' ? 0.5 : 0.25);
    for (let k = 0; k < r.stops.length - 1; k++) {
      const e = edgeByPair[r.stops[k]+'-'+r.stops[k+1]];
      if (!e) return { ok:false, why:'线路走廊不存在' };
      const tr = pickTrack(e, model, r.pref);
      if (!tr) {
        const any = S.tracks.some(x => x.e===e.i && x.status==='ok');
        let why = `${cities[r.stops[k]].name}—${cities[r.stops[k+1]].name} 无可用轨道`;
        if (blocked[e.i]) why = `${cities[r.stops[k]].name}—${cities[r.stops[k+1]].name} 因「${blocked[e.i]}」中断`;
        if (any && (model.type==='electric'||model.type==='emu')) why = `${cities[r.stops[k]].name}—${cities[r.stops[k+1]].name} 未电气化`;
        if (any && model.use === 'freight' && !S.tracks.some(x => x.e === e.i && x.status === 'ok' && !isHighSpeed(x.v))) why = `${cities[r.stops[k]].name}—${cities[r.stops[k+1]].name} 只有高速客运专线，请在建设页补建客货共用线`;
        if (any && e.plateau && !model.plateau) why = `${cities[r.stops[k]].name}—${cities[r.stops[k+1]].name} 为高原线路，需高原型机车`;
        if (edgeLock(e)) why = `${cities[r.stops[k]].name}—${cities[r.stops[k+1]].name} ${lockText(e)}`;
        return { ok:false, why };
      }
      const v = effVmax(model, tr);
      const vavg = v * (v > 200 ? 0.82 : 0.72) * (e.terrain > 1.8 ? 0.85 : 1) * (model.use==='freight' ? 0.8 : 1);
      const h = e.dist / vavg + (e.xb ? (e.gauge ? 4 : 1.5) : 0);   // 口岸通关；宽轨国家还要换轮
      const f = tr.owner === 'P' ? 0 : feeRate(tr, model.use, y, v) * e.dist * (tr.owner === 'S' && model.use === 'pax' ? frFee(e.i) : 1);
      legs.push({ e:e.i, tr:tr.id, owner:tr.owner, from:r.stops[k], to:r.stops[k+1], dist:e.dist, h, fee:f, v });
      dist += e.dist; hours += h; fee += f; vmin = Math.min(vmin, v);
    }
    const st = stopFlags(r, model.use);
    for (const k of [0, r.stops.length-1]) if (!st[k]) return { ok:false, why:`${cities[r.stops[k]].name} 尚未开设车站` };
    const nStop = st.filter(Boolean).length;
    const oneWay = hours + dwell * Math.max(0, nStop - 2) + 1.2;
    let trips = HOURS_PER_MONTH * AVAIL * (availOf(t) / 0.98) / oneWay;
    const night = model.use === 'pax' && gradeOf(r) === 'night';
    const run = (1 - 0.03 * trLv()) * model.run * 1.0 * cpi(y) * wIdx(y) * dist * (isUnit(model) ? 1 : 0.55 + 0.45 * Math.min(2, model.nCars / (model.use==='pax' ? 16 : 45)));
    return { ok:true, legs, dist, hours, oneWay, trips, fee, run, vavg: dist / hours, dwell, st, nStop, night };
  }

  // 国铁最短时间（Dijkstra，按国铁线路）
  // 国铁最短时间：按需逐行计算（城市较多时避免每次全量计算）
  let stateTime = null, sAdj = null;
  function computeStateTimes(){
    sAdj = cities.map(() => []); stateTime = [];
    S.tracks.forEach(tr => { if (tr.owner==='S' && tr.status==='ok') { const e = edges[tr.e]; if (e.pol && edgeLock(e)) return; const h = e.dist / (Math.min(tr.v, 350) * 0.55) + (e.xb ? (e.gauge ? 4 : 1.5) : 0); sAdj[e.a].push([e.b,h,e.dist]); sAdj[e.b].push([e.a,h,e.dist]); } });
  }
  function stateRow(s){
    if (stateTime[s]) return stateTime[s];
    const n = cities.length, dist = new Array(n).fill(Infinity); dist[s] = 0; const done = new Uint8Array(n);
    for (let it = 0; it < n; it++) {
      let u = -1, best = Infinity; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) break; done[u] = 1;
      sAdj[u].forEach(([v,h]) => { if (dist[u] + h + 0.3 < dist[v]) dist[v] = dist[u] + h + 0.3; });
    }
    return (stateTime[s] = dist);
  }

  // 需求模型
  function paxDemand(ci, cj, d, y, vavg){
    const pi = popOf(cities[ci], y), pj = popOf(cities[cj], y);
    const era = 1 + (y - 1985) * 0.065;
    const induce = 1 + Math.max(0, vavg - 70) / 160;
    const A = cities[ci].abroad, B = cities[cj].abroad;
    const visa = A && B ? (A === B ? 0.8 : 0.5) : (A || B) ? (y < 2005 ? 0.35 : 0.5) : 1;   // 跨境客流受签证限制
    return 70 * pi * pj / Math.pow(Math.max(d, 60), 0.85) * era * S.mods.paxDemand * induce * visa;
  }
  function freightDemand(ci, cj, d, y){
    const era = 1 + (y - 1985) * 0.07;
    return 6500 * freightOf(cities[ci], y) * freightOf(cities[cj], y) / Math.sqrt(Math.max(d, 60)) * era * S.mods.freightDemand;
  }
  function cargoDemand(SD, g, ci, cj, d, y){
    const era = 1 + (y - 1985) * 0.05;
    const a = SD[ci], b = SD[cj];
    const xb = !!cities[ci].abroad !== !!cities[cj].abroad ? (S.mods.xbFreight || 1) : 1;
    return 5200 * CARGO[g].k * (a.S[g] * b.D[g] + b.S[g] * a.D[g]) / Math.sqrt(Math.max(d, 60)) * era * S.mods.freightDemand * xb;
  }
  function captureShare(ci, cj, hoursPlayer, use, y){
    const ts = stateTime ? stateRow(ci)[cj] : Infinity;
    if (!isFinite(ts)) return use==='freight' ? 0.9 : 0.85;
    const ratio = hoursPlayer / ts;
    let s = 1 / (1 + Math.pow(ratio, 2.2));
    if (use === 'freight') s = Math.min(0.92, s + (y < 1998 ? 0.25 : 0.08)); // 八九十年代运力紧张
    return Math.max(0.05, Math.min(0.92, s));
  }

  // 重新计算所有列车的单程收益（每月及每次变动时）
  let econ = {}; // trainId -> {revTrip, lf, paxTrip, ...}
  let pairInfo = {};
  function cargoCaps(t){ // 货运列车各货种可用载重（按车厢）
    const caps = {}, comps = [];
    (t.cars || []).forEach(x => { const c = carById[x.id]; if (!c || c.kind !== 'freight' || !x.n) return; const gs = CAR_CARGO[c.id] || ['general'];
      comps.push({ gs, cap: c.load * x.n }); gs.forEach(g => caps[g] = (caps[g]||0) + c.load * x.n); });
    return { caps, comps };
  }
  let MF = { pax:1, fr:1, city:{}, evs:[] };
  function recompute(){
    computeDepotCover();
    MF = monthFactors();
    computeStateTimes();
    const y = ym(S.day).y;
    const SD = cities.map(c => cargoSD(c, y));
    const plans = {}; const services = {};
    S.trains.forEach(t => { if (t.status === 'run') plans[t.id] = planTrain(t); });
    congestion(plans, y);
    S.trains.forEach(t => {
      if (t.status !== 'run') { const W = { delivery:'交付中', overhaul:'大修中', repair:'故障临修' }; plans[t.id] = { ok:false, why: W[t.status] || '未分配线路' }; if (t.route && !W[t.status]) plans[t.id] = planTrain(t); return; }
      const p = plans[t.id];
      if (!p.ok) return;
      const model = tmodel(t); const r = S.routes.find(r => r.id===t.route);
      const capM = p.trips * model.cap;
      const cc = model.use === 'freight' ? cargoCaps(t) : null;
      // 每个站对
      const cum = [0]; const hcum = [0];
      p.legs.forEach((l, k) => { cum.push(cum[k] + l.dist); hcum.push(hcum[k] + l.h + (k>0 && p.st[k] ? p.dwell : 0)); });
      for (let a = 0; a < r.stops.length; a++) if (p.st[a]) for (let b = a+1; b < r.stops.length; b++) if (p.st[b]) {
        const ci = r.stops[a], cj = r.stops[b];
        const d = cum[b] - cum[a], h = hcum[b] - hcum[a] + 0.5;
        const gl = model.use === 'freight' ? Object.keys(cc.caps) : ['pax'];
        gl.forEach(g => {
          const key = (model.use === 'pax' ? 'pax' : 'freight:' + g) + ':' + Math.min(ci,cj) + '-' + Math.max(ci,cj);
          const cm = model.use === 'pax' ? capM : p.trips * cc.caps[g];
          if (!services[key]) services[key] = { ci: Math.min(ci,cj), cj: Math.max(ci,cj), use:model.use, g, d, h, cap:0, list:[], nb:0 };
          const sv = services[key]; if (h < sv.h) { sv.h = h; sv.d = d; }
          let fast = true; for (let q = a; q < b; q++) if (p.legs[q].v < 200) { fast = false; break; }
          sv.cap += cm; sv.nb += cm * (p.night ? (h >= 6 && h <= 16 ? 1 + 0.35 * Math.min(1, sleeperFrac(t) / 0.6) : 0.8) : 1); sv.list.push({ t:t.id, a, b, capM:cm, d, g, h, key, ci:Math.min(ci,cj), cj:Math.max(ci,cj), fast: fast && model.vmax >= 200 });
        });
      }
    });
    // 分配需求
    const alloc = {}; pairInfo = {}; cityPax = {};
    // 接驳：二三线城市旅客可在本公司枢纽换乘其他线路，客流加成
    const hubRoutes = {}; S.routes.forEach(r => new Set(r.stops).forEach(c => { if (!isTown(c)) hubRoutes[c] = (hubRoutes[c]||0) + 1; }));
    const svs = Object.values(services); const townLoad = {};
    svs.forEach(sv => {
      const vavg = sv.d / sv.h;
      let D = sv.use === 'pax' ? paxDemand(sv.ci, sv.cj, sv.d, y, vavg) * MF.pax * (MF.city[sv.ci]||1) * (MF.city[sv.cj]||1)
                               : cargoDemand(SD, sv.g, sv.ci, sv.cj, sv.d, y) * MF.fr;
      const towns = [sv.ci, sv.cj].filter(isTown);
      if (sv.use === 'freight' && towns.some(c => !STATION_LEVELS[stationLv(c)].freight)) D = 0;
      if (sv.use === 'pax') towns.forEach(c => { const o = c === sv.ci ? sv.cj : sv.ci; if (!isTown(o)) D *= 1 + 0.08 * stationLv(c) * Math.min(4, Math.max(0, (hubRoutes[o]||0) - 1)); });
      const sat = svcSat(sv); const share = Math.min(0.95, (sv.cap ? sv.nb / sv.cap : 1) * captureShare(sv.ci, sv.cj, sv.h, sv.use, y) * (0.85 + sat / 333) * (0.92 + S.rep / 625) * (sv.use === 'pax' ? (1 + 0.02 * exLv('cmo')) * warShare(sv.ci, sv.cj) * frShare(sv.ci, sv.cj) : 1));
      const ct = sv.use === 'freight' ? (S.contracts||[]).filter(o => o.g === sv.g && o.a === sv.ci && o.b === sv.cj).reduce((a,o) => a + o.tons, 0) : 0;
      sv.D = D + ct; sv.share = share; sv.dem = D * share + ct; sv.ct = ct; sv.towns = towns;
      if (sv.use === 'pax') towns.forEach(c => townLoad[c] = (townLoad[c]||0) + sv.dem);
    });
    // 车站能力上限（月旅客发送+到达）
    const townScale = {}; Object.keys(townLoad).forEach(c => { const capP = STATION_LEVELS[stationLv(+c)].paxCap * 1e4 * 2; townScale[c] = Math.min(1, capP / townLoad[c]); S.stations[c].load = townLoad[c]; S.stations[c].util = townLoad[c] / capP; });
    svs.forEach(sv => {
      let cap = sv.dem; if (sv.use === 'pax') sv.towns.forEach(c => cap *= townScale[c]);
      pairInfo[(sv.use === 'pax' ? 'pax' : 'freight:' + sv.g)+':'+sv.ci+'-'+sv.cj] = { D:sv.D, share:sv.share, cap, served:Math.min(cap, sv.cap), svcap:sv.cap, ct:sv.ct||0, ci:sv.ci, cj:sv.cj, g:sv.g, use:sv.use };
      if (sv.use === 'pax') { const sd = Math.min(cap, sv.cap); cityPax[sv.ci] = (cityPax[sv.ci] || 0) + sd; cityPax[sv.cj] = (cityPax[sv.cj] || 0) + sd; }
      sv.list.forEach(x => { (alloc[x.t] = alloc[x.t] || []).push({ a:x.a, b:x.b, n: sv.cap ? cap * x.capM / sv.cap : 0, d:x.d, g:x.g, h:x.h, key:x.key, ci:x.ci, cj:x.cj, fast:x.fast }); });
    });
    econ = {};
    S.trains.forEach(t => {
      const p = plans[t.id]; const model = tmodel(t);
      const e = { plan:p, revTrip:0, lf:0, unitsTrip:0, costTrip:0, feeTrip:0, monthly:0 };
      econ[t.id] = e;
      if (!p || !p.ok || t.status !== 'run') return;
      const list = alloc[t.id] || [];
      // 票额分配：长途优先，逐段扣减剩余能力
      const nLeg = p.legs.length, load = new Array(nLeg).fill(0);
      const comps = model.use === 'freight' ? cargoCaps(t).comps : [{ gs:['pax'], cap:model.cap }];
      const rem = comps.map(cp => new Array(nLeg).fill(cp.cap));
      let unitKm = 0, units = 0, want = 0, wKm = 0; const cg = {}; const pairs = {};
      const rr0 = S.routes.find(q => q.id === t.route); const night = model.use === 'pax' && gradeOf(rr0) === 'night'; const sfr = night ? Math.min(1, sleeperFrac(t) / 0.6) : 0;
      list.slice().sort((u,v) => v.d - u.d).forEach(x => {
        const per = x.n / p.trips; want += per; let left = per;
        // 价格战跟价只在重叠城市之间的站对打折；夜车卧铺加成按该站对的乘车时长计算
        const pm = (x.g === 'pax' ? warPairFare(x.ci, x.cj) * (night ? 1 + 0.45 * sfr * nightWin(x.h) : 1) : CARGO[x.g].rate);
        comps.forEach((cp, ci) => { if (left <= 0 || !cp.gs.includes(x.g)) return;
          let take = left; for (let k = x.a; k < x.b; k++) take = Math.min(take, rem[ci][k]);
          if (take <= 0) return;
          for (let k = x.a; k < x.b; k++) { rem[ci][k] -= take; load[k] += take; }
          left -= take; unitKm += take * x.d; units += take; wKm += take * x.d * pm;
          pairs[x.key] = (pairs[x.key] || 0) + take; if (x.fast) pairs['fast:' + x.ci + '-' + x.cj] = (pairs['fast:' + x.ci + '-' + x.cj] || 0) + take;
          if (x.g !== 'pax') cg[x.g] = (cg[x.g]||0) + take; });
      });
      e.cargoTrip = cg; e.legLoad = load; e.pairs = pairs;
      const maxL = Math.max(0, ...load);
      e.spill = Math.max(0, want - units);
      const prem = model.use === 'pax' ? 1 + Math.max(0, Math.min(2.8, (p.vavg - 75) / 85)) * 0.8 : 1;
      const cmf = comfortMul(t, p.dist * 0.6); e.comfort = cmf;
      const rr = S.routes.find(q => q.id === t.route); const svl = model.use === 'pax' && rr ? (rr.svc === undefined ? 1 : rr.svc) : 1;
      const rateU = (model.use === 'pax' ? 0.022 * paxFareIdx(y, p.vavg) : 0.019 * cpi(y)) * S.mods.fare * prem * cmf * [0.95, 1, 1.08][svl] * (rr && rr.slow ? 0.65 : 1) * (model.use === 'pax' ? (gradeOf(rr) === 'night' ? 1 : gradeFare(rr, t, p.oneWay)) * eraFare(t) : 1);
      e.revTrip = wKm * rateU; e.unitsTrip = units; e.lf = unitKm / (model.cap * p.dist);
      e.feeTrip = p.fee; e.costTrip = p.run * [0.95, 1, 1.12][svl]; e.prem = prem; e.punct = p.punct; e.delay = p.delay || 0;
      e.monthly = (e.revTrip - e.feeTrip - e.costTrip) * p.trips - maintOf(t, y);
      // 实际发车节奏：与计划趟数同一口径（含可用率、拥堵与通过能力限制）
      e.pace = p.trips * p.oneWay / HOURS_PER_MONTH;
      // 每趟实发时按“当时所跑的线路”记账，调车后旧线路的班次不会算到新线路
      if (model.use === 'pax') {
        e.paxE = p.legs.map(l => l.e);
        e.hsrTr = p.legs.filter(l => l.owner === 'P' && l.v >= 250).map(l => l.tr);
        e.frIds = (S.franch || []).filter(f => f.st === 'held' && f.holder === 'P' && p.legs.some(l => f.edges.includes(l.e)) && rr.stops.filter((c, k) => p.st[k] && f.set[c]).length >= 2).map(f => f.uid);
        if (rr.slow) { const subs = S.slowSub || {}; e.slowAmt = p.dist * (Math.max(0, ...rr.stops.map(c => subs[c] || 0)) || 3); }
      }
      e.loadMax = Math.min(1, maxL / model.cap);
    });
    updateLit();
  }
  // 边际利润：在该线路再加一列同型同编组列车后，全公司预计月净利的变化（含对同线、共线列车的挤占）
  const margCache = {};
  function marginalOf(rid){
    const tpl = S.trains.find(t => t.route === rid && t.status === 'run' && econ[t.id] && econ[t.id].plan.ok); if (!tpl) return null;
    const key = rid + '|' + S.lastYM + '|' + S.trains.map(t => t.id + t.status + t.route).join(',') + '|' + S.tracks.length;
    if (margCache[rid] && margCache[rid].key === key) return margCache[rid].v;
    const sum = () => S.trains.reduce((a, t) => a + ((econ[t.id] && econ[t.id].plan && econ[t.id].plan.ok && t.status === 'run') ? econ[t.id].monthly : 0), 0);
    const before = sum(); const lit = Object.assign({}, S.litEver), nl = S.news.length;
    S.trains.push(Object.assign({}, tpl, { id:-1, cars:(tpl.cars || []).map(x => Object.assign({}, x)), bought:S.day, ovh:S.day, phase:0, name:'试算' }));
    let after = before, own = 0; try { recompute(); after = sum(); own = econ[-1] ? econ[-1].monthly : 0; } finally { S.trains.pop(); S.litEver = lit; S.news.length = Math.min(S.news.length, nl); recompute(); }
    const v = { gain: after - before, own, model: tpl.model }; margCache[rid] = { key, v }; return v; }
  function maintOf(t, y){ const age = (S.day - t.bought) / 365; const so = yrsSinceOvh(t); return t.price * 0.035 / 12 * (1 + age * 0.02 + so * 0.07) * (cpi(y) / cpi(t.year || 1985)) * (1 - 0.2 * (depotCover[t.id] || 0)) * eraMaint(t); }

  function updateLit(){
    const lit = {};
    const trips = {};
    S.trains.forEach(t => { const e = econ[t.id]; if (t.status !== 'run' || !e || !e.plan.ok) return; const r = S.routes.find(r => r.id===t.route); if (!r) return;
      const st = e.plan.st; r.stops.forEach((c,k) => { if (st[k]) { lit[c] = true; trips[c] = (trips[c]||0) + e.plan.trips * (e.plan.vavg > 180 ? 1.8 : 1); } }); });
    S.cityTrips = trips;
    S.lit = lit;
    Object.keys(lit).forEach(c => { if (!S.litEver[c]) { S.litEver[c] = ym(S.day).y; if (S.day > 0) log('点亮城市 · ' + cities[c].name, `${cities[c].name} 开通 ${S.company} 列车服务。`, 'good'); } });
  }

  // ---------- 主循环 ----------
  const events = []; // 供界面显示的浮动收入
  function tick(hours){
    if (!S || S.over) return;
    const prevDay = Math.floor(S.day);
    S.day += hours / 24;
    S.trains.forEach(t => {
      if (t.status !== 'run') return;
      const e = econ[t.id]; if (!e || !e.plan.ok) return;
      t.phase = (t.phase || 0) + hours * (e.pace || 0);
      const ow = e.plan.oneWay;
      let guard = 0;
      while (t.phase >= ow && guard++ < 50) {
        t.phase -= ow; t.dir = t.dir ? 0 : 1;
        const net = e.revTrip;
        const key = trainUse(t);
        S.month[key] += e.revTrip; S.month.run += e.costTrip; S.month.fees += e.feeTrip; S.month.trips++;
        if (key==='pax') S.month.paxN += e.unitsTrip; else { S.month.tons += e.unitsTrip; S.month.cargo = S.month.cargo || {}; Object.entries(e.cargoTrip||{}).forEach(([g,v]) => S.month.cargo[g] = (S.month.cargo[g]||0) + v); }
        // 按站对记实际完成的运量：任务、合同、剧本均以此为准
        const PM = S.month.pairs || (S.month.pairs = {}); Object.entries(e.pairs || {}).forEach(([k, v]) => PM[k] = (PM[k] || 0) + v);
        t.tripsM = (t.tripsM || 0) + 1;
        if (e.paxE) { const M = S.month; M.paxE = M.paxE || {}; e.paxE.forEach(i => M.paxE[i] = 1); M.hsrTr = M.hsrTr || {}; e.hsrTr.forEach(i => M.hsrTr[i] = 1);
          M.frT = M.frT || {}; e.frIds.forEach(u => M.frT[u] = (M.frT[u] || 0) + 1); if (e.slowAmt) M.slowAcc = (M.slowAcc || 0) + e.slowAmt; }
        // 过轨费逐段付给产权方：同业线路的费用记入对方现金
        e.plan.legs.forEach(l => { if (l.owner !== 'P' && l.owner !== 'S' && l.fee) { const rv = S.rivals.find(x => x.id === l.owner); if (rv) { rv.cash += l.fee; rv.feeIn = (rv.feeIn || 0) + l.fee; } } });
        S.cash += e.revTrip - e.costTrip - e.feeTrip;
        t.revM = (t.revM||0) + e.revTrip; t.costM = (t.costM||0) + e.costTrip + e.feeTrip;
        const r = S.routes.find(r => r.id===t.route);
        if (r) { r.revM = (r.revM||0) + e.revTrip; r.costM = (r.costM||0) + e.costTrip + e.feeTrip; }
        const legs = e.plan.legs;
        const city = t.dir ? legs[legs.length - 1].to : legs[0].from;
        events.push({ t:t.id, city, amt:net, at:performance.now() });
        if (events.length > 60) events.shift();
      }
    });
    if (Math.floor(S.day) !== prevDay) dailyCheck();
  }
  let simulating = false; // 剧本历史推演期间：不写存档、不弹窗
  function dailyCheck(){
    let changed = false;
    // 先结算上个月（此时月初到期的竣工、交付、开站等尚未生效，不会被计入上月）
    { const t = ym(S.day); const key = t.y + '-' + t.m;
      if (key !== S.lastYM) { const prev = S.lastYM; S.lastYM = key; monthEnd(prev); changed = true; recompute(); autoSave(true); } }
    if (S.over) return;
    S.tracks.forEach(tr => {
      if (tr.status === 'build' && tr.sup && !superPaid(tr.sup)) return; // 超级工程：尾款付清才能通车
      if (tr.status === 'build' && S.day >= tr.done) {
        tr.status = 'ok'; changed = true;
        const e = edges[tr.e];
        if (tr.owner === 'P') log('线路竣工', `${cities[e.a].name}—${cities[e.b].name} ${e.dist} km（${tr.v} km/h${tr.elec?'，电气化':''}）建成通车。`, 'good');
        else { const rv = RIVALS.find(r => r.id===tr.owner); if (rv) log('同业 · ' + rv.name, `${cities[e.a].name}—${cities[e.b].name} 新线通车。`, 'rival'); }
      }
      if (tr.upg && S.day >= tr.upg.done) { tr.v = tr.upg.v; tr.elec = tr.upg.elec; tr.upg = null; changed = true; const e = edges[tr.e]; log('改造完成', `${cities[e.a].name}—${cities[e.b].name} 升级为 ${tr.v} km/h${tr.elec?'（电气化）':''}。`, 'good'); }
    });
    if (signalWorks()) changed = true;
    Object.keys(S.stations).forEach(c => { const s = S.stations[c]; if (s.pend && S.day >= s.pend.done){ s.lv = s.pend.lv; s.pend = null; changed = true; log('车站启用', `${cities[c].name}站「${STATION_LEVELS[s.lv].name}」投入使用。`, 'good'); } });
    S.trains.forEach(t => { if ((t.status === 'overhaul' || t.status === 'repair') && S.day >= t.ovhDone) { if (t.status === 'overhaul') { t.ovh = S.day; log('大修完成', `${t.name} 大修出厂，恢复如新。`, 'good'); } t.status = t.route ? 'run' : 'idle'; t.phase = 0; changed = true; } });
    S.trains.forEach(t => { if (t.status === 'delivery' && S.day >= t.arrive) { t.status = t.route ? 'run' : 'idle'; t.phase = 0; changed = true; log('车辆交付', `${trainById[t.model].name}（${t.name}）已交付。`, 'info'); } });
    depotsOf().forEach(d => { if (d.pend && S.day >= d.pend.done) { d.lv = d.pend.lv; d.pend = null; changed = true; log('机务段启用', `${cities[d.ci].name}${DEPOT_LV[d.lv].name}建成，半径 ${DEPOT_LV[d.lv].radius} 公里内的本公司列车就近检修。`, 'good'); } });
    if (changed) recompute();
  }
  function monthEnd(prevKey){
    const [py, pm] = prevKey.split('-').map(Number);
    const y = py;
    // 固定成本
    let maint = 0; S.trains.forEach(t => { maint += maintOf(t, y); t.lastRev = t.revM||0; t.lastCost = (t.costM||0) + maintOf(t,y); t.revM = 0; t.costM = 0; t.lastTrips = t.tripsM || 0; t.tripsM = 0; });
    S.lastPairs = S.month.pairs || {};
    S.lastRun = { paxE:S.month.paxE || {}, hsrTr:S.month.hsrTr || {}, frT:S.month.frT || {} };
    S.routes.forEach(r => { r.lastRev = r.revM||0; r.lastCost = r.costM||0; r.revM = 0; r.costM = 0; });
    let tm = 0; S.tracks.forEach(tr => { if (tr.owner==='P' && tr.status==='ok') tm += edges[tr.e].dist * TRACK_CLASSES[clsOfV(tr.v)].maint * 1e4 / 12 * cpi(y); });
    Object.values(S.stations).forEach(s => { if (s.lv) tm += STATION_LEVELS[s.lv].cost * 1e4 * 0.0025 * cpi(y); });
    ensureT2();
    const interest = S.debt * rate(y) / 12 * (1 - 0.04 * exLv('cfo')) + bondsMonth();
    const contract = checkContracts(y); S.cash += contract; S.month.contract = contract;
    let biz = 0; Object.keys(S.biz || {}).forEach(c => biz += shopIncome(+c, y));
    const rent = landRent(y), subsidy = slowSubsidy(y);
    S.month.biz = biz; S.month.rent = rent; S.month.subsidy = subsidy; S.cash += biz + rent + subsidy;
    checkJV();
    const staff = staffCost(y) + (S.month.staff || 0); S.month.staff = staff; S.cash -= staff - (S.month.staffPaid || 0);
    if (S.execs && S.execs.gm) addRep(0.06 * S.execs.gm.lv);
    if (pm === 1 || !(S.cands || []).length) genCands(py);
    if ((pm === 2 || pm === 8) && py >= 1987) genLocal(py);
    breakdowns();
    accidents();
    routeSatisfaction();
    // 同业及国铁过轨收入
    const feeIn = trackFeeIncome(y);
    S.month.maint = maint + (S.month.ovhCost||0); S.month.trackMaint = tm; S.month.interest = interest; S.month.feeIn = feeIn;
    S.cash += feeIn - maint - tm - interest;
    ensureT4(); ensureT5(); ensureT6(); depotsMonth(y); usedMonth(y, pm); usedMarketMonth(y); supersMonth(y); franchMonth(y); overseasMonth(y); rivalsMonth(y); warsMonth(y); raidMonth(y); govMonth();
    cityGrowth(y);
    const m = S.month;
    const rev = m.pax + m.freight + m.feeIn + (m.contract||0) + (m.biz||0) + (m.rent||0) + (m.subsidy||0) + (m.overseas||0);
    if (pm % 3 === 0 && py >= 1986) genContracts(py);
    S.offers = (S.offers||[]).filter(o => o.expire > S.day);
    S.rep += (50 - S.rep) * 0.012;
    const rdSpend = rdMonth(py, rev - m.feeIn); S.cash -= rdSpend; m.rd = rdSpend;
    const opex = m.run + m.fees + (m.frFee||0) + m.maint + m.trackMaint + m.interest + (m.staff||0) + m.rd + (m.jvRefund||0);
    const H = { y:py, m:pm, overseas:m.overseas||0, staff:m.staff||0, rd:m.rd||0, biz:m.biz||0, rent:m.rent||0, subsidy:m.subsidy||0, contract:m.contract||0, rep:S.rep, price:S.ipo ? S.ipo.price : 0, pax:m.pax, freight:m.freight, feeIn:m.feeIn, run:m.run, fees:m.fees, maint:m.maint, trackMaint:m.trackMaint, interest:m.interest,
      rev, opex, net: rev - opex, frFee:m.frFee||0, capex: m.build + m.buy - m.sell, cash0:S.cash0 === undefined ? null : S.cash0, cash:S.cash, debt:S.debt, worth:0, paxN:m.paxN, tons:m.tons, lit:Object.keys(S.lit).length, trips:m.trips, cargo:Object.assign({}, m.cargo) };
    S.history.push(H);
    stockMonth();   // 股价用包含本月在内的完整已入账利润
    S.routes.forEach(r => { r.yRev = (r.yRev||0) + (r.lastRev||0); r.yCost = (r.yCost||0) + (r.lastCost||0); });
    if (pm === 12) annualReport(py);
    S.lifetime.pax += m.paxN; S.lifetime.tons += m.tons; S.lifetime.rev += rev; S.lifetime.trips += m.trips;
    if (S.history.length > 480) S.history.shift();
    // 资金检查：只借足缺口（按 100 万元取整），不超过剩余授信
    let autoLoan = 0;
    if (S.cash < 0) {
      const need = Math.ceil(-S.cash / 1e6) * 1e6, room = Math.max(0, creditLimit() - S.debt), amt = Math.min(need, Math.floor(room / 1e6) * 1e6);
      if (amt > 0) { autoLoan = amt; S.debt += amt; S.cash += amt; m.fin.loanIn = (m.fin.loanIn || 0) + amt; log('自动贷款', `现金不足，自动向银行借款 ${fmtW(amt)}元。`, 'warn'); }
      if (S.cash < 0) { S.negMonths++; log('资金预警', `公司现金为负且授信额度已用尽（第 ${S.negMonths}/3 个月）。请出售资产或削减开支！`, 'bad'); if (S.negMonths >= 3) { S.over = true; pendingPopups.push({ type:'over' }); } }
      else S.negMonths = 0;
    } else S.negMonths = 0;
    // 月报记录派息与自动融资之后的期末余额，并保留现金流桥接
    H.fin = Object.assign({}, m.fin); H.cash = S.cash; H.debt = S.debt; H.worth = netWorth(); S.cash0 = S.cash;
    if (pm === 12 && S.reports && S.reports.length && S.reports[S.reports.length - 1].y === py) { const R = S.reports[S.reports.length - 1]; R.cash = S.cash; R.debt = S.debt; R.worth = H.worth; if (R.fin && autoLoan) R.fin.loanIn = (R.fin.loanIn || 0) + autoLoan; }
    S.month = blankMonth();
    // 新年
    const t = ym(S.day);
    if (S.imports.y !== t.y) { S.imports = { y:t.y, n:0 }; newYearModels(t.y); }
    applyPolicies(false);
    applyStateEvents();
    logEvents();
    checkAchievements();
    checkScenario(py);
    if (t.y === 2021 && t.m === 1 && !S.achievements.end && !simulating) { S.achievements.end = true; const sc = recordFree(); pendingPopups.push({ type:'end', score:sc }); }
  }
  let autoSaveErr = null, autoSaveAt = 0, pendingAutoSave = null;
  function cloneSaveState(value){
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(cloneSaveState);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneSaveState(item)]));
  }
  function autoSave(defer = false){
    if (simulating) return;
    if (!defer){ commitAutoSave(S, saveMeta); return; }
    // 在原来的存档时点保留结算快照；空闲回调期间游戏可能已走到下一个日结。
    S.saveVer = SAVE_VER;
    const alreadyScheduled = pendingAutoSave?.source === S;
    pendingAutoSave = { source:S, state:typeof structuredClone === 'function' ? structuredClone(S) : cloneSaveState(S), meta:saveMeta() };
    if (alreadyScheduled) return;
    const source = S;
    const flush = () => { if (pendingAutoSave?.source === source) flushAutoSave(); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(flush, { timeout:900 });
    else setTimeout(flush, 0);
  }
  function flushAutoSave(){
    const snapshot = pendingAutoSave;
    pendingAutoSave = null;
    if (!snapshot || snapshot.source !== S) return;
    commitAutoSave(snapshot.state, () => snapshot.meta);
  }
  function commitAutoSave(state, meta){
    state.saveVer = SAVE_VER;
    try {
      writeSave('auto', state, meta);
      autoSaveErr = null;
      autoSaveAt = Date.now();
    } catch(e) { autoSaveErr = '浏览器存储空间不足或不可用，自动存档失败'; }
  }
  if (typeof window !== 'undefined') window.addEventListener?.('pagehide', flushAutoSave);
  function cityGrowth(y){
    S.boost = S.boost || {}; S.cityLv = S.cityLv || {};
    cities.forEach(c => {
      const tr = (S.cityTrips || {})[c.i] || 0;
      if (tr > 0) S.boost[c.i] = Math.min(0.5, (S.boost[c.i]||0) + 0.0008 * Math.min(1.5, tr / 120) * (c.tier > 1 ? 1.3 : 1));
      const lv = cityLevel(popOf(c, y)); const old = S.cityLv[c.i];
      if (old === undefined) S.cityLv[c.i] = lv;
      else if (lv > old){ S.cityLv[c.i] = lv; if (tr > 0) log('城市升级 · ' + c.name, `${c.name} 城区人口达到 ${Math.round(popOf(c,y))} 万，升级为「${CITY_LEVELS[lv][1]}」。铁路带来的人流物流功不可没。`, 'good'); }
    });
  }
  function logEvents(){
    const t = ym(S.day); S.evSeen = S.evSeen || {};
    activeEvents(t.y, t.m).forEach(ev => { if (S.evSeen[ev.id]) return; S.evSeen[ev.id] = 1; log('时事 · ' + ev.title, ev.text, ev.block ? 'bad' : 'info'); if (ev.block) pendingPopups.push({ type:'event', ev }); });
  }
  function annualReport(y){
    const H = S.history.filter(h => h.y === y); if (!H.length) return;
    const sum = k => H.reduce((a,h) => a + (h[k]||0), 0);
    const cargo = {}; H.forEach(h => Object.entries(h.cargo||{}).forEach(([g,v]) => cargo[g] = (cargo[g]||0) + v));
    const nat = nationalOf(y);
    const routes = S.routes.map(r => ({ name:r.name, rev:r.yRev||0, net:(r.yRev||0) - (r.yCost||0) })).sort((a,b) => b.net - a.net);
    S.routes.forEach(r => { r.yRev = 0; r.yCost = 0; });
    const rep = { y, rev:sum('rev'), pax:sum('pax'), freight:sum('freight'), feeIn:sum('feeIn'), staff:sum('staff'), rd:sum('rd'), contract:sum('contract'), biz:sum('biz'), overseas:sum('overseas'), rent:sum('rent'), subsidy:sum('subsidy'), land:landValue(), opex:sum('opex'), net:sum('net'), run:sum('run'), fees:sum('fees'), maint:sum('maint'), trackMaint:sum('trackMaint'), interest:sum('interest'),
      capex:sum('capex'), paxN:sum('paxN'), tons:sum('tons'), cargo, routes, lit:Object.keys(S.lit).length, worth:netWorth(), cash:S.cash, debt:S.debt,
      paxShare: sum('paxN') / (nat[0] * 1e8), tonShare: sum('tons') / (nat[1] * 1e8), trains:S.trains.length,
      km: S.tracks.filter(t => t.owner==='P' && t.status==='ok').reduce((a,t) => a + edges[t.e].dist, 0), rep:S.rep, sat:S.satAvg, mcap:marketCap(), price:S.ipo ? S.ipo.price : 0, bonds:(S.bonds||[]).reduce((a,b)=>a+b.amt,0), nContracts:(S.contracts||[]).length };
    rep.cashPreDiv = S.cash; rep.div = payDividend(rep.net); rep.cash = S.cash; rep.frFee = sum('frFee');
    const fin = {}; H.forEach(h => Object.entries(h.fin || {}).forEach(([k, v]) => fin[k] = (fin[k] || 0) + v)); Object.entries(S.month.fin || {}).forEach(([k, v]) => fin[k] = (fin[k] || 0) + v); rep.fin = fin;
    S.reports = S.reports || []; S.reports.push(rep);
    log(`${y} 年度报告`, `全年营收 ${fmtW(rep.rev)}元，净利润 ${fmtW(rep.net)}元，客运 ${(rep.paxN/1e4).toFixed(0)} 万人次，货运 ${(rep.tons/1e4).toFixed(0)} 万吨。`, 'info');
    pendingPopups.push({ type:'report', rep });
  }
  function trackFeeIncome(y){
    let total = 0;
    const own = S.tracks.filter(t => t.owner === 'P' && t.status === 'ok');
    const trackCount = new Map();
    own.forEach(t => trackCount.set(t.e, (trackCount.get(t.e) || 0) + 1));
    own.forEach(tr => {
      const e = edges[tr.e];
      // 走廊的背景过轨车流由已通车的自有线路分担。
      const era = 1 + (y - 1985) * 0.05, elas = Math.pow(S.feeMul, -0.8) / trackCount.get(e.i);
      const rate = feeRate(Object.assign({}, tr, { owner:'X' }), 'pax', y) / 1.15 * S.feeMul;
      const rv = {}; let trains = 0;
      S.rivals.forEach(r => { if (!r.active) return;
        const touch = S.tracks.some(x => x.owner===r.id && x.status==='ok' && (edges[x.e].a===e.a || edges[x.e].b===e.a || edges[x.e].a===e.b || edges[x.e].b===e.b));
        if (touch) rv[r.id] = 30 * era * elas; });
      const stateSame = S.tracks.filter(x => x.owner==='S' && x.e===e.i && x.status==='ok');
      const stateBest = stateSame.reduce((m,x) => Math.max(m, x.v), 0);
      // 国铁及货主过轨：只有两端都接入路网时才有整列过轨，一端接入减半
      const linked = c => adj[c].some(x => x.i !== e.i && S.tracks.some(q => q.e === x.i && q.status === 'ok'));
      const conn = (linked(e.a) ? 0.5 : 0) + (linked(e.b) ? 0.5 : 0);
      if (!stateSame.length) trains += 60 * conn;
      else if (tr.v > stateBest) trains += 25 * (tr.v / stateBest);
      trains *= era * elas;
      let all = trains + Object.values(rv).reduce((a, v) => a + v, 0);
      // 受通过能力限制：扣除本公司列车占用后的剩余时隙
      const tu = trackUtil[tr.id]; const room = Math.max(0, (capOf(tr) * 0.9 - (tu ? tu.own : 0)) * 30);
      const k = all > room ? room / all : 1; all *= k;
      tr.usage = all;
      total += trains * k * e.dist * rate;
      // 同业列车过轨费由对方实际支付
      Object.entries(rv).forEach(([id, n]) => { const r = S.rivals.find(x => x.id === id); const fee = n * k * e.dist * rate; r.cash -= fee; r.feePaid = (r.feePaid || 0) + fee; total += fee; });
    });
    return total;
  }
  function rivalsMonth(y){
    S.rivals.forEach(r => {
      if (!r.active) return;
      const def = RIVALS.find(x => x.id===r.id);
      const own = S.tracks.filter(x => x.owner===r.id);
      const km = own.filter(x => x.status === 'ok').reduce((s,x) => s + edges[x.e].dist, 0);   // 在建线路不产生经营收入
      r.cash += (km * 650 * (1 + (y-1985)*0.04) + 1e6) * cpi(y);
      // 玩家支付的过轨费已在列车每趟运行时逐笔记入对方现金（r.feeIn）
      // 建设贷款：按月付息并还本 2%
      if (r.debt > 0) { const it = r.debt * rate(y) / 12, pr = Math.min(r.debt, r.debt * 0.02); r.cash -= it + pr; r.debt -= pr; if (r.debt < 1) r.debt = 0; }
      const planning = rivalPlanMonth(r, def, y);
      maybeWar(r, def, y);
      if (!planning && Math.random() < 0.12 * S.mods.rivalAggro) {
        const pEdges = playerRouteEdges();
        // 选择候选走廊
        const nodes = new Set([cityIdx[def.home]]); own.forEach(x => { nodes.add(edges[x.e].a); nodes.add(edges[x.e].b); });
        const cands = [];
        nodes.forEach(n => adj[n].forEach(e => { if (e.sup || e.abroad || e.xb) return;
          if (S.tracks.some(x => x.e===e.i && x.owner===r.id)) return;
          const g = popOf(cities[e.a], y) * popOf(cities[e.b], y) / e.dist;
          const hasP = S.tracks.some(x => x.e===e.i && x.owner==='P');
          const hasS = S.tracks.some(x => x.e===e.i && x.owner==='S');
          const s = g * (hasP ? 0.4 : 1) * (hasS ? 0.5 : 1.6) * (pEdges.has(e.i) && !hasP ? 2.2 : 1) / e.terrain * (0.6 + Math.random()*0.8);
          cands.push({ e, s });
        }));
        cands.sort((a,b) => b.s - a.s);
        const pick = cands[0];
        if (pick) {
          const cls = S.unlock.P11 ? 3 : S.unlock.P9 ? 2 : S.unlock.P5 ? 1 : 0;
          const useCls = (cls >= 2 && Math.random() < 0.5) ? cls : Math.min(cls, 1);
          const C = TRACK_CLASSES[useCls];
          const cost = pick.e.dist * (C.cost + ELEC_COST) * 1e4 * pick.e.terrain * cpi(y) * 0.8;
          if (r.cash > cost * 0.5) {
            r.plan = { e:pick.e.i, cls:useCls, cost, at:S.day + 90 };
            const mine = pEdges.has(pick.e.i);
            log('情报 · ' + def.name, `据悉，${def.name} 计划约 3 个月后开工修建 ${cities[pick.e.a].name}—${cities[pick.e.b].name}（${C.name}）。${mine ? '这段正是你列车经过的走廊，使用对方线路时需交过轨费。' : ''}若你抢先开工修建同用途线路，对方计划将落空。`, mine ? 'bad' : 'rival');
            if (mine) pendingPopups.push({ type:'intel', rid:r.id, name:def.name, e:pick.e.i, cls:useCls });
          }
        }
      }
      r.value = r.cash - (r.debt || 0) + own.reduce((s,x) => s + (x.cost||0) * 0.85, 0);
    });
  }
  function buildMonths(e, cls){ return Math.max(cls >= 2 ? 12 : 4, Math.ceil(e.dist / 80 * Math.sqrt(e.terrain) * (1 + cls*0.5)) + 3); }

  // ---------- 财务 ----------
  function trainValue(t){ return t.price * trainDepreciation(t); }
  function carDepotValue(){ return Object.values(depotCars()).reduce((sum, car) => sum + car.value, 0); }
  function trackValue(tr){ const age = (S.day - (tr.built||0))/365; return (tr.cost||0) * Math.pow(0.975, age); }
  function assets(){ return S.trains.reduce((s,t) => s + trainValue(t), 0) + carDepotValue() + S.tracks.filter(t => t.owner==='P').reduce((s,t) => s + trackValue(t), 0) + Object.values(S.stations||{}).reduce((s,x) => s + stationValue(x), 0) + landValue() + Object.values(S.bizCost||{}).reduce((s,x) => s + x * 0.6, 0); }
  // —— 二手车：同业求购 ——
  function usedMonth(y, pm){ S.usedOffers = (S.usedOffers || []).filter(o => o.expire > S.day && S.trains.some(t => t.id === o.tid));
    if (pm % 2 !== 0 || S.usedOffers.length >= 3) return;
    const pool = S.trains.filter(t => t.status !== 'delivery' && !S.usedOffers.some(o => o.tid === t.id) && (eraOf(t) === 'ended' || eraOf(t) === 'obsolete' || !t.route));
    if (!pool.length || Math.random() > 0.55) return;
    const t = pool[Math.floor(Math.random() * pool.length)]; const val = trainValue(t);
    const buyers = S.rivals.filter(r => r.active && !r.acquired && r.cash > val * 1.5); if (!buyers.length) return;
    const r = buyers[Math.floor(Math.random() * buyers.length)];
    const price = Math.round(val * (0.95 + Math.random() * 0.25) / 1e4) * 1e4;
    S.usedOffers.push({ id:S.nid++, tid:t.id, rid:r.id, price, expire:S.day + 60 });
    log('同业求购 · ' + rivalDef(r.id).name, `${rivalDef(r.id).name}希望以 ${fmtW(price)}元收购你的 ${t.name}（${trainById[t.model].name}），比二手市场多 ${fmtW(Math.max(0, price - sellQuote(t)))}元。60 天内有效，可在「车队」页处理。`, 'rival'); }
  function acceptUsed(id){ const o = (S.usedOffers || []).find(x => x.id === id); if (!o) return { ok:false, msg:'报价已失效' };
    const i = S.trains.findIndex(t => t.id === o.tid); const r = S.rivals.find(x => x.id === o.rid);
    const drop = msg => { S.usedOffers = S.usedOffers.filter(x => x !== o); return { ok:false, msg }; };
    if (i < 0 || !r || !r.active || r.acquired) return drop('报价已失效');
    if (o.expire <= S.day) return drop('报价已过期');
    if (r.cash < o.price) return drop(`${rivalDef(r.id).name}资金不足，已撤回报价`);
    const t = S.trains[i]; S.cash += o.price; S.month.sell += o.price; r.cash -= o.price; S.trains.splice(i, 1); S.usedOffers = S.usedOffers.filter(x => x !== o);
    log('出售给同业', `${t.name} 以 ${fmtW(o.price)}元转让给${rivalDef(o.rid).name}。`, 'info'); recompute(); return { ok:true, price:o.price }; }
  function declineUsed(id){ S.usedOffers = (S.usedOffers || []).filter(x => x.id !== id); }
  function newYearModels(y){ const nw = TRAINS.filter(m => m.year === y && !m.research && !m.own).map(m => m.id);
    const ownIds = new Set(S.trains.map(t => t.model)); const ended = TRAINS.filter(m => m.end === y - 1 && ownIds.has(m.id) && !isRetained(m)).map(m => m.id);
    const obs = TRAINS.filter(m => m.end + 8 === y - 1 && ownIds.has(m.id)).map(m => m.id);
    if (nw.length) log('新车上市', `${y} 年新车型上市：${nw.map(id => trainById[id].name).join('、')}。可在「购车」页查看。`, 'info');
    if (nw.length || ended.length || obs.length) pendingPopups.push({ type:'newModels', y, nw, ended, obs }); }
  // —— 换代保证：同级别接班车型 ——
  function succClass(m){ const tr = (m.type === 'steam' || m.type === 'diesel') ? 'd' : m.type === 'electric' ? 'e' : 'u';
    if (tr === 'u') return 'emu-' + (m.vmax <= 200 ? 'L' : m.vmax < 300 ? 'M' : 'H'); return m.use + '-' + tr; }
  const CLASS_NAME = { 'pax-d':'客运内燃/氢能机车', 'freight-d':'货运内燃/氢能机车', 'pax-e':'客运电力机车', 'freight-e':'货运电力机车', 'emu-L':'城际动车组（≤200 km/h）', 'emu-M':'250 级动车组', 'emu-H':'300 级以上高速动车组' };
  const FAR_END = 2090;   // end ≥ 2090 视为“长期在产”
  function buyable(m){ return !m.research || !!(S && S.rd && S.rd.done && S.rd.done[m.research]); }
  function endingSoon(m, y){ y = y || ym(S.day).y; return !isRetained(m) && m.end < FAR_END && y >= m.year && y <= m.end && m.end - y <= 2; }
  function succScore(m){ return m.use === 'freight' ? m.cap * 10 + m.vmax : m.vmax * 10 + m.cap / 100; }
  // 推荐替代车型：同级别、比它晚停产；优先当前在售、国产（或已国产化）、性能最好的
  function successorOf(m, y){ y = y || ym(S.day).y; const c = succClass(m);
    const c1 = TRAINS.filter(x => x !== m && buyable(x) && (!m.plateau || (x.plateau && supportsUse(x, m.use))) && succClass(x) === c && x.end > m.end && x.year <= Math.max(y, m.end) + 1);
    if (!c1.length) return null;
    const now = c1.filter(x => x.year <= y && y <= x.end); const pool = now.length ? now : c1;
    pool.sort((a, b) => ((isImp(a) ? 1 : 0) - (isImp(b) ? 1 : 0)) || (succScore(b) - succScore(a)) || (a.year - b.year));
    return pool[0]; }
  function nextTrainNames(model, count){
    S.serial = S.serial || {};
    const id = model.id, pre = `${model.en.split(' ').pop()}-`, owned = S.trains.filter(t => t.model === id);
    const last = owned.reduce((n, t) => {
      const serial = t.name.startsWith(pre) && /^(\d+)$/.exec(t.name.slice(pre.length));
      return serial ? Math.max(n, +serial[1]) : n;
    }, Math.max(S.serial[id] || 0, owned.length));
    S.serial[id] = last + count;
    return Array.from({ length:count }, (_, i) => pre + String(last + i + 1).padStart(3, '0'));
  }

  // —— 二手车市场：从国铁和同业购买旧车（停产车型也能买到） ——
  const USED_MAX = 6;
  function usedPool(y){ return TRAINS.filter(m => !m.research && !m.design && y >= m.year + 3 && y <= m.end + 15); }
  function priceAt(p, year, y){ return p * 1e4 * (cpi(y) / cpi(Math.max(1985, year))); }
  function consistAt(m, yy){ if (isUnit(m)) return [];
    const kind = m.use; const ok = c => c.kind === kind && yy >= c.year && yy <= c.end && !c.imported;
    let av = CARS.filter(c => ok(c) && (kind === 'freight' ? /件杂货|煤炭/.test(c.cargo) : /^YZ/.test(c.id))); if (!av.length) av = CARS.filter(ok);
    av.sort((a, b) => b.year - a.year); const c = av[0]; if (!c) return [];
    const per = c.tare + (kind === 'pax' ? c.seats * 0.08 : c.load);
    return [{ id:c.id, n:Math.max(1, Math.min(kind === 'pax' ? 16 : 50, Math.floor(trailLimit(m) / per))) }]; }
  function sellerName(s){ if (s === 'S') return '国家铁路'; const d = RIVALS.find(r => r.id === s); return d ? d.name : '同业公司'; }
  function usedMarketMonth(y){ S.usedMarket = (S.usedMarket || []).filter(o => o.expire > S.day && trainById[o.model]);
    const pool = usedPool(y); if (!pool.length) return;
    let add = S.usedMarket.length < 2 ? 2 : (Math.random() < 0.5 ? 1 : 0);
    while (add-- > 0 && S.usedMarket.length < USED_MAX){
      const w = pool.map(m => { const e = modelEra(m, y); return (e === 'ended' ? 2.4 : e === 'obsolete' ? 1.4 : 1) * (successorOf(m, y) && available(successorOf(m, y)) ? 1 : 1.6); });
      let r = Math.random() * w.reduce((a, b) => a + b, 0), k = 0; while (k < pool.length - 1 && (r -= w[k]) > 0) k++;
      const m = pool[k]; if (S.usedMarket.some(o => o.model === m.id)) continue;
      const maxAge = Math.max(3, Math.min(28, y - m.year)); const age = 3 + Math.floor(Math.random() * (maxAge - 2));
      const so = Math.round(Math.random() * Math.min(age, 5) * 10) / 10;
      const sellers = ['S'].concat(S.rivals.filter(x => x.active && !x.acquired).map(x => x.id)); const seller = sellers[Math.floor(Math.random() * sellers.length)];
      const cars = consistAt(m, Math.min(y, m.end));
      const newP = priceAt(m.price, m.year, y) + cars.reduce((a, x) => { const c = carById[x.id]; return a + priceAt(c.price, c.year, y) * x.n; }, 0);
      const k2 = { new:0.95, active:0.9, ended:0.8, obsolete:0.65 }[modelEra(m, y)];
      const price = Math.max(1e4, Math.round(newP * Math.pow(0.93, age) * k2 * (1 - 0.03 * so) * (0.85 + Math.random() * 0.25) / 1e4) * 1e4);
      S.usedMarket.push({ id:S.nid++, model:m.id, age, so, seller, cars, price, newP, expire:S.day + 90 });
    } }
  function buyUsed(id, routeId){ const o = (S.usedMarket || []).find(x => x.id === id); if (!o) return { ok:false, msg:'该车已被别家买走' };
    if (o.expire <= S.day) { S.usedMarket = S.usedMarket.filter(x => x !== o); return { ok:false, msg:'挂牌已过期' }; }
    const m = trainById[o.model]; if (!m) return { ok:false, msg:'车型数据缺失' };
    if (S.cash < o.price) return { ok:false, msg:'现金不足' };
    S.cash -= o.price; S.month.buy += o.price;
    if (o.seller !== 'S') { const r = S.rivals.find(x => x.id === o.seller); if (r) r.cash += o.price; }
    const t = { id:S.nid++, model:m.id, name:nextTrainNames(m, 1)[0], route:routeId || null, status:'delivery', arrive:S.day + 15, bought:S.day - o.age * 365, ovh:S.day - o.so * 365,
      price:o.price / Math.pow(0.93, o.age), year:ym(S.day).y, phase:0, dir:0, cars:(o.cars || []).filter(x => carById[x.id]).map(x => ({ id:x.id, n:x.n })), used:true };
    S.trains.push(t); S.usedMarket = S.usedMarket.filter(x => x !== o);
    log('购入二手车', `从${sellerName(o.seller)}购入 ${m.name}（车龄 ${o.age} 年），${fmtW(o.price)}元，约 15 天后交付。`, 'info');
    recompute(); return { ok:true, train:t }; }

  // —— 自主设计：用研发点打造本公司车型 ——
  const PLATFORMS = [
    { id:'pe', name:'客运电力机车平台', cls:'pax-e', type:'electric', use:'pax', img:'OWN_PE', pts:700, vcap:220, code:'K' },
    { id:'fe', name:'重载电力机车平台', cls:'freight-e', type:'electric', use:'freight', img:'OWN_FE', pts:800, vcap:160, code:'H' },
    { id:'pd', name:'客运内燃/氢能机车平台', cls:'pax-d', type:'diesel', use:'pax', img:'OWN_PD', pts:600, vcap:200, code:'N' },
    { id:'fd', name:'货运内燃/氢能机车平台', cls:'freight-d', type:'diesel', use:'freight', img:'OWN_FD', pts:700, vcap:140, code:'NH' },
    { id:'el', name:'城际动车组平台', cls:'emu-L', type:'emu', use:'pax', img:'OWN_EL', pts:1200, vcap:200, code:'C' },
    { id:'eh', name:'高速动车组平台', cls:'emu-H', type:'emu', use:'pax', img:'OWN_EH', pts:2400, vcap:400, code:'G' },
  ];
  const DESIGN_MAX = 12;
  function designUnlock(){ const y = ym(S.day).y, rd = rdState(); if (y >= 2015) return ''; if (OWN_MODELS.some(o => rd.done[o.id])) return y >= 2005 ? '' : '2005 年起开放自主设计';
    return '完成任一款自主车型研制（或到 2015 年）后解锁'; }
  function designBase(p){ const y = ym(S.day).y;
    const all = TRAINS.filter(m => succClass(m) === p.cls && m.type !== 'steam' && buyable(m) && m.year <= y); if (!all.length) return null;
    const now = all.filter(m => y <= m.end); const pool = now.length ? now : all;
    return pool.slice().sort((a, b) => ((isImp(a) ? 1 : 0) - (isImp(b) ? 1 : 0)) || (succScore(b) - succScore(a)))[0]; }   // 优先国产（含已国产化）车型
  function designQuote(pid, o){ const p = PLATFORMS.find(x => x.id === pid); if (!p) return null; const base = designBase(p); if (!base) return null;
    o = o || {}; const sp = clamp(o.sp | 0, 0, 2), cp = clamp(o.cap | 0, 0, 2), ec = clamp(o.eco | 0, 0, 2), T = sp + cp + ec; const y = ym(S.day).y;
    const vmax = Math.max(base.vmax, Math.min(p.vcap, Math.round(base.vmax * (1 + 0.1 * sp) / 10) * 10));
    const cap = p.use === 'freight' || isUnit(base) ? Math.round(base.cap * (1 + 0.1 * cp)) : Math.round(base.cap * (1 + 0.1 * cp));
    const power = Math.round(base.power * (1 + 0.08 * sp + (p.use === 'pax' && !isUnit(base) ? 0.1 : 0.05) * cp) / 10) * 10;
    const run = Math.round(base.run * (1 - 0.1 * ec) * 10) / 10;
    const price = Math.round(base.price * (cpi(y) / cpi(Math.max(1985, base.year))) * (1 + 0.05 * T) * 0.92);
    const pts = Math.round(p.pts * (1 + 0.45 * T) * (y >= 2030 ? 1.25 : 1));
    return { p, base, sp, cp, ec, T, vmax, cap, power, run, price, pts, spMax: base.vmax >= p.vcap };
  }
  function designName(p){ const pool = { pe:['驰风','逐日','长风'], fe:['重骥','泰岳','砥柱'], pd:['神骏','追云','远驰'], fd:['犇牛','擎岳','巨犀'], el:['飞燕','星河','晨曦'], eh:['飞鸿','苍穹','长虹'] }[p.id] || ['新星'];
    const n = (rdState().designs || []).filter(d => d.platform === p.id).length; return '华夏·' + pool[n % pool.length] + (n >= pool.length ? Math.floor(n / pool.length) + 1 : ''); }
  function createDesign(pid, o, name){ const rd = rdState(); const why = designUnlock(); if (why) return { ok:false, msg:why };
    const q = designQuote(pid, o); if (!q) return { ok:false, msg:'该平台暂时没有可参考的车型' };
    rd.designs = rd.designs || []; if (rd.designs.length >= DESIGN_MAX) return { ok:false, msg:`最多保留 ${DESIGN_MAX} 款自主设计` };
    if (rd.designs.filter(d => !rd.done[d.research]).length >= 3) return { ok:false, msg:'同时最多 3 个设计方案在研' };
    const y = ym(S.day).y; const p = q.p, base = q.base;
    name = String(name || '').replace(/[<>&"'`]/g, '').trim().slice(0, 14) || designName(p);
    const n = rd.dzN = (rd.dzN || 0) + 1; const key = 'dz_' + n, id = 'DZ' + n;
    let en = `HX-${p.code}${p.use === 'freight' ? Math.round(q.cap / 1000) : q.vmax}`; if (TRAINS.some(m => m.en === en)) en += '-' + n;
    const art = Object.assign({}, base.art || {}, { num:en });
    const d = { id, name, en, country:'中国', flag:'CN', maker:S.company + '（自主设计）', year:y, end:2099, type:p.type, use:p.use, design:true, research:key, platform:p.id, img:p.img,
      vmax:q.vmax, power:q.power, cap:q.cap, price:q.price, run:q.run, weight:base.weight || '—', axle:base.axle || '—', rdPts:q.pts, baseId:base.id, spec:{ sp:q.sp, cap:q.cp, eco:q.ec },
      note:`本公司在「${base.name}」基础上自主设计的${p.name.replace('平台', '')}${q.T ? `（${[q.sp ? '提速 ' + q.sp * 10 + '%' : '', q.cp ? (p.use === 'freight' ? '牵引' : '载客') + ' +' + q.cp * 10 + '%' : '', q.ec ? '能耗 −' + q.ec * 10 + '%' : ''].filter(Boolean).join('，')}）` : ''}。`, art };
    if (base.comfort || isUnit(base)) d.comfort = Math.round(((base.comfort || (base.year >= 1995 ? 1.3 : 1.15)) + 0.05 * q.cp) * 100) / 100;
    if (base.tilt) d.tilt = true; if (base.plateau) d.plateau = true; if (base.fuel) d.fuel = base.fuel;
    rd.designs.push(d); registerDesigns(S);
    if (!rd.cur) startProject(key);
    log('自主设计立项', `「${name}」（${en}）设计方案立项，需要 ${q.pts} 研发点。`, 'info');
    return { ok:true, model:d }; }
  function cancelDesign(key){ const rd = rdState(); const d = (rd.designs || []).find(x => x.research === key); if (!d || rd.done[key]) return { ok:false, msg:'无法撤销' };
    rd.designs = rd.designs.filter(x => x !== d); if (rd.cur === key) { rd.cur = null; rd.pts = 0; } if (rd.prog) delete rd.prog[key]; registerDesigns(S); return { ok:true }; }
  // 把存档里的自主设计登记进车型目录（读档、新局、回滚时调用）
  function registerDesigns(st){
    for (let i = TRAINS.length - 1; i >= 0; i--) if (TRAINS[i].design) { delete trainById[TRAINS[i].id]; TRAINS.splice(i, 1); }
    const ds = st && st.rd && Array.isArray(st.rd.designs) ? st.rd.designs : [];
    ds.forEach(d => { if (d && typeof d.id === 'string' && /^DZ\d+$/.test(d.id) && !trainById[d.id] && fin(d.vmax) && fin(d.price) && fin(d.cap) && fin(d.power) && fin(d.run)) { d.design = true; TRAINS.push(d); trainById[d.id] = d; } }); }
  function overseasValue(){ return (S.overseas || []).reduce((a, x) => a + (x.st === 'build' ? x.paid : x.st === 'run' ? x.cost * Math.max(0, (x.until - S.day) / (20 * 365)) : 0), 0); }
  function netWorth(){ return S.cash - S.debt - (S.bonds||[]).reduce((a,b) => a + b.amt, 0) + assets() + overseasValue(); }
  function creditLimit(){ const y = ym(S.day).y; return ((1.0e8 * cpi(y) * S.mods.credit) + assets() * 0.45) * repMul(); }
  const finAdd = (k, v) => { const f = S.month.fin || (S.month.fin = {}); f[k] = (f[k] || 0) + v; };
  function borrow(amt){ amt = Math.min(amt, creditLimit() - S.debt); if (amt <= 0) return false; S.debt += amt; S.cash += amt; finAdd('loanIn', amt); return true; }
  function repay(amt){ amt = Math.min(amt, S.debt, Math.max(0, S.cash)); if (amt <= 0) return false; S.debt -= amt; S.cash -= amt; finAdd('loanOut', amt); return true; }

  // ---------- 玩家操作 ----------
  function buildQuote(e, cls, elec){
    const y = ym(S.day).y; const C = TRACK_CLASSES[cls];
    if (cls >= 2) elec = true;
    let unit = C.cost + (elec ? ELEC_COST : 0);
    let sub = S.mods.buildSubsidy + (e.west ? S.mods.westSubsidy : 0) + (cls >= 2 ? S.mods.hsrSubsidy : 0);
    if (e.abroad || e.xb) sub = (S.mods.abroadSubsidy || 0) + (e.xb ? S.mods.buildSubsidy * 0.5 : 0);   // 境外段不享受国内补贴
    sub = Math.min(0.45, sub) + jvSub(e);
    const gross = e.dist * unit * 1e4 * e.terrain * cpi(y) * (1 - 0.03 * exLv('ce'));
    return { cost: gross * (1 - sub), gross, sub, months: buildMonths(e, cls), elec, v:C.v, unit: unit*e.terrain*cpi(y)*(1-sub) };
  }
  function canBuildClass(cls){ return !!S.unlock[TRACK_CLASSES[cls].unlock]; }
  function buildTrackBlock(e, cls){
    if (!e) return '找不到该走廊';
    if (e.sup && !S.tracks.some(t => t.e === e.i && t.status === 'ok')) return '超级工程通车后可增建并行线路';
    if (edgeLock(e)) return lockText(e);
    const v = TRACK_CLASSES[cls].v;
    if (ownTrackFor(e.i, v)) return `该区段已建或在建自有${isHighSpeed(v) ? '高速客运专线' : '客货共用线'}`;
    return '';
  }
  function buildTrack(eid, cls, elec){
    const e = edges[eid]; const msg = buildTrackBlock(e, cls);
    if (msg) return { ok:false, msg };
    if (!canBuildClass(cls)) return { ok:false, msg:'该等级尚未获得政策许可' };
    const q = buildQuote(e, cls, elec);
    if (S.cash < q.cost) return { ok:false, msg:'现金不足' };
    S.cash -= q.cost; S.month.build += q.cost;
    S.tracks.push({ id:S.nid++, e:eid, owner:'P', v:q.v, elec:q.elec, status:'build', done:S.day + q.months*30, cost:q.cost, built:S.day });
    { const j = (S.jv || []).find(o => o.gi === e.grp); if (j) j.paid = (j.paid || 0) + q.gross * j.sub; }
    log('开工建设', `${cities[e.a].name}—${cities[e.b].name} ${e.dist} km，${TRACK_CLASSES[cls].name}，投资 ${fmtW(q.cost)}元，工期 ${q.months} 个月。`, 'info');
    recompute();
    return { ok:true };
  }
  // 整段修建：一次性补齐走廊上缺少所选用途线路的区段
  function groupQuote(gi, cls, elec){
    const g = groups[gi]; const v = TRACK_CLASSES[cls].v;
    const segs = g.edges.filter(i => !ownTrackFor(i, v));
    let cost = 0, months = 0, km = 0; segs.forEach(i => { const q = buildQuote(edges[i], cls, elec); cost += q.cost; months = Math.max(months, q.months); km += edges[i].dist; });
    if (segs.length > 1) months = Math.ceil(months * 1.15);
    return { segs, cost, months, km, v };
  }
  function buildGroup(gi, cls, elec){
    { const lk = groups[gi] && groups[gi].edges.map(i => edges[i]).find(edgeLock); if (lk) return { ok:false, msg:lockText(lk) }; }
    if (!canBuildClass(cls)) return { ok:false, msg:'该等级尚未获得政策许可' };
    const q = groupQuote(gi, cls, elec); if (!q.segs.length) return { ok:false, msg:'该走廊各区段均已建或在建所选用途的线路' };
    if (S.cash < q.cost) return { ok:false, msg:'现金不足' };
    if (cls >= 2) elec = true;
    { const j = (S.jv || []).find(o => o.gi === gi); if (j) q.segs.forEach(i => j.paid = (j.paid || 0) + buildQuote(edges[i], cls, elec).gross * j.sub); }
    q.segs.forEach(i => { const c = buildQuote(edges[i], cls, elec).cost; S.tracks.push({ id:S.nid++, e:i, owner:'P', v:q.v, elec:!!elec, status:'build', done:S.day + q.months*30, cost:c, built:S.day }); });
    S.cash -= q.cost; S.month.build += q.cost;
    const g = groups[gi];
    log('开工建设', `${cities[g.a].name}—${cities[g.b].name} 整段 ${q.km} km（${q.segs.length} 个区段），${TRACK_CLASSES[cls].name}，投资 ${fmtW(q.cost)}元，工期 ${q.months} 个月。`, 'info');
    recompute(); return { ok:true };
  }
  function upgradeQuote(tr, cls, elec){
    const e = edges[tr.e]; const cur = clsOfV(tr.v);
    if (cls >= 2) elec = true;
    const q = buildQuote(e, cls, elec);
    const old = buildQuote(e, cur, tr.elec);
    let cost = Math.max(0, q.cost - old.cost * 0.6);
    if (cls === cur && elec && !tr.elec) cost = e.dist * ELEC_COST * 1e4 * e.terrain * cpi(ym(S.day).y) * (1 - Math.min(0.45, S.mods.buildSubsidy));
    const months = cls === cur ? Math.max(2, Math.ceil(e.dist/200)+1) : Math.max(3, Math.ceil(q.months*0.7));
    return { cost, months, v:q.v, elec };
  }
  function upgradeTrack(trId, cls, elec){
    const tr = S.tracks.find(x => x.id===trId); if (!tr || tr.owner!=='P' || tr.status!=='ok' || tr.upg) return { ok:false, msg:'无法改造' };
    if (isHighSpeed(tr.v) !== isHighSpeed(TRACK_CLASSES[cls].v)) return { ok:false, msg:'请新建并行的高速客运专线，保留既有客货共用线' };
    if (!canBuildClass(cls)) return { ok:false, msg:'该等级尚未获得政策许可' };
    const q = upgradeQuote(tr, cls, elec);
    if (q.v < tr.v || (q.v === tr.v && q.elec === tr.elec)) return { ok:false, msg:'没有需要改造的内容' };
    if (S.cash < q.cost) return { ok:false, msg:'现金不足' };
    S.cash -= q.cost; S.month.build += q.cost; tr.cost += q.cost;
    tr.upg = { v:q.v, elec:q.elec, done:S.day + q.months*30 };
    const e = edges[tr.e];
    log('线路改造', `${cities[e.a].name}—${cities[e.b].name} 开始改造（${q.v} km/h${q.elec?'，电气化':''}），工期 ${q.months} 个月。`, 'info');
    return { ok:true };
  }
  function trainPrice(model, routeId, cars){
    const y = ym(S.day).y;
    const base = model.price * 1e4 * (cpi(y) / cpi(Math.max(1985, model.year)));
    const tariff = isImp(model) ? S.mods.tariff : 0;
    const dc = cars || defaultConsist(model, routeId); const consist = consistCost(dc);
    const locMul = localized(model) ? 0.8 : 1;
    const loco = base * locMul * (1 + tariff);
    return { total:loco + consist, loco, base, tariff, consist, dc };
  }
  function available(model){ const y = ym(S.day).y; return !!model && buyable(model) && y >= model.year && (y <= model.end || isRetained(model)); }
  const MAX_ORDER = 500;
  function quoteTrainOrder(id, { routeId = null, count = 1, service, cars } = {}){
    const model = trainById[id];
    if (!available(model)) return { ok:false, msg:'该车型当前不在售' };
    if (!Number.isInteger(count) || count < 1 || count > MAX_ORDER) return { ok:false, msg:`采购数量须为 1–${MAX_ORDER} 列` };
    if (routeId !== null && !S.routes.some(r => r.id === routeId)) return { ok:false, msg:'找不到配属线路' };
    service = service || model.use;
    cars = cars ? cars.filter(({ n }) => n !== 0) : defaultConsist(modelForUse(model, service), routeId);
    const issue = checkConsist(model, service, cars);
    if (issue) return { ok:false, msg:issue };
    const depot = { ...depotCars() }, basis = {}, loco = trainPrice(model, null, []).loco;
    let bought = 0, reused = 0, carCash = 0;
    for (const { id:carId, n } of cars){
      const supply = supplyCars(depot, carId, n * count);
      if (supply.msg) return { ok:false, msg:supply.msg };
      basis[carId] = supply.value / count;
      bought += supply.bought; reused += supply.reused; carCash += supply.cost;
    }
    const total = count * loco + carCash, imported = isImp(model);
    const quota = S.mods.importQuota < 99 && imported ? Math.max(0, S.mods.importQuota - S.imports.n) : Infinity;
    const msg = count > quota ? `本年度进口额度还剩 ${quota} 列` : '';
    return { ok:!msg && S.cash >= total, msg:msg || (S.cash < total ? '现金不足' : ''), quotaIssue:msg,
      model, count, routeId, service, cars, depot, basis, bought, reused, carCash, loco, total, imported, days:imported ? 75 : 30 };
  }
  function placeTrainOrder(q){
    S.cash -= q.total; S.month.buy += q.total; S.carDepot = q.depot;
    if (q.imported) S.imports.n += q.count;
    const price = q.loco + Object.values(q.basis).reduce((sum, value) => sum + value, 0);
    const trains = nextTrainNames(q.model, q.count).map(name => ({
      id:S.nid++, model:q.model.id, name, route:q.routeId, status:'delivery', arrive:S.day + q.days, bought:S.day, ovh:S.day,
      price, year:ym(S.day).y, phase:0, dir:0, cars:q.cars.map(({ id, n }) => ({ id, n })), carBasis:{ ...q.basis },
      ...(q.model.dualUse ? { service:q.service } : {})
    }));
    S.trains.push(...trains);
    return trains;
  }
  function buyTrains(id, options){
    const q = quoteTrainOrder(id, options); if (!q.ok) return q;
    const trains = placeTrainOrder(q);
    log('采购车辆', `订购 ${q.model.name} ${q.count} 列，合计 ${fmtW(q.total)}元，约 ${q.days} 天后交付。`, 'info');
    recompute();
    return { ok:true, train:trains[0], trains, days:q.days, total:q.total };
  }
  function buyTrain(id, routeId){ return buyTrains(id, { routeId:routeId || null }); }
  function quoteDepotTrade(id, n, sell){
    const c = carById[id];
    if (!c || !Number.isSafeInteger(n) || n < 1 || n > 1000000) return { ok:false, msg:'请输入有效的车厢数量' };
    const stock = depotCars()[id];
    if (sell && (!stock || n > stock.n)) return { ok:false, msg:'车厢库数量不足' };
    if (!sell && !carAvailable(c)) return { ok:false, msg:'该车厢当前不在售' };
    const value = sell ? stock.value * n / stock.n : carPrice(c) * n;
    const amount = sell ? Math.min(carPrice(c) * n * 0.6, value) : value;
    return { ok:sell || S.cash >= amount, msg:!sell && S.cash < amount ? '现金不足' : '', amount, value };
  }
  function tradeDepotCars(id, n, sell){
    const q = quoteDepotTrade(id, n, sell); if (!q.ok) return q;
    S.carDepot = { ...depotCars() };
    postDepot(S.carDepot, id, sell ? -n : n, sell ? -q.value : q.value);
    S.cash += sell ? q.amount : -q.amount;
    S.month[sell ? 'sell' : 'buy'] += q.amount;
    log(sell ? '出售车厢' : '购入车厢', `${carById[id].name} ${n} 辆，${sell ? '回收' : '支付'} ${fmtW(q.amount)}元。`, 'info');
    return q;
  }
  // —— 车型换代 ——
  function modelEra(m, y){ y = y || ym(S.day).y; if (y > m.end + 8) return 'obsolete'; if (y > m.end) return 'ended'; if (y - m.year <= 1) return 'new'; return 'active'; }
  const ERA = { new:{ name:'新型', fare:1, maint:1, sell:0.85 }, active:{ name:'在产', fare:1, maint:1, sell:0.8 }, ended:{ name:'已停产', fare:0.95, maint:1.15, sell:0.7 }, obsolete:{ name:'淘汰车型', fare:0.88, maint:1.35, sell:0.5 } };
  function routeKm(r){ let d = 0; for (let k = 0; k < r.stops.length - 1; k++){ const e = edgeByPair[r.stops[k] + '-' + r.stops[k+1]]; if (e) d += e.dist; } return d; }
  function isBranch(r){ if (!r || r.stops.length < 2) return false; return isTown(r.stops[0]) || isTown(r.stops[r.stops.length-1]) || routeKm(r) <= 200; }
  function eraOf(t){ return modelEra(trainById[t.model]); }
  function trainOnBranch(t){ const r = t.route && S.routes.find(x => x.id === t.route); return isBranch(r); }
  // 过时车在干线上票价打折、维修更贵；调到支线则不受影响，维修还更省
  function eraFare(t){ if (trainOnBranch(t)) return 1; return ERA[eraOf(t)].fare; }
  function eraMaint(t){ const e = eraOf(t); if (trainOnBranch(t)) return e === 'ended' || e === 'obsolete' ? 0.9 : 1; return ERA[e].maint; }
  function sellQuote(t, keepCars = false){
    const carValue = keepCars && !isUnit(trainById[t.model]) ? Object.values(attachedCarValue(t)).reduce((sum, value) => sum + value, 0) : 0;
    return Math.max(0, trainValue(t) - carValue) * ERA[eraOf(t)].sell;
  }
  function selectedTrains(ids){ const selected = new Set(ids); return S.trains.filter(t => selected.has(t.id)); }
  function quoteTrainSale(ids, keepCars = false){
    const entries = selectedTrains(ids).map(train => ({ train, amount:sellQuote(train, keepCars) }));
    const stored = keepCars ? entries.reduce((sum, { train }) => sum + (isUnit(trainById[train.model]) ? 0 : (train.cars || []).reduce((n, car) => n + car.n, 0)), 0) : 0;
    return { entries, stored, total:entries.reduce((sum, entry) => sum + entry.amount, 0) };
  }
  function removeSoldTrains(sold){
    S.trains = S.trains.filter(t => !sold.has(t.id));
    S.usedOffers = (S.usedOffers || []).filter(o => !sold.has(o.tid));
  }
  function sellTrains(ids, keepCars = false){
    const { entries, total, stored } = quoteTrainSale(ids, keepCars), count = entries.length;
    if (!count) return { ok:false, msg:'找不到待出售的列车' };
    const sold = new Set(entries.map(({ train }) => train.id));
    if (stored){
      S.carDepot = { ...depotCars() };
      for (const { train } of entries){
        if (isUnit(trainById[train.model])) continue;
        const values = attachedCarValue(train);
        for (const [id, n] of Object.entries(carCounts(train.cars))) postDepot(S.carDepot, id, n, values[id]);
      }
    }
    S.cash += total; S.month.sell += total;
    removeSoldTrains(sold);
    if (count === 1) log('出售车辆', `${entries[0].train.name} 售出，回收 ${fmtW(total)}元。`, 'info');
    else log('批量出售', `${count} 列车售出，合计回收 ${fmtW(total)}元。`, 'info');
    recompute();
    return { ok:true, count, total, stored, ids:[...sold] };
  }
  function sellTrain(tid){ sellTrains([tid]); }
  function quoteHeadReplacement(tid, id){
    const train = S.trains.find(t => t.id === tid), model = trainById[id];
    if (!train || isUnit(trainById[train.model]) || !model || isUnit(model)) return { ok:false, msg:'请选择可更换的机车' };
    const service = trainUse(train), cars = train.cars || [];
    const issue = checkConsist(model, service, cars); if (issue) return { ok:false, msg:issue };
    const q = quoteTrainOrder(id, { routeId:train.route || null, service, cars:[] });
    if (!q.model || q.quotaIssue) return q;
    const proceeds = sellQuote(train, true), net = q.total - proceeds;
    const plan = train.route && cars.length ? planTrain({ model:id, service, cars, route:train.route }) : null;
    return { ...q, train, cars, proceeds, net, basis:attachedCarValue(train), plan,
      ok:S.cash >= net, msg:S.cash < net ? '现金不足' : '' };
  }
  function replaceHead(tid, id){
    const q = quoteHeadReplacement(tid, id); if (!q.ok) return q;
    S.cash += q.proceeds; S.month.sell += q.proceeds;
    removeSoldTrains(new Set([tid]));
    const [train] = placeTrainOrder(q);
    log('更换车头', `${q.train.name} 更换为 ${train.name}，原编组与配属线路转移到新车头。`, 'info');
    recompute();
    return { ok:true, train, days:q.days, net:q.net };
  }
  function assignTrain(tid, routeId){
    const t = S.trains.find(t => t.id===tid); if (!t) return;
    t.route = routeId || null; t.phase = 0;
    // 交付、大修、临修期间只能预分配线路，到期后才投入运营
    if (t.status === 'run' || t.status === 'idle') t.status = t.route ? 'run' : 'idle';
    recompute();
  }
  const ROUTE_COLORS = ['#b3261e','#1d3f6e','#2f6b3f','#9a5b2e','#b8902a','#5e4b8b','#2f7f7a','#6b6a60'];
  function createRoute(stops, name){
    const r = { id:S.nid++, stops:stops.slice(), name: name || `${cities[stops[0]].name}—${cities[stops[stops.length-1]].name}`, pref:'fast', color: ROUTE_COLORS[S.routes.length % ROUTE_COLORS.length] };
    S.routes.push(r); log('新开线路', `${r.name}（${stops.length} 站）`, 'info'); recompute(); return r;
  }
  function toggleSkip(rid, c){ const r = S.routes.find(r => r.id===rid); if (!r) return; r.skip = r.skip || []; const i = r.skip.indexOf(c); if (i >= 0) r.skip.splice(i,1); else r.skip.push(c); recompute(); }
  function deleteRoute(id){ S.trains.forEach(t => { if (t.route===id) { t.route = null; if (t.status==='run') t.status='idle'; } }); S.routes = S.routes.filter(r => r.id!==id); recompute(); }
  function routeAllowed(a, b){ const e = edgeByPair[a+'-'+b]; if (!e || edgeLock(e)) return false; return S.tracks.some(x => x.e===e.i && x.status==='ok'); }

  // =========================================================
  //  第二层：运输合同 · 车辆老化与大修 · 资本运作 · 商誉
  // =========================================================
  function ensureT2(){
    if (S.rep === undefined) S.rep = 50;
    S.contracts = S.contracts || []; S.offers = S.offers || []; S.bonds = S.bonds || [];
    S.month = S.month || blankMonth(); S.month.fin = S.month.fin || {}; S.month.pairs = S.month.pairs || {};
    if (S.ipo === undefined) S.ipo = null;
    S.trains.forEach(t => { if (t.ovh === undefined) t.ovh = t.bought; });
  }
  function addRep(d, why){ const o = S.rep; S.rep = clamp(S.rep + d, 0, 100); if (why && Math.abs(d) >= 3) log(d > 0 ? '商誉提升' : '商誉受损', `${why}（商誉 ${Math.round(o)} → ${Math.round(S.rep)}）`, d > 0 ? 'good' : 'bad'); }
  function repMul(){ return 0.7 + S.rep / 166; } // 50 → 1.0


  // =========================================================
  //  调度与信号 · 口碑与服务
  // =========================================================
  const SIGNALS = [
    { id:0, name:'半自动闭塞', cap:48, cost:0, desc:'一个区间只容一列车，通过能力低' },
    { id:1, name:'自动闭塞', cap:110, cost:38, from:1985, desc:'区间划分为多个闭塞分区，追踪间隔约 8 分钟' },
    { id:2, name:'调度集中 CTC', cap:170, cost:85, from:1996, desc:'调度中心集中控制信号与道岔，通过能力和正点率最高' },
  ];
  function sigOf(tr){
    if (tr.sig !== undefined) return tr.sig;
    const y = ym(S.day).y;
    if (tr.owner === 'S') return tr.v >= 250 ? 2 : y >= 2005 ? 2 : y >= 1993 ? 1 : (edges[tr.e].line ? 1 : 0);
    if (tr.owner === 'P') return tr.v >= 250 ? 2 : 0;
    return 1;
  }
  function capOf(tr){ const c = SIGNALS[sigOf(tr)].cap; return tr.v >= 250 ? Math.max(c, 200) : c; }
  function bgLoad(tr, y){
    if (tr.owner === 'S') { const e = edges[tr.e]; const base = (e.line ? 34 : 18) + (y - 1985) * (e.line ? 1.5 : 0.8); return Math.min(capOf(tr) * 0.82, base) * (tr.v >= 250 ? 0.6 : 1); }
    return (tr.usage || 0) / 30;
  }
  let trackUtil = {};
  function congestion(plans, y){
    const load = {};
    Object.values(plans).forEach(p => { if (p && p.ok) p.legs.forEach(l => load[l.tr] = (load[l.tr] || 0) + p.trips / 30); });
    trackUtil = {};
    S.tracks.forEach(tr => { if (tr.status !== 'ok') return; const L = (load[tr.id] || 0) + bgLoad(tr, y); trackUtil[tr.id] = { u: L / capOf(tr), own: load[tr.id] || 0, bg: bgLoad(tr, y), cap: capOf(tr) }; });
    S.trains.forEach(t => {
      const p = plans[t.id]; if (!p || !p.ok) return;
      let extra = 0, s0 = 0, uMax = 0;
      p.legs.forEach(l => { const tu = trackUtil[l.tr] || { u:0 }; const tr = S.tracks.find(x => x.id === l.tr);
        const c = tu.u <= 0.72 ? 0 : Math.min(1.5, (tu.u - 0.72) * 1.3); extra += l.h * c; uMax = Math.max(uMax, tu.u);
        if (tr && sigOf(tr) === 0) s0 += l.dist; });
      const d = extra / Math.max(0.1, p.hours);
      p.delay = extra; p.oneWay += extra; p.hours += extra; p.vavg = p.dist / p.hours;
      p.trips = HOURS_PER_MONTH * AVAIL * (availOf(t) / 0.98) / p.oneWay;
      if (uMax > 1) p.trips /= uMax; // 超过通过能力：多出的列车排不上运行图
      p.uMax = uMax; p.sig0 = s0 / Math.max(1, p.dist);
      p.punct = clamp(0.985 + 0.01 * trLv() - d * 0.9 - p.sig0 * 0.05 - (1 - availOf(t)) * 0.25, 0.35, 0.99);
    });
  }
  function signalQuote(trId, lv){ const tr = S.tracks.find(x => x.id === trId); if (!tr) return null; const e = edges[tr.e];
    const cur = sigOf(tr); const y = ym(S.day).y; const cost = Math.max(0, SIGNALS[lv].cost - SIGNALS[cur].cost * 0.5) * e.dist * 1e4 * cpi(y);
    return { cost, months: 2 + Math.ceil(e.dist / 250), ok: lv > cur && (!SIGNALS[lv].from || y >= SIGNALS[lv].from) }; }
  function upgradeSignal(trId, lv){
    const tr = S.tracks.find(x => x.id === trId); if (!tr || tr.owner !== 'P' || tr.status !== 'ok') return { ok:false, msg:'只能改造自有线路' };
    if (tr.sigUpg) return { ok:false, msg:'信号改造进行中' };
    const q = signalQuote(trId, lv); if (!q.ok) return { ok:false, msg: lv <= sigOf(tr) ? '已达到该等级' : `${SIGNALS[lv].name} ${SIGNALS[lv].from} 年起可用` };
    if (S.cash < q.cost) return { ok:false, msg:'现金不足' };
    S.cash -= q.cost; S.month.build += q.cost; tr.cost = (tr.cost || 0) + q.cost; tr.sigUpg = { lv, done:S.day + q.months * 30 };
    const e = edges[tr.e]; log('信号改造', `${cities[e.a].name}—${cities[e.b].name} 开始改造为「${SIGNALS[lv].name}」，投资 ${fmtW(q.cost)}元，工期 ${q.months} 个月。`, 'info');
    return { ok:true };
  }
  function signalWorks(){ let ch = false; S.tracks.forEach(tr => { if (tr.sigUpg && S.day >= tr.sigUpg.done) { tr.sig = tr.sigUpg.lv; tr.sigUpg = null; ch = true; const e = edges[tr.e]; log('信号开通', `${cities[e.a].name}—${cities[e.b].name} 「${SIGNALS[tr.sig].name}」投入使用，通过能力提升。`, 'good'); } }); return ch; }

  // ---------- 服务与满意度 ----------
  const SVC = [{ name:'简朴', fare:0.95, cost:0.95, sat:-8, desc:'不设餐车，乘务从简' }, { name:'标准', fare:1, cost:1, sat:0, desc:'常规乘务与供餐' }, { name:'优质', fare:1.08, cost:1.12, sat:10, desc:'餐车、卧具更新、列车员增配' }];
  function setService(rid, lv){ const r = S.routes.find(x => x.id === rid); if (!r) return; r.svc = clamp(lv|0, 0, 2); recompute(); }
  function svcSat(sv){
    let w = 0, a = 0; sv.list.forEach(x => { const t = S.trains.find(q => q.id === x.t); const r = t && S.routes.find(q => q.id === t.route); const st = r && r.sat !== undefined ? r.sat : 55; w += x.capM; a += x.capM * st; });
    return w ? a / w : 55;
  }
  function routeStats(r){
    const ts = S.trains.filter(t => t.route === r.id && t.status === 'run' && econ[t.id] && econ[t.id].plan.ok);
    if (!ts.length) return null;
    const w = ts.reduce((a, t) => a + econ[t.id].plan.trips, 0) || 1;
    const punct = ts.reduce((a, t) => a + (econ[t.id].punct || 0.95) * econ[t.id].plan.trips, 0) / w;
    const lf = ts.reduce((a, t) => a + econ[t.id].lf, 0) / ts.length;
    const cmf = ts.reduce((a, t) => a + (econ[t.id].comfort || 1), 0) / ts.length;
    const pax = ts.some(t => trainUse(t) === 'pax');
    const uMax = Math.max(...ts.map(t => econ[t.id].plan.uMax || 0));
    return { punct, lf, cmf, pax, uMax, n:ts.length };
  }
  function routeSatisfaction(){
    let tw = 0, ta = 0;
    S.routes.forEach(r => {
      const st = routeStats(r); if (r.sat === undefined) r.sat = 60; r.acc = (r.acc || 0) * 0.85;
      if (!st) return;
      const svc = st.pax ? SVC[r.svc === undefined ? 1 : r.svc].sat : 0;
      const target = clamp(62 + (st.punct - 0.9) * 200 + svc + (st.pax ? (st.cmf - 1) * 25 - (st.lf > 0.97 ? 5 : 0) : 0) - r.acc, 0, 100);
      r.sat += (target - r.sat) * 0.3; r.punct = st.punct;
      tw += st.n; ta += st.n * r.sat;
    });
    if (tw) { const avg = ta / tw; S.satAvg = avg; addRep((avg - 55) * 0.012); }
  }
  function accidents(){
    S.trains.forEach(t => {
      if (t.status !== 'run') return; const e = econ[t.id]; if (!e || !e.plan.ok) return;
      const p = 0.00025 * (1 - 0.2 * trLv()) * (1 + 2 * (e.plan.sig0 || 0)) * (1 + yrsSinceOvh(t) / 8) * (1 + Math.max(0, (e.plan.uMax || 0) - 1) * 2);
      if (Math.random() < p) {
        const c = t.price * 0.25; S.cash -= c; S.month.ovhCost = (S.month.ovhCost || 0) + c;
        t.status = 'repair'; t.ovhDone = S.day + 45;
        const r = S.routes.find(x => x.id === t.route); if (r) r.acc = (r.acc || 0) + 30;
        addRep(-Math.max(1, 4 * Math.min(1, 40 / S.trains.length)), `${t.name} 发生行车事故`);
        log('行车事故', `${t.name}（${trainById[t.model].name}）在${r ? r.name : ''}发生行车事故，所幸无人员伤亡。损失 ${fmtW(c)}元，停运 45 天，线路口碑受挫。信号落后、车况老旧、线路超负荷都会增加事故风险。`, 'bad');
        pendingPopups.push({ type:'accident', name:t.name, route: r ? r.name : '', cost:c });
      }
    });
  }


  // =========================================================
  //  车站商业 · 沿线地产 · 地方政府合作
  // =========================================================
  const SHOP_LV = [
    { name:'无', cost:0, spend:0 },
    { name:'小卖部与报刊亭', cost:120, spend:0.1, ad:0.4 },
    { name:'候车室商铺', cost:600, spend:0.25, ad:1 },
    { name:'站房商业综合体', cost:3200, spend:0.55, ad:2.5, from:1998 },
  ];
  let cityPax = {};
  function shopLv(ci){ return (S.biz && S.biz[ci]) || 0; }
  function shopQuote(ci, lv){ const y = ym(S.day).y; const L = SHOP_LV[lv]; if (!L) return null;
    const cost = Math.max(0, L.cost - SHOP_LV[shopLv(ci)].cost * 0.6) * 1e4 * cpi(y);
    const why = lv <= shopLv(ci) ? '已达到该等级' : (L.from && y < L.from) ? `${L.from} 年起可建` : !S.lit[ci] ? '需先开通本公司列车服务' : (isTown(ci) && stationLv(ci) < 1) ? '需先开设车站' : '';
    return { cost, why }; }
  function buildShop(ci, lv){ const q = shopQuote(ci, lv); if (!q) return { ok:false, msg:'无效' }; if (q.why) return { ok:false, msg:q.why }; if (S.cash < q.cost) return { ok:false, msg:'现金不足' };
    S.biz = S.biz || {}; S.biz[ci] = lv; S.cash -= q.cost; S.month.build += q.cost; S.bizCost = S.bizCost || {}; S.bizCost[ci] = (S.bizCost[ci] || 0) + q.cost;
    log('车站商业', `${cities[ci].name}站开设「${SHOP_LV[lv].name}」，投资 ${fmtW(q.cost)}元。`, 'info'); return { ok:true }; }
  function shopIncome(ci, y){ const lv = shopLv(ci); if (!lv || !S.lit[ci]) return 0; const L = SHOP_LV[lv];
    const pax = cityPax[ci] || 0; const pop = popOf(cities[ci], y);
    return (pax * L.spend + pop * 1e4 * 0.004 * L.ad) * cpi(y) * (0.8 + (S.satAvg || 55) / 250) * (1 + 0.08 * exLv('cmo')); }
  // 地产：每座城市最多 5 块，每块代表站前约 10 公顷土地使用权
  const LAND_IDX = { 1985:1, 1988:1.3, 1992:2.2, 1994:2.6, 1998:2.9, 2001:3.6, 2004:5.2, 2007:7.8, 2010:11, 2013:14, 2016:17, 2020:20 };
  function landIdx(y){ const ks = Object.keys(LAND_IDX).map(Number); let a = ks[0], b = ks[ks.length-1];
    for (const k of ks){ if (k <= y) a = k; if (k >= y){ b = k; break; } } if (a === b) return LAND_IDX[a]; return LAND_IDX[a] + (LAND_IDX[b] - LAND_IDX[a]) * (y - a) / (b - a); }
  function landPrice(ci){
    const y = ym(S.day).y + (ym(S.day).m - 1) / 12; const c = cities[ci];
    const served = S.lit[ci] ? 1 : 0; const yrs = S.litEver[ci] ? Math.min(10, ym(S.day).y - S.litEver[ci]) : 0;
    return Math.sqrt(popOf(c, Math.floor(y))) * 60e4 * landIdx(y) * (1 + 0.25 * served + 0.04 * yrs + 0.08 * (isTown(ci) ? stationLv(ci) : 2)) * (c.tier > 1 ? 0.75 : 1);
  }
  function buyLand(ci){ const y = ym(S.day).y; if (y < 1988) return { ok:false, msg:'1988 年起土地使用权才可以有偿转让' };
    S.land = S.land || {}; const L = S.land[ci] || { n:0, cost:0 }; if (L.n >= 5) return { ok:false, msg:'该城市已购满 5 块' };
    const p = landPrice(ci) * 1.03; if (S.cash < p) return { ok:false, msg:'现金不足' };
    S.cash -= p; S.month.build += p; L.n++; L.cost += p; S.land[ci] = L;
    log('购置土地', `在${cities[ci].name}站前购入一块土地使用权，价格 ${fmtW(p)}元。通车和城市发展会让地价上涨。`, 'info'); return { ok:true, cost:p }; }
  function sellLand(ci){ const L = S.land && S.land[ci]; if (!L || !L.n) return { ok:false, msg:'没有土地' };
    const p = landPrice(ci) * 0.95; const avg = L.cost / L.n; S.cash += p; S.month.sell += p; L.cost -= avg; L.n--;
    S.landGain = (S.landGain || 0) + (p - avg);
    log('出售土地', `出售${cities[ci].name}站前土地一块，收入 ${fmtW(p)}元（${p >= avg ? '增值' : '亏损'} ${fmtW(Math.abs(p - avg))}元）。`, p >= avg ? 'good' : 'warn'); return { ok:true, gain:p - avg }; }
  function landValue(){ return Object.entries(S.land || {}).reduce((a, [c, L]) => a + L.n * landPrice(+c), 0); }
  function landRent(y){ return Object.entries(S.land || {}).reduce((a, [c, L]) => a + L.n * landPrice(+c) * 0.0028 * (S.lit[c] ? 1.3 : 1), 0); }

  // ---------- 地方政府 ----------
  function genLocal(y){
    S.locals = (S.locals || []).filter(o => o.expire > S.day);
    const out = [];
    // 1) 合资建线：对方出资一部分，要求通车后开行客车
    const cands = groups.map((g, i) => ({ g, i })).filter(({ g, i }) => !g.abroad && !g.edges.some(ei => S.tracks.some(t => t.e === ei && t.owner === 'P')) && !S.locals.some(o => o.gi === i) && !(S.jv || []).some(o => o.gi === i));
    const pickJV = cands.filter(({ g }) => { const a = cities[g.a], b = cities[g.b]; return a.lon < 112 || b.lon < 112 || a.tier > 1 || b.tier > 1 || !g.edges.some(ei => S.tracks.some(t => t.e === ei && t.owner === 'S')); });
    if (pickJV.length && Math.random() < 0.8) { const { g, i } = pickJV[Math.floor(Math.random() * pickJV.length)];
      const host = cities[g.a].lon < cities[g.b].lon ? g.a : g.b;
      out.push({ id:S.nid++, kind:'jv', gi:i, host, sub: 0.25 + Math.round(Math.random() * 4) * 0.05, need: 20, expire:S.day + 180 }); }
    // 2) 设站补贴：小城市请你停车
    const towns = cities.filter(c => c.tier > 1 && !c.abroad && stationLv(c.i) < 1 && Object.values(adj[c.i] || []).some(e => S.tracks.some(t => t.e === e.i && t.status === 'ok')));
    if (towns.length) { const c = towns[Math.floor(Math.random() * towns.length)]; out.push({ id:S.nid++, kind:'station', ci:c.i, sub:0.5, expire:S.day + 180 }); }
    // 3) 公益慢车：西部或山区补贴
    if (y >= 1990 && Math.random() < 0.6) { const c = cities.filter(c => c.lon < 112 && !c.abroad && S.lit[c.i]); if (c.length) { const h = c[Math.floor(Math.random() * c.length)]; out.push({ id:S.nid++, kind:'slow', ci:h.i, rate: 9 + Math.round(Math.random() * 6), expire:S.day + 180 }); } }
    S.locals = S.locals.concat(out).slice(-6);
    if (out.length) log('地方政府', `收到 ${out.length} 份地方政府合作提议，请在「合同」页查看。`, 'info');
  }
  function acceptLocal(id){
    const i = (S.locals || []).findIndex(o => o.id === id); if (i < 0) return { ok:false, msg:'提议已失效' };
    if (S.locals[i].expire <= S.day) { S.locals.splice(i, 1); return { ok:false, msg:'提议已过期' }; }
    const o = S.locals.splice(i, 1)[0];
    if (o.kind === 'jv') { S.jv = S.jv || []; S.jv.push({ gi:o.gi, sub:o.sub, host:o.host, need:o.need, since:null, warned:0, until:S.day + 3 * 365 });
      const g = groups[o.gi]; log('合资建线', `与${cities[o.host].name}市政府签订合资协议：${cities[g.a].name}—${cities[g.b].name} 修建时地方出资 ${Math.round(o.sub*100)}%。通车后 12 个月内需开行客车。`, 'good'); }
    if (o.kind === 'station') { S.stSub = S.stSub || {}; S.stSub[o.ci] = o.sub; log('设站补贴', `${cities[o.ci].name}市政府承担新建车站 ${Math.round(o.sub*100)}% 的费用。`, 'good'); }
    if (o.kind === 'slow') { S.slowSub = S.slowSub || {}; S.slowSub[o.ci] = o.rate; log('公益慢车', `${cities[o.ci].name}所在地区对途经该市的公益慢车按每列·公里 ${o.rate} 元补贴。`, 'good'); }
    addRep(1); recompute(); return { ok:true };
  }
  function declineLocal(id){ S.locals = (S.locals || []).filter(o => o.id !== id); }
  function jvSub(e){ const j = (S.jv || []).find(o => o.gi === e.grp); return j ? j.sub : 0; }
  function setSlow(rid, on){ const r = S.routes.find(x => x.id === rid); if (!r) return; r.slow = !!on; if (on) r.grade = 'normal'; if (on) r.skip = []; recompute(); }
  function slowSubsidy(y){
    // 按本月公益慢车实际开行的列·公里结算（没有专项补贴时按 3 元/列·公里的社会效益补助）
    return (S.month.slowAcc || 0) * cpi(y);
  }
  function checkJV(){
    (S.jv || []).slice().forEach(j => {
      const g = groups[j.gi]; const built = g.edges.every(ei => S.tracks.some(t => t.e === ei && t.owner === 'P' && t.status === 'ok'));
      const started = g.edges.some(ei => S.tracks.some(t => t.e === ei && t.owner === 'P'));
      if (!started && j.until && S.day > j.until) { S.jv = S.jv.filter(x => x !== j); log('合资协议到期', `${cities[g.a].name}—${cities[g.b].name} 合资协议三年内未开工，自动失效。`, 'info'); return; }
      if (!built) return; if (j.since === null) j.since = S.day;
      const run = (S.lastRun && S.lastRun.paxE) || {}; const used = g.edges.some(ei => run[ei]);  // 上月确有客车实际驶过合资线
      if (used) { S.jv = S.jv.filter(x => x !== j); addRep(3, `${cities[g.a].name}—${cities[g.b].name} 合资线开通客车，地方政府十分满意`); return; }
      if (S.day - j.since > 365) { const refund = (j.paid || 0); S.cash -= refund; S.month.jvRefund = (S.month.jvRefund || 0) + refund; S.jv = S.jv.filter(x => x !== j); addRep(-6, `${cities[g.a].name}—${cities[g.b].name} 合资线通车一年未开客车，被要求退还地方出资 ${fmtW(refund)}元`); }
    });
  }


  // =========================================================
  //  员工与管理层 · 科研与国产化
  // =========================================================
  const ROLES = {
    gm:  { name:'总经理', desc:lv => `商誉每月 +${(0.06*lv).toFixed(2)}，合同奖金 +${5*lv}%` },
    ce:  { name:'总工程师', desc:lv => `建设费用 −${3*lv}%，机车故障 −${12*lv}%，研发速度 +${20*lv}%` },
    cfo: { name:'财务总监', desc:lv => `贷款利息 −${4*lv}%，债券利率 −${(0.2*lv).toFixed(1)} 个百分点，估值 +${4*lv}%` },
    cmo: { name:'营销总监', desc:lv => `客流分担 +${2*lv}%，车站商业收入 +${8*lv}%` },
  };
  const SURN = '王李张刘陈杨赵黄周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文';
  const GIVN = ['建国','卫东','志刚','国庆','振华','红梅','秀英','海燕','立新','跃进','德明','永强','丽华','学军','春生','玉兰','铁军','树林','晓东','文斌','建华','明远','思源','宏伟','静','敏','涛','磊','鹏','婷','洁','峰','华','军','勇','梅','芳','琳','颖','博'];
  const BG = { gm:['原铁路局局长','合资企业总经理','留学归国的管理学博士','地方国企负责人'], ce:[y => y >= 2013 ? '原铁道部所属科研机构研究员' : '铁道部科研院研究员','机车厂总工程师','铁道学院教授','工程局副总工'], cfo:['银行信贷处处长','会计师事务所合伙人','证券公司投行部经理','国企总会计师'], cmo:['航空公司营销部经理','百货集团副总','广告公司创始人','旅行社总经理'] };
  const pickR = a => a[Math.floor(Math.random() * a.length)];
  function wageIdx(y){ return cpi(y) * (1 + Math.max(0, y - 1995) * 0.05); }
  function execSalary(lv, y){ return [0, 40, 100, 260][lv] * 1e4 * wageIdx(y); }
  function genCands(y){
    S.cands = [];
    const roles = Object.keys(ROLES);
    for (let k = 0; k < 4; k++) { const role = roles[(k + Math.floor(Math.random() * 4)) % 4]; const r = Math.random(); const lv = r < 0.5 ? 1 : r < 0.85 ? 2 : 3;
      S.cands.push({ id:S.nid++, role, lv, name: pickR(SURN) + pickR(GIVN), bg: (b => typeof b === 'function' ? b(y) : b)(pickR(BG[role])), age: 32 + Math.floor(Math.random() * 25) }); }
  }
  function exLv(role){ const e = S.execs && S.execs[role]; return e ? e.lv : 0; }
  function hireExec(id){
    const c = (S.cands || []).find(x => x.id === id); if (!c) return { ok:false, msg:'候选人已离开' };
    const y = ym(S.day).y; const sign = execSalary(c.lv, y) * 0.5; if (S.cash < sign) return { ok:false, msg:'现金不足以支付签约金' };
    S.execs = S.execs || {}; const old = S.execs[c.role];
    S.cash -= sign; S.month.staff = (S.month.staff || 0) + sign; S.month.staffPaid = (S.month.staffPaid || 0) + sign;
    S.execs[c.role] = { name:c.name, lv:c.lv, bg:c.bg, since:S.day };
    S.cands = S.cands.filter(x => x !== c);
    log('聘任高管', `聘请${c.name}（${c.bg}）出任${ROLES[c.role].name}，签约金 ${fmtW(sign)}元${old ? `，原${ROLES[c.role].name}${old.name}离任` : ''}。`, 'good');
    recompute(); return { ok:true };
  }
  function fireExec(role){ const e = S.execs && S.execs[role]; if (!e) return; const y = ym(S.day).y; const pay = execSalary(e.lv, y) * 0.25; S.cash -= pay; S.month.staff = (S.month.staff || 0) + pay; S.month.staffPaid = (S.month.staffPaid || 0) + pay; delete S.execs[role]; log('高管离任', `${ROLES[role].name}${e.name}离任，支付补偿 ${fmtW(pay)}元。`, 'info'); recompute(); }
  const TRAIN_LV = [{ name:'无专项培训', cost:0 }, { name:'岗前培训', cost:0.8 }, { name:'定期轮训', cost:2 }, { name:'技能鉴定与仿真培训', cost:4 }];
  function setTraining(lv){ S.trainLv = clamp(lv|0, 0, 3); recompute(); }
  function trLv(){ return S.trainLv || 0; }
  function staffCost(y){
    let c = S.trains.length * TRAIN_LV[trLv()].cost * 1e4 * cpi(y);
    Object.values(S.execs || {}).forEach(e => c += execSalary(e.lv, y) / 12);
    return c;
  }
  // ---------- 研发 ----------
  const OWN_MODELS = [
    { id:'own1', model:'HXE160', name:'自主准高速客运电力机车', pts:600, from:1996, need:null },
    { id:'own2', model:'HXH25', name:'自主八轴重载电力机车', pts:900, from:2002, need:'own1' },
    { id:'own3', model:'HXG300', name:'自主高速动车组', pts:2500, from:2006, need:'own2' },
  ];
  function rdState(){ S.rd = S.rd || { lv:0, pts:0, done:{}, cur:null }; return S.rd; }
  function setRD(lv){ rdState().lv = clamp(lv|0, 0, 3); }
  function localized(m){ return !!(S && S.rd && S.rd.done['loc_' + m.id]); }
  function isImp(m){ return !!m.imported && !localized(m); }
  function isRetained(m){ return !!S?.rd?.done?.['retain_' + m.id]; }
  function retentionProjects(){
    const y = ym(S.day).y;
    return TRAINS.filter(m => buyable(m) && m.year <= y && m.end < FAR_END)
      .sort((a, b) => b.end - a.end || a.year - b.year)
      .map(m => ({ key:'retain_' + m.id, kind:'retain', name:`保留 ${m.name}`, pts:Math.max(60, Math.round(m.price / 20)), m }));
  }
  function rdProjects(){
    const y = ym(S.day).y; const rd = rdState(); const out = [];
    TRAINS.filter(m => m.imported).forEach(m => { const n = S.trains.filter(t => t.model === m.id).length; const key = 'loc_' + m.id;
      if (rd.done[key]) return; if (n < 2 && rd.cur !== key) return;
      out.push({ key, kind:'loc', name:`${m.name} 国产化`, pts: Math.round(m.price / 8), m, desc:'免关税、不占进口额度、价格降低 20%，交付期缩短为 30 天' }); });
    OWN_MODELS.forEach(o => { if (rd.done[o.id]) return; const ok = y >= o.from && (!o.need || rd.done[o.need]);
      out.push({ key:o.id, kind:'own', name:o.name, pts:o.pts, m:trainById[o.model], locked: ok ? '' : (y < o.from ? `${o.from} 年起可立项` : '需先完成上一代自主车型'), desc:'研发成功后可购买本公司自主车型' }); });
    (rd.designs || []).forEach(d => { if (rd.done[d.research]) return;
      out.push({ key:d.research, kind:'design', name:`自主设计：${d.name}`, pts:d.rdPts || 1000, m:d, desc:`${d.en} · ${d.vmax} km/h · ${d.use === 'pax' ? (isUnit(d) ? d.cap + ' 人' : '功率 ' + d.power.toLocaleString() + ' kW') : d.cap.toLocaleString() + ' t'} · 运行成本 ${d.run}` }); });
    out.push(...retentionProjects().filter(p => !rd.done[p.key]));
    return out;
  }
  function startProject(key){ const rd = rdState(); const p = rdProjects().find(x => x.key === key); if (!p) return { ok:false, msg:'项目不可用' }; if (p.locked) return { ok:false, msg:p.locked };
    if (rd.cur === key) return { ok:true };
    if (rd.cur) { rd.prog = rd.prog || {}; rd.prog[rd.cur] = rd.pts; }
    rd.cur = key; rd.pts = (rd.prog && rd.prog[key]) || 0; log('研发立项', `启动研发项目「${p.name}」，需要 ${p.pts} 研发点。`, 'info'); return { ok:true }; }
  function rdMonth(y, rev){
    const rd = rdState(); const spend = Math.max(0, rev) * [0, 0.01, 0.025, 0.05][rd.lv] + (rd.lv ? 10e4 * cpi(y) * rd.lv : 0);
    if (!rd.cur) return rd.lv ? spend * 0.3 : 0;   // 没有项目时仍有基础研究开支
    const gain = spend / (10e4 * cpi(y)) * (1 + 0.2 * exLv('ce'));
    rd.pts += gain; rd.lastGain = gain;
    const p = rdProjects().find(x => x.key === rd.cur);
    if (p && rd.pts >= p.pts) { rd.done[p.key] = ym(S.day).y; rd.cur = null; rd.pts = 0;
      if (p.kind === 'design') p.m.year = ym(S.day).y;   // 定型投产年份
      log('研发成功', p.kind === 'loc' ? `${p.m.name} 实现国产化：免关税、不占进口额度、价格降低 20%。` : p.kind === 'retain' ? `${p.m.name} 获得长期订购渠道，可在购车页采购。` : `自主车型「${p.m.name}」研制成功，可以在购车页采购！`, 'good');
      pendingPopups.push({ type:'rd', name:p.name, kind:p.kind, model:p.m.name }); addRep(2); }
    return spend;
  }


  // =========================================================
  //  剧本与挑战 · 排行榜
  // =========================================================
  function last12(k){ return S.history.slice(-12).reduce((a, h) => a + (h[k] || 0), 0); }
  function pairServed(use, g, a, b){ const ci = cityIdx[a], cj = cityIdx[b]; const k = (use === 'pax' ? 'pax' : 'freight:' + g) + ':' + Math.min(ci, cj) + '-' + Math.max(ci, cj); return (pairInfo[k] || {}).served || 0; }
  // 时速 200 以上列车承担的客流（按两地间本公司列车运能比例折算）
  function fastServed(a, b){ const ci = cityIdx[a], cj = cityIdx[b]; let f = 0, all = 0;
    S.trains.forEach(t => { if (t.status !== 'run') return; const r = S.routes.find(q => q.id === t.route); if (!r || !r.stops.includes(ci) || !r.stops.includes(cj)) return;
      const e = econ[t.id]; const m = trainModel(t); if (!e || !e.plan.ok || m.use !== 'pax') return; const c = e.plan.trips * tmodel(t).cap; all += c; if (m.vmax >= 200) f += c; });
    return all ? pairServed('pax', null, a, b) * f / all : 0; }
  const pk = (a, b) => { const ci = cityIdx[a], cj = cityIdx[b]; return Math.min(ci, cj) + '-' + Math.max(ci, cj); };
  // 剧本按月记录实际运量（上月完成量）
  function scnMonthly(){ const P = S.lastPairs || {}; return { coal: P['freight:coal:' + pk('大同', '秦皇岛')] || 0, fast: P['fast:' + pk('北京', '天津')] || 0 }; }
  function scnRoll(k, n){ const h = (S.scn && S.scn.hist) || []; return h.slice(-n).reduce((a, x) => a + (x[k] || 0), 0); }
  // 只沿本公司 250 km/h 以上已通车线路判断两地是否贯通
  function ownHSRLinked(a, b){ const A = cityIdx[a], B = cityIdx[b]; const ok = {}; S.tracks.forEach(t => { if (t.owner === 'P' && t.status === 'ok' && t.v >= 250) ok[t.e] = true; });
    const seen = new Set([A]), q = [A]; while (q.length) { const u = q.shift(); if (u === B) return 1; adj[u].forEach(e => { if (!ok[e.i]) return; const v = e.a === u ? e.b : e.a; if (!seen.has(v)) { seen.add(v); q.push(v); } }); } return 0; }
  function ownHSR(a, b){ const p = findPath(cityIdx[a], cityIdx[b]); if (!p || p.length < 2) return 0; let n = 0;
    for (let k = 0; k < p.length - 1; k++) { const e = edgeByPair[p[k] + '-' + p[k+1]]; if (e && S.tracks.some(t => t.e === e.i && t.owner === 'P' && t.status === 'ok' && t.v >= 250)) n++; } return n / (p.length - 1); }
  const SCENARIOS = [
    { id:'daqin', title:'打通大秦煤运', year:1985, until:1992, cash:1.5e8,
      brief:'晋北煤炭堆积如山，港口却等煤装船。请在 1992 年底前，打通大同到秦皇岛的运煤通道。',
      goal:'大同—秦皇岛煤炭年运量达到 800 万吨（按最近 12 个月实际完成量）',
      prog: () => scnRoll('coal', 12) / 8e6 },
    { id:'south', title:'南国春潮', year:1990, until:1996, cash:2.5e8,
      brief:'珠三角工厂林立，每年春节数百万外来务工者往返南北。抓住这股人潮。',
      goal:'连续 12 个月旅客发送量达到 1800 万人次，并开通广州的列车服务',
      prog: () => Math.min(S.lit[cityIdx['广州']] ? 1 : 0.5, last12('paxN') / 1.8e7) },
    { id:'west', title:'西部大开发', year:2000, until:2008, cash:12e8,
      brief:'国家提出西部大开发，中西部铁路建设迎来补贴与机遇。',
      goal:'点亮东经 110° 以西的 15 座城市',
      prog: () => Object.keys(S.lit).filter(c => cities[c].lon < 110 && !cities[c].abroad).length / 15 },
    { id:'jingjin', title:'京津城际', year:2005, until:2009, cash:60e8,
      brief:'奥运会即将到来。请抢在国铁之前，建成北京至天津的高速城际铁路。',
      goal:'自有 250 km/h 以上线路贯通北京—天津，且两地间时速 200 公里以上列车的月客流达到 400 万人次',
      prog: () => Math.min(ownHSRLinked('北京', '天津'), scnRoll('fast', 1) / 4e6) },
    { id:'tycoon', title:'百亿集团', year:1985, until:2005, cash:1.5e8,
      brief:'从一纸试点许可起步，二十年内成长为数百亿级的铁路集团。',
      goal:'净资产达到 250 亿元',
      prog: () => netWorth() / 2.5e10 },
  ];
  function scenario(){ return S && S.scn ? SCENARIOS.find(x => x.id === S.scn.id) : null; }
  function scnProgress(){ const sc = scenario(); if (!sc) return null; return Math.max(0, Math.min(1, sc.prog() || 0)); }
  function startScenario(id, company){
    const sc = SCENARIOS.find(x => x.id === id); if (!sc) return false;
    newGame(company);
    simulating = true;   // 历史推演：不写自动存档、不记排行
    try { while (ym(S.day).y < sc.year) tick(24 * 5); } finally { simulating = false; }
    pendingPopups = pendingPopups.filter(p => p.type === 'policy').slice(-3);
    S.cash = sc.cash; S.debt = 0; S.bonds = []; S.month = blankMonth(); S.cash0 = sc.cash; S.history = []; S.reports = []; S.news = []; S.lifetime = { pax:0, tons:0, rev:0, trips:0 }; S.achievements = {}; S.negMonths = 0;
    S.scn = { id, start:S.day, done:false, failed:false };
    log('剧本 · ' + sc.title, sc.brief + ' 目标：' + sc.goal + `，期限 ${sc.until} 年底。`, 'policy');
    pendingPopups.push({ type:'scnStart', sc });
    S.lastYM = ym(S.day).y + '-' + ym(S.day).m;
    recompute(); autoSave(); return true;
  }
  function scoreOf(sc){ const y = ym(S.day).y; const left = sc ? Math.max(0, sc.until - y) : 0;
    return Math.round(1000 + left * 150 + Math.max(0, netWorth()) / 1e8 / cpi(y) * 3 + S.rep * 3 + Object.keys(S.litEver).length * 5); }
  function board(){ try { return JSON.parse(localStorage.getItem('tdcq_board') || '[]'); } catch(e) { return []; } }
  function recordScore(entry){ try { const b = board(); b.push(entry); b.sort((x, y) => y.score - x.score); localStorage.setItem('tdcq_board', JSON.stringify(b.slice(0, 50))); } catch(e) {} }
  function checkScenario(py){
    const sc = scenario(); if (!sc || S.scn.done || S.scn.failed) return;
    S.scn.hist = (S.scn.hist || []).concat([scnMonthly()]).slice(-12);
    const y = py || ym(S.day).y; const p = scnProgress();
    if (y > sc.until) { S.scn.failed = true; log('剧本失败 · ' + sc.title, `期限已过，目标完成度 ${Math.round(p * 100)}%。可以继续自由经营。`, 'bad'); pendingPopups.push({ type:'scnLose', sc, p }); return; }
    if (p >= 1) { S.scn.done = y; const score = scoreOf(sc);
      recordScore({ scn:sc.id, title:sc.title, company:S.company, score, y, worth:netWorth(), date:new Date().toISOString().slice(0, 10) });
      log('剧本完成 · ' + sc.title, `目标达成！得分 ${score}。`, 'good'); pendingPopups.push({ type:'scnWin', sc, score }); return; }
  }
  function recordFree(){ if (S.scn || S.boardDone) return; S.boardDone = true; const score = scoreOf(null);
    recordScore({ scn:'free', title:'自由经营（1985–2020）', company:S.company, score, y:ym(S.day).y, worth:netWorth(), date:new Date().toISOString().slice(0, 10) }); return score; }

  // ---------- 车辆老化 ----------
  function yrsSinceOvh(t){ return Math.max(0, (S.day - (t.ovh !== undefined ? t.ovh : t.bought)) / 365); }
  function availOf(t){ const c = depotCover[t.id] || 0; return Math.max(0.62 + 0.08 * c, 0.98 + 0.01 * c - 0.012 * (1 - 0.5 * c) * yrsSinceOvh(t)); }
  // —— 机务段 ——
  const DEPOT_LV = [null, { name:'机务折返段', cost:4000, upkeep:18, radius:450, cap:40 }, { name:'机务段', cost:9000, upkeep:60, radius:700, cap:120 }];
  let depotCover = {};
  function cityKm(a, b){ const A = cities[a], B = cities[b]; const k = Math.cos((A.lat + B.lat) / 2 * Math.PI / 180); return Math.hypot((A.lon - B.lon) * 111 * k, (A.lat - B.lat) * 111); }
  function depotsOf(){ return S.depots || (S.depots = []); }
  function nearDepot(r){ let best = null, bd = 1e9; depotsOf().forEach(d => { if (d.pend) return; const R = DEPOT_LV[d.lv].radius; r.stops.forEach(c => { const k = cityKm(c, d.ci); if (k <= R && k < bd) { bd = k; best = d; } }); }); return best; }
  function computeDepotCover(){
    depotCover = {}; const D = depotsOf().filter(d => d.lv); depotsOf().forEach(d => d.used = 0); if (!D.length) return;
    const opts = {}; S.routes.forEach(r => { opts[r.id] = D.map(d => ({ d, k:Math.min(...r.stops.map(c => cityKm(c, d.ci))) })).filter(x => x.k <= DEPOT_LV[x.d.lv].radius).sort((a, b) => a.k - b.k); });
    S.trains.filter(t => t.route && t.status !== 'delivery').sort((a, b) => a.id - b.id).forEach(t => { const o = (opts[t.route] || []).find(x => x.d.used < DEPOT_LV[x.d.lv].cap); if (!o) return; o.d.used++; depotCover[t.id] = 1; });
  }
  function depotQuote(ci, lv){ const y = ym(S.day).y; const cur = depotsOf().find(d => d.ci === ci); const L = DEPOT_LV[lv]; if (!L) return null;
    const has = cur && cur.lv >= 1 && DEPOT_LV[cur.lv];
    const cost = Math.max(0, L.cost - (has ? DEPOT_LV[cur.lv].cost * 0.8 : 0)) * 1e4 * cpi(y); return { cost, months: has ? 6 : 8, lv }; }
  function depotCandidates(){ // 按“附近尚未覆盖的列车数”推荐选址
    const R = DEPOT_LV[1].radius, cnt = {}, own = new Set(depotsOf().map(d => d.ci));
    S.routes.forEach(r => { const n = S.trains.filter(t => t.route === r.id && t.status !== 'delivery' && !depotCover[t.id]).length; if (!n) return;
      cities.forEach((x, i) => { if (isTown(i) || own.has(i)) return; const k = Math.min(...r.stops.map(c => cityKm(c, i))); if (k <= R) cnt[i] = (cnt[i] || 0) + n * (k === 0 ? 1 : 0.999 - k / R * 0.2); }); });
    return Object.entries(cnt).map(([ci, n]) => ({ ci:+ci, n:Math.round(n) })).sort((a, b) => b.n - a.n).slice(0, 5);
  }
  function buildDepot(ci, lv){
    lv = lv || 1; if (isTown(ci)) return { ok:false, msg:'机务段只能建在大城市' };
    const cur = depotsOf().find(d => d.ci === ci);
    if (cur && (cur.pend || cur.lv >= lv)) return { ok:false, msg: cur.pend ? '正在施工' : '已达到该等级' };
    if (!cur && lv > 1) return { ok:false, msg:'需要先建机务折返段' };
    const q = depotQuote(ci, lv); if (S.cash < q.cost) return { ok:false, msg:'现金不足' };
    S.cash -= q.cost; S.month.build += q.cost;
    const d = cur || { ci, lv:0, cost:0, built:S.day }; if (!cur) S.depots.push(d);
    d.cost += q.cost; d.pend = { lv, done:S.day + q.months * 30 };
    log('机务段开工', `${cities[ci].name}${DEPOT_LV[lv].name}开工，投资 ${fmtW(q.cost)}元，工期 ${q.months} 个月。`, 'info'); return { ok:true };
  }
  function depotsMonth(y){ let up = 0;
    depotsOf().forEach(d => { if (d.lv) up += DEPOT_LV[d.lv].upkeep * 1e4 * cpi(y); });
    S.cash -= up; S.month.depot = up; S.month.trackMaint = (S.month.trackMaint || 0) + up; return up; }
  function overhaulQuote(t){ const y = ym(S.day).y; return t.price * 0.15 * (cpi(y) / cpi(t.year || 1985)); }
  function overhaulIssue(t){
    if (!t) return '找不到列车';
    if (t.status === 'delivery' || t.status === 'overhaul') return '该车当前不能大修';
    return yrsSinceOvh(t) < 2 ? '距上次大修不足 2 年' : '';
  }
  const overhaulDays = t => depotCover[t.id] ? 18 : 30;
  function quoteTrainOverhaul(ids){
    const trains = selectedTrains(ids);
    const entries = trains.filter(t => !overhaulIssue(t)).map(train => ({ train, amount:overhaulQuote(train), days:overhaulDays(train) }));
    return { entries, total:entries.reduce((sum, entry) => sum + entry.amount, 0), skipped:trains.length - entries.length };
  }
  function overhaulTrains(ids){
    const { entries, total } = quoteTrainOverhaul(ids), count = entries.length;
    if (!count) return { ok:false, msg:'所选列车目前无法大修' };
    if (S.cash < total) return { ok:false, msg:'现金不足' };
    S.cash -= total; S.month.ovhCost = (S.month.ovhCost || 0) + total;
    for (const { train, days } of entries){
      train.status = 'overhaul'; train.ovhDone = S.day + days;
    }
    if (count === 1){
      const { train, days } = entries[0];
      log('车辆大修', `${train.name} 进厂大修，费用 ${fmtW(total)}元，停运 ${days} 天${days < 30 ? '（就近机务段检修）' : ''}。`, 'info');
    } else log('批量大修', `${count} 列车进厂大修，合计支出 ${fmtW(total)}元。`, 'info');
    recompute();
    return { ok:true, count, total, ids:entries.map(({ train }) => train.id) };
  }
  function overhaul(tid){
    const t = S.trains.find(x => x.id === tid), issue = overhaulIssue(t);
    if (issue) return { ok:false, msg:issue };
    const days = overhaulDays(t), result = overhaulTrains([tid]);
    return result.ok ? { ok:true, cost:result.total, days } : result;
  }
  function breakdowns(){
    const hit = [];
    S.trains.forEach(t => {
      if (t.status !== 'run') return;
      const p = (0.006 + 0.0035 * yrsSinceOvh(t)) * (1 - 0.12 * exLv('ce')) * (1 - 0.18 * trLv());
      if (Math.random() < p) {
        const c = t.price * 0.012; S.cash -= c; S.month.ovhCost = (S.month.ovhCost||0) + c;
        t.status = 'repair'; t.ovhDone = S.day + 7 + Math.floor(Math.random() * 8);
        hit.push([t.name, c]);
      }
    });
    if (!hit.length) return;
    addRep(-0.25 * Math.min(4, hit.length));
    const cost = hit.reduce((a, h) => a + h[1], 0);
    log('机车故障', hit.length === 1 ? `${hit[0][0]} 途中故障，临修 1–2 周，费用 ${fmtW(cost)}元。车龄越久故障越多，可安排大修。`
      : `本月 ${hit.length} 台车途中故障（${hit.slice(0,3).map(h => h[0]).join('、')}${hit.length>3?' 等':''}），临修费用合计 ${fmtW(cost)}元。`, 'warn');
  }

  // ---------- 运输合同 ----------
  const SHIPPERS = { coal:['矿务局','煤业公司','发电厂'], ore:['钢铁公司','矿业公司'], steel:['钢铁公司','机械厂'], grain:['粮食局','粮油公司','农垦总局'], oil:['石化公司','油田'], cont:['外贸公司','港务局','船务代理'], general:['百货批发站','供销社','轻工公司'] };
  function genContracts(y){
    const SD = cities.map(c => cargoSD(c, y));
    const near = {}; S.tracks.forEach(tr => { if (tr.owner === 'P' || tr.status === 'ok') { const e = edges[tr.e]; if (tr.owner === 'P') { near[e.a] = 3; near[e.b] = 3; } } });
    Object.keys(S.lit).forEach(c => near[c] = Math.max(near[c]||0, 2));
    const pool = [];
    CARGO_IDS.forEach(g => {
      if (g === 'cont' && y < 1990) return;
      const src = cities.filter(c => SD[c.i].S[g] > 0.5), dst = cities.filter(c => SD[c.i].D[g] > 0.5);
      src.forEach(a => dst.forEach(b => {
        if (a.i === b.i || stationLv(a.i) === 0 && isTown(a.i) && !near[a.i]) return;
        const d = hav(a, b) * 1.2; if (d < 250 || d > 1800) return;
        const w = SD[a.i].S[g] * SD[b.i].D[g] / Math.sqrt(d) * ((near[a.i]||0.6) + (near[b.i]||0.6));
        pool.push({ g, a:a.i, b:b.i, d, w });
      }));
    });
    pool.sort((u, v) => v.w - u.w); const top = pool.slice(0, 60); const tot = top.reduce((s, x) => s + x.w, 0);
    const out = []; let guard = 0;
    while (out.length < 3 && top.length && guard++ < 50) {
      let r = Math.random() * tot, pick = top[0]; for (const x of top) { r -= x.w; if (r <= 0) { pick = x; break; } }
      if (out.some(o => o.g === pick.g && o.a === pick.a && o.b === pick.b) || S.contracts.some(o => o.g === pick.g && o.a === pick.a && o.b === pick.b)) continue;
      const months = [12, 12, 24, 36][Math.floor(Math.random() * 4)];
      const era = 1 + (y - 1985) * 0.04;
      const tons = Math.round((1.5 + Math.random() * 5) * (0.6 + S.rep / 125) * era * CARGO[pick.g].k) * 1e4;
      const mBonus = tons * pick.d * 0.022 * cpi(y) * 0.22 * CARGO[pick.g].rate;
      const sh = SHIPPERS[pick.g];
      out.push({ id:S.nid++, g:pick.g, a:Math.min(pick.a, pick.b), b:Math.max(pick.a, pick.b), from:pick.a, d:Math.round(pick.d), tons, months,
        mBonus, fBonus: mBonus * months * 0.25, penalty: mBonus * 1.4, expire: S.day + 90,
        shipper: cities[pick.a].name + sh[Math.floor(Math.random() * sh.length)] });
    }
    S.offers = S.offers.filter(o => o.expire > S.day).concat(out).slice(-6);
    if (out.length) log('运输合同', `收到 ${out.length} 份新的货主运输合同邀约，请在「合同」页查看。`, 'info');
  }
  function acceptContract(id){
    const i = S.offers.findIndex(o => o.id === id); if (i < 0) return { ok:false, msg:'邀约已失效' };
    if (S.offers[i].expire <= S.day) { S.offers.splice(i, 1); return { ok:false, msg:'邀约已过期' }; }
    if (S.contracts.length >= 4 + Math.floor(S.rep / 25)) return { ok:false, msg:'同时履行的合同已达上限（商誉越高上限越高）' };
    const o = S.offers.splice(i, 1)[0];
    Object.assign(o, { start:S.day, left:o.months, done:0, strikes:0, served:0, hist:[] });
    S.contracts.push(o);
    log('签订合同', `与${o.shipper}签订合同：${cities[o.from].name}→${cities[o.from === o.a ? o.b : o.a].name} ${CARGO[o.g].name}每月 ${(o.tons/1e4).toFixed(1)} 万吨，为期 ${o.months} 个月。`, 'good');
    recompute(); return { ok:true };
  }
  function declineContract(id){ S.offers = S.offers.filter(o => o.id !== id); }
  function contractKey(o){ return 'freight:' + o.g + ':' + o.a + '-' + o.b; }
  function checkContracts(y){
    let income = 0; const used = {};
    S.contracts.slice().forEach(o => {
      const k = contractKey(o), act = (S.month.pairs || {})[k] || 0;   // 本月实际完成的吨数，扣除已分给其他合同的部分
      const served = Math.max(0, Math.min(o.tons, act - (used[k]||0))); used[k] = (used[k]||0) + served;
      const ratio = served / o.tons; const grace = o.months - o.left < 2;
      o.left--; o.done++; o.hist.push(Math.round(ratio * 100)); o.served = ratio;
      if (ratio >= 0.8) { income += o.mBonus * Math.min(1, ratio) * (1 + 0.05 * exLv('gm')); addRep(0.08); }
      else if (!grace) { income -= o.penalty; o.strikes++; addRep(-1.2);
        log('合同违约', `${o.shipper}合同本月只完成 ${Math.round(ratio*100)}%，支付违约金 ${fmtW(o.penalty)}元（第 ${o.strikes}/3 次）。`, 'bad'); }
      if (o.strikes >= 3) { S.contracts = S.contracts.filter(x => x !== o); addRep(-6, `${o.shipper}因多次违约解除合同`); return; }
      if (o.left <= 0) {
        S.contracts = S.contracts.filter(x => x !== o);
        const good = o.hist.filter(h => h >= 80).length / o.hist.length;
        if (good >= 0.75) { income += o.fBonus; addRep(3, `${o.shipper}合同圆满完成，获得履约奖励 ${fmtW(o.fBonus)}元`); }
        else log('合同到期', `${o.shipper}合同到期，履约率 ${Math.round(good*100)}%，未达到奖励标准。`, 'info');
      }
    });
    return income;
  }

  // ---------- 企业债 ----------
  function bondRate(){ const y = ym(S.day).y; return Math.max(0.02, rate(y) - 0.005 - 0.002 * exLv('cfo') + (50 - S.rep) * 0.0004); }
  function bondRoom(){ return Math.max(0, netWorth() * 0.3 - S.bonds.reduce((s, b) => s + b.amt, 0)); }
  function issueBond(amt){
    const y = ym(S.day).y; if (y < 1993) return { ok:false, msg:'1993 年起才允许企业发行债券' };
    amt = Math.min(amt, bondRoom()); if (amt < 1e6) return { ok:false, msg:'发债额度不足（上限为净资产的 30%）' };
    const b = { id:S.nid++, amt, rate:bondRate(), due:S.day + 5 * 365, y };
    S.bonds.push(b); S.cash += amt * 0.99; finAdd('bondIn', amt * 0.99);
    log('发行企业债', `发行 5 年期企业债 ${fmtW(amt)}元，票面利率 ${(b.rate*100).toFixed(2)}%。`, 'info');
    return { ok:true, b };
  }
  function bondsMonth(){
    let interest = 0;
    S.bonds.slice().forEach(b => {
      interest += b.amt * b.rate / 12;
      if (S.day >= b.due) { S.cash -= b.amt; finAdd('bondOut', b.amt); S.bonds = S.bonds.filter(x => x !== b); log('债券到期', `${b.y} 年发行的企业债到期，兑付本金 ${fmtW(b.amt)}元。`, 'info'); }
    });
    return interest;
  }

  // ---------- 上市与股价 ----------
  function ttmProfit(){ const H = S.history.slice(-12); return H.reduce((s, h) => s + (h.net || 0), 0); }
  function sentOf(y){ return MARKET_SENT[y] || 1; }
  function valuation(){
    const y = ym(S.day).y; const nw = Math.max(0, netWorth()), pr = Math.max(0, ttmProfit());
    const pay = S.ipo ? [0.92, 1, 1.08][S.ipo.payoutLv || 0] : 1;
    return (nw * 0.85 + pr * 11) * sentOf(y) * (0.8 + S.rep / 250) * pay * (1 + 0.04 * exLv('cfo'));
  }
  function ipoCheck(){
    const y = ym(S.day).y; const why = [];
    if (S.ipo) return { ok:false, why:['已经上市'] };
    if (y < 1993) why.push('1993 年起开放铁路企业上市');
    if (netWorth() < 2e8) why.push('净资产需达到 2 亿元');
    const last3 = (S.reports || []).slice(-3);
    if (last3.length < 3 || last3.some(r => r.net <= 0)) why.push('需要连续 3 个年度盈利');
    if (S.rep < 40) why.push('商誉需不低于 40');
    return { ok: !why.length, why };
  }
  function doIPO(){
    const c = ipoCheck(); if (!c.ok) return { ok:false, msg:c.why.join('；') };
    const v = valuation(); const shares = Math.max(5e7, Math.round(v * 0.88 / 6 / 1e6) * 1e6), price = v / shares * 0.88; // 发行价约 6 元
    const pub = shares * 0.25, raise = pub * price * 0.97;
    S.ipo = { shares, pub, price, payoutLv:1, lastIssue:S.day, listed:S.day, ipoPrice:price, hist:[{ d:S.day, p:price }] };
    S.cash += raise; finAdd('equityIn', raise);
    log('公司上市', `${S.company} 成功上市，发行 ${(pub/1e4).toFixed(0)} 万股，发行价 ${price.toFixed(2)} 元，募集资金 ${fmtW(raise)}元。`, 'good');
    addRep(5); pendingPopups.push({ type:'ipo', price, raise });
    return { ok:true, raise };
  }
  function stockMonth(){
    if (!S.ipo) return; const I = S.ipo;
    const fair = valuation() / I.shares;
    I.price = Math.max(0.5, I.price * 0.65 + fair * 0.35) * (1 + (Math.random() - 0.5) * 0.08);
    I.hist.push({ d:S.day, p:I.price }); if (I.hist.length > 360) I.hist.shift();
  }
  function setPayout(lv){ if (S.ipo) S.ipo.payoutLv = clamp(lv|0, 0, 2); }
  function secondaryQuote(){ if (!S.ipo) return null; const n = S.ipo.shares * 0.1; return { n, raise: n * S.ipo.price * 0.92 * 0.97, wait: Math.max(0, S.ipo.lastIssue + 730 - S.day) }; }
  function secondary(){
    const q = secondaryQuote(); if (!q) return { ok:false, msg:'尚未上市' };
    if (q.wait > 0) return { ok:false, msg:`距上次发行不足 2 年（还需 ${Math.ceil(q.wait/30)} 个月）` };
    S.ipo.shares += q.n; S.ipo.pub += q.n; S.ipo.lastIssue = S.day; S.cash += q.raise; finAdd('equityIn', q.raise); S.ipo.price *= 0.96;
    log('增发新股', `增发 ${(q.n/1e4).toFixed(0)} 万股，募集资金 ${fmtW(q.raise)}元。`, 'info'); return { ok:true };
  }
  function buyback(){
    if (!S.ipo) return { ok:false, msg:'尚未上市' };
    const n = Math.min(S.ipo.pub * 0.08, S.ipo.shares * 0.02); const cost = n * S.ipo.price * 1.02;
    if (n < 1e4) return { ok:false, msg:'流通股过少' }; if (S.cash < cost) return { ok:false, msg:'现金不足' };
    S.cash -= cost; finAdd('buyback', cost); S.ipo.shares -= n; S.ipo.pub -= n; S.ipo.price *= 1.02;
    log('股份回购', `回购并注销 ${(n/1e4).toFixed(0)} 万股，耗资 ${fmtW(cost)}元。`, 'info'); return { ok:true, cost };
  }
  function payDividend(profit){
    if (!S.ipo || profit <= 0) return 0;
    const I = S.ipo, ratio = [0, 0.2, 0.4][I.payoutLv || 0]; const per = profit * ratio / I.shares;
    // 公众、友好投资者、同业持股都按股份领取红利；发起人（本公司控股方）部分留在公司
    const rv = S.rivals.reduce((a, r) => a + (r.stake || 0), 0); const outside = I.pub + (I.friendly || 0) + rv;
    const amt = per * outside;
    if (amt > 0) { S.cash -= amt; S.month.fin.div = (S.month.fin.div || 0) + amt; S.rivals.forEach(r => { if (r.stake) r.cash += per * r.stake; });
      log('年度分红', `向外部股东（公众${I.friendly ? '、战略投资者' : ''}${rv ? '、同业' : ''}）派发现金红利 ${fmtW(amt)}元（分红率 ${ratio*100}%）。`, 'info'); }
    if (ratio === 0) addRep(-1); else if (ratio >= 0.4) addRep(1.5);
    return amt;
  }
  function marketCap(){ return S.ipo ? S.ipo.price * S.ipo.shares : 0; }

  // ---------- 收购同业 ----------
  function acquireQuote(rid){
    const r = S.rivals.find(x => x.id === rid); if (!r) return null;
    const y = ym(S.day).y; const why = [];
    if (y < 1995) why.push('1995 年起允许铁路企业兼并重组');
    if (!r.active || r.acquired) why.push('该公司未在经营');
    const km0 = S.tracks.filter(x => x.owner === rid).reduce((s, x) => s + edges[x.e].dist, 0);
    if (r.value >= netWorth() * 0.6) why.push('对方规模需小于本公司净资产的 60%');
    const price = Math.max(r.value, 5e7) * 1.3 + km0 * 4e5 * cpi(y);
    const km = S.tracks.filter(x => x.owner === rid).reduce((s, x) => s + edges[x.e].dist, 0);
    if (S.cash < price - r.cash) why.push('现金不足');
    return { ok: !why.length, why, price, net: price - r.cash, km, cash:r.cash };
  }
  function acquireRival(rid){
    const q = acquireQuote(rid); if (!q || !q.ok) return { ok:false, msg: q ? q.why.join('；') : '找不到该公司' };
    const r = S.rivals.find(x => x.id === rid); const def = RIVALS.find(x => x.id === rid);
    S.cash -= q.net; S.month.build += q.net;
    S.tracks.filter(x => x.owner === rid).forEach(tr => {
      const mine = ownTrackFor(tr.e, tr.v);
      if (!mine) { tr.owner = 'P'; tr.cost = (tr.cost || 0) * 0.85; return; }
      tr.dead = true;
      if (tr.status !== 'ok') return;
      if (mine.upg) { mine.upg.v = Math.max(mine.upg.v, tr.v); mine.upg.elec ||= tr.elec; }
      if (isHighSpeed(mine.v) === isHighSpeed(tr.v)) {
        mine.v = Math.max(mine.v, tr.v); mine.elec ||= tr.elec;
        mine.sig = Math.max(sigOf(mine), sigOf(tr)); mine.status = 'ok';
      }
    });
    S.tracks = S.tracks.filter(x => !x.dead);
    if (r.stake && S.ipo) { S.ipo.shares -= r.stake; r.stake = 0; } r.plan = null; (S.wars || []).forEach(w => { if (w.rid === rid && !w.ended) w.ended = S.day; });
    // 对方持有的干线经营权随兼并退回主管部门
    (S.franch || []).forEach(f => { if (f.st === 'held' && f.holder === rid) { f.st = 'end'; f.end = S.day; log('经营权退回', `「${f.name}」随 ${def.name} 被兼并退回主管部门，将重新招标。`, 'info'); } });
    r.active = false; r.acquired = ym(S.day).y; r.cash = 0; r.value = 0; r.debt = 0;
    addRep(3);
    log('收购同业', `${S.company} 以 ${fmtW(q.price)}元收购 ${def.name}，接收线路 ${q.km} km。`, 'good');
    pendingPopups.push({ type:'acq', name:def.name, km:q.km, price:q.price });
    recompute(); return { ok:true };
  }

  // ---------- 成就 ----------
  const ACH = [
    { id:'lit5', name:'初露锋芒', desc:'点亮 5 座城市', test: s => Object.keys(s.litEver).length >= 5 },
    { id:'lit15', name:'纵横南北', desc:'点亮 15 座城市', test: s => Object.keys(s.litEver).length >= 15 },
    { id:'lit30', name:'通达四方', desc:'点亮 30 座城市', test: s => Object.keys(s.litEver).length >= 30 },
    { id:'lit50', name:'路网之王', desc:'点亮 50 座城市', test: s => Object.keys(s.litEver).length >= 50 },
    { id:'lhasa', name:'天路', desc:'点亮拉萨', test: s => !!s.litEver[cityIdx['拉萨']] },
    { id:'w10', name:'十亿身家', desc:'公司净资产达到 10 亿元', test: s => netWorth() >= 1e9 },
    { id:'w100', name:'百亿集团', desc:'公司净资产达到 100 亿元', test: s => netWorth() >= 1e10 },
    { id:'hsr', name:'风驰电掣', desc:'拥有一条 350 km/h 的自有线路', test: s => s.tracks.some(t => t.owner==='P' && t.v >= 350 && t.status==='ok') },
    { id:'km1000', name:'千里铁道', desc:'自有线路超过 1000 km', test: s => s.tracks.filter(t => t.owner==='P' && t.status==='ok').reduce((a,t)=>a+edges[t.e].dist,0) >= 1000 },
    { id:'km5000', name:'万里长龙', desc:'自有线路超过 5000 km', test: s => s.tracks.filter(t => t.owner==='P' && t.status==='ok').reduce((a,t)=>a+edges[t.e].dist,0) >= 5000 },
  ];
  function checkAchievements(){ ACH.forEach(a => { if (!S.achievements[a.id] && a.test(S)) { S.achievements[a.id] = ym(S.day).y; log('成就达成 · ' + a.name, a.desc, 'good'); pendingPopups.push({ type:'ach', a }); } }); }

  // ---------- 存档 ----------
  // —— 存档：自动存档 + 5 个手动存档位（manual 即 1 号位，兼容旧存档）——
  const SLOTS = ['manual', 's2', 's3', 's4', 's5'];
  const SAVE_VER = 7;
  function saveMeta(){ const t = ym(S.day); return { company:S.company, date:`${t.y}年${t.m}月`, worth:netWorth(), lit:Object.keys(S.lit || {}).length, scn:S.scn ? (SCENARIOS.find(x => x.id === S.scn.id) || {}).title || null : null, at:Date.now() }; }
  function metas(){ try { return JSON.parse(localStorage.getItem('tdcq2_meta') || '{}'); } catch(e) { return {}; } }
  function save(slot){ S.saveVer = SAVE_VER; return writeSave(slot || 'manual', S, saveMeta); }
  function writeSave(slot, state, meta){ localStorage.setItem('tdcq2_save_' + slot, JSON.stringify(state));
    // 先写内容，再写摘要；摘要写失败时读档界面会从内容重建
    try { const m = metas(); m[slot] = meta(); localStorage.setItem('tdcq2_meta', JSON.stringify(m)); } catch(e) {} return true; }
  // —— 存档校验：不通过则拒绝读取，并给出具体字段 ——
  const fin = v => typeof v === 'number' && isFinite(v);
  // 顶层字段：缺失时用默认值补齐（旧档兼容），类型不对则拒绝
  const ARR = () => [], OBJ = () => ({});
  const STATE_DEF = { lifetime:() => ({ pax:0, tons:0, rev:0, trips:0 }), imports:null, lit:OBJ, litEver:OBJ, achievements:OBJ, boost:OBJ, cityLv:OBJ, reports:ARR, evSeen:OBJ,
    offers:ARR, contracts:ARR, bonds:ARR, policies:ARR, stateEvents:ARR, unlock:OBJ, stations:OBJ, serial:OBJ, wars:ARR, gov:ARR, depots:ARR, supers:OBJ, franch:ARR, overseas:ARR,
    locals:ARR, jv:ARR, usedOffers:ARR, usedMarket:ARR, cands:ARR, execs:OBJ, biz:OBJ, bizCost:OBJ, land:OBJ, stSub:OBJ, slowSub:OBJ, cityTrips:OBJ, carDepot:OBJ };
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  function validateState(st, ver){ try { return validateState0(st, ver); } catch(e) { return ['存档结构异常：' + (e && e.message || e)]; } }
  function validateState0(st, ver){
    const err = []; const add = m => { if (err.length < 6) err.push(m); };
    if (!st || typeof st !== 'object') return ['存档内容为空'];
    const sv = ver !== undefined ? ver : st.saveVer;
    if (sv !== undefined && !(fin(sv) && sv <= SAVE_VER)) add(`存档版本 ${sv} 比当前游戏（${SAVE_VER}）更新，请先更新游戏`);
    if (!fin(st.day) || st.day < 0) add('日期 day 无效');
    if (!fin(st.cash)) add('现金 cash 无效');
    if (!fin(st.debt) || st.debt < 0) add('银行负债 debt 无效');
    if (typeof st.lastYM !== 'string' || !/^\d{4}-\d{1,2}$/.test(st.lastYM)) add('已结算年月 lastYM 缺失或格式错误');
    if (!st.mods || typeof st.mods !== 'object') add('政策参数 mods 缺失');
    if (!isObj(st.month)) add('当月账 month 缺失');
    else Object.entries(blankMonth()).forEach(([k, v]) => { if (typeof v === 'number' && st.month[k] !== undefined && !fin(st.month[k])) add(`当月账 month.${k} 无效`); });
    if (!fin(st.nid)) add('编号计数 nid 无效');
    if (typeof st.company !== 'string') add('公司名 company 无效');
    if (st.rep !== undefined && !fin(st.rep)) add('商誉 rep 无效');
    ['tracks','trains','routes','rivals','history','news'].forEach(k => { if (!Array.isArray(st[k])) add(`${k} 不是列表`); });
    Object.entries(STATE_DEF).forEach(([k, d]) => { const v = st[k]; if (v === undefined || v === null) return;
      if (k === 'imports') { if (!isObj(v) || !fin(v.y) || !fin(v.n)) add('进口额度 imports 无效'); return; }
      if (k === 'lifetime') { if (!isObj(v) || ['pax','tons','rev','trips'].some(q => !fin(v[q]))) add('累计统计 lifetime 无效'); return; }
      const want = d() ; if (Array.isArray(want) ? !Array.isArray(v) : !isObj(v)) add(`${k} 类型错误`); });
    if (st.ipo !== undefined && st.ipo !== null && (!isObj(st.ipo) || ['shares','pub','price'].some(q => !fin(st.ipo[q])) || !Array.isArray(st.ipo.hist))) add('上市信息 ipo 无效');
    if (st.scn !== undefined && st.scn !== null && (!isObj(st.scn) || !SCENARIOS.some(x => x.id === st.scn.id))) add('剧本信息 scn 无效');
    if (st.rd !== undefined && st.rd !== null && (!isObj(st.rd) || !isObj(st.rd.done) || !fin(st.rd.pts))) add('研发信息 rd 无效');
    if (st.rd && st.rd.designs !== undefined && !Array.isArray(st.rd.designs)) add('自主设计 designs 不是列表');
    if (err.length) return err;
    registerDesigns(st);   // 自主设计车型要先登记，列车才能通过车型校验
    Object.entries(st.carDepot || {}).forEach(([id, item]) => { if (!carById[id] || !isObj(item) || !Number.isSafeInteger(item.n) || item.n <= 0 || !fin(item.value) || item.value < 0) add('车厢库数据无效'); });
    st.rivals.forEach((r, i) => { if (!r || !RIVALS.some(x => x.id === r.id) || !fin(r.cash)) add(`第 ${i+1} 家同业数据无效`); });
    const rv = new Set(RIVALS.map(r => r.id)), owners = new Set(['P','S', ...rv]);
    st.tracks.forEach((tr, i) => { if (!tr || !Number.isInteger(tr.e) || !edges[tr.e]) add(`第 ${i+1} 段轨道的走廊编号无效`);
      else if (!owners.has(tr.owner)) add(`第 ${i+1} 段轨道的产权方 ${tr.owner} 无效`);
      else if (!fin(tr.v) || tr.v <= 0) add(`第 ${i+1} 段轨道速度无效`);
      else if (!['ok','build'].includes(tr.status)) add(`第 ${i+1} 段轨道状态 ${tr.status} 无效`); });
    const rids = new Set();
    st.routes.forEach((r, i) => { if (!r || !Array.isArray(r.stops) || r.stops.length < 2) { add(`线路 ${i+1} 站点不完整`); return; }
      rids.add(r.id);
      if (r.stops.some(c => !Number.isInteger(c) || !cities[c])) { add(`线路「${r.name || i+1}」含无效城市`); return; }
      for (let k = 0; k < r.stops.length - 1; k++) if (!edgeByPair[r.stops[k] + '-' + r.stops[k+1]]) { add(`线路「${r.name || i+1}」的 ${cities[r.stops[k]].name}—${cities[r.stops[k+1]].name} 不相邻`); break; } });
    st.trains.forEach((t, i) => { if (!t || !trainById[t.model]) { add(`第 ${i+1} 列车车型 ${t && t.model} 不存在`); return; }
      if (!['run','idle','delivery','overhaul','repair'].includes(t.status)) add(`${t.name || '列车'} 状态 ${t.status} 无效`);
      if (t.route !== null && t.route !== undefined && !rids.has(t.route)) add(`${t.name || '列车'} 分配的线路不存在`);
      if (!fin(t.price) || !fin(t.bought)) add(`${t.name || '列车'} 价格或购买日期无效`);
      if (t.cars !== undefined && t.cars !== null && !Array.isArray(t.cars)) add(`${t.name || '列车'} 编组 cars 不是列表`);
      else (t.cars || []).forEach(x => { if (!isObj(x) || typeof x.id !== 'string' || !carById[x.id] || !fin(x.n) || x.n < 0) add(`${t.name || '列车'} 编组中有无效车厢`); });
      if (t.service !== undefined && !supportsUse(trainById[t.model], t.service)) add(`第 ${i+1} 列车用途无效`);
      if (t.carBasis !== undefined && (!isObj(t.carBasis) || Object.entries(t.carBasis).some(([id, value]) => !carById[id] || !fin(value) || value < 0) || Object.values(t.carBasis).reduce((a, b) => a + b, 0) > t.price + 0.01)) add(`第 ${i+1} 列车的车厢账面价值无效`);
      if (typeof t.name !== 'string') add('列车名称无效'); if (!fin(t.id)) add('列车编号无效'); });
    st.history.forEach((h, i) => { if (!h || !fin(h.y) || !fin(h.m) || !fin(h.net)) add(`月报第 ${i+1} 条无效`); });
    return err;
  }
  function migrate(st){
    Object.entries(STATE_DEF).forEach(([k, d]) => { if (st[k] === undefined || st[k] === null) { if (k === 'imports') st.imports = { y:dateOf(st.day).getFullYear(), n:0 }; else st[k] = d(); } });
    Object.entries(blankMonth()).forEach(([k, v]) => { if (st.month[k] === undefined) st.month[k] = v; });
    if (st.rep === undefined) st.rep = 50;
    // 旧版自动存档在 lastYM 推进前保存：若最后一条月报就是 lastYM，说明该月已结账，推进游标避免重复结算
    const h = st.history[st.history.length - 1];
    if (h && st.lastYM === h.y + '-' + h.m) { const d = dateOf(st.day); st.lastYM = d.getFullYear() + '-' + (d.getMonth() + 1); }
    return st;
  }
  // 旧存档升级到扩展地图：补上 1985 年既有的新走廊、已经开通的国铁新线和已出台的开放政策（不弹窗）
  function ensureFrontier(){
    if (S.mapVer >= 2) return;
    const t = ym(S.day), passed = o => t.y > o.y || (t.y === o.y && t.m >= o.m);
    const newE = e => e.i >= BASE_EDGES;
    edges.forEach(e => { if (newE(e) && e.line && !S.tracks.some(x => x.e === e.i && x.owner === 'S'))
      S.tracks.push({ id:S.nid++, e:e.i, owner:'S', v:e.v0, elec:!!e.elec0, status:'ok', line:e.line, cost:0, built:0 }); });
    const pols = [];
    POLICIES.forEach(p => { if (!/^X/.test(p.id) || S.policies.includes(p.id) || !passed(p)) return; S.policies.push(p.id); p.apply(S); S.unlock[p.id] = true; pols.push(p.title); });
    // 旧国铁提速、电气化事件对新走廊同样生效（如陇海线东延连云港段）
    STATE_EVENTS.forEach((ev, k) => { if (k >= STATE_EVENTS_BASE || !S.stateEvents.includes(k)) return;
      if (ev.kind === 'speed') S.tracks.forEach(tr => { if (tr.owner === 'S' && newE(edges[tr.e]) && ev.lines.some(l => (tr.line||'').startsWith(l)) && tr.v < ev.v && tr.v <= 200) tr.v = ev.v; });
      if (ev.kind === 'elec') S.tracks.forEach(tr => { if (tr.owner === 'S' && newE(edges[tr.e]) && ev.lines.some(l => (tr.line||'').startsWith(l))) tr.elec = true; }); });
    const lines = [];
    STATE_EVENTS.forEach((ev, k) => { if (k < STATE_EVENTS_BASE || S.stateEvents.includes(k) || !passed(ev)) return; S.stateEvents.push(k);
      if (ev.kind !== 'build') return;
      ev.edges.forEach(([a, b]) => { const e = edgeByPair[cityIdx[a] + '-' + cityIdx[b]]; if (!e || S.tracks.some(x => x.e === e.i && x.owner === 'S' && isHighSpeed(x.v) === isHighSpeed(ev.v) && x.v >= ev.v)) return;
        S.tracks.push({ id:S.nid++, e:e.i, owner:'S', v:ev.v, elec:!!ev.elec, status:'ok', line:ev.name, cost:0, built:S.day }); });
      lines.push(ev.name); });
    S.mapVer = 2;
    log('地图扩展', `地图新增西北、东北、西南边疆城市和蒙古、俄罗斯、中亚、南亚、东南亚、朝鲜半岛的海外城市。${lines.length ? `已开通的铁路新线：${lines.join('、')}。` : ''}${pols.length ? `已出台的开放政策：${pols.join('、')}。` : ''}`, 'info');
  }
  function fixUp(){ ensureFrontier(); ensureT2(); ensureT4(); ensureT5(); S.trains.forEach(t => { if (!t.cars) t.cars = defaultConsist(trainModel(t)); }); recompute(); }
  // 在临时状态里迁移、校验、重建缓存；全部成功后才切换，失败时原局面原样保留
  function adopt(st, ver){
    const errs = validateState(st, ver); if (errs.length) { registerDesigns(S); return { ok:false, msg:errs.join('；') }; }
    flushAutoSave();
    const old = S;
    try { S = migrate(st); fixUp(); if (!fin(netWorth())) throw new Error('净资产计算异常'); }
    catch(e) { S = old; registerDesigns(S); if (S) { try { recompute(); } catch(_) {} } return { ok:false, msg:'存档内容损坏：' + (e && e.message || e) }; }
    return { ok:true };
  }
  let lastLoadErr = '';
  function load(slot){ if (slot === 'auto') flushAutoSave(); let s; try { s = localStorage.getItem('tdcq2_save_' + (slot||'manual')); } catch(e) { lastLoadErr = '浏览器存储不可用'; return false; }
    if (!s) { lastLoadErr = '没有存档'; return false; }
    let st; try { st = JSON.parse(s); } catch(e) { lastLoadErr = '存档格式无法解析'; return false; }
    const r = adopt(st); lastLoadErr = r.ok ? '' : r.msg; return r.ok; }
  function hasSave(slot){ try { return !!localStorage.getItem('tdcq2_save_' + (slot||'manual')); } catch(e) { return false; } }
  function metaFromContent(slot){ try { const st = JSON.parse(localStorage.getItem('tdcq2_save_' + slot)); const d = dateOf(st.day); return { company:st.company, date:`${d.getFullYear()}年${d.getMonth()+1}月`, worth:NaN, lit:Object.keys(st.lit || {}).length, scn:null, at:null }; } catch(e) { return null; } }
  function listSaves(){ const m = metas(); return ['auto'].concat(SLOTS).map(k => { const has = hasSave(k); return { slot:k, has, meta:m[k] || (has ? metaFromContent(k) : null) }; }); }
  function deleteSave(slot){ try { localStorage.removeItem('tdcq2_save_' + slot); const m = metas(); delete m[slot]; localStorage.setItem('tdcq2_meta', JSON.stringify(m)); } catch(e) {} }
  function exportSave(){ return JSON.stringify({ game:'tdcq', ver:SAVE_VER, meta:saveMeta(), S }); }
  function importSave(str){ let o; try { o = JSON.parse(str); } catch(e) { return { ok:false, msg:'文件不是有效的存档' }; }
    const wrapped = o && o.game === 'tdcq'; const st = wrapped ? o.S : o;
    if (!st || !Array.isArray(st.tracks) || !Array.isArray(st.trains) || typeof st.day !== 'number') return { ok:false, msg:'文件不是本游戏的存档' };
    return adopt(st, wrapped ? o.ver : undefined); }

  // =============================================================
  //  第四层：主动的对手（抢线、价格战、敌意收购）与政府任务
  // =============================================================
  function ensureT5(){ depotsOf(); ensureT6(); }
  function ensureT4(){ S.wars = S.wars || []; S.gov = S.gov || []; S.rivals.forEach(r => { if (r.stake === undefined) r.stake = 0; }); }
  const rivalDef = id => RIVALS.find(x => x.id === id);
  function rivalNodes(rid){ const s = new Set(); S.tracks.forEach(x => { if (x.owner === rid && x.status === 'ok') { s.add(edges[x.e].a); s.add(edges[x.e].b); } }); return s; }
  function warOf(rid){ return (S.wars || []).find(w => w.rid === rid && !w.ended); }
  function warAt(ci, cj){ return (S.wars || []).find(w => !w.ended && w.cities.includes(ci) && w.cities.includes(cj)); }
  function warShare(ci, cj){ const w = warAt(ci, cj); return !w ? 1 : w.resp === 'match' ? 0.98 : 0.72; }
  function warPairFare(ci, cj){ const w = warAt(ci, cj); return w && w.resp === 'match' ? 0.85 : 1; }
  function warFare(r){ if (!r || !(S.wars || []).length) return 1; const w = (S.wars || []).find(w => !w.ended && w.resp === 'match' && r.stops.filter(c => w.cities.includes(c)).length >= 2); return w ? 0.85 : 1; }
  function playerRouteEdges(){ const s = new Set(); S.routes.forEach(r => { for (let k = 0; k < r.stops.length - 1; k++){ const e = edgeByPair[r.stops[k] + '-' + r.stops[k+1]]; if (e) s.add(e.i); } }); return s; }
  function warRespond(rid, resp){ const w = warOf(rid); if (!w) return false; w.resp = resp === 'match' ? 'match' : 'hold';
    log('价格战 · 应对', resp === 'match' ? `跟进降价：在与${rivalDef(rid).name}重叠的城市间，本公司票价下调 15%，客源基本保住。` : `保持票价：重叠城市间约 28% 的客源被${rivalDef(rid).name}抢走。`, 'info'); recompute(); return true; }
  function warsMonth(y){
    (S.wars || []).forEach(w => { if (w.ended) return; const r = S.rivals.find(x => x.id === w.rid); const def = rivalDef(w.rid);
      if (!r || !r.active) { w.ended = S.day; return; }
      const km = S.tracks.filter(x => x.owner === r.id && x.status === 'ok').reduce((s, x) => s + edges[x.e].dist, 0);
      r.cash -= (km * 450 + 1.5e6) * cpi(y) * (w.resp === 'match' ? 2.4 : 1);
      if (r.cash < -Math.max(5e7, r.value * 0.15)) { w.ended = S.day; w.win = true; r.warCd = S.day + 1080;
        if (w.resp === 'match') addRep(3, `${def.name} 资金告急，宣布退出价格战`); else log('价格战结束', `${def.name} 资金告急，恢复正常票价。`, 'info'); }
      else if (S.day >= w.until) { w.ended = S.day; log('价格战结束', `${def.name} 结束降价，重叠城市间的票价恢复正常。`, 'info'); }
    });
    if ((S.wars || []).some(w => w.ended === S.day)) recompute();
    S.wars = (S.wars || []).filter(w => !w.ended || S.day - w.ended < 400);
  }
  function maybeWar(r, def, y){
    if (y < 1988 || warOf(r.id) || (r.warCd || 0) > S.day || r.cash < 3e7 * cpi(y)) return;
    if (Math.random() > 0.06 * S.mods.rivalAggro) return;
    const set = rivalNodes(r.id); if (set.size < 3) return;
    let hit = 0; Object.values(pairInfo).forEach(pi => { if (pi.use === 'pax' && set.has(pi.ci) && set.has(pi.cj)) hit += pi.served || 0; });
    if (hit < 2e4) return;
    const w = { rid:r.id, cities:[...set], from:S.day, until:S.day + 240, resp:null, hit };
    S.wars.push(w); r.warCd = S.day + 240 + 900;
    log('价格战 · ' + def.name, `${def.name} 在其线路沿线（${w.cities.slice(0,5).map(c => cities[c].name).join('、')}等）大幅降价，与你争夺这些城市之间的客源，预计持续 8 个月。价格战期间，对方线路对过轨列车（含货车）加收 40% 过轨费。`, 'bad');
    pendingPopups.push({ type:'war', rid:r.id, name:def.name, hit, cities:w.cities.slice(0,8).map(c => cities[c].name) });
  }
  // 敌意收购：只针对已上市的公司
  function raidMonth(y){
    if (!S.ipo) return; const I = S.ipo;
    S.rivals.forEach(r => { if (!r.active || r.acquired) return; const def = rivalDef(r.id);
      const fair = valuation() / I.shares;
      const trackV = S.tracks.filter(x => x.owner === r.id).reduce((s, x) => s + (x.cost || 0) * 0.85, 0);
      const power = Math.max(0, r.cash) * 0.4 + trackV * 0.02 + marketCap() * 0.03; // 自有资金 + 财团配资（每月可动用）
      if (!r.stake && !(y >= 1996 && I.price < fair * 0.98 && Math.random() < 0.035 * S.mods.rivalAggro)) return;
      if (I.price > fair * 1.2) return;
      const n = Math.min(I.pub * 0.12, I.shares * 0.025, power / I.price);
      if (n < I.shares * 0.002) return;
      const before = r.stake / I.shares;
      r.stake += n; I.pub -= n; r.cash -= Math.min(Math.max(0, r.cash) * 0.4, n * I.price); I.price *= 1.015;
      const pct = r.stake / I.shares, ctl = controlPct();
      const warn = th => { log('举牌 · ' + def.name, `${def.name} 在二级市场持续买入本公司股票，持股已达 ${(pct*100).toFixed(1)}%（你方控制 ${(ctl*100).toFixed(1)}%）。一旦超过你方，公司控制权将易手。`, 'bad'); pendingPopups.push({ type:'raid', rid:r.id, name:def.name, pct, ctl }); };
      [0.05, 0.15, 0.25].forEach(th => { if (before < th && pct >= th) warn(th); });
      if (before < ctl * 0.8 && pct >= ctl * 0.8 && pct < 0.25) warn(0);
      if (pct > ctl && !S.over) { S.over = true; S.takenBy = def.name; pendingPopups.push({ type:'taken', name:def.name }); }
    });
  }
  function controlPct(){ if (!S.ipo) return 1; const I = S.ipo; const rv = S.rivals.reduce((a, r) => a + (r.stake || 0), 0); return Math.max(0, (I.shares - I.pub - rv) / I.shares); }
  function raidPct(rid){ const r = S.rivals.find(x => x.id === rid); return S.ipo && r ? (r.stake || 0) / S.ipo.shares : 0; }
  // 定向增发：每 24 个月最多一次、规模为总股本 12%，友好投资者按股份领取分红
  function diluteQuote(){ if (!S.ipo) return null; const I = S.ipo; const n = I.shares * 0.12; return { n, raise: n * I.price * 0.9, wait: Math.max(0, (S.diluteAt || -1e9) + 730 - S.day) }; }
  function defendDilute(){ const q = diluteQuote(); if (!q) return { ok:false, msg:'公司尚未上市' }; if (q.wait > 0) return { ok:false, msg:`两年内只能定向增发一次（还需 ${Math.ceil(q.wait/30)} 个月）` };
    const I = S.ipo; I.shares += q.n; I.friendly = (I.friendly || 0) + q.n; S.cash += q.raise; finAdd('equityIn', q.raise); I.price *= 0.94; S.diluteAt = S.day; addRep(-1);
    log('定向增发', `向友好的战略投资者定向增发 ${(q.n/1e8).toFixed(2)} 亿股，募集 ${fmtW(q.raise)}元，同业持股比例被摊薄。`, 'info'); return { ok:true }; }
  function greenmailQuote(rid){ const r = S.rivals.find(x => x.id === rid); if (!S.ipo || !r || !r.stake) return null; return { n:r.stake, cost:r.stake * S.ipo.price * 1.3 }; }
  function defendGreenmail(rid){ const q = greenmailQuote(rid); if (!q) return { ok:false, msg:'对方没有持股' }; if (S.cash < q.cost) return { ok:false, msg:'现金不足' };
    const r = S.rivals.find(x => x.id === rid); S.cash -= q.cost; finAdd('buyback', q.cost); r.cash += q.cost; S.ipo.shares -= q.n; r.stake = 0; addRep(-2, '溢价回购同业持股，被市场批评为损害中小股东利益');
    log('溢价回购', `以 ${fmtW(q.cost)}元溢价回购${rivalDef(rid).name}所持全部股份并注销。`, 'info'); return { ok:true }; }
  function rivalPlanMonth(r, def, y){
    if (!r.plan) return false;
    if (S.day < r.plan.at) return true;
    const p = r.plan; r.plan = null; const e = edges[p.e];
    if (ownTrackFor(e.i, TRACK_CLASSES[p.cls].v)) {
      log('抢线成功', `你抢先在 ${cities[e.a].name}—${cities[e.b].name} 开工，${def.name} 的修建计划落空。`, 'good'); addRep(1); return true; }
    if (S.tracks.some(x => x.e === e.i && x.owner === r.id)) return true;
    // 同业融资建线：首付 50%，其余为有息建设贷款（总负债不超过 2 倍现金规模）
    const down = p.cost * 0.5, loan = p.cost - down;
    if (r.cash < down || (r.debt || 0) + loan > Math.max(0, r.cash) * 2 + 5e8 * cpi(y)) { log('同业 · ' + def.name, `${cities[e.a].name}—${cities[e.b].name} 修建计划因资金不足推迟。`, 'rival'); return true; }
    const C = TRACK_CLASSES[p.cls]; r.cash -= down; r.debt = (r.debt || 0) + loan; const months = buildMonths(e, p.cls);
    S.tracks.push({ id:S.nid++, e:e.i, owner:r.id, v:C.v, elec: p.cls >= 2 || y >= 1995, status:'build', done:S.day + months*30, cost:p.cost, built:S.day });
    r.built++;
    log('同业 · ' + def.name, `开工修建 ${cities[e.a].name}—${cities[e.b].name}（${C.name}，预计 ${months} 个月）。`, 'rival');
    return true;
  }
  // —— 政府任务 ——
  const GOV = {
    chunyun:{ name:'春运加开', unit:'万人次', rep:4, fail:4 },
    coal:   { name:'电煤保供', unit:'万吨', rep:3, fail:3 },
    relief: { name:'抢险救灾运输', unit:'万吨', rep:6, fail:5 },
  };
  const mk = (y, m) => y * 12 + m;
  const mkStr = k => `${Math.floor((k-1)/12)}年${(k-1)%12+1}月`;
  // 任务进度按实际完成的运量计（src='plan' 时按运行计划估算，只用于下达目标和界面预计）
  function govMetric(g, src){
    if (src === 'plan') {
      if (g.k === 'chunyun') { const pi = pairInfo['pax:' + g.ci + '-' + g.cj]; return pi ? pi.served || 0 : 0; }
      if (g.k === 'coal') { const pi = pairInfo['freight:coal:' + g.ci + '-' + g.cj]; return pi ? pi.served || 0 : 0; }
      let s = 0; Object.values(pairInfo).forEach(pi => { if (pi.use === 'freight' && (pi.ci === g.city || pi.cj === g.city)) s += pi.served || 0; }); return s; }
    const P = (src && typeof src === 'object') ? src : (S.month.pairs || {});
    if (g.k === 'chunyun') return P['pax:' + g.ci + '-' + g.cj] || 0;
    if (g.k === 'coal') return P['freight:coal:' + g.ci + '-' + g.cj] || 0;
    let s = 0; Object.entries(P).forEach(([k, v]) => { const m = /^freight:\w+:(\d+)-(\d+)$/.exec(k); if (m && (+m[1] === g.city || +m[2] === g.city)) s += v; }); return s;
  }
  function freightStops(){ const s = new Set(); S.trains.forEach(t => { if (trainUse(t) !== 'freight' || !t.route) return; const r = S.routes.find(q => q.id === t.route); if (r) r.stops.forEach(c => s.add(c)); }); return [...s]; }
  function govOffer(g, y){
    g.id = S.nid++; g.st = 'offer'; g.prog = 0; g.offered = S.day; g.expire = Math.min(S.day + 30, g.expire || 1e9);
    g.cash = Math.round(g.cash * cpi(y) / 1e4) * 1e4;
    S.gov.push(g);
    log('政府任务 · ' + GOV[g.k].name, g.text + `（目标 ${(g.target/1e4).toFixed(1)}${GOV[g.k].unit}）`, 'policy');
    pendingPopups.push({ type:'gov', id:g.id });
  }
  function govMonth(){
    ensureT4(); const t = ym(S.day); const y = t.y, k = mk(y, t.m), done = k - 1;
    S.gov.forEach(g => {
      if (g.st === 'offer' && S.day > g.expire) { g.st = 'lapsed'; g.end = S.day; return; }
      if (g.st !== 'active') return;
      if (done >= g.from && done <= g.to) { g.lastM = govMetric(g); g.prog += g.lastM; }
      if (g.prog >= g.target) { g.st = 'done'; g.end = S.day; S.cash += g.cash; S.month.contract = (S.month.contract || 0) + g.cash;
        addRep(GOV[g.k].rep, `圆满完成「${g.title}」，获得表彰`); log('任务完成 · ' + g.title, `完成量 ${(g.prog/1e4).toFixed(1)}${GOV[g.k].unit}，获得奖励 ${fmtW(g.cash)}元。`, 'good');
        pendingPopups.push({ type:'govEnd', id:g.id }); }
      else if (done >= g.to && g.prog >= g.target * 0.85) { g.st = 'part'; g.end = S.day; const c = Math.round(g.cash * 0.4 / 1e4) * 1e4; g.paid = c; S.cash += c; S.month.contract = (S.month.contract || 0) + c;
        log('任务基本完成 · ' + g.title, `完成目标的 ${Math.round(g.prog / g.target * 100)}%，获得部分奖励 ${fmtW(c)}元，商誉不受影响。`, 'info'); pendingPopups.push({ type:'govEnd', id:g.id }); }
      else if (done >= g.to) { g.st = 'fail'; g.end = S.day; addRep(-GOV[g.k].fail, `未能完成「${g.title}」`);
        log('任务未完成 · ' + g.title, `只完成了目标的 ${Math.round(g.prog / g.target * 100)}%。`, 'bad'); pendingPopups.push({ type:'govEnd', id:g.id }); }
    });
    S.gov = S.gov.filter(g => g.st === 'offer' || g.st === 'active' || S.day - (g.end || 0) < 400);
    if (y < 1987 || S.gov.some(g => g.st === 'offer')) return;
    const busy = kk => S.gov.some(g => g.k === kk && (g.st === 'active' || g.st === 'offer'));
    // 春运：11 月下达，次年 1–2 月执行
    if (t.m === 11 && !busy('chunyun')) {
      const best = Object.values(pairInfo).filter(p => p.use === 'pax' && (p.served || 0) >= 8e3).sort((a, b) => b.served - a.served)[0];
      if (best) { const target = Math.max(2e4, Math.round(best.served * 2 * 1.25 / 1e3) * 1e3);
        return govOffer({ k:'chunyun', ci:best.ci, cj:best.cj, from:mk(y+1, 1), to:mk(y+1, 2), target, cash:target * 14,
          title:`${y+1}年春运 ${cities[best.ci].name}—${cities[best.cj].name} 加开`, text:`铁道部门请求在 ${y+1} 年春运期间（1–2 月）加开 ${cities[best.ci].name}—${cities[best.cj].name} 间的旅客列车，缓解“一票难求”。` }, y); }
    }
    // 电煤保供：9 月下达，10–12 月执行
    if (t.m === 9 && y >= 1988 && !busy('coal')) {
      const best = Object.values(pairInfo).filter(p => p.use === 'freight' && p.g === 'coal' && (p.served || 0) >= 5e3).sort((a, b) => b.served - a.served)[0];
      if (best) { const target = Math.max(2e4, Math.round(best.served * 3 * 1.15 / 1e3) * 1e3);
        return govOffer({ k:'coal', ci:best.ci, cj:best.cj, from:mk(y, 10), to:mk(y, 12), target, cash:target * 10,
          title:`${y}年冬季电煤保供`, text:`入冬前电厂存煤告急，经贸部门请求在 10–12 月加大 ${cities[best.ci].name}—${cities[best.cj].name} 间的煤炭运输。` }, y); }
    }
    // 抢险救灾：历史灾害或随机的夏季汛情
    const fs = freightStops().filter(c => govMetric({ k:'relief', city:c }, 'plan') >= 3e3); if (!fs.length || busy('relief')) return;
    const ev = activeEvents(y, t.m).find(e => e.block && e.from[0] === y && e.from[1] === t.m);
    let city = null, why = '';
    if (ev) { const cx = (ev.block.lon[0] + ev.block.lon[1]) / 2, cy = (ev.block.lat[0] + ev.block.lat[1]) / 2;
      city = fs.slice().sort((a, b) => Math.hypot(cities[a].lon - cx, cities[a].lat - cy) - Math.hypot(cities[b].lon - cx, cities[b].lat - cy))[0];
      why = `${ev.title}发生后，`; }
    else if (t.m >= 6 && t.m <= 8 && Math.random() < 0.18) { city = fs[Math.floor(Math.random() * fs.length)]; why = `${cities[city].name}一带突发汛情，`; }
    if (city === null) return;
    const cur = govMetric({ k:'relief', city }, 'plan');
    const target = Math.max(1e4, Math.round(cur * 2 * 1.2 / 1e3) * 1e3);
    govOffer({ k:'relief', city, from:k, to:k + 1, target, cash:target * 25, expire:S.day + 20,
      title:`${cities[city].name}抢险救灾运输`, text:`${why}当地急需抢险物资和生活物资，请求本公司在本月和下月加大进出${cities[city].name}的货运量。` }, y);
  }
  function govAccept(id){ const g = (S.gov || []).find(x => x.id === id); if (!g || g.st !== 'offer') return false; if (S.day > g.expire) { g.st = 'lapsed'; g.end = S.day; return false; } g.st = 'active'; log('接受任务', `已接受「${g.title}」，执行期 ${mkStr(g.from)}–${mkStr(g.to)}。`, 'info'); return true; }
  function govDecline(id){ const g = (S.gov || []).find(x => x.id === id); if (!g || g.st !== 'offer') return false; g.st = 'lapsed'; g.end = S.day; if (g.k === 'relief') addRep(-1); return true; }
  function govProgressNow(g){ const t = ym(S.day), k = mk(t.y, t.m); return g.prog + (g.st === 'active' && k >= g.from && k <= g.to ? govMetric(g) : 0); }
  function govForecast(g){ const t = ym(S.day), k = mk(t.y, t.m); return g.st === 'active' && k >= g.from && k <= g.to ? govMetric(g, 'plan') : 0; }

  // ================= 第三批：干线经营权招标 / 超级工程 / 海外项目 =================
  function ensureT6(){ S.supers = S.supers || {}; S.franch = S.franch || []; S.overseas = S.overseas || []; }
  // —— 超级工程 ——
  function superQuote(id){ const sp = SUPER.find(x => x.id === id); if (!sp) return null; const y = ym(S.day).y;
    const why = []; if (y < sp.from) why.push(`${sp.from} 年起开放社会资本参与`);
    const st = S.supers[id]; if (st) why.push(st.st === 'done' ? '已建成' : '正在建设');
    const cost = sp.cost * cpi(y) / cpi(2005); const first = cost * 0.15;
    if (!st && S.cash < first) why.push(`首期资本金需要 ${fmtW(first)}元`);
    return { sp, cost, first, monthly:(cost - first) / sp.months, months:sp.months, why, ok:!why.length, km:edges[sp.e].dist }; }
  function startSuper(id){ ensureT6(); const q = superQuote(id); if (!q) return { ok:false, msg:'找不到项目' }; if (!q.ok) return { ok:false, msg:q.why[0] };
    const sp = q.sp; S.cash -= q.first; S.month.build += q.first;
    const tr = { id:S.nid++, e:sp.e, owner:'P', v:sp.v, elec:true, status:'build', done:S.day + sp.months * 30, cost:q.first, built:S.day, sup:sp.id };
    S.tracks.push(tr); S.supers[id] = { st:'build', start:S.day, cost:q.cost, paid:q.first, monthly:q.monthly, tr:tr.id, late:0 };
    log('超级工程开工 · ' + sp.name, `${sp.name}（${q.km} km）正式开工，总投资约 ${fmtW(q.cost)}元，计划工期 ${Math.round(sp.months/12)} 年。首期资本金 ${fmtW(q.first)}元已到位，其余按月拨付。`, 'good');
    addRep(3, `${sp.name}开工`); return { ok:true }; }
  function superPaid(id){ const st = S.supers && S.supers[id]; return !!st && st.paid >= st.cost * 0.999; }
  function supersMonth(y){ ensureT6();
    SUPER.forEach(sp => { const st = S.supers[sp.id]; if (!st || st.st !== 'build') return; const tr = S.tracks.find(x => x.id === st.tr);
      if (!tr) { st.st = 'void'; st.end = S.day; log('超级工程 · ' + sp.name, '关联线路已不存在，项目终止。', 'bad'); return; }
      // 先拨付本月工程款，再判断是否具备通车条件（工期届满 + 资金付足 + 线路完整）
      const left = st.cost - st.paid; const pay = Math.min(left, st.monthly);
      if (pay > 0) {
        if (S.cash < pay) { tr.done += 30; st.late++; if (st.late % 6 === 1) log('工程资金不足 · ' + sp.name, `本月工程款 ${fmtW(pay)}元未能拨付，工期顺延一个月。`, 'bad'); }
        else { S.cash -= pay; st.paid += pay; S.month.build += pay; tr.cost = st.paid; tr.built = S.day; }
      }
      if (tr.status === 'ok' || (tr.status === 'build' && S.day >= tr.done && superPaid(sp.id))) { tr.status = 'ok'; st.st = 'done'; st.end = S.day; addRep(8, `${sp.name}建成通车`); S.prestige = (S.prestige || 0) + 1;
        log('超级工程竣工 · ' + sp.name, `${sp.name}全线贯通，${cities[edges[sp.e].a].name}—${cities[edges[sp.e].b].name} 正式通车。累计投资 ${fmtW(st.paid)}元。`, 'good'); pendingPopups.push({ type:'superDone', id:sp.id }); }
    }); }
  // —— 干线经营权招标 ——
  const FRANCHISE = [
    { id:'jinghu', name:'京沪干线客运经营权', a:'北京', b:'上海' }, { id:'jingguang', name:'京广干线客运经营权', a:'北京', b:'广州' },
    { id:'jingha', name:'京哈干线客运经营权', a:'北京', b:'哈尔滨' }, { id:'longhai', name:'陇海干线客运经营权', a:'郑州', b:'兰州' },
    { id:'huhang', name:'沪杭甬客运经营权', a:'上海', b:'宁波' }, { id:'zhehan', name:'浙赣干线客运经营权', a:'杭州', b:'株洲' },
    { id:'jingjiu', name:'京九干线客运经营权', a:'北京', b:'深圳' }, { id:'baolan', name:'包兰干线客运经营权', a:'包头', b:'兰州' },
  ];
  const FR_YEARS = 8;
  function frPath(f){ const a = cityIdx[f.a], b = cityIdx[f.b]; if (a === undefined || b === undefined) return null;
    // 只沿国铁线路
    const n = cities.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false); const ok = {};
    S.tracks.forEach(tr => { if (tr.owner === 'S' && tr.status === 'ok') ok[tr.e] = true; }); dist[a] = 0;
    for (let it = 0; it < n; it++){ let u = -1, best = Infinity; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best){ best = dist[i]; u = i; } if (u < 0 || u === b) break; done[u] = true;
      adj[u].forEach(e => { if (!ok[e.i]) return; const v = e.a === u ? e.b : e.a; if (dist[u] + e.dist < dist[v]){ dist[v] = dist[u] + e.dist; prev[v] = u; } }); }
    if (!isFinite(dist[b])) return null; const path = []; for (let v = b; v !== -1; v = prev[v]) path.unshift(v); return path; }
  function frOf(ci, cj){ return (S.franch || []).find(f => f.st === 'held' && f.set[ci] && f.set[cj]); }
  function frShare(ci, cj){ const f = frOf(ci, cj); return !f ? 1 : f.holder === 'P' ? 1.25 : 0.8; }
  function frFee(eid){ return (S.franch || []).some(f => f.st === 'held' && f.holder === 'P' && f.edges.includes(eid)) ? 0.5 : 1; }
  // 经营权考核：只计实际驶过中标干线区段、且在干线上至少停靠两站的旅客列车（plan=true 时给出按计划的预计值）
  function frTrips(f, plan){ let n = 0; S.trains.forEach(t => { if (trainUse(t) !== 'pax') return; const e = econ[t.id]; if (!e || !e.plan.ok) return; const r = S.routes.find(q => q.id === t.route); if (!r) return;
      if (!e.plan.legs.some(l => f.edges.includes(l.e))) return;
      const st = e.plan.st; if (r.stops.filter((c, k) => st[k] && f.set[c]).length < 2) return;
      n += plan ? (t.status === 'run' ? e.plan.trips : 0) : 0; });
    if (!plan) return ((S.lastRun && S.lastRun.frT) || {})[f.uid] || 0;   // 上月实发：每趟按当时线路记账
    return n; }
  function frOffer(y){ const held = new Set((S.franch || []).filter(f => f.st === 'held' || f.st === 'bid').map(f => f.id));
    const cand = FRANCHISE.filter(f => !held.has(f.id)).map(f => ({ f, path:frPath(f) })).filter(x => x.path && x.path.length >= 3);
    if (!cand.length) return; const pick = cand[Math.floor(Math.random() * cand.length)];
    const km = pick.path.slice(1).reduce((a, c, k) => a + edgeByPair[pick.path[k] + '-' + c].dist, 0);
    const set = {}; pick.path.forEach(c => set[c] = 1); const eds = pick.path.slice(1).map((c, k) => edgeByPair[pick.path[k] + '-' + c].i);
    const reserve = Math.round(km * 4.5e4 * cpi(y) / 1e5) * 1e5;
    const f = { id:pick.f.id, name:pick.f.name, a:cityIdx[pick.f.a], b:cityIdx[pick.f.b], path:pick.path, set, edges:eds, km, reserve, st:'bid', close:S.day + 75, bid:0, uid:S.nid++, minTrips:Math.round(Math.min(240, km / 8)) };
    S.franch.push(f);
    log('干线招标 · ' + f.name, `铁路主管部门公开招标 ${cities[f.a].name}—${cities[f.b].name}（${km} km）国铁干线的客运经营权，中标者取得该干线 ${FR_YEARS} 年的客运优先经营权（沿线客源份额 +25%、过轨费减半，其他公司仍可开行但客源被分流）。年度经营权费底价 ${fmtW(reserve)}元，投标需冻结 20% 保证金，75 天后开标。`, 'policy');
    pendingPopups.push({ type:'franch', uid:f.uid }); }
  function frBid(uid, mul){ const f = (S.franch || []).find(x => x.uid === uid); if (!f || f.st !== 'bid' || S.day >= f.close) return { ok:false, msg:'招标已截止' };
    const refund = () => { if (f.dep) { S.cash += f.dep; S.month.fin.depOut = (S.month.fin.depOut || 0) - f.dep; f.dep = 0; } };
    if (mul <= 0) { refund(); f.bid = 0; return { ok:true }; } const fee = f.reserve * mul, dep = fee * 0.2;
    if (S.cash + (f.dep || 0) < dep) return { ok:false, msg:`投标保证金（年费的 20%）需要 ${fmtW(dep)}元` };
    refund(); S.cash -= dep; f.dep = dep; S.month.fin.depOut = (S.month.fin.depOut || 0) + dep;
    f.bid = fee; log('投标', `已就「${f.name}」报价每年 ${fmtW(fee)}元，冻结保证金 ${fmtW(dep)}元（开标后退还）。`, 'info'); return { ok:true }; }
  function franchMonth(y){ ensureT6();
    S.franch.forEach(f => {
      if (f.st === 'bid' && S.day >= f.close) {
        const bids = []; if (f.bid) bids.push({ who:'P', v:f.bid * (1 + (S.rep - 50) / 400) });
        S.rivals.forEach(r => { if (!r.active || r.acquired) return; if (Math.random() < 0.6) bids.push({ who:r.id, v:f.reserve * (1 + Math.random() * 0.55) * (0.9 + Math.min(0.3, Math.max(0, r.cash) / 5e9)) }); });
        if (Math.random() < 0.5) bids.push({ who:'SC', v:f.reserve * (1.05 + Math.random() * 0.4) });
        if (!bids.length) { if (f.dep) { S.cash += f.dep; f.dep = 0; } f.st = 'void'; f.end = S.day; log('招标流标', `「${f.name}」无人投标，本次招标流标。`, 'info'); return; }
        if (f.dep) { S.cash += f.dep; S.month.fin.depOut = (S.month.fin.depOut || 0) - f.dep; f.dep = 0; }   // 开标后退还保证金
        bids.sort((a, b) => b.v - a.v); const w = bids[0];
        f.st = 'held'; f.holder = w.who; f.from = S.day; f.until = S.day + FR_YEARS * 365; f.fee = w.who === 'P' ? f.bid : f.reserve * (1 + Math.random() * 0.4); f.strikes = 0;
        if (w.who === 'P') { addRep(2); log('中标 · ' + f.name, `本公司以每年 ${fmtW(f.fee)}元中标，${FR_YEARS} 年内取得 ${cities[f.a].name}—${cities[f.b].name} 干线客运优先经营权：沿线站对客源份额 +25%，该干线国铁区段过轨费减半。每月需有不少于 ${f.minTrips} 趟旅客列车实际驶过该干线并在干线上停靠至少两站，连续或累计 3 个月不达标将被收回。`, 'good'); pendingPopups.push({ type:'franchWin', uid:f.uid }); }
        else { const rv = w.who === 'SC' ? { name:'地方国资联合体' } : RIVALS.find(x => x.id === w.who); log('开标结果 · ' + f.name, `${rv.name} 中标，${FR_YEARS} 年内取得该干线客运优先经营权。你仍可开行，但沿线城市之间的旅客列车客源会被分流约 20%。`, f.bid ? 'bad' : 'rival'); if (f.bid) pendingPopups.push({ type:'franchLose', uid:f.uid, name:rv.name }); }
        recompute(); return; }
      if (f.st !== 'held') return;
      if (S.day >= f.until) { f.st = 'end'; f.end = S.day; log('经营权到期', `「${f.name}」${FR_YEARS} 年经营期届满。`, 'info'); recompute(); return; }
      if (f.holder !== 'P') return;
      const fee = f.fee / 12; S.cash -= fee; S.month.frFee = (S.month.frFee || 0) + fee;   // 经营权年费单列，不混入过轨费
      if (S.day - f.from > 180) { const n = frTrips(f); f.lastTrips = n;
        if (n < f.minTrips) { f.strikes++; log('经营权考核', `「${f.name}」本月只开行 ${Math.round(n)} 趟，低于承诺的 ${f.minTrips} 趟（第 ${f.strikes}/3 次）。`, 'bad');
          if (f.strikes >= 3) { f.st = 'revoked'; f.end = S.day; addRep(-6, `未履行「${f.name}」开行承诺，经营权被收回`); recompute(); } } }
    });
    S.franch = S.franch.filter(f => f.st === 'bid' || f.st === 'held' || S.day - (f.end || 0) < 720);
    const t = ym(S.day); if (y >= 1998 && (t.m === 4 || t.m === 10) && !S.franch.some(f => f.st === 'bid') && Math.random() < 0.7) frOffer(y);
  }
  // —— 海外项目：出口高铁 ——
  const OVERSEAS = [
    { id:'nanyang', name:'南洋某国高速铁路', km:350, v:350, from:2012, cost:600e8, months:72, ret:0.105, desc:'连接该国首都与第二大城市，采用中国标准建设和运营。' },
    { id:'zhongya', name:'中亚跨境铁路', km:900, v:160, from:2010, cost:450e8, months:60, ret:0.095, desc:'穿越草原和戈壁，打通亚欧陆路货运通道。' },
    { id:'dongfei', name:'东非标准轨距铁路', km:480, v:120, from:2008, cost:280e8, months:48, ret:0.09, desc:'从港口通往内陆首都，客货兼营。' },
    { id:'zhongou', name:'中东欧城际高速铁路', km:340, v:300, from:2016, cost:520e8, months:66, ret:0.10, desc:'两国首都之间的城际高铁，进入欧洲市场的第一单。' },
  ];
  // 有本公司旅客列车上月实际开行的自有高速线路里程
  function hsrRunKm(){ const a = (S.lastRun && S.lastRun.hsrTr) || {}, b = S.month.hsrTr || {}; const used = new Set([...Object.keys(a), ...Object.keys(b)].map(Number));
    return S.tracks.filter(x => x.owner === 'P' && x.status === 'ok' && x.v >= 250 && used.has(x.id)).reduce((a, x) => a + edges[x.e].dist, 0); }
  function hsrKm(){ return S.tracks.filter(x => x.owner === 'P' && x.status === 'ok' && x.v >= 250).reduce((a, x) => a + edges[x.e].dist, 0); }
  function ovQuote(id){ const o = OVERSEAS.find(x => x.id === id); if (!o) return null; const y = ym(S.day).y; const why = [];
    const st = S.overseas.find(x => x.id === id); if (y < o.from) why.push(`${o.from} 年起招标`); if (st) why.push(st.st === 'bid' ? '已投标，等待结果' : st.st === 'lost' ? '已落标' : '已中标');
    const need = o.v >= 250 ? 300 : 0; const own = !!(S.rd && S.rd.done && S.rd.done.own3); const hk = hsrRunKm();
    if (need && hk < need && !own) why.push(`需要有 ${need} km 以上自有高速铁路实际开行旅客列车（现有 ${hk} km），或研制成功自主高速动车组`);
    const cost = o.cost * cpi(y) / cpi(2010); const fee = cost * 0.005;
    if (!st && S.cash < fee) why.push(`投标费用 ${fmtW(fee)}元`);
    const winP = clamp(0.3 + S.rep / 250 + Math.min(0.2, hk / 6000) + (S.prestige || 0) * 0.05, 0.2, 0.85);
    return { o, cost, fee, winP, why, ok:!why.length, yearly:cost * o.ret, payback: 1 / o.ret, monthsBuild:o.months, runYears:20, endsAfter2020: y + 0.25 + o.months / 12 > 2020 }; }
  function ovBid(id){ ensureT6(); const q = ovQuote(id); if (!q) return { ok:false, msg:'找不到项目' }; if (!q.ok) return { ok:false, msg:q.why[0] };
    S.cash -= q.fee; S.month.build += q.fee; S.overseas.push({ id, st:'bid', at:S.day + 90, cost:q.cost, winP:q.winP });
    log('海外投标 · ' + q.o.name, `已向业主国递交投标文件，投标费用 ${fmtW(q.fee)}元，约三个月后公布结果。`, 'info'); return { ok:true }; }
  function overseasMonth(y){ ensureT6(); let inc = 0;
    S.overseas.forEach(x => { const o = OVERSEAS.find(q => q.id === x.id); if (!o) return;
      if (x.st === 'bid' && S.day >= x.at) { if (Math.random() < x.winP) { x.st = 'build'; x.start = S.day; x.paid = 0; x.monthly = x.cost / o.months; x.done = S.day + o.months * 30; addRep(3, `中标${o.name}`);
          log('海外中标 · ' + o.name, `本公司中标${o.name}（${o.km} km），总投资约 ${fmtW(x.cost)}元，按月投入，建成后获得 20 年运营权。`, 'good'); pendingPopups.push({ type:'ovWin', id:o.id }); }
        else { x.st = 'lost'; x.end = S.day; log('海外落标 · ' + o.name, '业主国选择了其他国家的方案。', 'bad'); pendingPopups.push({ type:'ovLose', id:o.id }); } return; }
      if (x.st === 'build') {
        if (Math.random() < 0.006) { x.cost *= 1.15; x.monthly = (x.cost - x.paid) / Math.max(1, (x.done - S.day) / 30 + 6); x.done += 180; log('海外项目 · ' + o.name, '业主国政局变动，项目停工半年，预算增加 15%。', 'bad'); }
        const pay = Math.min(x.cost - x.paid, x.monthly); if (pay > 0) { if (S.cash < pay) { x.done += 30; } else { S.cash -= pay; x.paid += pay; S.month.build += pay; } }
        if (S.day >= x.done && x.paid >= x.cost * 0.999) { x.st = 'run'; x.runFrom = S.day; x.until = S.day + 20 * 365; addRep(5, `${o.name}建成通车`); S.prestige = (S.prestige || 0) + 1;
          log('海外项目通车 · ' + o.name, `${o.name}建成通车，本公司获得 20 年运营权，预计每年收益 ${fmtW(x.cost * o.ret)}元。`, 'good'); pendingPopups.push({ type:'ovDone', id:o.id }); }
        return; }
      if (x.st === 'run') { if (S.day >= x.until) { x.st = 'over'; return; } inc += x.cost * o.ret / 12 * (0.85 + Math.random() * 0.3); }
    });
    S.cash += inc; S.month.overseas = inc; return inc; }

  return {
    cities, edges, edgeByPair, adj, trainById, policyById, ACH, TRACK_CLASSES, edgeLock, lockText, BASE_EDGES,
    get S(){ return S; }, carById, isUnit, supportsUse, modelForUse, trainUse, trainModel, consistStats, trailLimit, maxCars, carAvailable, carPrice, defaultConsist, quoteConsist, setConsist, comfortMul, get econ(){ return econ; }, get pairInfo(){ return pairInfo; }, get stateTime(){ return stateTime; },
    newGame, tick, recompute, ym, dateOf, cpi, rate, popOf, freightOf, fmtW, clsOfV, feeRate, stateFeeBase,
    buildQuote, buildTrack, buildTrackBlock, upgradeQuote, upgradeTrack, canBuildClass, isHighSpeed, trainPrice, available, buyTrain, sellTrain, assignTrain,
    createRoute, deleteRoute, routeAllowed, isTown, stationLv, stopFlags, stationQuote, buildStation, findPath, groups, groupQuote, buildGroup, toggleSkip, planTrain, netWorth, assets, creditLimit, borrow, repay, trainValue,
    paxDemand, freightDemand, captureShare, cargoSD, cargoCaps, get MF(){ return MF; }, get blocked(){ return blocked; }, activeEvents, events, popups: () => { const p = pendingPopups; pendingPopups = []; return p; },
    SCENARIOS, scenario, scnProgress, startScenario, board, scoreOf,
    ROLES, TRAIN_LV, OWN_MODELS, execSalary, exLv, hireExec, fireExec, setTraining, staffCost, rdState, setRD, rdProjects, startProject, localized, isImp, isRetained, retentionProjects, genCands,
    SHOP_LV, shopLv, shopQuote, buildShop, shopIncome, get cityPax(){ return cityPax; }, landPrice, landIdx, buyLand, sellLand, landValue, acceptLocal, declineLocal, setSlow, genLocal,
    ensureT4, controlPct, warOf, warAt, warRespond, raidPct, diluteQuote, defendDilute, greenmailQuote, defendGreenmail, GOV, govAccept, govDecline, govProgressNow, govMetric, mkStr, rivalNodes,
    SIGNALS, SVC, sigOf, capOf, get trackUtil(){ return trackUtil; }, signalQuote, upgradeSignal, setService, routeStats,
    ensureT2, availOf, yrsSinceOvh, overhaulQuote, overhaul, acceptContract, declineContract, contractKey, bondRate, bondRoom, issueBond, valuation, ipoCheck, doIPO, setPayout, secondaryQuote, secondary, buyback, marketCap, acquireQuote, acquireRival, ttmProfit, repMul, genContracts,
    succClass, CLASS_NAME, successorOf, endingSoon, buyable, FAR_END, sellerName, buyUsed, consistAt, PLATFORMS, designUnlock, designBase, designQuote, createDesign, cancelDesign, DESIGN_MAX,
    modelEra, ERA, isBranch, trainOnBranch, eraOf, eraFare, eraMaint, sellQuote, quoteTrainSale, sellTrains, acceptUsed, declineUsed, routeKm,
    overhaulIssue, overhaulDays, quoteTrainOverhaul, overhaulTrains,
    MAX_ORDER, quoteTrainOrder, buyTrains, carDepotValue, quoteDepotTrade, tradeDepotCars, quoteHeadReplacement, replaceHead,
    SUPER, superQuote, startSuper, FRANCHISE, FR_YEARS, frBid, frTrips, frOf, OVERSEAS, ovQuote, ovBid, hsrKm, ensureT6,
    GRADES, gradeOf, setGrade, sleeperFrac, DEPOT_LV, depotsOf, depotQuote, buildDepot, depotCandidates, nearDepot, get depotCover(){ return depotCover; }, cityKm,
    save, load, hasSave, listSaves, deleteSave, exportSave, importSave, SLOTS, maintOf, log: (a,b,c) => log(a,b,c),
    validateState, marginalOf, govForecast, hsrRunKm, nightWin, superPaid, get lastLoadErr(){ return lastLoadErr; }, get autoSaveErr(){ return autoSaveErr; }, get autoSaveAt(){ return autoSaveAt; },
  };
})();
