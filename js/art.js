// =============================================================
//  铁道春秋 · 原创车辆立绘生成器（程序化SVG，侧视图）
// =============================================================
const Art = (() => {
  let uid = 0;
  const W = 420, H = 130, RAIL = 112;

  function hex2rgb(h){ h=h.replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); const n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
  function rgb2hex(r,g,b){ return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
  function shade(h, amt){ const [r,g,b]=hex2rgb(h); if(amt>=0) return rgb2hex(r+(255-r)*amt,g+(255-g)*amt,b+(255-b)*amt); return rgb2hex(r*(1+amt),g*(1+amt),b*(1+amt)); }

  function track(){
    let s = `<rect x="0" y="${RAIL+2}" width="${W}" height="5" fill="#3a3530" opacity=".55"/>`;
    for(let x=4;x<W;x+=16) s+=`<rect x="${x}" y="${RAIL+1}" width="9" height="6" rx="1" fill="#4a3f35" opacity=".7"/>`;
    s += `<rect x="0" y="${RAIL-1}" width="${W}" height="3" fill="#9aa0a6"/><rect x="0" y="${RAIL-1}" width="${W}" height="1" fill="#d6dade"/>`;
    return s;
  }
  function wheel(cx, cy, r, color, spokes){
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color||'#2a2c2f'}" stroke="#121314" stroke-width="1.2"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${r*0.72}" fill="none" stroke="${shade(color||'#2a2c2f',0.25)}" stroke-width="1"/>`;
    if (spokes){ for(let a=0;a<360;a+=360/spokes){ const rad=a*Math.PI/180; s+=`<line x1="${cx}" y1="${cy}" x2="${(cx+Math.cos(rad)*r*0.85).toFixed(1)}" y2="${(cy+Math.sin(rad)*r*0.85).toFixed(1)}" stroke="${shade(color,-0.35)}" stroke-width="1.1"/>`; } }
    s += `<circle cx="${cx}" cy="${cy}" r="${Math.max(1.6,r*0.22)}" fill="#8d9399"/>`;
    return s;
  }
  function bogie(cx, n, r, frame){
    const gap = r*2+3, w = (n-1)*gap + r*2 + 8, y = RAIL - r;
    let s = `<rect x="${cx-w/2}" y="${y-r*0.55}" width="${w}" height="${r*1.1}" rx="3" fill="${frame||'#2b2e31'}"/>`;
    for(let i=0;i<n;i++){ s += wheel(cx - (n-1)*gap/2 + i*gap, y, r); }
    s += `<rect x="${cx-w/2+3}" y="${y-2}" width="${w-6}" height="3" fill="#43484d"/>`;
    // 轴箱弹簧
    for(let i=0;i<n;i++){ const x=cx-(n-1)*gap/2+i*gap; s+=`<rect x="${x-2.5}" y="${y-r*0.9}" width="5" height="${r*0.5}" fill="#55595e"/>`; }
    return s;
  }
  function panto(x, roofY, flip){
    const d = flip?-1:1; const top = roofY-26;
    return `<g stroke="#2b2b2b" stroke-width="1.6" fill="none">
      <line x1="${x-10}" y1="${roofY-2}" x2="${x+10}" y2="${roofY-2}" stroke-width="3"/>
      <polyline points="${x-8},${roofY-3} ${x+6*d},${roofY-15} ${x-4*d},${top}"/>
      <polyline points="${x+8},${roofY-3} ${x+6*d},${roofY-15}"/>
      <line x1="${x-16}" y1="${top}" x2="${x+10}" y2="${top}" stroke-width="2.4"/>
      <line x1="${x-16}" y1="${top}" x2="${x-19}" y2="${top+3}"/><line x1="${x+10}" y1="${top}" x2="${x+13}" y2="${top+3}"/>
    </g>
    <rect x="${x-14}" y="${roofY-4}" width="4" height="3" fill="#b9b2a0"/><rect x="${x+10}" y="${roofY-4}" width="4" height="3" fill="#b9b2a0"/>`;
  }
  function coachBox(x0, x1, top, color, windowColor, opts={}){
    const id = 'cg'+(uid++);
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(color,0.18)}"/><stop offset=".55" stop-color="${color}"/><stop offset="1" stop-color="${shade(color,-0.25)}"/></linearGradient></defs>`;
    s += `<rect x="${x0}" y="${top}" width="${x1-x0}" height="${92-top}" rx="5" fill="url(#${id})" stroke="${shade(color,-0.45)}" stroke-width="1"/>`;
    s += `<rect x="${x0}" y="${top-3}" width="${x1-x0}" height="5" rx="2" fill="${shade(color,-0.15)}"/>`;
    const wy = top + 10;
    for(let x=x0+14;x<x1-14;x+=19){ s += `<rect x="${x}" y="${wy}" width="13" height="11" rx="1.5" fill="${windowColor||'#1c2633'}"/><rect x="${x+1}" y="${wy+1}" width="5" height="3" fill="#ffffff" opacity=".18"/>`; }
    if (opts.stripe) s += `<rect x="${x0}" y="${wy+16}" width="${x1-x0}" height="3" fill="${opts.stripe}"/>`;
    s += `<rect x="${x0}" y="92" width="${x1-x0}" height="5" fill="#25282b"/>`;
    s += bogie(x0+34, 2, 6.5) + (x1<W+20? bogie(x1-34,2,6.5):'');
    return s;
  }
  function plate(x,y,txt,color){ return `<rect x="${x}" y="${y}" width="${txt.length*5.6+8}" height="10" rx="1.5" fill="${color||'#d8c48a'}" opacity=".95"/><text x="${x+4}" y="${y+7.8}" font-size="7.5" font-family="Menlo,Consolas,monospace" fill="#1b1b1b" font-weight="700">${txt}</text>`; }

  // ---------------- 蒸汽机车 ----------------
  function steam(a, pax){
    const b=a.body, tr=a.trim, wc=a.wheel; const id='st'+(uid++);
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#55595e"/><stop offset=".35" stop-color="${b}"/><stop offset="1" stop-color="#0c0d0e"/></linearGradient></defs>`;
    // 煤水车
    s += `<rect x="300" y="50" width="112" height="44" rx="3" fill="url(#${id})" stroke="#000" stroke-width=".8"/>`;
    s += `<rect x="300" y="44" width="112" height="8" rx="2" fill="#2a2c2f"/><path d="M306 44 Q330 30 380 36 L406 44 Z" fill="#111"/>`;
    s += `<rect x="300" y="72" width="112" height="3" fill="${tr}"/>`;
    s += bogie(325,2,7) + bogie(388,2,7);
    // 司机室
    s += `<rect x="236" y="34" width="62" height="58" fill="url(#${id})" stroke="#000" stroke-width=".8"/>`;
    s += `<path d="M230 33 L304 33 L300 28 L234 28 Z" fill="#26282b"/>`;
    s += `<rect x="250" y="42" width="16" height="16" rx="2" fill="#2f3a46"/><rect x="272" y="42" width="16" height="16" rx="2" fill="#2f3a46"/>`;
    s += `<rect x="236" y="72" width="62" height="3" fill="${tr}"/>`;
    // 锅炉
    s += `<rect x="52" y="44" width="186" height="36" rx="18" fill="url(#${id})" stroke="#000" stroke-width=".8"/>`;
    for(let x=80;x<236;x+=40) s+=`<rect x="${x}" y="44" width="2" height="36" fill="#6b7076" opacity=".5"/>`;
    s += `<rect x="30" y="40" width="30" height="44" rx="6" fill="#141516" stroke="#000"/><circle cx="34" cy="62" r="13" fill="#1d1f21" stroke="#444" stroke-width="1"/>`;
    s += `<circle cx="34" cy="50" r="4.5" fill="#f7e9a6" stroke="#333"/>`; // 头灯
    if (a.trim) s += `<circle cx="34" cy="64" r="5" fill="${tr}"/>`; // 红五星位
    s += `<path d="M34 61 l1.6 3.4 3.7.4-2.8 2.5.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.8-2.5 3.7-.4z" fill="#f2c94c"/>`;
    s += `<rect x="40" y="22" width="13" height="22" fill="#1b1c1e"/><rect x="37" y="20" width="19" height="5" rx="1" fill="#0f1011"/>`;
    s += `<rect x="118" y="34" width="20" height="12" rx="6" fill="#1f2123"/><rect x="170" y="36" width="16" height="10" rx="5" fill="#1f2123"/>`;
    s += `<path d="M60 40 Q 90 6 150 14" stroke="#cfd4d8" stroke-width="0" fill="none"/>`;
    // 烟
    s += `<g opacity=".35" fill="#c9ced3"><circle cx="50" cy="12" r="7"/><circle cx="64" cy="6" r="9"/><circle cx="82" cy="4" r="7"/></g>`;
    // 走板与汽缸
    s += `<rect x="30" y="80" width="270" height="5" fill="#111" /><rect x="30" y="80" width="270" height="2" fill="${tr}"/>`;
    s += `<rect x="42" y="84" width="32" height="16" rx="3" fill="#202225" stroke="#000"/>`;
    // 排障器
    s += `<path d="M18 ${RAIL-2} L32 86 L42 86 L42 ${RAIL-2} Z" fill="#1a1b1d"/>`;
    // 动轮
    const drivers = pax? [100,145,190] : [92,124,156,188,220];
    const r = pax? 19 : 14.5;
    drivers.forEach(x => s += wheel(x, RAIL-r, r, wc, 12));
    s += wheel(60, RAIL-8, 8, wc, 8); // 导轮
    s += wheel(pax?232:250, RAIL-9, 9, wc, 8); // 从轮
    s += `<line x1="${drivers[0]}" y1="${RAIL-r+5}" x2="${drivers[drivers.length-1]}" y2="${RAIL-r+5}" stroke="#c7ccd1" stroke-width="3.2" stroke-linecap="round"/>`;
    s += `<line x1="60" y1="92" x2="${drivers[1]}" y2="${RAIL-r+5}" stroke="#aeb4ba" stroke-width="2.4"/>`;
    s += plate(250, 62, a.num, '#d8c48a');
    return s;
  }

  // ---------------- 箱式机车（内燃/电力） ----------------
  function cabUnit(a, x0, x1, opts){
    const top = 42, bot = 92, c = a.body; const id='bx'+(uid++), clip='cl'+(uid++);
    const n = a.nose||'flat';
    let path;
    if (n==='flat')  path = `M${x0+3} ${top+4} Q${x0+3} ${top} ${x0+10} ${top} L${x1-10} ${top} Q${x1-3} ${top} ${x1-3} ${top+4} L${x1} ${bot} L${x0} ${bot} Z`;
    else if (n==='slant') path = `M${x0+14} ${top} L${x1-14} ${top} L${x1} ${top+20} L${x1} ${bot} L${x0} ${bot} L${x0} ${top+20} Z`;
    else path = `M${x0+18} ${top} L${x1-18} ${top} Q${x1} ${top} ${x1} ${top+22} L${x1} ${bot} L${x0} ${bot} L${x0} ${top+22} Q${x0} ${top} ${x0+18} ${top} Z`;
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c,0.22)}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${shade(c,-0.3)}"/></linearGradient><clipPath id="${clip}"><path d="${path}"/></clipPath></defs>`;
    // 车顶设备
    s += `<rect x="${x0+20}" y="${top-6}" width="${x1-x0-40}" height="7" rx="2" fill="${a.roof||'#8a9399'}"/>`;
    if (a.panto){ s += `<rect x="${x0+40}" y="${top-10}" width="22" height="5" fill="#6f777c"/>`; }
    else { for(let x=x0+60;x<x1-50;x+=34) s+=`<rect x="${x}" y="${top-10}" width="20" height="5" rx="2" fill="#5b6267"/>`; }
    s += `<path d="${path}" fill="url(#${id})" stroke="${shade(c,-0.5)}" stroke-width="1"/>`;
    s += `<g clip-path="url(#${clip})">`;
    s += `<rect x="${x0}" y="${top+30}" width="${x1-x0}" height="7" fill="${a.stripe}"/>`;
    s += `<rect x="${x0}" y="${top+40}" width="${x1-x0}" height="2" fill="${a.stripe}" opacity=".7"/>`;
    s += `<rect x="${x0}" y="${top}" width="${x1-x0}" height="8" fill="#fff" opacity=".07"/>`;
    s += `</g>`;
    // 前窗（左端）与后窗
    const ww = 18;
    if (!opts.noFront){
      s += `<path d="M${x0+(n==='flat'?6:n==='slant'?9:8)} ${top+7} L${x0+ww+10} ${top+7} L${x0+ww+10} ${top+22} L${x0+4} ${top+22} Z" fill="#1a2430"/>`;
      s += `<rect x="${x0+9}" y="${top+9}" width="7" height="3" fill="#fff" opacity=".22"/>`;
      s += `<circle cx="${x0+6}" cy="${top+36}" r="2.6" fill="#fff4c2" stroke="#444" stroke-width=".6"/>`;
    }
    if (!opts.noRear){
      s += `<path d="M${x1-ww-10} ${top+7} L${x1-(n==='flat'?6:9)} ${top+7} L${x1-4} ${top+22} L${x1-ww-10} ${top+22} Z" fill="#1a2430"/>`;
    }
    // 侧门与侧窗、百叶
    s += `<rect x="${x0+ww+16}" y="${top+6}" width="11" height="40" rx="1" fill="none" stroke="${shade(c,-0.45)}" stroke-width="1"/>`;
    s += `<rect x="${x0+ww+18}" y="${top+9}" width="7" height="9" fill="#1a2430"/>`;
    const lx0 = x0+ww+36, lx1 = x1-ww-34;
    for(let x=lx0; x<lx1-12; x+=16){
      s += `<rect x="${x}" y="${top+8}" width="12" height="18" rx="1" fill="${shade(c,-0.22)}"/>`;
      for(let y=top+10;y<top+25;y+=3) s+=`<line x1="${x+1}" y1="${y}" x2="${x+11}" y2="${y}" stroke="${shade(c,-0.45)}" stroke-width=".8"/>`;
    }
    if (!opts.noRear) s += `<rect x="${x1-ww-28}" y="${top+6}" width="11" height="40" rx="1" fill="none" stroke="${shade(c,-0.45)}" stroke-width="1"/>`;
    // 底架
    s += `<rect x="${x0}" y="${bot}" width="${x1-x0}" height="6" fill="#222528"/>`;
    if (!a.panto) s += `<rect x="${(x0+x1)/2-28}" y="${bot+4}" width="56" height="9" rx="3" fill="#2f3337"/>`; // 油箱
    else s += `<rect x="${(x0+x1)/2-20}" y="${bot+4}" width="40" height="6" rx="2" fill="#2f3337"/>`;
    // 转向架
    const nb = a.bogies||2, ax = a.axles||3, r = ax===3?7.5:8.5;
    if (nb===2){ s += bogie(x0+44, ax, r) + bogie(x1-44, ax, r); }
    else { s += bogie(x0+38, ax, r) + bogie((x0+x1)/2, ax, r) + bogie(x1-38, ax, r); }
    if (a.panto) s += panto(x0+52, top-6, false);
    // 车钩
    if (!opts.noFront) s += `<rect x="${x0-6}" y="${bot-4}" width="8" height="5" fill="#2a2a2a"/>`;
    return s;
  }
  function cab(a){
    let s='';
    if (a.twin){
      const L = 190*(a.len||0.9);
      s += cabUnit(a, 8, 8+L, {noRear:true});
      s += `<rect x="${8+L}" y="80" width="6" height="8" fill="#222"/>`;
      s += cabUnit(a, 14+L, 14+2*L, {noFront:true});
      s += plate(40, 98-28, a.num, '#e9e2c7');
    } else {
      const L = 250*(a.len||1);
      s += cabUnit(a, 10, 10+L, {});
      if (a.coach){ s += coachBox(10+L+6, W+40, 46, a.coach, '#1c2633', {stripe: shade(a.coach,0.45)}); s += `<rect x="${10+L}" y="80" width="6" height="7" fill="#222"/>`; }
      s += plate(10+L/2-20, 98-28, a.num, '#e9e2c7');
    }
    return s;
  }

  // ---------------- 美式罩式机车 ----------------
  function hood(a){
    const c=a.body, id='hd'+(uid++);
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c,0.2)}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${shade(c,-0.3)}"/></linearGradient></defs>`;
    const x0=14, x1=360;
    // 走板
    s += `<rect x="${x0}" y="86" width="${x1-x0}" height="6" fill="#1d1f21"/><rect x="${x0}" y="84" width="${x1-x0}" height="3" fill="${a.stripe}"/>`;
    // 扶手
    s += `<line x1="${x0+60}" y1="62" x2="${x1-4}" y2="62" stroke="#cfd3d6" stroke-width="1"/>`;
    for(let x=x0+70;x<x1;x+=30) s+=`<line x1="${x}" y1="62" x2="${x}" y2="84" stroke="#cfd3d6" stroke-width=".8"/>`;
    // 短罩（前）
    const capX = x0+26, capW = a.wide? 48: 40;
    if (a.wide) s += `<path d="M${x0+2} 84 L${x0+2} 58 Q${x0+4} 50 ${capX} 48 L${capX} 84 Z" fill="url(#${id})" stroke="${shade(c,-0.5)}"/>`;
    else s += `<rect x="${x0+4}" y="60" width="${capX-x0-2}" height="24" rx="3" fill="url(#${id})" stroke="${shade(c,-0.5)}"/>`;
    // 司机室
    s += `<rect x="${capX}" y="${a.wide?34:36}" width="${capW}" height="${a.wide?50:48}" rx="3" fill="url(#${id})" stroke="${shade(c,-0.5)}"/>`;
    s += `<rect x="${capX-2}" y="${a.wide?31:33}" width="${capW+4}" height="5" rx="2" fill="${shade(c,-0.25)}"/>`;
    s += `<rect x="${capX+6}" y="${a.wide?40:42}" width="${capW-12}" height="14" rx="2" fill="#1a2430"/>`;
    s += `<rect x="${capX+8}" y="${a.wide?42:44}" width="8" height="3" fill="#fff" opacity=".2"/>`;
    // 长罩
    const hx = capX+capW;
    s += `<rect x="${hx}" y="48" width="${x1-hx-6}" height="36" rx="3" fill="url(#${id})" stroke="${shade(c,-0.5)}"/>`;
    for(let x=hx+10;x<x1-60;x+=22){ s+=`<rect x="${x}" y="54" width="14" height="24" fill="none" stroke="${shade(c,-0.4)}" stroke-width=".9"/>`; }
    s += `<rect x="${x1-70}" y="44" width="58" height="6" rx="2" fill="${shade(c,-0.35)}"/>`;
    s += `<rect x="${x1-64}" y="40" width="20" height="4" fill="#333"/><rect x="${x1-38}" y="40" width="20" height="4" fill="#333"/>`;
    s += `<rect x="${hx+30}" y="42" width="10" height="6" fill="#222"/>`;
    s += `<rect x="${hx}" y="70" width="${x1-hx-6}" height="4" fill="${a.stripe}"/>`;
    s += `<circle cx="${x0+6}" cy="68" r="2.4" fill="#fff4c2"/>`;
    // 油箱与转向架
    s += `<rect x="${130}" y="93" width="110" height="12" rx="5" fill="#26292c"/>`;
    s += bogie(80, 3, 7.5) + bogie(300, 3, 7.5);
    s += `<path d="M${x0-6} ${RAIL-3} L${x0} 92 L${x0+8} 92 L${x0+8} ${RAIL-3} Z" fill="#1a1b1d"/>`;
    s += plate(hx+20, 70-1, a.num, '#efe7c9');
    s += coachBox(x1+4, W+60, 52, '#6b5a4a', '#3b3029', {});
    return s;
  }

  // ---------------- 动车组 ----------------
  function bez(p0,p1,p2,p3,t){ const u=1-t; return [u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0], u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]]; }
  const NOSES = {
    // 控制点：以鼻尖x0为原点，按鼻长nl与高度h的比例
    bullet0:{ tipY:74, p1:[0.45,0], p2:[0,0.12], lip:0 },
    round:  { tipY:80, p1:[0.4,0], p2:[0,0.35], lip:1 },
    pointed:{ tipY:84, p1:[0.55,0.08], p2:[0.15,0.8], lip:2 },
    long:   { tipY:87, p1:[0.72,0], p2:[0.25,0.95], lip:3 },
    duck:   { tipY:88, p1:[0.85,0.05], p2:[0.55,1.05], lip:5 },
    wedge:  { tipY:84, p1:[0.75,0.25], p2:[0.3,0.75], lip:2 },
    tgv:    { tipY:83, p1:[0.62,0.42], p2:[0.25,0.86], lip:3, power:true },
    ice:    { tipY:82, p1:[0.3,0], p2:[0.05,0.55], lip:2, power:true },
    bullet: { tipY:85, p1:[0.6,0], p2:[0.1,0.85], lip:3 },
    blunt:  { tipY:78, p1:[0.3,0], p2:[0,0.3], lip:1, power:true },
    hst:    { tipY:80, p1:[0.5,0.2], p2:[0,0.45], lip:2, power:true, buffers:true },
  };
  function emu(a, hstMode){
    const nose = NOSES[a.nose] || NOSES.pointed;
    const top = 46, bot = 92, x0 = 6;
    const nl = 78*(a.noseLen||1);
    const nx = x0 + nl; // 鼻部结束处
    const carEnd = 318;
    const P0=[nx, top], P3=[x0, nose.tipY];
    const hh = nose.tipY-top;
    const P1=[x0 + nl*nose.p1[0], top + hh*nose.p1[1]];
    const P2=[x0 + nl*nose.p2[0], top + hh*nose.p2[1]];
    const body = `M${carEnd} ${top+2} Q${carEnd} ${top} ${carEnd-4} ${top} L${nx} ${top} C${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]} ${P3[0]} ${P3[1]} Q${x0-1} ${bot-2} ${x0+10+nose.lip*2} ${bot} L${carEnd} ${bot} Z`;
    const c = a.body, id='eg'+(uid++), clip='ec'+(uid++);
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c,0.35)}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${shade(c,-0.22)}"/></linearGradient><clipPath id="${clip}"><path d="${body}"/></clipPath></defs>`;
    // 第二节车
    s += coachEmu(carEnd+6, W+60, top, a);
    s += `<rect x="${carEnd-2}" y="${top+8}" width="10" height="${bot-top-12}" fill="#2a2d30"/>`;
    // 车体
    s += `<path d="${body}" fill="url(#${id})" stroke="${shade(c,-0.45)}" stroke-width="1"/>`;
    s += `<g clip-path="url(#${clip})">`;
    if (hstMode){ s += `<rect x="0" y="${top}" width="${nx+30}" height="${bot-top}" fill="${a.body}"/><rect x="${nx+30}" y="${top}" width="${carEnd}" height="${bot-top}" fill="${a.body2}"/>`; }
    // 腰线
    s += `<path d="M0 ${top+31} L${carEnd} ${top+31} L${carEnd} ${top+37} L0 ${top+37} Z" fill="${a.stripe}"/>`;
    if (a.stripe2) s += `<rect x="0" y="${top+39}" width="${carEnd}" height="2.5" fill="${a.stripe2}"/>`;
    else s += `<rect x="0" y="${top+39}" width="${carEnd}" height="1.5" fill="${a.stripe}" opacity=".6"/>`;
    // 前窗：沿曲线取样
    const pts=[]; for(let t=0.12;t<=0.52;t+=0.04){ pts.push(bez(P0,P1,P2,P3,t)); }
    const inner = pts.slice().reverse().map(p=>[p[0]+7, p[1]+5]);
    s += `<path d="M${pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L')} L${inner.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L')} Z" fill="${a.window||'#1d2a3a'}"/>`;
    // 高光
    s += `<rect x="0" y="${top}" width="${carEnd}" height="5" fill="#fff" opacity=".18"/>`;
    // 侧窗
    const wx0 = nx + 26;
    if (nose.power && !hstMode){
      // 动力车：格栅
      for(let x=wx0; x<carEnd-30; x+=22) s += `<rect x="${x}" y="${top+10}" width="16" height="14" rx="1" fill="${shade(c,-0.18)}" stroke="${shade(c,-0.38)}" stroke-width=".6"/>`;
    } else {
      if (a.duplex){
        for(let x=wx0; x<carEnd-14; x+=17) s += `<rect x="${x}" y="${top+6}" width="12" height="8" rx="1.5" fill="${a.window}"/><rect x="${x}" y="${top+18}" width="12" height="9" rx="1.5" fill="${a.window}"/>`;
      } else {
        for(let x=wx0; x<carEnd-14; x+=17) s += `<rect x="${x}" y="${top+12}" width="12" height="12" rx="2" fill="${a.window}"/><rect x="${x+1}" y="${top+13}" width="4" height="3" fill="#fff" opacity=".22"/>`;
      }
      s += `<rect x="${nx+8}" y="${top+8}" width="10" height="${bot-top-14}" rx="1.5" fill="none" stroke="${shade(c,-0.4)}" stroke-width=".9"/>`;
    }
    // 司机室侧窗
    s += `<rect x="${nx-6}" y="${top+10}" width="12" height="9" rx="2" fill="${a.window}"/>`;
    s += `</g>`;
    // 头灯
    const hl = bez(P0,P1,P2,P3,0.82);
    s += `<ellipse cx="${(hl[0]+5).toFixed(1)}" cy="${(hl[1]+3).toFixed(1)}" rx="4" ry="2" fill="#fffbe0" stroke="#666" stroke-width=".5"/>`;
    if (nose.buffers){ s += `<rect x="${x0-6}" y="${bot-8}" width="8" height="3" fill="#333"/><rect x="${x0-6}" y="${bot-3}" width="8" height="3" fill="#333"/>`; }
    // 裙板与转向架
    s += `<path d="M${x0+14} ${bot} L${carEnd} ${bot} L${carEnd} ${bot+5} L${x0+22} ${bot+5} Z" fill="${shade(c,-0.5)}"/>`;
    s += bogie(nx+34, 2, 7) + bogie(carEnd-40, 2, 7);
    if (nose.power || hstMode){ if(!hstMode) s += panto(carEnd-80, top, false); }
    s += plate(carEnd-90, bot-15, a.num, '#e8ecef');
    return s;
  }
  function coachEmu(x0, x1, top, a){
    const c=a.hstCoach||a.body2||a.body, id='ce'+(uid++);
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(c,0.35)}"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${shade(c,-0.22)}"/></linearGradient></defs>`;
    s += `<rect x="${x0}" y="${top}" width="${x1-x0}" height="${92-top}" rx="6" fill="url(#${id})" stroke="${shade(c,-0.45)}"/>`;
    s += `<rect x="${x0}" y="${top+31}" width="${x1-x0}" height="6" fill="${a.stripe}"/>`;
    if (a.duplex){ for(let x=x0+14;x<x1-10;x+=17) s += `<rect x="${x}" y="${top+6}" width="12" height="8" rx="1.5" fill="${a.window}"/><rect x="${x}" y="${top+18}" width="12" height="9" rx="1.5" fill="${a.window}"/>`; }
    else for(let x=x0+14;x<x1-10;x+=17) s += `<rect x="${x}" y="${top+12}" width="12" height="12" rx="2" fill="${a.window||'#1d2a3a'}"/>`;
    s += `<rect x="${x0}" y="92" width="${x1-x0}" height="5" fill="${shade(c,-0.5)}"/>`;
    s += bogie(x0+30, 2, 7);
    if (a.panto2 !== false && (a.nose!=='tgv' && a.nose!=='ice' && a.nose!=='hst')) s += panto(x0+60, top, true);
    return s;
  }


  // ---------------- 车厢 ----------------
  const CAR_LOOK = {
    YZ22:['coach','#2f5e3b','#e8c95a'], YW22:['coach','#2f5e3b','#e8c95a'], RW22:['coach','#2f5e3b','#e8c95a'], YZ25B:['coach','#2f5e3b','#e8c95a'],
    SYZ25B:['duplex','#a8322b','#efe6cf'], YZ25G:['coach','#c0442b','#f3eee2'], YW25G:['coach','#c0442b','#f3eee2'],
    YZ25K:['coach','#efefea','#c0392b'], YW25T:['coach','#f3f3ef','#1d4f91'], RW25T:['coach','#f3f3ef','#1d4f91'],
    CORAIL:['coach','#9aa3a8','#e3701e'], EUROFIMA:['coach','#e9dcc0','#9b1c2c'], MK3:['coach','#c9ccd0','#1f3a6e'], SU_KUPE:['coach','#355f3c','#d8c25a'], J24:['coach','#1d2f6b','#f2f2f2'],
    P62:['box','#7a3b2a'], C62A:['gond','#2b2b2b'], C64:['gond','#33302c'], C70:['gond','#6b2a20'], C80:['gond','#a9b0b5'], G60:['tank','#1e1e1e'], N17:['flat','#3a3a3a'], X1K:['cont','#4a4f55'], US_HOPPER:['hopper','#4a2f22'], US_STACK:['stack','#3d4248'],
    RW25G:['coach','#c0442b','#f3eee2'], YZ25Z:['coach','#f2f2ee','#1f5aa6'], YZ25T:['coach','#f3f3ef','#1d4f91'], P64:['box','#7a3b2a'], P70:['box','#6e3326'], G70:['tank','#262626'], KM70:['hopper','#4a4f55'], X2K:['stack','#3d4248'], NX70:['flat','#3a3a3a'],
  };
  function carSvg(c){
    const [shape, col, st] = CAR_LOOK[c.id] || [c.kind==='pax'?'coach':'box', '#666', '#ccc'];
    const x0 = 24, x1 = 396; let g = '';
    const id='cr'+(uid++);
    const grad = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(col,0.2)}"/><stop offset=".55" stop-color="${col}"/><stop offset="1" stop-color="${shade(col,-0.3)}"/></linearGradient></defs>`;
    const couplers = `<rect x="${x0-10}" y="86" width="12" height="5" fill="#222"/><rect x="${x1-2}" y="86" width="12" height="5" fill="#222"/>`;
    if (shape === 'coach' || shape === 'duplex'){
      g += coachBox(x0, x1, shape==='duplex'?34:44, col, '#1c2633', { stripe: st });
      if (shape==='duplex') for(let x=x0+14;x<x1-14;x+=19) g += `<rect x="${x}" y="70" width="13" height="10" rx="1.5" fill="#1c2633"/>`;
      g += `<rect x="${x0+4}" y="50" width="9" height="36" rx="1" fill="none" stroke="${shade(col,-0.45)}"/><rect x="${x1-13}" y="50" width="9" height="36" rx="1" fill="none" stroke="${shade(col,-0.45)}"/>`;
      return grad + g + couplers;
    }
    const bog = bogie(x0+44, 2, 7.5) + bogie(x1-44, 2, 7.5);
    const frame = `<rect x="${x0}" y="88" width="${x1-x0}" height="6" fill="#222"/>`;
    if (shape==='box'){ g += `<rect x="${x0}" y="40" width="${x1-x0}" height="48" rx="2" fill="url(#${id})" stroke="${shade(col,-0.5)}"/><path d="M${x0} 40 Q${(x0+x1)/2} 32 ${x1} 40 Z" fill="${shade(col,-0.2)}"/>`;
      for(let x=x0+10;x<x1;x+=18) g += `<line x1="${x}" y1="42" x2="${x}" y2="86" stroke="${shade(col,-0.3)}"/>`;
      g += `<rect x="${(x0+x1)/2-30}" y="44" width="60" height="42" fill="${shade(col,-0.12)}" stroke="${shade(col,-0.5)}"/>`; }
    if (shape==='gond' || shape==='hopper'){ g += `<path d="M${x0} 58 Q${(x0+x1)/2} 44 ${x1} 58 L${x1} 52 L${x0} 52 Z" fill="#141414"/>`;
      g += `<rect x="${x0}" y="52" width="${x1-x0}" height="36" rx="1" fill="url(#${id})" stroke="${shade(col,-0.5)}"/>`;
      for(let x=x0+12;x<x1;x+=24) g += `<rect x="${x}" y="52" width="3" height="36" fill="${shade(col,-0.25)}"/>`;
      if (shape==='hopper') g += `<path d="M${x0+80} 88 L${x0+110} 100 L${x0+150} 100 L${x0+180} 88 Z M${x1-180} 88 L${x1-150} 100 L${x1-110} 100 L${x1-80} 88 Z" fill="${shade(col,-0.2)}"/>`; }
    if (shape==='tank'){ g += `<rect x="${x0+6}" y="46" width="${x1-x0-12}" height="40" rx="20" fill="url(#${id})" stroke="#000"/><rect x="${(x0+x1)/2-12}" y="38" width="24" height="9" fill="#2a2a2a"/><line x1="${x0+20}" y1="44" x2="${x1-20}" y2="44" stroke="#777"/>`; }
    if (shape==='flat'){ g += `<rect x="${x0}" y="80" width="${x1-x0}" height="8" fill="url(#${id})"/>`; for(let k=0;k<4;k++) g += `<rect x="${x0+20}" y="${72-k*8}" width="${x1-x0-40}" height="7" rx="3" fill="#7d8389" stroke="#555"/>`; g += `<line x1="${x0+80}" y1="48" x2="${x0+80}" y2="80" stroke="#c9a227" stroke-width="2"/><line x1="${x1-80}" y1="48" x2="${x1-80}" y2="80" stroke="#c9a227" stroke-width="2"/>`; }
    if (shape==='cont'){ g += `<rect x="${x0}" y="82" width="${x1-x0}" height="6" fill="url(#${id})"/><rect x="${x0+6}" y="40" width="176" height="42" fill="#2a6aa3" stroke="#183c5e"/><rect x="${x1-182}" y="40" width="176" height="42" fill="#b3402e" stroke="#6b2419"/>`;
      for(let x=x0+12;x<x1-6;x+=8) if (Math.abs(x-(x0+x1)/2)>6) g += `<line x1="${x}" y1="42" x2="${x}" y2="80" stroke="rgba(0,0,0,.25)"/>`; }
    if (shape==='stack'){ g += `<path d="M${x0} 70 L${x0+40} 70 L${x0+40} 96 L${x1-40} 96 L${x1-40} 70 L${x1} 70 L${x1} 80 L${x0} 80 Z" fill="url(#${id})"/><rect x="${x0+44}" y="54" width="${x1-x0-88}" height="40" fill="#c08a2a" stroke="#6b4a12"/><rect x="${x0+36}" y="14" width="${x1-x0-72}" height="40" fill="#2f6e5a" stroke="#1a4033"/>`;
      return grad + g + bogie(x0+22, 2, 7.5) + bogie(x1-22, 2, 7.5) + couplers; }
    return grad + g + frame + bog + couplers;
  }
  function carSVG(c){ uid++; return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="train-art" preserveAspectRatio="xMidYMid meet">${track()}${carSvg(c)}</svg>`; }

  function svg(model, opts={}){
    const a = model.art; uid++;
    let inner = '';
    if (a.style==='steam') inner = steam(a, model.use==='pax');
    else if (a.style==='cab') inner = cab(a);
    else if (a.style==='hood') inner = hood(a);
    else if (a.style==='emu') inner = emu(a, false);
    else if (a.style==='hst') inner = emu(Object.assign({}, a, {nose:'hst', noseLen:0.8, hstCoach:a.body2}), true);
    const shadow = `<ellipse cx="${W/2}" cy="${RAIL+4}" rx="${W/2}" ry="3" fill="#000" opacity=".25"/>`;
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="${opts.cls||'train-art'}" preserveAspectRatio="xMidYMid meet">${track()}${shadow}${inner}</svg>`;
  }
  function icon(name, label){
    const accessibility = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
    return `<svg class="ui-icon" ${accessibility}><use href="#ui-${name}"/></svg>`;
  }
  return { svg, shade, car: carSVG, icon };
})();
