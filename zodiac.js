/* ============================================================
   黄道十二宮データ ＋ 星座原画（オリジナル生成 SVG）
   画像素材はライセンスの曖昧さを避けるため、すべて自前の
   SVG で描き起こしています（星座記号＋実星配置風の星々）。
   element: fire(火) / earth(地) / air(風) / water(水)
   ============================================================ */

const ZODIAC = [
  { key: "aries",       jp: "牡羊座",   roma: "Aries",       glyph: "♈", element: "fire",  date: "3/21 - 4/19" },
  { key: "taurus",      jp: "牡牛座",   roma: "Taurus",      glyph: "♉", element: "earth", date: "4/20 - 5/20" },
  { key: "gemini",      jp: "双子座",   roma: "Gemini",      glyph: "♊", element: "air",   date: "5/21 - 6/21" },
  { key: "cancer",      jp: "蟹座",     roma: "Cancer",      glyph: "♋", element: "water", date: "6/22 - 7/22" },
  { key: "leo",         jp: "獅子座",   roma: "Leo",         glyph: "♌", element: "fire",  date: "7/23 - 8/22" },
  { key: "virgo",       jp: "乙女座",   roma: "Virgo",       glyph: "♍", element: "earth", date: "8/23 - 9/22" },
  { key: "libra",       jp: "天秤座",   roma: "Libra",       glyph: "♎", element: "air",   date: "9/23 - 10/23" },
  { key: "scorpio",     jp: "蠍座",     roma: "Scorpio",     glyph: "♏", element: "water", date: "10/24 - 11/22" },
  { key: "sagittarius", jp: "射手座",   roma: "Sagittarius", glyph: "♐", element: "fire",  date: "11/23 - 12/21" },
  { key: "capricorn",   jp: "山羊座",   roma: "Capricorn",   glyph: "♑", element: "earth", date: "12/22 - 1/19" },
  { key: "aquarius",    jp: "水瓶座",   roma: "Aquarius",    glyph: "♒", element: "air",   date: "1/20 - 2/18" },
  { key: "pisces",      jp: "魚座",     roma: "Pisces",      glyph: "♓", element: "water", date: "2/19 - 3/20" },
];

/* 各星座の「星の配置」（0〜100 の相対座標で星を打ち、線でつなぐ）。
   本物の星図を簡略化・意匠化したオリジナル配置。 */
const CONSTELLATIONS = {
  aries:       { stars: [[20,70],[42,55],[62,48],[80,40]], lines: [[0,1],[1,2],[2,3]] },
  taurus:      { stars: [[18,38],[38,52],[55,60],[72,46],[85,30],[60,76]], lines: [[0,1],[1,2],[2,3],[3,4],[2,5]] },
  gemini:      { stars: [[32,18],[30,46],[28,78],[64,20],[66,48],[68,80]], lines: [[0,1],[1,2],[3,4],[4,5],[0,3],[2,5]] },
  cancer:      { stars: [[50,24],[38,50],[64,52],[28,76],[74,74]], lines: [[0,1],[0,2],[1,3],[2,4]] },
  leo:         { stars: [[22,68],[36,52],[40,32],[58,26],[72,40],[78,62],[60,72]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,0]] },
  virgo:       { stars: [[20,30],[40,40],[58,34],[55,56],[72,68],[42,72]], lines: [[0,1],[1,2],[1,3],[3,4],[3,5]] },
  libra:       { stars: [[30,60],[50,30],[70,60],[24,78],[76,78]], lines: [[0,1],[1,2],[0,3],[2,4]] },
  scorpio:     { stars: [[18,28],[34,34],[50,40],[60,56],[56,74],[72,80],[80,66]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]] },
  sagittarius: { stars: [[24,72],[44,58],[60,46],[78,36],[58,66],[40,40]], lines: [[0,1],[1,2],[2,3],[1,4],[1,5]] },
  capricorn:   { stars: [[22,40],[44,30],[66,42],[78,62],[50,72],[30,60]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]] },
  aquarius:    { stars: [[18,44],[34,52],[50,44],[66,52],[82,44],[58,70]], lines: [[0,1],[1,2],[2,3],[3,4],[3,5]] },
  pisces:      { stars: [[20,30],[34,48],[28,68],[60,40],[76,30],[70,64]], lines: [[0,1],[1,2],[3,4],[3,5],[1,3]] },
};

const ELEMENT_META = {
  fire:  { jp: "火",  color: "#ff8a5c", soft: "#ffd2b0" },
  earth: { jp: "地",  color: "#c4a86a", soft: "#ecdcb0" },
  air:   { jp: "風",  color: "#9fd0ff", soft: "#d6ecff" },
  water: { jp: "水",  color: "#a9a4ff", soft: "#ddd9ff" },
};

/* 指定星座の「星座原画」SVG を組み立てる */
function buildConstellationSVG(zodiac, opts = {}) {
  const c = CONSTELLATIONS[zodiac.key];
  const em = ELEMENT_META[zodiac.element];
  const glow = opts.color || em.color;
  const id = "g_" + zodiac.key + "_" + Math.random().toString(36).slice(2, 7);

  let lines = "";
  c.lines.forEach(([a, b]) => {
    const p = c.stars[a], q = c.stars[b];
    lines += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="url(#${id}-line)" stroke-width="0.7" stroke-linecap="round" opacity="0.65"/>`;
  });

  let stars = "";
  c.stars.forEach(([x, y], i) => {
    const r = i === 0 ? 2.4 : 1.5 + (i % 2) * 0.5;
    stars += `<circle cx="${x}" cy="${y}" r="${r + 2.6}" fill="${glow}" opacity="0.18"/>`;
    stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`;
    stars += `<circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="${glow}"/>`;
  });

  return `
  <svg viewBox="0 0 100 100" class="constellation-svg" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="${id}-line" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${glow}" stop-opacity="0.2"/>
        <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.9"/>
        <stop offset="1" stop-color="${glow}" stop-opacity="0.2"/>
      </linearGradient>
      <radialGradient id="${id}-halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${glow}" stop-opacity="0.30"/>
        <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#${id}-halo)"/>
    <text x="50" y="58" text-anchor="middle" class="constellation-glyph" fill="${glow}">${zodiac.glyph}</text>
    <g class="constellation-lines">${lines}</g>
    <g class="constellation-stars">${stars}</g>
  </svg>`;
}

function findZodiac(key) {
  return ZODIAC.find((z) => z.key === key);
}
