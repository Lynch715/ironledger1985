// 新手引导：前 10 分钟一步步教玩家看地图、建线路、买车、开行、修线
const Tutorial = (() => {
  const $ = s => document.querySelector(s);
  const KEY = 'tdcq_tut_done';
  const mobile = () => window.innerWidth <= 760;
  const STEPS = [
    { title:'欢迎上任', text:'你是一家新成立铁路公司的总经理。这份引导大约 10 分钟，带你开出第一趟列车。随时可以点「跳过」，之后在「帮助」里还能重新打开。', next:true },
    { title:'看懂地图', mapStep:true, text:() => `深色实线是国铁线路，你的列车可以付费过轨运行；虚线是可以自己修建的走廊。${mobile() ? '单指拖动、双指缩放地图，' : '拖动、滚轮缩放地图，'}然后<b>点一下北京或任何一座城市</b>，看看它的人口和客货需求。`,
      done:(S, ui) => ui.selCity !== null && ui.selCity !== undefined },
    { title:'规划第一条线路', text:'开行列车先要有一条运营线路。点城市详情里的<b>「以此为起点新建运营线路」</b>，或者在「线路」页点<b>「新建运营线路」</b>。', hl:'[data-act=routeFrom],[data-act=newRoute],#tabs [data-tab=routes]',
      done:(S, ui) => ui.mode === 'route' || S.routes.length > 0 },
    { title:'选择经停城市', text:'在地图上<b>依次点击要经停的城市</b>（至少两座），系统会沿已有线路自动寻路。选好后点上方的<b>「完成」</b>。建议先选两座相距不远、客流旺盛的大城市，比如北京—天津。', hl:'#routebar',
      done:S => S.routes.length > 0 },
    { title:'购买列车', text:'打开<b>「购车」</b>页，挑一款<b>客运</b>机车，比如 1985 年的<b>东风4B型</b>内燃机车（不需要电气化，京津线可以直接跑；韶山型电力机车要等线路电气化）。在下拉框里选刚建的线路，点<b>「购买」</b>，会自动配上一组硬座车厢。国产车约 30 天交付，交付后自动上线。', hl:() => document.querySelector('[data-act=buy]') ? '[data-act=buy]' : '#tabs [data-tab=market]',
      done:S => S.trains.length > 0 },
    { title:'让时间走起来', text:'点顶部的<b>播放按钮</b>（或按空格键）。速度越快，一天过得越快。新车交付后会自动投入运营，地图上能看到它在跑。', hl:'#speed',
      // 首趟列车实际跑完一个单程才算完成
      done:(S, ui) => ui.speed > 0 && S.trains.some(t => t.status === 'run' && ((t.tripsM || 0) + (t.lastTrips || 0)) > 0) },
    { title:'看收入', text:'列车开起来了。<b>「线路」</b>页能看到每条线的客流、满载率和月利润；<b>「总览」</b>看全公司的收支。满载率高时先看区段利用率：线路还有通过能力、加车后预计月利润为正再加车；区段已拥堵时加车只会晚点。长期亏损就换线路或换车型。', hl:'#tabs [data-tab=routes]', next:true },
    { title:'自己修线', text:'租用国铁线路要付过轨费。想省钱、点亮更多城市，就<b>点地图上的虚线走廊</b>，在「建设」页开工自己的线路。钱不够时可以借款开工。', hl:'#tabs [data-tab=build]',
      done:S => S.tracks.some(t => t.owner === 'P'), next:'先不修，继续' },
    { title:'出发吧', text:'基本操作就是这些。运输合同、政府任务、同业竞争、上市融资会在游戏推进中陆续出现。祝你的铁路帝国一路畅通！', next:'完成', last:true },
  ];
  let step = -1, timer = null, min = false;
  function el(){ let e = $('#coach'); if (!e) { e = document.createElement('div'); e.id = 'coach'; document.body.appendChild(e);
      e.addEventListener('click', ev => { const b = ev.target.closest('[data-tut]'); if (!b) return; const k = b.dataset.tut;
        if (k === 'next') go(step + 1); if (k === 'skip') stop(true); if (k === 'min') { min = !min; render(); } }); } return e; }
  function clearHL(){ document.querySelectorAll('.tut-hl').forEach(x => x.classList.remove('tut-hl')); }
  function render(){ const s = STEPS[step]; if (!s) return; const e = el(); e.className = min ? 'min' : '';
    const txt = typeof s.text === 'function' ? s.text() : s.text;
    place(); e.innerHTML = min ? `<button class="btn sm" data-tut="min">新手引导 ${step+1}/${STEPS.length} ${Art.icon('up')}</button>`
      : `<div class="ct-head"><span class="stamp">新手引导 · ${step+1}/${STEPS.length}</span><button class="ct-x" data-tut="min" title="收起" aria-label="收起引导">${Art.icon('minus')}</button></div><h3>${s.title}</h3><p>${txt}</p>
        <div class="ct-foot">${s.last ? '<span></span>' : '<button class="btn sm" data-tut="skip">跳过引导</button>'}${s.next ? `<button class="btn sm primary" data-tut="next">${s.next === true ? '下一步' : s.next}</button>` : '<span class="dim">完成上面的操作后自动继续</span>'}</div>`; }
  function go(i){ if (i >= STEPS.length) return stop(true); step = i; min = false; clearHL(); render(); if (window.Sfx) Sfx.play('tick'); }
  function place(){ const e = $('#coach'); if (!e) return; if (!mobile()) { e.style.top = e.style.bottom = ''; return; }
    const rb = $('#routebar'), ins = $('#inspector'), st = STEPS[step] || {};
    const bottom = (rb && rb.classList.contains('show')) || (st.mapStep && !(ins && ins.classList.contains('show')));
    if (bottom) { e.style.top = 'auto'; e.style.bottom = ''; }
    else { const h = $('#top'); e.style.top = ((h ? h.getBoundingClientRect().bottom : 90) + 6) + 'px'; e.style.bottom = 'auto'; } }
  function check(){ place(); const s = STEPS[step]; if (!s || typeof Game === 'undefined' || !Game.S) return; const ui = window.__ui || {};
    if (s.done && s.done(Game.S, ui)) { go(step + 1); return; }
    clearHL(); const hl = typeof s.hl === 'function' ? s.hl() : s.hl; if (hl && !min) document.querySelectorAll(hl).forEach(x => x.classList.add('tut-hl')); }
  function start(){ stop(false); go(0); timer = setInterval(check, 400); }
  function stop(done){ if (timer) clearInterval(timer); timer = null; step = -1; clearHL(); const e = $('#coach'); if (e) e.remove(); if (done) try { localStorage.setItem(KEY, '1'); } catch(err) {} }
  function seen(){ try { return !!localStorage.getItem(KEY); } catch(e) { return true; } }
  return { start, stop, seen, active:() => step >= 0 };
})();
window.Tutorial = Tutorial;
