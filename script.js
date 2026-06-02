/* ============================================================
   絆占い  ─  メインロジック
   ・星座えらび／名前入力
   ・占いの儀式（5〜8秒の障眼法アニメーション）
   ・相性スコアは入力から決定論的に算出（同じ入力なら同じ結果）
   ============================================================ */

const state = { left: null, right: null, mode: "name" };

/* ---------- 起動 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  buildGrids();
  buildWheel();
  initAmbientStars();
  bindUI();
  setMode("name");
  updateSide("left");
  updateSide("right");
});

/* ---------- 占いモードの切り替え ---------- */
function setMode(mode) {
  state.mode = mode;
  const stage = document.getElementById("stage");
  stage.classList.toggle("mode-name", mode === "name");
  stage.classList.toggle("mode-zodiac", mode === "zodiac");
  document.querySelectorAll("#mode-switch .mode-btn").forEach((b) => {
    const on = b.dataset.mode === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  const ind = document.getElementById("mode-indicator");
  if (ind) ind.style.transform = mode === "zodiac" ? "translateX(100%)" : "translateX(0)";
  refreshReady();
}

/* ---------- 星座えらびのグリッドを生成 ---------- */
function buildGrids() {
  ["left", "right"].forEach((side) => {
    const grid = document.getElementById("grid-" + side);
    ZODIAC.forEach((z) => {
      const cell = document.createElement("button");
      cell.className = "zodiac-cell";
      cell.textContent = z.glyph;
      cell.title = z.jp;
      cell.dataset.key = z.key;
      cell.addEventListener("click", () => selectZodiac(side, z.key, cell));
      grid.appendChild(cell);
    });
  });
}

function selectZodiac(side, key, cell) {
  state[side] = key;
  const grid = document.getElementById("grid-" + side);
  grid.querySelectorAll(".zodiac-cell").forEach((c) => c.classList.remove("selected"));
  cell.classList.add("selected");
  updateSide(side);
  refreshReady();
}

/* 選択中の星座原画と名前表示を更新 */
function updateSide(side) {
  const disp = document.getElementById("zodiac-" + side);
  const nameEl = document.getElementById("zodiac-name-" + side);
  if (!state[side]) {
    disp.classList.add("empty");
    disp.innerHTML = "";
    nameEl.textContent = "星座を選択してください";
    return;
  }
  const z = findZodiac(state[side]);
  disp.classList.remove("empty");
  disp.innerHTML = buildConstellationSVG(z);
  disp.classList.remove("pop"); void disp.offsetWidth; disp.classList.add("pop");
  const em = ELEMENT_META[z.element];
  nameEl.innerHTML = `${z.jp}<span class="roma">${z.roma} ・ ${em.jp}のエレメント</span>`;
}

/* ---------- 黄道十二宮の輪を生成 ---------- */
function buildWheel() {
  const ticks = document.getElementById("wheel-ticks");
  const glyphs = document.getElementById("wheel-glyphs");
  const cx = 300, cy = 300, rGlyph = 191, rTick = 232;
  ZODIAC.forEach((z, i) => {
    const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const gx = cx + Math.cos(ang) * rGlyph;
    const gy = cy + Math.sin(ang) * rGlyph;
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", gx); t.setAttribute("y", gy);
    t.setAttribute("class", "wheel-glyph"); t.textContent = z.glyph;
    glyphs.appendChild(t);
    // 目盛り
    const a2 = ((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", cx + Math.cos(a2) * (rTick - 14));
    ln.setAttribute("y1", cy + Math.sin(a2) * (rTick - 14));
    ln.setAttribute("x2", cx + Math.cos(a2) * rTick);
    ln.setAttribute("y2", cy + Math.sin(a2) * rTick);
    ln.setAttribute("class", "wheel-tick");
    ticks.appendChild(ln);
  });
}

/* ---------- UI 配線 ---------- */
function bindUI() {
  document.getElementById("name-left").addEventListener("input", refreshReady);
  document.getElementById("name-right").addEventListener("input", refreshReady);
  document.getElementById("divine-btn").addEventListener("click", startDivination);
  document.getElementById("again-btn").addEventListener("click", resetToStart);
  document.querySelectorAll("#mode-switch .mode-btn").forEach((b) => {
    b.addEventListener("click", () => setMode(b.dataset.mode));
  });
}

/* このモードで占いに必要な星座がそろっているか */
function zodiacReady() {
  return state.mode === "name" || (state.left && state.right);
}

function namesFilled() {
  return (
    document.getElementById("name-left").value.trim() &&
    document.getElementById("name-right").value.trim()
  );
}
function refreshReady() {
  const ready = zodiacReady() && namesFilled();
  const btn = document.getElementById("divine-btn");
  btn.classList.toggle("ready", !!ready);
  const hint = document.getElementById("hint-text");
  const need = state.mode === "zodiac"
    ? "おふたりの星座とお名前を入力してください"
    : "おふたりのお名前を入力してください";
  hint.textContent = ready ? "鑑定の準備が整いました。結果を読み解きましょう ✦" : need;
}

/* ============================================================
   占いの儀式
   ============================================================ */
let ritualRAF = null;

function startDivination() {
  if (!(zodiacReady() && namesFilled())) {
    flashHint(state.mode === "zodiac"
      ? "おふたりの星座とお名前を入力してください"
      : "おふたりのお名前を入力してください");
    return;
  }
  const nameL = document.getElementById("name-left").value.trim();
  const nameR = document.getElementById("name-right").value.trim();

  // ── 結果は"この瞬間"に確定（障眼法：見せている間に裏では決まっている） ──
  const outcome = state.mode === "zodiac"
    ? computeCompatibility(nameL, state.left, nameR, state.right)
    : computeByName(nameL, nameR);

  // 儀式の中央に置く原画（星座モード＝星座原画／名前モード＝ことだまの珠）
  if (state.mode === "zodiac") {
    document.getElementById("orbit-1").innerHTML = buildConstellationSVG(findZodiac(state.left));
    document.getElementById("orbit-2").innerHTML = buildConstellationSVG(findZodiac(state.right));
  } else {
    document.getElementById("orbit-1").innerHTML = buildNameOrbSVG(nameL, "#f4a8c8");
    document.getElementById("orbit-2").innerHTML = buildNameOrbSVG(nameR, "#b9a4ff");
  }

  const ritual = document.getElementById("ritual");
  ritual.classList.add("active");
  ritual.setAttribute("aria-hidden", "false");

  startRitualParticles();
  runRitualSequence(outcome);
}

/* 障眼法の進行：フェーズとことばを時間で切り替える */
function runRitualSequence(outcome) {
  const ritual = document.getElementById("ritual");
  const caption = document.getElementById("ritual-caption");
  const bar = document.getElementById("ritual-progress-bar");

  // 5〜8秒の中でランダムに総尺を決める（毎回わずかに違う"間"）
  const total = 5600 + Math.random() * 2000; // 5.6〜7.6s
  const t0 = performance.now();

  const phases = [
    { at: 0.00, cls: "phase-enter", text: "星々がささやきはじめています…" },
    { at: 0.14, cls: "phase-wheel", text: "黄道十二宮の導きをたどっています" },
    { at: 0.34, cls: "phase-wheel", text: "おふたりの星が、静かに引き合っています…" },
    { at: 0.52, cls: "phase-bind",  text: "運命の糸を、そっと結び合わせています…" },
    { at: 0.74, cls: "phase-read",  text: "絆占いが、おふたりの相性を読み解いています…" },
    { at: 0.90, cls: "phase-read",  text: "まもなく、鑑定結果をお届けします ✦" },
  ];
  let phaseIdx = -1;

  function applyPhase(i) {
    const p = phases[i];
    ritual.classList.remove("phase-enter", "phase-wheel", "phase-bind", "phase-read");
    ritual.classList.add(p.cls);
    caption.classList.remove("show");
    setTimeout(() => {
      caption.textContent = p.text;
      caption.classList.add("show");
    }, 180);
    if (p.cls === "phase-bind") burstParticles(0.9);
    if (p.cls === "phase-read") burstParticles(0.5);
  }

  function tick(now) {
    const prog = Math.min(1, (now - t0) / total);
    bar.style.width = (prog * 100).toFixed(1) + "%";

    // フェーズ切り替え
    let target = 0;
    for (let i = 0; i < phases.length; i++) if (prog >= phases[i].at) target = i;
    if (target !== phaseIdx) { phaseIdx = target; applyPhase(target); }

    if (prog < 1) {
      ritualRAF = requestAnimationFrame(tick);
    } else {
      finishRitual(outcome);
    }
  }
  ritualRAF = requestAnimationFrame(tick);
}

function finishRitual(outcome) {
  const ritual = document.getElementById("ritual");
  burstParticles(1.4); // フィナーレの大きな閃光
  setTimeout(() => {
    ritual.classList.remove("active", "phase-enter", "phase-wheel", "phase-bind", "phase-read");
    ritual.setAttribute("aria-hidden", "true");
    stopRitualParticles();
    showResult(outcome);
  }, 650);
}

/* ============================================================
   相性スコアの算出（決定論的）
   名前と星座から安定したハッシュを作り、四元素の相性で補正。
   結果が寂しくなりすぎないよう 44〜99% に収める。
   ============================================================ */
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0);
}

/* 名前の等冪計算の素（ことだまの響き）。
   占う「いま」の日付＋時刻（時単位・分は含めない）を種に混ぜるので、
   同じ日付・同じ時・同じ二人なら結果は等冪。日付か時が変われば変わる。
   星座モードでも"基礎"としてこの値を使う。 */
function nameSeedParts(nameL, nameR) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}`;
  const seed = [nameL, nameR].sort().join("|") + "@" + stamp;
  const h  = hashString(seed);
  const h2 = hashString(seed + "✦");
  const h3 = hashString(seed + "★"); // 奇跡枠の抽選に使う
  // 単一ハッシュで均一分布（平均値への集中を避ける）
  const raw = (h % 10000) / 10000;
  return { raw, h, h2, h3, now };
}

/* スコア分布を適用する。
   1/12 の確率で「奇跡の高相性（93〜99）」、
   1/12 の確率で「謎めいた低相性（5〜13）」が出現する。
   残り 10/12 は 20〜90 の均一分布。 */
function applyScoreDistribution(raw, h3) {
  const roll = h3 % 12;
  if (roll === 0) {
    return { score: 93 + (h3 >>> 8) % 7, miracle: "high" }; // 93〜99
  }
  if (roll === 1) {
    return { score: 5 + (h3 >>> 8) % 9, miracle: "low" };   // 5〜13
  }
  return { score: Math.round(20 + raw * 70), miracle: null }; // 20〜90
}

/* ---- 黄道（太陽の位置）まわりの計算 ---- */
// 指定日時の太陽の黄経（0〜360°、春分点=牡羊座0°）。低精度だが占い用途には十分。
function sunEclipticLongitude(date) {
  const JD = date.getTime() / 86400000 + 2440587.5; // ユリウス日
  const n = JD - 2451545.0;                          // J2000.0 からの経過日数
  const L = (280.460 + 0.9856474 * n);               // 平均黄経
  const g = (357.528 + 0.9856003 * n) * Math.PI / 180; // 平均近点角
  let lon = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
  return ((lon % 360) + 360) % 360;
}
// 星座の中心黄経（牡羊=15°, 牡牛=45° …）
function signCenter(key) { return ZODIAC.findIndex((z) => z.key === key) * 30 + 15; }
// 2つの黄経の最小角差（0〜180°）
function angDist(a, b) { const d = (((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; }

// アスペクト（角度関係）の調和度を 0〜1 で返す。プトレマイオスの主要アスペクト。
function aspectHarmony(deg) {
  const aspects = [
    { a: 0,   v: 0.88, orb: 10 }, // 合
    { a: 60,  v: 0.82, orb: 8 },  // セクスタイル（吉）
    { a: 90,  v: 0.40, orb: 8 },  // スクエア（凶）
    { a: 120, v: 0.98, orb: 10 }, // トライン（大吉）
    { a: 150, v: 0.38, orb: 6 },  // インコンジャクト（凶）
    { a: 180, v: 0.62, orb: 10 }, // オポジション
  ];
  let acc = 0, wsum = 0;
  for (const asp of aspects) {
    const w = Math.max(0, 1 - Math.abs(deg - asp.a) / asp.orb); // オーブ内で線形に効く
    acc += asp.v * w; wsum += w;
  }
  return wsum > 0 ? acc / wsum : 0.5; // どのアスペクトのオーブ外なら中立
}

function aspectName(sep) {
  const s = Math.round(sep / 30) * 30;
  return ({
    0:   "重なり合うご縁（コンジャンクション）",
    30:  "ゆるやかに近づくご縁（セミセクスタイル）",
    60:  "心地よく支え合う関係（セクスタイル）",
    90:  "刺激し合い成長できる関係（スクエア）",
    120: "自然に響き合う関係（トライン）",
    150: "歩み寄りが鍵になる関係（インコンジャンクト）",
    180: "向き合うほど惹かれる関係（オポジション）",
  })[s] || "星が示すご縁";
}

// 太陽の現在位置を踏まえた、ふたつの星座の相性（0〜1）。
function zodiacAffinityBySun(keyL, keyR, sunLon) {
  const cL = signCenter(keyL), cR = signCenter(keyR);
  const sep = angDist(cL, cR);
  const baseAspect = aspectHarmony(sep);                       // 二人の星座どうしの角度関係
  const sunFavor = (aspectHarmony(angDist(sunLon, cL)) +
                    aspectHarmony(angDist(sunLon, cR))) / 2;   // 今の太陽が両者をどう照らすか
  const score = baseAspect * 0.65 + sunFavor * 0.35;
  const sunSign = ZODIAC[Math.floor((((sunLon % 360) + 360) % 360) / 30)];
  return { score, aspectName: aspectName(sep), sunSign };
}

/* 星座＋名前の相性。
   姓名の等冪計算を基礎に、太陽の現在位置で測った星座相性を叠加する。 */
function computeCompatibility(nameL, keyL, nameR, keyR) {
  const zL = findZodiac(keyL), zR = findZodiac(keyR);
  const { raw: nameBase, h, h3, now } = nameSeedParts(nameL, nameR);

  const sunLon = sunEclipticLongitude(now);
  const z = zodiacAffinityBySun(keyL, keyR, sunLon);

  // 奇跡枠を先に抽選する（出た場合は星座相性を上書き）
  const { score, miracle } = (() => {
    const pre = applyScoreDistribution(nameBase, h3);
    if (pre.miracle) return pre;
    // 奇跡でない場合は姓名5割＋星座相性5割で補正
    const sameSign = keyL === keyR ? 0.04 : 0;
    const raw = Math.max(0, Math.min(1, nameBase * 0.5 + z.score * 0.5 + sameSign));
    return { score: Math.round(20 + raw * 70), miracle: null };
  })();

  return {
    mode: "zodiac",
    score, miracle, nameL, nameR, zL, zR,
    affinity: z.score, sunSign: z.sunSign,
    verdict: pickVerdict(score, miracle, h),
    message: pickMessage(score, miracle, h),
    aspect: z.aspectName,
  };
}

/* 名前だけの相性（ことだまの響き）。星座を使わず姓名の等冪計算のみ。 */
function computeByName(nameL, nameR) {
  const { raw, h, h3 } = nameSeedParts(nameL, nameR);
  const { score, miracle } = applyScoreDistribution(raw, h3);

  return {
    mode: "name",
    score, miracle, nameL, nameR, zL: null, zR: null,
    verdict: pickVerdict(score, miracle, h),
    message: pickMessage(score, miracle, h),
    aspect: nameResonanceLabel(score, miracle),
  };
}

function nameResonanceLabel(score, miracle) {
  if (miracle === "high") return "言霊が、必殺技のように響き合っています";
  if (miracle === "low")  return "言霊が、まだ次回予告を待っているようです";
  if (score >= 82) return "言霊が、ぴたりとコンビ技になっています";
  if (score >= 70) return "ふたつの名前が、やさしく響き合っています";
  if (score >= 57) return "名前の響きが、心地よく調和しています";
  if (score >= 42) return "ふたつの響きが、少しずつ寄り添っています";
  return "名前の響きが、ゆっくり距離を縮めています";
}

const MIRACLE_HIGH_VERDICTS = [
  "奇跡のご縁 ─ 主人公級の相性",
  "運命的な結びつき ─ これはもう最終回手前",
  "星が祝福するご縁 ─ 友情・努力・相性",
  "かけがえのない絆 ─ コンビ技が決まる相性",
  "心が通い合うご縁 ─ スーパー級の相性",
];

const MIRACLE_LOW_VERDICTS = [
  "まだ形の見えないご縁 ─ 第1話はここから",
  "少し不思議な結びつき ─ 伏線回収はこれから",
  "意外性のあるご縁 ─ 名探偵も二度見する相性",
  "慎重に育てたい関係 ─ 作戦会議が効く相性",
  "距離の縮め方が大切なご縁 ─ 次回に期待の相性",
];

function pickVerdict(score, miracle, h) {
  if (miracle === "high") return MIRACLE_HIGH_VERDICTS[h % MIRACLE_HIGH_VERDICTS.length];
  if (miracle === "low")  return MIRACLE_LOW_VERDICTS[h % MIRACLE_LOW_VERDICTS.length];
  if (score >= 82) return "運命を感じるご縁 ─ 主題歌が流れる相性";
  if (score >= 70) return "自然に惹かれ合う ─ いいチームになれる相性";
  if (score >= 57) return "心が通い合う ─ じわじわ良い相性";
  if (score >= 42) return "歩み寄るほど深まる相性";
  return "ゆっくり育てたい、まだ序盤の相性";
}

const MESSAGES = {
  miracle_high: [
    "めったに見られないほど強い結びつきを感じる相性です。お互いの存在が安心感となり、関係を大切に育てるほど絆はさらに深まっていくでしょう。",
    "出会うべくして出会ったと思えるご縁です。言葉にしなくても気持ちが伝わりやすく、ふたりで過ごす時間が心の支えになっていきます。",
    "星の流れから見ると、おふたりは互いの魅力を自然に引き出し合える関係です。まるで冒険の一味に迎えたくなるような、頼もしさがあります。",
    "おふたりの間には、偶然とは思えない引力があります。向き合うほど、隠しコマンドを見つけたみたいに関係が強くなっていきそうです。",
    "この相性は、強いご縁とタイミングの良さを示しています。ここぞという場面では、まるで必殺技のカットインのように息が合うでしょう。",
  ],
  miracle_low: [
    "今はまだ、お互いの距離感を探る時期かもしれません。焦らず相手の考え方を知っていくことで、思いがけない接点が見えてくるでしょう。",
    "価値観の違いが出やすい相性ですが、その違いは関係を広げるきっかけにもなります。丁寧な言葉選びが、ふたりの流れを変えてくれます。",
    "すぐに答えを決めつけず、少しずつ歩み寄ることが大切です。今は修行編だと思えば、伸びしろはかなり大きめです。",
    "星は、まだ余白の多い関係を示しています。名探偵なら見逃さない小さな伏線が、これから効いてくるかもしれません。",
    "おふたりの関係には、慎重さと素直さの両方が必要です。秘密道具を探すより、まずは一言のやさしさが近道になります。",
  ],
  high: [
    "お互いの存在が、自然と心を明るくしてくれる相性です。無理をしなくても距離が縮まりやすく、一緒にいるほど信頼が深まります。",
    "違いさえも魅力として受け止めやすい関係です。素直な気持ちを伝えることで、恋の流れはさらに前向きに進んでいくでしょう。",
    "惹かれ合う力が強く、支え合える相性です。ふたりで全集中すれば、日常の小さな壁も軽やかに越えていけそうです。",
    "テンポの合いやすい相性です。まるで息ぴったりのチーム戦のように、相手の一手を自然に受け取れるでしょう。",
  ],
  mid: [
    "穏やかに育っていく相性です。焦らず相手のペースを尊重することで、信頼はゆっくり確かなものになります。",
    "ときに価値観の違いを感じても、それはお互いを知るための大切なきっかけです。素直な言葉が、ふたりの距離を縮めてくれます。",
    "心地よい風のように、自然体で向き合える関係です。小さな感謝を重ねるほど、ふたりの時間は温かくなっていきます。",
    "まだ派手な展開ではありませんが、じわじわ効いてくる良いご縁です。日常回を大切にすると、ちゃんと名場面が増えていきます。",
  ],
  low: [
    "今はまだ手探りでも、関係を育てる余地は十分にあります。違いを否定せず、面白がる気持ちが距離を近づけます。",
    "ゆっくり時間をかけるほど深まるご縁です。相手の小さな優しさに気づくことで、関係は少しずつ温まっていきます。",
    "最初はすれ違いがあっても、理解しようとする姿勢が流れを変えます。歩み寄るほど、星はふたりの味方をしてくれるでしょう。",
    "今はまだ序盤のライバル関係に見えますが、会話を重ねるほど印象は変わります。焦らず、次の話数を楽しみにしてみてください。",
  ],
};

function pickMessage(score, miracle, h) {
  if (miracle === "high") return MESSAGES.miracle_high[h % MESSAGES.miracle_high.length];
  if (miracle === "low")  return MESSAGES.miracle_low[h % MESSAGES.miracle_low.length];
  const bucket = score >= 70 ? "high" : score >= 45 ? "mid" : "low";
  return MESSAGES[bucket][h % MESSAGES[bucket].length];
}

/* ============================================================
   結果の表示
   ============================================================ */
function showResult(o) {
  const res = document.getElementById("result");
  document.getElementById("result-names").innerHTML =
    `<b>${escapeHTML(o.nameL)}</b><span class="heart">♡</span><b>${escapeHTML(o.nameR)}</b>`;
  document.getElementById("result-verdict").textContent = o.verdict;
  document.getElementById("result-message").textContent = o.message;
  document.getElementById("score-label").textContent = "相性度";
  const aspectsEl = document.getElementById("result-aspects");

  if (o.mode === "zodiac") {
    const emL = ELEMENT_META[o.zL.element], emR = ELEMENT_META[o.zR.element];
    aspectsEl.className = "result-aspects zodiac-aspects";
    aspectsEl.innerHTML = `
      <div class="aspect aspect-side"><b>${o.zL.glyph}</b><span>${o.zL.jp}</span><div class="el">${emL.jp}のエレメント</div></div>
      <div class="aspect aspect-center"><b>✧</b><span>${o.aspect}</span><div class="el">現在の太陽：${o.sunSign.glyph}${o.sunSign.jp}</div></div>
      <div class="aspect aspect-side"><b>${o.zR.glyph}</b><span>${o.zR.jp}</span><div class="el">${emR.jp}のエレメント</div></div>`;
  } else {
    aspectsEl.className = "result-aspects name-aspects";
    aspectsEl.innerHTML = `
      <div class="aspect aspect-side"><b>${escapeHTML(firstChar(o.nameL))}</b><span>${escapeHTML(o.nameL)}</span><div class="el">&nbsp;</div></div>
      <div class="aspect aspect-center"><b>✧</b><span>${o.aspect}</span><div class="el">言霊の響き</div></div>
      <div class="aspect aspect-side"><b>${escapeHTML(firstChar(o.nameR))}</b><span>${escapeHTML(o.nameR)}</span><div class="el">&nbsp;</div></div>`;
  }

  res.classList.add("active");
  res.setAttribute("aria-hidden", "false");

  // リングと数字をアニメーションで満たす
  const ring = document.getElementById("ring-fill");
  const circ = 2 * Math.PI * 96; // ≒603
  ring.style.strokeDasharray = circ.toFixed(1);
  ring.style.strokeDashoffset = circ.toFixed(1);
  // 色を相性に応じて
  ring.style.stroke = o.score >= 80 ? "#f4a8c8" : o.score >= 64 ? "#e8c97d" : "#b9a4ff";
  requestAnimationFrame(() => {
    setTimeout(() => {
      ring.style.strokeDashoffset = (circ * (1 - o.score / 100)).toFixed(1);
      countUp(document.getElementById("score-value"), o.score, 2000);
    }, 250);
  });
}

function countUp(el, target, dur) {
  const t0 = performance.now();
  function step(now) {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * target);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

function resetToStart() {
  const res = document.getElementById("result");
  res.classList.remove("active");
  res.setAttribute("aria-hidden", "true");
  document.getElementById("ring-fill").style.strokeDashoffset = "603";
  document.getElementById("score-value").textContent = "0";
}

/* ============================================================
   背景のアンビエント星空（常時）
   ============================================================ */
function initAmbientStars() {
  const canvas = document.getElementById("ambient-stars");
  const ctx = canvas.getContext("2d");
  let stars = [], w, h, dpr;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((w * h) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.3 + 0.3,
      base: Math.random() * 0.5 + 0.3,
      tw: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.02 + 0.005,
      hue: Math.random() < 0.3 ? "244,168,200" : Math.random() < 0.5 ? "232,201,125" : "255,255,255",
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.tw += s.sp;
      const a = s.base + Math.sin(s.tw) * 0.35;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.hue},${Math.max(0, a).toFixed(2)})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener("resize", resize);
  resize(); draw();
}

/* ============================================================
   儀式中のパーティクル（流れ星・光の粒・閃光）
   ============================================================ */
let pCtx, pCanvas, pParticles = [], pStreaks = [], pRunning = false, pRAF = null, pW, pH, pDpr;

function startRitualParticles() {
  pCanvas = document.getElementById("ritual-canvas");
  pCtx = pCanvas.getContext("2d");
  resizeRitualCanvas();
  pParticles = []; pStreaks = [];
  pRunning = true;
  // 中心に向かって渦巻く光の粒
  for (let i = 0; i < 140; i++) pParticles.push(spawnSwirl());
  loopRitual();
  window.addEventListener("resize", resizeRitualCanvas);
}
function resizeRitualCanvas() {
  if (!pCanvas) return;
  pDpr = Math.min(window.devicePixelRatio || 1, 2);
  pW = pCanvas.clientWidth; pH = pCanvas.clientHeight;
  pCanvas.width = pW * pDpr; pCanvas.height = pH * pDpr;
  pCtx.setTransform(pDpr, 0, 0, pDpr, 0, 0);
}
function spawnSwirl() {
  const ang = Math.random() * Math.PI * 2;
  const rad = Math.min(pW, pH) * (0.35 + Math.random() * 0.35);
  return {
    ang, rad,
    cx: pW / 2, cy: pH / 2,
    spin: (Math.random() * 0.6 + 0.4) * (Math.random() < 0.5 ? 1 : -1) * 0.01,
    pull: Math.random() * 0.25 + 0.08,
    r: Math.random() * 2.2 + 0.6,
    hue: Math.random() < 0.4 ? "244,168,200" : Math.random() < 0.6 ? "232,201,125" : "185,164,255",
    a: Math.random() * 0.5 + 0.4,
    life: 1,
  };
}
function loopRitual() {
  if (!pRunning) return;
  pCtx.clearRect(0, 0, pW, pH);
  pCtx.globalCompositeOperation = "lighter";

  // 渦巻く粒
  for (const p of pParticles) {
    p.ang += p.spin;
    p.rad -= p.pull;
    if (p.rad < 6) { Object.assign(p, spawnSwirl()); }
    const x = p.cx + Math.cos(p.ang) * p.rad;
    const y = p.cy + Math.sin(p.ang) * p.rad;
    const g = pCtx.createRadialGradient(x, y, 0, x, y, p.r * 3);
    g.addColorStop(0, `rgba(${p.hue},${p.a})`);
    g.addColorStop(1, `rgba(${p.hue},0)`);
    pCtx.fillStyle = g;
    pCtx.beginPath(); pCtx.arc(x, y, p.r * 3, 0, Math.PI * 2); pCtx.fill();
  }

  // 流れ星
  for (let i = pStreaks.length - 1; i >= 0; i--) {
    const s = pStreaks[i];
    s.x += s.vx; s.y += s.vy; s.life -= 0.012;
    if (s.life <= 0) { pStreaks.splice(i, 1); continue; }
    pCtx.strokeStyle = `rgba(${s.hue},${Math.max(0, s.life)})`;
    pCtx.lineWidth = s.w;
    pCtx.beginPath();
    pCtx.moveTo(s.x, s.y);
    pCtx.lineTo(s.x - s.vx * 6, s.y - s.vy * 6);
    pCtx.stroke();
  }

  pCtx.globalCompositeOperation = "source-over";
  pRAF = requestAnimationFrame(loopRitual);
}
/* 閃光バースト：中心から流れ星と火花を放つ */
function burstParticles(intensity) {
  if (!pRunning) return;
  const n = Math.round(40 * intensity);
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = (Math.random() * 4 + 2) * intensity;
    pStreaks.push({
      x: pW / 2, y: pH / 2,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      w: Math.random() * 1.6 + 0.4, life: 1,
      hue: Math.random() < 0.5 ? "244,168,200" : Math.random() < 0.7 ? "232,201,125" : "255,255,255",
    });
  }
}
function stopRitualParticles() {
  pRunning = false;
  if (pRAF) cancelAnimationFrame(pRAF);
  if (pCtx) pCtx.clearRect(0, 0, pW, pH);
  window.removeEventListener("resize", resizeRitualCanvas);
}

/* ---------- 小物 ---------- */
/* 名前の最初の一文字（サロゲートペアにも安全に対応） */
function firstChar(s) {
  return s ? Array.from(s)[0] : "";
}

/* 名前モードの儀式用「ことだまの珠」SVG（名前の頭文字を宿す光球） */
function buildNameOrbSVG(name, color) {
  const ch = escapeHTML(firstChar(name));
  const id = "orb_" + Math.random().toString(36).slice(2, 7);
  return `
  <svg viewBox="0 0 100 100" class="constellation-svg" preserveAspectRatio="xMidYMid meet">
    <defs>
      <radialGradient id="${id}-halo" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${color}" stop-opacity="0.42"/>
        <stop offset="0.7" stop-color="${color}" stop-opacity="0.12"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#${id}-halo)"/>
    <circle cx="50" cy="50" r="30" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.55"/>
    <circle cx="50" cy="50" r="36" fill="none" stroke="#ffffff" stroke-width="0.4" opacity="0.4" stroke-dasharray="1 4"/>
    <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
          fill="#fff" font-family="'Shippori Mincho', serif" font-size="34"
          style="filter:drop-shadow(0 0 6px ${color})">${ch}</text>
  </svg>`;
}

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function flashHint(msg) {
  const hint = document.getElementById("hint-text");
  const prev = hint.textContent;
  hint.textContent = msg;
  hint.style.color = "#f4a8c8";
  setTimeout(() => { hint.style.color = ""; refreshReady(); }, 1800);
}
