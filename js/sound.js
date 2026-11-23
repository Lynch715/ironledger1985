// 音效与配乐：全部用 Web Audio 实时合成，不依赖外部音频文件
const Sfx = (() => {
  const KEY = 'tdcq_sound';
  let cfg = { sfx:true, music:true, sv:0.7, mv:0.45 };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch(e) {}
  let ac = null, sfxBus, musBus, delay, unlocked = false;
  function init(){
    if (ac) return ac; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ac = new AC();
    const master = ac.createDynamicsCompressor(); master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    musBus = ac.createGain(); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; musBus.connect(lp); lp.connect(master);
    // 磁带般的回声
    delay = ac.createDelay(1); delay.delayTime.value = 0.36; const fb = ac.createGain(); fb.gain.value = 0.28; const dl = ac.createGain(); dl.gain.value = 0.35;
    delay.connect(fb); fb.connect(delay); delay.connect(dl); dl.connect(musBus);
    apply(); return ac;
  }
  function apply(){ if (!ac) return; sfxBus.gain.value = cfg.sfx ? cfg.sv * 0.55 : 0; musBus.gain.value = cfg.music ? cfg.mv * 0.22 : 0; }
  function saveCfg(){ try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch(e) {} }
  function unlock(){ if (unlocked) return; if (!init()) return; if (ac.state === 'suspended') ac.resume(); unlocked = true; if (cfg.music) musicStart(); }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { capture:true, passive:true }));

  // —— 基础发声 ——
  function env(g, t, a, peak, d, sus, r, end){ g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d); g.gain.setValueAtTime(Math.max(0.0001, peak * sus), end); g.gain.exponentialRampToValueAtTime(0.0001, end + r); }
  function osc(type, f, t, dur, peak, out, opt){ opt = opt || {}; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (opt.glide) o.frequency.exponentialRampToValueAtTime(opt.glide, t + dur); if (opt.detune) o.detune.value = opt.detune;
    env(g, t, opt.a || 0.01, peak, opt.d || 0.1, opt.s === undefined ? 0.6 : opt.s, opt.r || 0.15, t + dur);
    let node = g; if (opt.lp) { const f2 = ac.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = opt.lp; f2.Q.value = opt.q || 0.7; g.connect(f2); node = f2; }
    o.connect(g); node.connect(out); if (opt.send) node.connect(opt.send); o.start(t); o.stop(t + dur + (opt.r || 0.15) + 0.05); }
  function noise(t, dur, peak, out, f, q, type){ const n = ac.createBufferSource(), len = Math.ceil(ac.sampleRate * (dur + 0.3)); const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; n.buffer = buf; const bp = ac.createBiquadFilter(); bp.type = type || 'bandpass'; bp.frequency.value = f; bp.Q.value = q || 1;
    const g = ac.createGain(); env(g, t, 0.02, peak, 0.05, 0.7, 0.2, t + dur); n.connect(bp); bp.connect(g); g.connect(out); n.start(t); n.stop(t + dur + 0.3); }

  const SOUNDS = {
    // 内燃机车双音风笛
    horn(t, k){ const v = 0.32 * k; [311, 370, 466].forEach((f, i) => osc('sawtooth', f, t, 0.9, v * (i === 2 ? 0.5 : 1), sfxBus, { a:0.06, d:0.2, s:0.85, r:0.35, lp:1500, detune:(i - 1) * 6 })); },
    // 车站广播提示音：叮—咚—叮
    chime(t, k){ [[659, 0], [523, 0.32], [784, 0.64]].forEach(([f, dt]) => { osc('sine', f, t + dt, 0.05, 0.28 * k, sfxBus, { a:0.005, d:0.6, s:0.25, r:0.9 }); osc('sine', f * 2, t + dt, 0.05, 0.05 * k, sfxBus, { a:0.005, d:0.3, s:0.1, r:0.5 }); }); },
    // 进账
    coin(t, k){ osc('triangle', 988, t, 0.06, 0.25 * k, sfxBus, { a:0.003, d:0.08, s:0.3, r:0.1 }); osc('triangle', 1319, t + 0.08, 0.18, 0.25 * k, sfxBus, { a:0.003, d:0.15, s:0.4, r:0.3 }); },
    // 警示
    alert(t, k){ [0, 0.22].forEach(dt => osc('square', 220, t + dt, 0.12, 0.12 * k, sfxBus, { a:0.005, d:0.05, s:0.8, r:0.06, lp:1200 })); osc('square', 175, t + 0.44, 0.3, 0.12 * k, sfxBus, { a:0.005, d:0.1, s:0.7, r:0.2, lp:1000 }); },
    // 轻点
    tick(t, k){ osc('sine', 1800, t, 0.015, 0.08 * k, sfxBus, { a:0.002, d:0.02, s:0.2, r:0.03 }); },
    // 开工：打桩声
    build(t, k){ [0, 0.18, 0.36].forEach(dt => { noise(t + dt, 0.05, 0.35 * k, sfxBus, 180, 1.2, 'lowpass'); osc('sine', 90, t + dt, 0.06, 0.3 * k, sfxBus, { a:0.003, d:0.08, s:0.2, r:0.1, glide:55 }); }); },
    // 汽笛（蒸汽机车）
    whistle(t, k){ noise(t, 1.0, 0.18 * k, sfxBus, 1300, 6); osc('sine', 740, t, 1.0, 0.1 * k, sfxBus, { a:0.08, d:0.2, s:0.8, r:0.3, glide:700 }); },
  };
  const lastAt = {};
  function play(name, k){ if (!cfg.sfx || !unlocked || !ac || !SOUNDS[name]) return; const now = ac.currentTime; if (lastAt[name] && now - lastAt[name] < 0.25) return; lastAt[name] = now; SOUNDS[name](now + 0.01, k || 1); }

  // —— 配乐：五声音阶的慢板，每次都略有不同 ——
  const BPM = 76, BEAT = 60 / BPM;
  const PENTA = [0, 2, 4, 7, 9];
  const CHORDS = [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [2, 5, 9], [7, 11, 14]]; // C Am F G C Am Dm G
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  let musTimer = null, nextT = 0, beat = 0, melIdx = 7, phraseRest = 0;
  function scaleNote(i){ const o = Math.floor(i / 5), d = ((i % 5) + 5) % 5; return 60 + o * 12 + PENTA[d]; }
  function scheduleBeat(t, b){
    const bar = Math.floor(b / 4), ch = CHORDS[bar % CHORDS.length], pos = b % 4, root = 48 + ch[0] % 12;
    if (pos === 0) { osc('triangle', midi(root - 12), t, BEAT * 3.6, 0.22, musBus, { a:0.02, d:0.4, s:0.5, r:0.4, lp:500 });
      ch.forEach((n, i) => osc('sine', midi(60 + n - 12), t + i * 0.02, BEAT * 3.8, 0.05, musBus, { a:0.6, d:0.5, s:0.8, r:0.8 })); }
    if (pos === 2) osc('triangle', midi(root - 5), t, BEAT * 1.6, 0.12, musBus, { a:0.02, d:0.3, s:0.4, r:0.3, lp:500 });
    // 旋律：每 4 小节一个乐句，句尾休止
    const phrasePos = b % 16; if (phrasePos === 0) phraseRest = Math.random() < 0.25 ? 1 : 0;
    if (phraseRest || phrasePos >= 14) return;
    const notes = Math.random() < 0.35 ? [0, 0.5] : [0];
    notes.forEach(off => { if (Math.random() < 0.18) return;
      const step = [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]; melIdx = Math.max(3, Math.min(12, melIdx + step));
      if (pos === 0 && Math.random() < 0.6) { const tones = ch.map(n => n % 12); for (let k = 0; k < 3; k++) { if (tones.includes(scaleNote(melIdx) % 12)) break; melIdx += 1; } }
      const f = midi(scaleNote(melIdx)), tt = t + off * BEAT, dur = off ? BEAT * 0.4 : BEAT * (notes.length > 1 ? 0.4 : 0.85);
      osc('triangle', f, tt, dur, 0.16, musBus, { a:0.01, d:0.25, s:0.35, r:0.5, send:delay, lp:2400 });
      osc('sine', f * 2, tt, dur * 0.5, 0.03, musBus, { a:0.01, d:0.1, s:0.2, r:0.3 }); });
  }
  function musicStart(){ if (!ac || musTimer) return; nextT = ac.currentTime + 0.2; musTimer = setInterval(() => { if (!cfg.music) return; if (nextT < ac.currentTime) nextT = ac.currentTime + 0.1; while (nextT < ac.currentTime + 0.4) { scheduleBeat(nextT, beat++); nextT += BEAT; } }, 100); }
  function musicStop(){ if (musTimer) clearInterval(musTimer); musTimer = null; }
  function set(k, v){ cfg[k] = v; saveCfg(); unlock(); apply(); if (k === 'music') { if (v) musicStart(); else musicStop(); } if (k === 'sfx' && v) play('tick'); }
  return { play, set, get cfg(){ return Object.assign({}, cfg); } };
})();
window.Sfx = Sfx;
