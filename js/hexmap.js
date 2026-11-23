// =============================================================
//  铁道春秋 · 六边形地形地图 v2（票根复古风，手绘地形）
//  地形按经纬度多边形近似划分，仅用于游戏示意，不表示任何行政边界。
//  渲染：连续地形底色（柔和过渡 + 高程晕渲）→ 海岸水纹 → 河湖 → 六边形格网 → 手绘图标
// =============================================================
const HexMap = (() => {
  const COS = Math.cos(35 * Math.PI/180);
  const wx = lon => (lon - 104) * COS, wy = lat => -(lat - 35);
  const B = { lon0:72, lon1:136, lat0:15, lat1:54 };
  const R = 0.27;                  // 六边形外接圆半径（世界单位≈纬度）

  // ---------- 海岸线（海在多边形内） ----------
  const OCEAN = [
    [136,45.2],[135.1,43.8],[134.0,43.0],[133.1,42.7],[132.3,43.2],[131.8,43.0],[131.2,42.6],[130.7,42.3],
    [130.0,41.95],[129.7,41.4],[129.4,40.8],[128.6,40.3],[127.9,39.95],[127.5,39.6],[127.4,39.15],[128.1,38.7],[128.6,38.2],[129.1,37.5],[129.4,36.6],[129.45,35.9],[129.3,35.3],[129.0,35.05],
    [128.4,34.85],[127.7,34.65],[127.2,34.5],[126.6,34.35],[126.3,34.75],[126.45,35.4],[126.6,36.0],[126.3,36.6],[126.6,37.1],[126.6,37.5],[126.1,37.75],[125.5,37.8],[125.2,38.05],[125.0,38.5],[125.4,38.75],[125.1,39.3],[124.7,39.65],[124.3,39.85],
    [123.6,39.75],[123.0,39.55],[122.4,39.25],[121.9,38.95],[121.6,38.85],[121.2,38.75],[121.35,39.05],[121.6,39.5],[121.55,39.95],[122.0,40.35],[122.25,40.6],[122.0,40.85],[121.6,40.9],[121.1,40.8],[120.8,40.55],[120.35,40.2],[119.8,39.95],[119.5,39.8],
    [119.1,39.35],[118.5,39.1],[118.0,39.15],[117.65,38.95],[117.55,38.6],[117.75,38.3],[118.1,38.1],[118.6,38.0],[119.05,37.75],[118.95,37.35],[119.1,37.15],[119.5,37.15],[119.85,37.35],[120.3,37.65],[120.75,37.82],[121.15,37.6],[121.6,37.48],[122.1,37.52],[122.55,37.4],[122.65,37.15],
    [122.45,36.9],[121.95,36.9],[121.5,36.75],[121.0,36.55],[120.7,36.35],[120.35,36.05],[120.05,35.85],[119.65,35.55],[119.4,35.1],[119.25,34.75],[119.6,34.45],[120.25,34.1],[120.5,33.55],[120.8,33.1],[121.0,32.6],[121.4,32.3],[121.85,31.85],
    [121.9,31.45],[121.95,31.05],[121.75,30.85],[121.25,30.7],[120.85,30.5],[120.65,30.35],[121.05,30.3],[121.45,30.1],[121.75,29.95],[121.95,29.6],[121.75,29.2],[121.6,28.85],[121.55,28.5],[121.35,28.2],[120.95,27.95],[120.7,27.55],[120.4,27.2],[120.1,26.95],[119.75,26.7],[119.6,26.35],
    [119.65,26.0],[119.6,25.6],[119.35,25.35],[119.05,25.2],[118.75,24.9],[118.4,24.65],[118.1,24.45],[117.85,24.2],[117.55,23.95],[117.3,23.65],[116.85,23.4],[116.55,23.1],[116.15,22.9],[115.6,22.75],[115.2,22.75],[114.75,22.65],[114.35,22.4],[114.05,22.45],[113.75,22.75],[113.6,22.55],[113.55,22.2],[113.15,22.0],
    [112.75,21.8],[112.25,21.7],[111.8,21.55],[111.3,21.45],[110.75,21.25],[110.45,20.95],[110.5,20.5],[110.3,20.25],[110.0,20.25],[109.85,20.55],[109.75,21.0],[109.7,21.45],[109.35,21.45],[109.05,21.5],[108.6,21.7],[108.3,21.55],[108.0,21.5],
    [107.4,21.25],[106.75,20.8],[106.3,20.35],[105.95,19.85],[105.75,19.2],[105.65,18.6],[106.3,18.0],[106.6,17.5],[107.1,16.9],[107.7,16.4],[108.25,16.05],[108.8,15.4],[109.1,14.5],[109.25,13.6],[109.2,12],[136,12],
  ];
  const ISLANDS = [
    { n:'海南岛', p:[[110.3,20.08],[110.7,20.0],[111.03,19.65],[110.7,19.15],[110.45,18.75],[110.05,18.4],[109.55,18.2],[109.1,18.35],[108.7,18.6],[108.6,19.15],[108.9,19.55],[109.25,19.85],[109.7,20.0]], t:'hills' },
    { n:'台湾岛', p:[[121.55,25.3],[121.85,25.05],[121.9,24.6],[121.65,24.0],[121.45,23.3],[121.2,22.75],[120.85,21.92],[120.65,22.4],[120.3,22.55],[120.1,23.05],[120.15,23.55],[120.35,24.1],[120.65,24.55],[120.95,24.9],[121.15,25.1]], t:'mountain' },
    { n:'', p:[[126.15,33.4],[126.5,33.55],[126.95,33.45],[126.75,33.25],[126.3,33.2]], t:'hills' },
    { n:'', p:[[129.75,33.4],[130.2,33.9],[130.9,33.95],[131.55,33.6],[131.95,32.9],[131.65,32.0],[131.25,31.35],[130.6,31.15],[130.2,31.45],[130.35,32.1],[129.9,32.75],[129.6,33.15]], t:'hills' },
    { n:'', p:[[132.0,33.0],[132.6,32.8],[133.2,33.25],[134.3,33.3],[134.75,33.8],[134.3,34.2],[133.5,34.35],[132.9,34.0],[132.4,33.85]], t:'hills' },
    { n:'', p:[[130.9,34.0],[131.4,34.4],[132.4,34.3],[133.2,34.45],[134.2,34.7],[135.15,34.6],[135.4,34.7],[136,34.4],[136,36.6],[135.3,35.6],[134.4,35.55],[133.3,35.55],[132.6,35.4],[131.7,34.75],[131.0,34.45]], t:'mountain' },
    { n:'崇明', p:[[121.15,31.85],[121.55,31.62],[121.95,31.5],[121.85,31.42],[121.4,31.55],[121.15,31.72]], t:'plain' },
    { n:'', p:[[121.95,30.1],[122.3,30.08],[122.25,29.9],[121.95,29.92]], t:'hills' },
  ];
  // 湖泊（多边形，经纬度）
  const ell = (lon, lat, rx, ry, rot, k) => { const p = []; for (let i = 0; i < 18; i++){ const a = i/18*Math.PI*2; const j = 1 + 0.12*Math.sin(a*3 + k) + 0.06*Math.cos(a*5 + k*2); const x = Math.cos(a)*rx*j, y = Math.sin(a)*ry*j; p.push([lon + x*Math.cos(rot) - y*Math.sin(rot), lat + x*Math.sin(rot) + y*Math.cos(rot)]); } return p; };
  const LAKES = [
    { n:'青海湖', p:ell(100.2,36.88,0.5,0.26,0.15,1) },
    { n:'鄱阳湖', p:[[116.1,29.75],[116.25,29.55],[116.55,29.25],[116.75,28.95],[116.6,28.72],[116.3,28.75],[116.15,28.95],[116.05,29.3]] },
    { n:'洞庭湖', p:[[112.25,29.0],[112.5,29.3],[112.95,29.42],[113.1,29.25],[112.95,28.95],[112.6,28.85]] },
    { n:'太湖', p:ell(120.2,31.2,0.24,0.2,0,2) },
    { n:'洪泽湖', p:ell(118.6,33.3,0.2,0.17,0.4,3) },
    { n:'巢湖', p:ell(117.55,31.58,0.2,0.08,0.1,4) },
    { n:'滇池', p:ell(102.68,24.85,0.06,0.16,0.2,5) },
    { n:'呼伦湖', p:ell(117.4,48.95,0.22,0.32,0.5,6) },
    { n:'博斯腾湖', p:ell(87.0,41.98,0.3,0.12,0.1,7) },
    { n:'纳木错', p:ell(90.6,30.72,0.38,0.14,0.15,8) },
    { n:'色林错', p:ell(89.0,31.8,0.35,0.14,-0.1,9) },
    { n:'兴凯湖', p:ell(132.45,45.0,0.4,0.33,0.3,10) },
    { n:'巴尔喀什湖', p:[[73.6,46.6],[74.5,46.95],[75.6,46.75],[77.0,46.55],[78.4,46.35],[79.2,46.8],[79.35,46.45],[78.2,45.95],[76.6,46.15],[75.2,46.2],[74.3,45.95],[73.7,46.2]] },
    { n:'贝加尔湖', p:[[103.8,51.6],[104.6,51.5],[105.8,51.8],[107.0,52.4],[108.4,53.2],[109.5,53.9],[109.6,54.5],[108.9,54.4],[108.0,53.6],[106.3,52.7],[104.8,52.0],[104.0,51.85]] },
  ];

  // 地形区（越靠前优先级越高）
  const ZONES = [
    ['mountain', [[78.5,33.5],[80,30.6],[83,29.6],[86.5,28.3],[89,27.9],[92,27.4],[95.5,28.2],[97.2,28.6],[96.8,29.6],[92,28.6],[88,28.9],[84,29.9],[81,31.2],[79.6,33.8]]], // 喜马拉雅
    ['mountain', [[75,36.8],[79,36.8],[84,36.4],[90,36.4],[95,35.9],[97,36.4],[94,37],[88,37.2],[82,37.4],[77,38]]], // 昆仑山
    ['mountain', [[73,39],[76,38.2],[77,39.3],[74.5,40]]], // 帕米尔
    ['mountain', [[75.5,41],[80,41.3],[85,42.3],[89,42.6],[94.5,42.9],[94.5,43.9],[89,43.9],[84,43.8],[79,42.8],[75.5,42.1]]], // 天山
    ['mountain', [[85.5,47.8],[88,48.6],[91,47.8],[91.5,46.5],[89,46.8],[86.5,47]]], // 阿尔泰
    ['mountain', [[97.2,28.6],[99.5,27.2],[101.2,26.0],[102.4,27.6],[102.4,30.5],[101.5,32.3],[99.5,32.2],[98.3,30.5]]], // 横断山
    ['mountain', [[104.2,33.2],[107,33.3],[110.5,33.6],[112,33.6],[111.5,34.1],[108,34.0],[105,34.0]]], // 秦岭
    ['mountain', [[109.6,31.0],[111.0,31.0],[111.0,32.2],[109.6,32.2]]], // 大巴山/神农架
    ['mountain', [[112.6,35.2],[113.8,35.6],[114.2,37.2],[114.6,39.0],[115.4,40.2],[114.4,40.4],[113.5,38.5],[112.8,36.6]]], // 太行山
    ['mountain', [[119.5,42.8],[121.2,44.5],[122.2,47],[123.8,50],[125,52.8],[123,52.5],[121,50],[120,47],[119,44.5]]], // 大兴安岭
    ['mountain', [[126.6,41.3],[128.8,41.6],[129.6,43],[128,43.5],[127,42.6]]], // 长白山
    ['mountain', [[104.4,36.2],[106.0,37.2],[106.4,38.0],[105.6,38.8],[104.8,37.2]]], // 六盘/贺兰
    ['mountain', [[98,38.2],[101.5,37.6],[103.6,37.0],[102.5,38.1],[99,39.2]]], // 祁连山
    ['mountain', [[115.5,24.6],[117.5,26],[118.6,27.6],[117.4,28],[116.2,26.5]]], // 武夷山
    ['plateau', [[73,37],[78,35.5],[80.5,31],[85,28.6],[89,27.8],[92.5,27.6],[96,28.2],[98.6,28.8],[100.5,30.5],[102.2,32.2],[102.5,34.2],[101.5,36.6],[98.5,37.6],[94,38],[90,37.8],[86,37.2],[81,37.2],[76,38]]], // 青藏高原
    ['desert', [[77.2,38.4],[80,37.3],[84,37.5],[88,38.2],[89.5,39.5],[88,40.6],[84,41],[80,40.6],[78,39.6]]], // 塔克拉玛干
    ['desert', [[84,44.4],[86.5,44.4],[89.5,44.9],[89,46.2],[86,46.2],[84.4,45.4]]], // 古尔班通古特
    ['desert', [[90.5,37.2],[95,36.7],[97.8,37.0],[96.5,38.1],[92,38.6],[90.5,38.2]]], // 柴达木
    ['desert', [[90,40.5],[95,40],[99,40.3],[102,40.6],[106,41],[109,41.6],[112,42.4],[114,43.5],[112,45],[107,45.5],[102,44.8],[97,43.8],[93,42.5]]], // 戈壁
    ['desert', [[100.2,39.2],[103.5,39.4],[104.6,40.4],[102,41],[100.4,40.4]]], // 巴丹吉林
    ['desert', [[103.2,37.6],[105.2,37.6],[105.6,38.6],[104,39],[103.2,38.4]]], // 腾格里
    ['desert', [[107.4,39.6],[109.8,39.8],[110.8,40.4],[108,40.4]]], // 库布齐
    ['loess', [[104,34.4],[108,34.6],[111.5,34.9],[112.6,35.4],[112.4,37.5],[111.5,39.4],[109.5,39.4],[107,38.4],[105.4,37.0],[104,35.8]]], // 黄土高原
    ['basin', [[103.6,29.0],[105.5,28.6],[107.2,29.4],[107.8,30.8],[106.5,32.0],[104.6,31.8],[103.4,30.6]]], // 四川盆地
    ['plain', [[107,34.1],[110,34.3],[110.4,34.8],[107.3,34.6]]], // 关中平原
    ['plain', [[113.8,32.3],[116,32.0],[117.6,32.4],[119.6,33.6],[120.2,34.8],[118.8,35.6],[118,37.2],[118.6,38.2],[117.6,39.4],[116.8,40.2],[115.4,40.0],[114.6,38.6],[114.2,36.8],[113.8,35],[113.4,33.4]]], // 华北平原
    ['plain', [[121.4,41.0],[123.3,40.8],[124.6,42.2],[125.5,44.2],[126.8,45.4],[127.4,46.8],[125.8,48.2],[124,48.2],[123.6,46.4],[123,44.4],[122.2,42.6]]], // 东北平原
    ['plain', [[130.0,46.0],[132.6,46.4],[134.8,47.8],[133.6,48.4],[131,47.6]]], // 三江平原
    ['plain', [[111.4,29.2],[113.2,28.4],[114.6,29.4],[116.4,28.6],[117.4,29.6],[118.8,30.8],[120.4,30.2],[121.9,31.0],[121.4,32.4],[119.6,33.2],[117.8,32.0],[116.2,31.2],[114.2,31.2],[112.6,31.0],[111.4,30.4]]], // 长江中下游平原
    ['plain', [[112.6,22.4],[114.2,22.4],[114.6,23.2],[113.4,23.9],[112.6,23.3]]], // 珠江三角洲
    ['plain', [[105.8,38.0],[106.8,38.2],[107.6,40.8],[109.8,40.8],[111.2,40.6],[110.6,41.2],[107,41.1],[106.2,39.4]]], // 河套平原
    ['karst', [[103.5,23.2],[106,23.4],[108.6,23.6],[110.6,24.4],[110.5,26.2],[109.4,27.6],[107.5,28.2],[105.6,28.0],[104,27],[102.6,26.0],[101.2,25.0],[101.4,23.6]]], // 云贵高原
    ['steppe', [[107.6,41.2],[112,42.4],[116,43],[119,44.5],[120,47],[118,48.8],[114,47],[110,45.6],[106,45.6]]], // 内蒙古草原
  ];

  // 新增地形区（优先级高于下方旧区）
  const ZONES_EXTRA = [
    ['mountain', [[110.0,25.9],[111.5,25.2],[113.5,24.9],[115.5,24.6],[116.0,25.2],[114.0,25.6],[112.0,26.0],[110.3,26.4]]], // 南岭
    ['mountain', [[108.6,27.2],[109.8,26.6],[110.9,27.4],[111.2,28.8],[110.6,29.9],[109.4,30.0],[108.8,29.0]]], // 武陵山/雪峰山
    ['mountain', [[114.4,31.0],[115.6,30.8],[116.8,31.0],[116.6,31.5],[115.2,31.7],[114.3,31.5]]], // 大别山
    ['mountain', [[115.6,40.2],[117.5,40.3],[119.2,40.6],[119.6,41.4],[117.5,41.5],[115.8,41.0]]], // 燕山
    ['mountain', [[106.4,40.9],[109.0,40.9],[111.5,41.0],[113.2,41.2],[113.0,41.7],[110.0,41.6],[107.0,41.5]]], // 阴山
    ['mountain', [[110.7,36.4],[111.6,36.6],[112.0,38.4],[111.6,39.2],[111.1,38.6],[110.8,37.4]]], // 吕梁山
    ['mountain', [[108.8,30.6],[110.6,30.8],[110.8,31.6],[109.2,31.6]]], // 巫山
    ['mountain', [[105.6,27.6],[107.0,27.8],[107.8,28.6],[106.6,28.8],[105.6,28.3]]], // 大娄山
    ['mountain', [[100.0,24.0],[100.8,22.8],[101.6,23.4],[101.4,25.2],[100.4,25.8],[99.6,25.2]]], // 无量山/哀牢山
    ['mountain', [[92.0,27.3],[97.6,27.6],[98.6,25.0],[97.6,24.2],[95.0,24.6],[93.0,25.4]]], // 那加/高黎贡一带
    ['forest',   [[125.8,47.6],[128.4,46.9],[130.6,47.4],[130.0,49.4],[127.6,50.4],[125.8,49.2]]], // 小兴安岭
    ['forest',   [[126.4,41.4],[129.0,41.6],[131.2,42.6],[131.4,45.2],[129.6,45.8],[127.6,45.4],[126.6,43.8]]], // 长白山林区
    ['forest',   [[117.4,25.8],[119.4,26.6],[120.4,27.6],[120.5,29.2],[119.4,29.7],[118.0,29.4],[117.0,27.8]]], // 闽浙山林
    ['forest',   [[99.0,21.0],[102.2,21.2],[102.0,23.0],[100.6,23.4],[99.0,22.6]]], // 西双版纳
    ['hills',    [[117.3,35.2],[118.8,35.0],[120.2,35.9],[122.6,37.2],[121.6,37.7],[120.0,37.6],[118.6,36.9],[117.2,36.3]]], // 山东丘陵
    ['hills',    [[121.2,38.75],[123.2,39.6],[124.5,40.0],[124.6,41.3],[123.4,41.4],[122.4,40.4],[121.6,39.6]]], // 辽东丘陵
    ['plain',    [[72,24],[86,24.4],[88.5,25.6],[89,26.4],[85,27.2],[81,28.6],[77,30.2],[74,31.4],[72,31.6]]], // 恒河平原
    ['plain',    [[89.4,26.0],[92.0,25.8],[95.4,27.2],[95.0,27.8],[92,27.0],[89.6,26.6]]], // 布拉马普特拉河谷
    ['plain',    [[104.8,10],[107,10],[106.8,11.5],[105.5,11.8],[104.6,11]]],
    ['plain',    [[105.4,20.4],[106.6,20.4],[106.9,21.1],[106.0,21.4],[105.3,21.1]]], // 红河三角洲
  ];

  // ---------- 河流（经纬度，w=河口宽度，世界单位） ----------
  const RIVERS = [
    { n:'长江', w:0.075, p:[[90.9,33.4],[92.5,34.0],[94.5,34.0],[96.0,33.3],[97.2,32.9],[98.4,31.6],[99.0,30.0],[99.4,28.5],[99.95,26.95],[100.35,27.75],[100.8,27.0],[101.5,26.55],[102.3,26.2],[103.0,26.9],[103.6,27.8],[104.2,28.55],[104.62,28.77],[105.4,28.9],[106.2,29.35],[106.58,29.57],[107.4,29.85],[108.4,30.8],[109.5,31.02],[110.4,31.0],[111.3,30.7],[112.2,30.3],[112.9,29.6],[113.5,29.82],[114.3,30.6],[115.0,30.22],[116.0,29.75],[117.0,30.5],[117.8,31.0],[118.4,31.4],[118.8,32.1],[119.4,32.25],[120.3,31.95],[121.0,31.8],[121.9,31.4]] },
    { n:'黄河', w:0.06, p:[[95.6,34.9],[97.5,34.8],[98.4,34.85],[99.6,34.2],[101.6,33.5],[102.3,33.85],[101.4,34.7],[100.6,35.5],[101.5,36.0],[102.5,35.9],[103.4,35.95],[103.82,36.07],[104.5,36.6],[105.0,37.3],[105.25,37.55],[106.0,37.95],[106.3,38.5],[106.8,39.4],[107.0,40.3],[107.6,40.8],[108.8,40.7],[109.9,40.5],[111.0,40.3],[111.4,39.6],[111.25,38.8],[110.7,37.8],[110.5,36.8],[110.4,35.6],[110.3,34.65],[111.2,34.75],[112.4,34.85],[113.6,34.95],[114.5,35.0],[115.3,35.4],[116.0,35.9],[116.8,36.6],[117.6,37.2],[118.5,37.6],[119.2,37.75]] },
    { n:'珠江', w:0.05, p:[[104.2,25.5],[105.5,24.9],[106.6,24.8],[107.6,24.6],[108.6,23.8],[109.4,23.4],[110.1,23.4],[111.3,23.48],[112.5,23.1],[113.1,22.85],[113.6,22.35]] },
    { n:'淮河', w:0.035, p:[[113.3,32.5],[114.1,32.25],[115.2,32.42],[116.4,32.6],[117.1,32.95],[117.8,33.1],[118.5,33.25]] },
    { n:'汉江', w:0.035, p:[[106.9,33.1],[108.2,32.9],[109.0,32.7],[110.0,32.6],[110.8,32.7],[111.5,32.5],[112.1,32.05],[112.5,31.2],[113.0,30.75],[113.7,30.55],[114.27,30.58]] },
    { n:'嘉陵江', w:0.03, p:[[106.2,34.0],[105.84,32.5],[105.9,31.6],[106.1,30.8],[106.3,30.1],[106.55,29.58]] },
    { n:'岷江', w:0.03, p:[[103.6,32.8],[103.6,31.4],[103.65,31.0],[103.85,30.3],[103.76,29.55],[104.3,29.0],[104.6,28.78]] },
    { n:'湘江', w:0.03, p:[[111.2,25.6],[111.7,26.3],[112.6,26.9],[113.0,27.9],[112.9,28.7],[113.0,29.2]] },
    { n:'赣江', w:0.03, p:[[115.0,25.85],[115.0,27.1],[115.5,28.0],[115.9,28.7],[116.15,29.1]] },
    { n:'闽江', w:0.025, p:[[117.6,27.2],[118.18,26.64],[118.9,26.2],[119.6,26.0]] },
    { n:'钱塘江', w:0.025, p:[[118.3,29.2],[119.3,29.45],[120.0,30.05],[120.6,30.35]] },
    { n:'辽河', w:0.03, p:[[119.5,43.0],[121.5,43.6],[123.0,43.4],[123.5,42.7],[122.7,41.8],[122.15,41.0],[122.05,40.8]] },
    { n:'海河', w:0.025, p:[[114.6,38.2],[115.8,38.6],[116.7,38.95],[117.2,39.1],[117.7,38.98]] },
    { n:'松花江', w:0.045, p:[[127.8,42.2],[126.55,43.84],[126.0,44.8],[124.8,45.45],[125.8,45.6],[126.6,45.8],[128.0,46.0],[129.5,46.5],[130.3,46.8],[132.0,47.3],[132.6,47.7]] },
    { n:'嫩江', w:0.03, p:[[125.6,51.0],[125.0,49.0],[124.0,47.5],[124.3,46.5],[124.8,45.45]] },
    { n:'黑龙江', w:0.055, p:[[121.5,53.3],[123.5,53.5],[125.5,52.9],[126.5,51.6],[127.5,50.2],[129.0,49.4],[130.6,48.7],[131.8,47.9],[133.5,48.2],[135.0,48.45],[136,48.6]] },
    { n:'乌苏里江', w:0.03, p:[[132.9,45.2],[133.5,46.0],[134.2,47.0],[134.7,47.7],[135.0,48.45]] },
    { n:'雅鲁藏布江', w:0.04, p:[[82.5,30.3],[85.0,29.4],[87.0,29.2],[88.9,29.3],[90.5,29.3],[91.5,29.3],[93.0,29.05],[94.3,29.5],[95.0,29.65],[95.3,29.0],[95.2,27.9],[94.0,27.3],[92.0,26.4],[90.0,25.9]] },
    { n:'澜沧江', w:0.035, p:[[95.4,32.8],[97.2,31.1],[98.5,29.0],[99.0,27.5],[99.3,26.0],[99.9,25.0],[100.5,23.0],[100.8,22.0],[101.2,21.0],[102.0,19.5]] },
    { n:'怒江', w:0.03, p:[[93.5,31.6],[95.0,31.0],[96.6,30.4],[98.5,28.0],[98.8,26.5],[98.9,25.0],[98.6,24.0],[98.0,22.6],[97.8,21.0]] },
    { n:'塔里木河', w:0.03, p:[[80.3,41.2],[81.5,40.8],[83.5,41.0],[85.5,41.05],[87.0,40.6],[88.0,39.7]] },
    { n:'红河', w:0.03, p:[[100.6,25.2],[102.0,23.8],[103.6,22.6],[104.8,21.6],[105.8,21.0],[106.6,20.4]] },
    { n:'恒河', w:0.05, p:[[78.2,30.1],[79.8,27.5],[82.0,25.6],[84.5,25.6],[86.5,25.3],[88.0,24.4],[89.6,23.6],[90.4,22.6]] },
  ];

  // ---------- 地形类型 ----------
  const T = {
    sea:      { name:'海洋',     cost:0,   fill:'#b5cbcd', h:-0.3, a:0 },
    lake:     { name:'湖泊',     cost:0,   fill:'#aac3c7', h:-0.1, a:0 },
    plain:    { name:'平原',     cost:1.0, fill:'#e7ddb5', h:0.05, a:0.02 },
    basin:    { name:'盆地',     cost:1.1, fill:'#e3d6a6', h:0.15, a:0.03 },
    steppe:   { name:'草原',     cost:1.1, fill:'#d9d7a3', h:0.3, a:0.05 },
    hills:    { name:'丘陵',     cost:1.4, fill:'#d6cb9a', h:0.35, a:0.12 },
    loess:    { name:'黄土高原', cost:1.6, fill:'#dfc58f', h:0.45, a:0.12 },
    karst:    { name:'高原山地', cost:2.1, fill:'#cbc196', h:0.55, a:0.18 },
    forest:   { name:'森林',     cost:1.5, fill:'#bcc792', h:0.35, a:0.1 },
    desert:   { name:'沙漠戈壁', cost:1.3, fill:'#eedca8', h:0.25, a:0.06 },
    mountain: { name:'山地',     cost:2.6, fill:'#cdbb95', h:0.85, a:0.32 },
    plateau:  { name:'高原',     cost:3.4, fill:'#d9cfb9', h:0.95, a:0.15 },
  };

  // ---------- 几何与分类 ----------
  function bbox(p){ let a=1e9,b=-1e9,c=1e9,d=-1e9; p.forEach(([x,y]) => { a=Math.min(a,x); b=Math.max(b,x); c=Math.min(c,y); d=Math.max(d,y); }); return [a,b,c,d]; }
  function inPoly(lon, lat, poly){ let c = false; for (let i = 0, j = poly.length-1; i < poly.length; j = i++){ const [xi,yi] = poly[i], [xj,yj] = poly[j]; if (((yi > lat) !== (yj > lat)) && (lon < (xj-xi)*(lat-yi)/(yj-yi)+xi)) c = !c; } return c; }
  // 海岸多边形按纬度分桶，加速点在多边形内判断
  const OB = (() => { const bk = {}; for (let i = 0, j = OCEAN.length-1; i < OCEAN.length; j = i++){ const a = OCEAN[i], b = OCEAN[j];
    const lo = Math.floor(Math.min(a[1], b[1]) * 2), hi = Math.floor(Math.max(a[1], b[1]) * 2); for (let q = lo; q <= hi; q++) (bk[q] = bk[q] || []).push([a[0],a[1],b[0],b[1]]); } return bk; })();
  function inOcean(lon, lat){ const es = OB[Math.floor(lat*2)]; if (!es) return false; let c = false;
    for (const [xi,yi,xj,yj] of es) if (((yi > lat) !== (yj > lat)) && (lon < (xj-xi)*(lat-yi)/(yj-yi)+xi)) c = !c; return c; }
  const ZL = ZONES_EXTRA.concat(ZONES).map(([t,p]) => ({ t, p, b:bbox(p) }));
  const IL = ISLANDS.map(o => Object.assign({ b:bbox(o.p) }, o));
  const LL = LAKES.map(o => Object.assign({ b:bbox(o.p) }, o));
  const inB = (lon, lat, b) => lon >= b[0] && lon <= b[1] && lat >= b[2] && lat <= b[3];
  function classifyLand(lon, lat){
    for (const z of ZL) if (inB(lon,lat,z.b) && inPoly(lon, lat, z.p)) return z.t;
    if (lat >= 47) return 'forest';
    if (lon >= 124 && lat >= 40) return 'forest';
    if (lon < 85 && lat >= 44.5) return 'steppe';
    if (lat >= 41 && lon < 120) return 'steppe';
    if (lon < 90 && lat > 38) return 'desert';
    if (lat < 27 && lon > 92 && lon < 101) return 'forest';
    if (lat < 22.5 && lon < 108) return 'forest';
    return 'hills';
  }
  function classify(lon, lat, noLake){
    for (const o of IL) if (inB(lon,lat,o.b) && inPoly(lon, lat, o.p)) return o.t;
    if (inOcean(lon, lat)) return 'sea';
    if (!noLake) for (const o of LL) if (inB(lon,lat,o.b) && inPoly(lon, lat, o.p)) return 'lake';
    return classifyLand(lon, lat);
  }

  // ---------- 噪声 ----------
  function hash(x, y){ let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
    const a = hash(xi,yi), b = hash(xi+1,yi), c = hash(xi,yi+1), d = hash(xi+1,yi+1); return a + (b-a)*u + (c-a)*v + (a-b-c+d)*u*v; }
  function fbm(x, y){ let s = 0, a = 0.5, f = 1; for (let o = 0; o < 5; o++){ s += a * (vnoise(x*f, y*f) - 0.5); f *= 2.03; a *= 0.5; } return s * 2; }
  function rnd(i){ const x = Math.sin(i*12.9898)*43758.5453; return x - Math.floor(x); }
  const hex2rgb = h => { const n = parseInt(h.slice(1),16); return [(n>>16)&255, (n>>8)&255, n&255]; };
  function boxBlur(src, nx, ny, r, passes){
    let a = Float32Array.from(src), b = new Float32Array(src.length);
    for (let p = 0; p < passes; p++){
      for (let y = 0; y < ny; y++){ let s = 0; const o = y*nx; for (let x = -r; x <= r; x++) s += a[o + Math.min(nx-1, Math.max(0, x))];
        for (let x = 0; x < nx; x++){ b[o+x] = s / (2*r+1); s += a[o + Math.min(nx-1, x+r+1)] - a[o + Math.max(0, x-r)]; } }
      for (let x = 0; x < nx; x++){ let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(ny-1, Math.max(0, y))*nx + x];
        for (let y = 0; y < ny; y++){ a[y*nx+x] = s / (2*r+1); s += b[Math.min(ny-1, y+r+1)*nx + x] - b[Math.max(0, y-r)*nx + x]; } }
    }
    return a;
  }
  // Catmull-Rom 平滑 + 轻微蜿蜒
  function smoothPath(pts, seg, wig, seed){
    const out = []; const P = pts;
    for (let i = 0; i < P.length - 1; i++){
      const p0 = P[Math.max(0,i-1)], p1 = P[i], p2 = P[i+1], p3 = P[Math.min(P.length-1,i+2)];
      for (let k = 0; k < seg; k++){ const t = k/seg, t2 = t*t, t3 = t2*t;
        let x = 0.5*((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3);
        let y = 0.5*((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3);
        if (wig){ x += fbm(x*3 + seed, y*3) * wig; y += fbm(x*3, y*3 + seed) * wig; }
        out.push([x,y]); }
    }
    out.push(P[P.length-1]); return out;
  }

  // ---------- 生成离屏地形图（K = 每世界单位像素） ----------
  let elevGrid = null;
  function build(K){
    const x0 = wx(B.lon0), x1 = wx(B.lon1), y0 = wy(B.lat1), y1 = wy(B.lat0);
    const W = Math.ceil((x1-x0)*K), H = Math.ceil((y1-y0)*K);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const px = x => (x - x0) * K, py = y => (y - y0) * K;
    const toLL = (X, Y) => [X / COS + 104, -Y + 35];

    // 1) 连续地形栅格
    const rs = 0.1, nx = Math.ceil((x1-x0)/rs) + 1, ny = Math.ceil((y1-y0)/rs) + 1, N = nx*ny;
    const land = new Float32Array(N), h0 = new Float32Array(N), am = new Float32Array(N), cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N);
    const tcol = {}; const PAPER = [233,224,198]; Object.keys(T).forEach(k => { const c0 = hex2rgb(T[k].fill); tcol[k] = c0.map((v,i) => v*0.78 + PAPER[i]*0.22); });
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){
      const k = j*nx + i; const [lon, lat] = toLL(x0 + i*rs, y0 + j*rs); const t = classify(lon, lat, true); const L = t !== 'sea' ? 1 : 0;
      land[k] = L; h0[k] = T[t].h; am[k] = T[t].a; const col = tcol[t]; cr[k] = col[0]*L; cg[k] = col[1]*L; cb[k] = col[2]*L;
    }
    const hb = boxBlur(h0, nx, ny, 5, 2), ab = boxBlur(am, nx, ny, 2, 2);
    const lm = boxBlur(land, nx, ny, 2, 2), br = boxBlur(cr, nx, ny, 2, 2), bg = boxBlur(cg, nx, ny, 2, 2), bb = boxBlur(cb, nx, ny, 2, 2);
    const near = boxBlur(land, nx, ny, 5, 3);
    const elev = new Float32Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){ const k = j*nx+i; const X = (x0 + i*rs), Y = (y0 + j*rs);
      const ridge = 1 - Math.abs(fbm(X*1.1 + 40, Y*1.1 - 17)) * 2; // 山脊感
      elev[k] = hb[k] + ab[k] * (fbm(X*1.7, Y*1.7) + 0.6*ridge*ab[k]); }
    elevGrid = { elev, nx, ny, rs, x0, y0 };
    const landImg = new ImageData(nx, ny), seaImg = new ImageData(nx, ny);
    const deep = hex2rgb('#9ab8c0'), shallow = hex2rgb('#c6d8d4');
    const Lx = -0.62, Ly = -0.62, Lz = 0.48;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){
      const k = j*nx+i, o = k*4;
      // 陆地：归一化卷积得到柔和过渡色
      const m = Math.max(1e-3, lm[k]); let r = br[k]/m, g = bg[k]/m, b = bb[k]/m;
      if (lm[k] < 1e-3){ r = 231; g = 221; b = 181; }
      const e = elev[k];
      const dx = (elev[k + (i < nx-1 ? 1 : 0)] - elev[k - (i > 0 ? 1 : 0)]) / (2*rs), dy = (elev[k + (j < ny-1 ? nx : 0)] - elev[k - (j > 0 ? nx : 0)]) / (2*rs);
      const z = 0.55; const nl = Math.hypot(dx*z, dy*z, 1); const dot = (-dx*z*Lx - dy*z*Ly + Lz) / nl;
      let sh = (dot - Lz) * 0.62; sh = Math.max(-0.26, Math.min(0.18, sh));
      const hi = Math.max(0, e - 0.92) * 0.35; // 高处偏白
      r = r*(1+sh) + (255 - r)*hi; g = g*(1+sh) + (255 - g)*hi; b = b*(1+sh) + (252 - b)*hi;
      landImg.data[o] = r; landImg.data[o+1] = g; landImg.data[o+2] = b; landImg.data[o+3] = 255;
      // 海：近岸浅、远海深
      const f = Math.min(1, near[k] * 2.6); const sn = fbm(i*0.05, j*0.05) * 6;
      seaImg.data[o] = deep[0] + (shallow[0]-deep[0])*f + sn; seaImg.data[o+1] = deep[1] + (shallow[1]-deep[1])*f + sn; seaImg.data[o+2] = deep[2] + (shallow[2]-deep[2])*f + sn; seaImg.data[o+3] = 255;
    }
    const rc = document.createElement('canvas'); rc.width = nx; rc.height = ny; const rcx = rc.getContext('2d');
    const drawRaster = img => { rcx.putImageData(img, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(rc, 0, 0, nx, ny, 0, 0, nx*rs*K, ny*rs*K); };
    drawRaster(seaImg);

    // 2) 海岸水纹（由外向内画同心描边，再擦去内部只留线条）
    const coastPath = (ctx2) => { ctx2.beginPath(); OCEAN.forEach(([lo,la],i) => { const X = px(wx(lo)), Y = py(wy(la)); i ? ctx2.lineTo(X,Y) : ctx2.moveTo(X,Y); });
      ISLANDS.forEach(o => { o.p.forEach(([lo,la],i) => { const X = px(wx(lo)), Y = py(wy(la)); i ? ctx2.lineTo(X,Y) : ctx2.moveTo(X,Y); }); ctx2.closePath(); }); };
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const t2 = tmp.getContext('2d'); t2.lineJoin = 'round'; t2.lineCap = 'round';
    [[0.62,0.10],[0.46,0.16],[0.31,0.24],[0.18,0.34]].forEach(([wd, al]) => {
      coastPath(t2); t2.globalCompositeOperation = 'source-over'; t2.strokeStyle = `rgba(52,88,100,${al})`; t2.lineWidth = wd*K; t2.stroke();
      coastPath(t2); t2.globalCompositeOperation = 'destination-out'; t2.strokeStyle = '#000'; t2.lineWidth = wd*K - Math.max(1, K*0.016); t2.stroke(); });
    t2.globalCompositeOperation = 'source-over';
    c.drawImage(tmp, 0, 0);

    // 3) 陆地（按海岸线裁切，岸线清晰）
    c.save(); c.beginPath(); c.rect(0,0,W,H); OCEAN.forEach(([lo,la],i) => { const X = px(wx(lo)), Y = py(wy(la)); i ? c.lineTo(X,Y) : c.moveTo(X,Y); }); c.closePath();
    ISLANDS.forEach(o => { o.p.forEach(([lo,la],i) => { const X = px(wx(lo)), Y = py(wy(la)); i ? c.lineTo(X,Y) : c.moveTo(X,Y); }); c.closePath(); });
    c.clip('evenodd'); drawRaster(landImg); c.restore();
    // 岸线描边（墨线 + 内侧淡影）
    c.save(); c.lineJoin = 'round'; coastPath(c); c.strokeStyle = 'rgba(48,70,78,.75)'; c.lineWidth = Math.max(1, K*0.022); c.stroke();
    coastPath(c); c.strokeStyle = 'rgba(48,70,78,.12)'; c.lineWidth = K*0.09; c.stroke(); c.restore();

    // 4) 湖泊
    LAKES.forEach(o => { c.beginPath(); smoothPath(o.p.concat([o.p[0]]), 4, 0, 0).forEach(([lo,la],i) => { const X = px(wx(lo)), Y = py(wy(la)); i ? c.lineTo(X,Y) : c.moveTo(X,Y); }); c.closePath();
      c.fillStyle = '#aec7ca'; c.fill(); c.strokeStyle = 'rgba(48,70,78,.7)'; c.lineWidth = Math.max(0.8, K*0.016); c.stroke(); c.strokeStyle = 'rgba(48,70,78,.15)'; c.lineWidth = K*0.06; c.stroke(); });

    // 5) 河流（平滑、蜿蜒、上游细下游粗）
    c.lineCap = 'round'; c.lineJoin = 'round';
    RIVERS.forEach((rv, ri) => {
      const pts = smoothPath(rv.p.map(([lo,la]) => [wx(lo), wy(la)]), 8, 0.05, ri*13.7);
      const n = pts.length;
      for (let pass = 0; pass < 2; pass++){
        for (let i = 0; i < n-1; i++){ const f = i/(n-1); const w = rv.w * (0.22 + 0.78*Math.pow(f, 0.8)) * K;
          c.beginPath(); c.moveTo(px(pts[i][0]), py(pts[i][1])); c.lineTo(px(pts[i+1][0]), py(pts[i+1][1]));
          if (pass === 0){ c.strokeStyle = 'rgba(48,82,96,.55)'; c.lineWidth = w + Math.max(1, K*0.014); } else { c.strokeStyle = '#8fb3bb'; c.lineWidth = Math.max(0.6, w*0.85); }
          c.stroke(); }
      }
    });

    // 6) 六边形格网
    const hw = Math.sqrt(3) * R, vh = 1.5 * R;
    const cells = []; let k = 0;
    for (let row = 0, y = y0; y < y1 + R; row++, y += vh){
      for (let x = x0 + (row % 2 ? hw/2 : 0); x < x1 + hw; x += hw){
        const [lon, lat] = toLL(x, y);
        const t = classify(lon, lat); cells.push({ x, y, t, k:k++, e: elevAt(x, y) });
      }
    }
    const hexP = (ctx2, cx, cy, r) => { for (let i = 0; i < 6; i++){ const a = Math.PI/180 * (60*i - 30); const X = cx + r*Math.cos(a), Y = cy + r*Math.sin(a); i ? ctx2.lineTo(X,Y) : ctx2.moveTo(X,Y); } ctx2.closePath(); };
    // 每格轻微色差，便于辨认格子
    cells.forEach(h => { if (h.t === 'sea') return; c.beginPath(); hexP(c, px(h.x), py(h.y), R*K); const v = rnd(h.k*3.1) - 0.5; c.fillStyle = v > 0 ? `rgba(255,250,235,${v*0.10})` : `rgba(80,60,30,${-v*0.08})`; c.fill(); });
    c.beginPath(); cells.forEach(h => { if (h.t !== 'sea') hexP(c, px(h.x), py(h.y), R*K); }); c.strokeStyle = 'rgba(92,72,42,.20)'; c.lineWidth = Math.max(0.6, K*0.009); c.stroke();
    c.beginPath(); cells.forEach(h => { if (h.t !== 'sea') hexP(c, px(h.x), py(h.y)+K*0.012, R*K*0.94); }); c.strokeStyle = 'rgba(255,250,235,.16)'; c.lineWidth = Math.max(0.5, K*0.007); c.stroke();
    c.beginPath(); cells.forEach(h => { if (h.t === 'sea') hexP(c, px(h.x), py(h.y), R*K); }); c.strokeStyle = 'rgba(52,88,100,.10)'; c.lineWidth = Math.max(0.5, K*0.008); c.stroke();

    // 7) 手绘图标（自上而下绘制，前排遮挡后排）
    cells.slice().sort((a,b) => a.y - b.y).forEach(h => icon(c, h, px(h.x), py(h.y), R*K));

    // 8) 纸张质感：低频污渍 + 细颗粒 + 暗角
    const nt = document.createElement('canvas'); nt.width = nt.height = 256; const ntx = nt.getContext('2d'); const nd = ntx.createImageData(256, 256);
    for (let i = 0; i < nd.data.length; i += 4){ const v = 228 + Math.random()*27; nd.data[i] = v; nd.data[i+1] = v; nd.data[i+2] = v - 3; nd.data[i+3] = 255; }
    ntx.putImageData(nd, 0, 0);
    c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.55; c.fillStyle = c.createPattern(nt, 'repeat'); c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    const sc = document.createElement('canvas'); sc.width = 160; sc.height = Math.round(160*H/W); const sx2 = sc.getContext('2d'); const si = sx2.createImageData(sc.width, sc.height);
    for (let j = 0; j < sc.height; j++) for (let i = 0; i < sc.width; i++){ const o = (j*sc.width+i)*4; const v = fbm(i*0.06+11, j*0.06+3); const t = 245 + v*28; si.data[o] = t; si.data[o+1] = t - 4; si.data[o+2] = t - 14; si.data[o+3] = 255; }
    sx2.putImageData(si, 0, 0); c.imageSmoothingEnabled = true; c.drawImage(sc, 0, 0, W, H); c.restore();
    const g = c.createRadialGradient(W/2,H/2,Math.min(W,H)*0.38,W/2,H/2,Math.max(W,H)*0.78); g.addColorStop(0,'rgba(110,80,40,0)'); g.addColorStop(1,'rgba(110,80,40,.30)'); c.fillStyle = g; c.fillRect(0,0,W,H);
    return { canvas:cv, x0, y0, K, cells };
  }
  function elevAt(X, Y){ const G = elevGrid; if (!G) return 0; const i = Math.max(0, Math.min(G.nx-1, Math.round((X - G.x0)/G.rs))), j = Math.max(0, Math.min(G.ny-1, Math.round((Y - G.y0)/G.rs))); return G.elev[j*G.nx + i]; }

  // ---------- 图标 ----------
  const INK = 'rgba(62,46,28,', INKB = 'rgba(48,70,78,';
  function peak(c, x, by, w, hgt, k, opt){
    const lx = x - w, rx = x + w, tx = x + (rnd(k)-0.5)*w*0.25, ty = by - hgt;
    // 明面
    c.beginPath(); c.moveTo(lx, by); c.lineTo(tx, ty); c.lineTo(rx, by); c.closePath(); c.fillStyle = opt.light; c.fill();
    // 暗面（右侧）+ 排线
    c.beginPath(); c.moveTo(tx, ty); c.lineTo(rx, by); c.lineTo(tx + w*0.12, by); c.closePath(); c.fillStyle = opt.dark; c.fill();
    c.save(); c.clip(); c.strokeStyle = INK + '.35)'; c.lineWidth = Math.max(0.4, w*0.05);
    for (let i = 1; i < 6; i++){ const yy = ty + (by-ty)*i/6; c.beginPath(); c.moveTo(tx, yy); c.lineTo(rx, yy + w*0.3); c.stroke(); }
    c.restore();
    if (opt.snow){ const sy = ty + hgt*0.36; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx - w*0.36, sy); c.lineTo(tx - w*0.12, sy - hgt*0.06); c.lineTo(tx + w*0.05, sy + hgt*0.02); c.lineTo(tx + w*0.34, sy - hgt*0.03); c.closePath(); c.fillStyle = '#fbf8f0'; c.fill(); }
    c.strokeStyle = INK + '.78)'; c.lineWidth = Math.max(0.5, w*0.07); c.beginPath(); c.moveTo(lx, by); c.lineTo(tx, ty); c.lineTo(rx, by); c.stroke();
    c.strokeStyle = INK + '.35)'; c.lineWidth = Math.max(0.4, w*0.045); c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + w*0.12, by); c.stroke();
  }
  function tree(c, x, y, s, k, kind){
    if (kind === 'conifer'){
      c.fillStyle = '#7f8f5c'; c.strokeStyle = INK + '.7)'; c.lineWidth = Math.max(0.4, s*0.06);
      c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s*0.38, y - s*0.1); c.lineTo(x - s*0.38, y - s*0.1); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x, y - s*0.1); c.lineTo(x, y + s*0.15); c.stroke();
    } else {
      c.fillStyle = '#8f9a63'; c.strokeStyle = INK + '.65)'; c.lineWidth = Math.max(0.4, s*0.06);
      c.beginPath(); c.arc(x, y - s*0.5, s*0.34, 0, Math.PI*2); c.fill(); c.stroke();
      c.beginPath(); c.arc(x + s*0.1, y - s*0.56, s*0.14, Math.PI*1.1, Math.PI*1.8); c.strokeStyle = 'rgba(255,250,230,.45)'; c.stroke();
      c.strokeStyle = INK + '.65)'; c.beginPath(); c.moveTo(x, y - s*0.16); c.lineTo(x, y + s*0.12); c.stroke();
    }
  }
  function icon(c, h, x, y, s){
    const t = h.t, k = h.k, r = rnd(k), r2 = rnd(k+7), r3 = rnd(k+13);
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    if (t === 'mountain'){
      if (r > 0.82) { c.restore(); return; } const big = h.e > 0.95; const n = r > 0.62 ? 2 : 1;
      for (let i = 0; i < n; i++){ const w = s*(0.5 + r2*0.2) * (i ? 0.75 : 1), hg = s*(0.85 + r3*0.45) * (big ? 1.15 : 1) * (i ? 0.75 : 1);
        peak(c, x + (i ? s*0.55 : -s*0.12) + (r2-0.5)*s*0.3, y + s*0.45 + (i ? s*0.15 : 0), w, hg, k+i, { light:'#d6c59f', dark:'#ab9672', snow: big || h.e > 0.8 && r > 0.5 }); }
    } else if (t === 'plateau'){
      if (r < 0.42){ const w = s*(0.55 + r2*0.2), hg = s*(0.6 + r3*0.3); peak(c, x + (r2-0.5)*s*0.4, y + s*0.35, w, hg, k, { light:'#e6dfd0', dark:'#bfb39c', snow:true }); }
      else if (r < 0.7){ c.strokeStyle = INK + '.35)'; c.lineWidth = Math.max(0.5, s*0.05); c.beginPath(); c.moveTo(x - s*0.45, y + s*0.1); c.quadraticCurveTo(x - s*0.1, y - s*0.25, x + s*0.3, y + s*0.05); c.stroke(); }
    } else if (t === 'karst'){
      if (r < 0.7){ for (let i = 0; i < 3; i++){ const bx = x + (i-1)*s*0.34 + (rnd(k+i)-0.5)*s*0.15, hg = s*(0.5 + rnd(k+i*3)*0.35), w = s*0.16;
        c.beginPath(); c.moveTo(bx - w, y + s*0.3); c.bezierCurveTo(bx - w, y + s*0.3 - hg*0.8, bx - w*0.5, y + s*0.3 - hg, bx, y + s*0.3 - hg); c.bezierCurveTo(bx + w*0.5, y + s*0.3 - hg, bx + w, y + s*0.3 - hg*0.8, bx + w, y + s*0.3);
        c.fillStyle = i === 1 ? '#bfb28a' : '#cbbf99'; c.fill(); c.strokeStyle = INK + '.6)'; c.lineWidth = Math.max(0.4, s*0.05); c.stroke(); } }
    } else if (t === 'hills'){
      if (r < 0.6){ for (let i = 0; i < 2; i++){ const bx = x + (i ? s*0.3 : -s*0.22) + (r2-0.5)*s*0.2, by = y + (i ? s*0.22 : 0), w = s*(i ? 0.32 : 0.42), hg = s*(i ? 0.26 : 0.36);
        c.beginPath(); c.moveTo(bx - w, by); c.quadraticCurveTo(bx - w*0.2, by - hg*1.6, bx + w, by); c.closePath(); c.fillStyle = 'rgba(200,184,140,.9)'; c.fill();
        c.strokeStyle = INK + '.55)'; c.lineWidth = Math.max(0.4, s*0.05); c.beginPath(); c.moveTo(bx - w, by); c.quadraticCurveTo(bx - w*0.2, by - hg*1.6, bx + w, by); c.stroke();
        c.strokeStyle = INK + '.22)'; c.beginPath(); c.moveTo(bx + w*0.1, by - hg*0.55); c.lineTo(bx + w*0.55, by - hg*0.1); c.stroke(); } }
    } else if (t === 'forest'){
      if (r > 0.78) { c.restore(); return; } const conifer = h.y < wy(42) || h.e > 0.6; const n = 3;
      for (let i = 0; i < n; i++){ const a = (i / n) * Math.PI*2 + r*3; const d = s*(i ? 0.38 : 0.05); tree(c, x + Math.cos(a)*d, y + Math.sin(a)*d*0.6 + s*0.25, s*0.5*(0.85 + rnd(k+i)*0.3), k+i, conifer ? 'conifer' : 'broad'); }
    } else if (t === 'desert'){
      if (r < 0.55){ c.strokeStyle = 'rgba(150,112,60,.6)'; c.lineWidth = Math.max(0.5, s*0.055);
        for (let i = 0; i < 2; i++){ const py2 = y + (i-0.4)*s*0.38, px2 = x + (r2-0.5)*s*0.3 + i*s*0.15; c.beginPath(); c.moveTo(px2 - s*0.45, py2); c.quadraticCurveTo(px2 - s*0.1, py2 - s*0.25, px2 + s*0.12, py2 - s*0.02); c.quadraticCurveTo(px2 + s*0.3, py2 + s*0.1, px2 + s*0.45, py2 + s*0.02); c.stroke();
          c.strokeStyle = 'rgba(150,112,60,.25)'; c.beginPath(); c.moveTo(px2 - s*0.05, py2 - s*0.17); c.lineTo(px2 + s*0.2, py2 + s*0.04); c.stroke(); c.strokeStyle = 'rgba(150,112,60,.6)'; } }
      else if (r < 0.75){ c.fillStyle = 'rgba(140,110,70,.45)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(x + (rnd(k+i*3)-0.5)*s, y + (rnd(k+i*5)-0.5)*s*0.7, s*0.035, 0, Math.PI*2); c.fill(); } }
    } else if (t === 'steppe'){
      if (r < 0.45){ c.strokeStyle = 'rgba(110,118,58,.6)'; c.lineWidth = Math.max(0.4, s*0.045);
        for (let i = 0; i < 3; i++){ const gx = x + (rnd(k+i)-0.5)*s*0.9, gy = y + (rnd(k+i*2)-0.5)*s*0.6; c.beginPath(); c.moveTo(gx - s*0.08, gy); c.lineTo(gx - s*0.04, gy - s*0.14); c.moveTo(gx, gy); c.lineTo(gx, gy - s*0.18); c.moveTo(gx + s*0.08, gy); c.lineTo(gx + s*0.05, gy - s*0.14); c.stroke(); } }
    } else if (t === 'loess'){
      if (r < 0.55){ c.strokeStyle = 'rgba(140,100,55,.5)'; c.lineWidth = Math.max(0.4, s*0.045);
        for (let i = 0; i < 3; i++){ const yy = y + (i-1)*s*0.16; const ww = s*(0.45 - i*0.08); c.beginPath(); c.moveTo(x - ww, yy + s*0.02); c.quadraticCurveTo(x, yy - s*0.08, x + ww, yy + s*0.02); c.stroke(); } }
    } else if (t === 'plain' || t === 'basin'){
      if (r < 0.22){ c.strokeStyle = 'rgba(120,130,62,.42)'; c.lineWidth = Math.max(0.4, s*0.035);
        const a = r2*Math.PI; for (let i = -2; i <= 2; i++){ const ox = Math.cos(a+Math.PI/2)*i*s*0.1, oy = Math.sin(a+Math.PI/2)*i*s*0.1; c.beginPath(); c.moveTo(x + ox - Math.cos(a)*s*0.28, y + oy - Math.sin(a)*s*0.28); c.lineTo(x + ox + Math.cos(a)*s*0.28, y + oy + Math.sin(a)*s*0.28); c.stroke(); } }
    } else if (t === 'sea'){
      if (r < 0.08){ c.strokeStyle = INKB + '.28)'; c.lineWidth = Math.max(0.4, s*0.04); c.beginPath(); c.moveTo(x - s*0.3, y); c.quadraticCurveTo(x - s*0.15, y - s*0.12, x, y); c.quadraticCurveTo(x + s*0.15, y + s*0.12, x + s*0.3, y); c.stroke(); }
    }
    c.restore();
  }

  // ---------- 地名 ----------
  // [文字, 经度, 纬度, 字号(世界单位), 类型, 旋转角度, 最小缩放, 最大缩放]
  const LABELS = [
    ['青 藏 高 原', 87.5, 33.0, 1.3, 'region', -4, 0, 60], ['内 蒙 古 高 原', 112.5, 44.6, 0.95, 'region', -6, 0, 60], ['黄 土 高 原', 108.6, 37.0, 0.75, 'region', 0, 0, 70],
    ['云 贵 高 原', 104.6, 25.6, 0.75, 'region', -6, 0, 70], ['华 北 平 原', 116.3, 36.4, 0.75, 'region', -10, 0, 70], ['东 北 平 原', 124.6, 45.0, 0.72, 'region', -20, 0, 70],
    ['长 江 中 下 游 平 原', 116.6, 30.3, 0.5, 'region', -8, 0, 80], ['四 川 盆 地', 105.5, 30.0, 0.55, 'region', 0, 0, 80], ['塔 里 木 盆 地', 83.2, 41.6, 0.6, 'region', 0, 0, 80],
    ['准 噶 尔 盆 地', 86.6, 45.4, 0.5, 'region', 0, 0, 80], ['柴 达 木 盆 地', 94.0, 37.6, 0.5, 'region', -4, 0, 80], ['东 南 丘 陵', 116.0, 26.9, 0.6, 'region', -10, 0, 80],
    ['塔克拉玛干沙漠', 83.0, 39.3, 0.55, 'desert', 0, 0, 90], ['戈 壁', 103.0, 42.4, 0.8, 'desert', 0, 0, 90], ['腾格里沙漠', 104.2, 38.3, 0.32, 'desert', 0, 20, 90], ['巴丹吉林沙漠', 101.8, 40.0, 0.32, 'desert', 0, 20, 90],
    ['喜 马 拉 雅 山 脉', 86.0, 28.3, 0.55, 'range', -14, 0, 90], ['昆 仑 山 脉', 85.0, 36.6, 0.5, 'range', -3, 0, 90], ['天 山', 84.0, 43.2, 0.5, 'range', -5, 0, 90], ['阿尔泰山', 88.2, 48.0, 0.38, 'range', -18, 20, 90],
    ['祁 连 山', 99.6, 38.2, 0.4, 'range', -20, 20, 90], ['秦 岭', 108.0, 33.55, 0.42, 'range', 0, 0, 90], ['大 巴 山', 109.0, 32.0, 0.32, 'range', -10, 20, 90], ['横 断 山 脉', 99.3, 28.6, 0.4, 'range', -70, 20, 90],
    ['太 行 山', 113.6, 37.4, 0.38, 'range', -62, 20, 90], ['吕梁山', 111.2, 37.6, 0.3, 'range', -70, 20, 90], ['大 兴 安 岭', 121.6, 48.6, 0.48, 'range', -58, 0, 90], ['小兴安岭', 128.4, 48.4, 0.36, 'range', -30, 20, 90],
    ['长 白 山', 128.2, 42.3, 0.36, 'range', -30, 20, 90], ['阴 山', 109.6, 41.35, 0.34, 'range', 0, 20, 90], ['燕 山', 117.6, 40.85, 0.32, 'range', 0, 20, 90], ['南 岭', 112.8, 25.3, 0.36, 'range', -6, 20, 90],
    ['武 夷 山', 117.2, 26.9, 0.32, 'range', -45, 20, 90], ['大别山', 115.6, 31.25, 0.28, 'range', 0, 20, 90], ['巫 山', 109.9, 31.2, 0.26, 'range', 0, 20, 90], ['武 陵 山', 109.8, 28.5, 0.3, 'range', -50, 20, 90],
    ['渤 海', 119.9, 38.95, 0.55, 'sea', 0, 0, 90], ['黄 海', 123.3, 35.2, 0.85, 'sea', 0, 0, 90], ['东 海', 125.2, 29.0, 0.95, 'sea', 0, 0, 90], ['南 海', 114.5, 18.6, 1.05, 'sea', 0, 0, 90],
    ['日 本 海', 133.2, 40.6, 0.8, 'sea', 0, 0, 90], ['台湾海峡', 119.6, 24.3, 0.34, 'sea', 52, 10, 90], ['北部湾', 108.2, 20.3, 0.36, 'sea', 0, 10, 90], ['琼州海峡', 110.2, 20.2, 0.18, 'sea', 0, 30, 90],
    ['辽东半岛', 122.3, 39.75, 0.22, 'cape', -40, 26, 90], ['山东半岛', 121.2, 37.0, 0.24, 'cape', -12, 26, 90], ['雷州半岛', 110.0, 20.8, 0.2, 'cape', -80, 28, 90],
    ['海 南 岛', 109.8, 19.15, 0.3, 'island', 0, 10, 90], ['台 湾 岛', 121.0, 23.7, 0.3, 'island', -72, 10, 90],
    ['青海湖', 100.2, 37.35, 0.22, 'lake', 0, 18, 90], ['鄱阳湖', 116.95, 29.15, 0.18, 'lake', 0, 26, 90], ['洞庭湖', 112.8, 29.6, 0.18, 'lake', 0, 26, 90], ['太湖', 120.2, 31.2, 0.16, 'lake', 0, 28, 90], ['呼伦湖', 117.9, 49.3, 0.2, 'lake', 0, 26, 90],
    ['长江', 111.0, 30.55, 0.28, 'river', -12, 14, 90], ['长江', 117.3, 30.55, 0.22, 'river', 30, 24, 90], ['黄河', 110.9, 37.3, 0.28, 'river', -78, 14, 90], ['黄河', 116.4, 36.05, 0.22, 'river', 40, 22, 90], ['珠江', 110.5, 23.65, 0.24, 'river', -5, 14, 90],
    ['淮河', 115.6, 32.65, 0.2, 'river', -5, 24, 90], ['汉江', 110.2, 32.85, 0.2, 'river', 0, 24, 90], ['松花江', 128.6, 46.45, 0.22, 'river', 20, 24, 90], ['黑龙江', 127.0, 51.3, 0.24, 'river', -50, 24, 90],
    ['雅鲁藏布江', 89.6, 29.0, 0.24, 'river', 0, 24, 90], ['澜沧江', 99.6, 27.0, 0.2, 'river', -75, 24, 90], ['塔里木河', 84.4, 41.4, 0.2, 'river', 0, 24, 90], ['嘉陵江', 106.3, 31.3, 0.18, 'river', -75, 24, 90], ['湘江', 112.4, 27.4, 0.18, 'river', -60, 24, 90], ['赣江', 115.5, 27.6, 0.18, 'river', -70, 24, 90],
  ];

  // 线路走廊地形系数：沿线取样平均
  function edgeTerrain(a, b){
    let sum = 0, n = 0, worst = 'plain', wc = 0;
    for (let i = 0; i <= 20; i++){ const f = i/20; const t = classify(a.lon + (b.lon-a.lon)*f, a.lat + (b.lat-a.lat)*f); const cost = T[t].cost || 1.8; sum += cost; n++; if (cost > wc){ wc = cost; worst = t; } }
    return { factor: +(sum/n).toFixed(2), worst: T[worst].name };
  }
  return { build, classify, edgeTerrain, T, LABELS, RIVERS, wx, wy };
})();
