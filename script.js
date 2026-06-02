/* ============================================================
   星詠みの相性占い  ─  メインロジック
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
    nameEl.textContent = "星座をえらんでね";
    return;
  }
  const z = findZodiac(state[side]);
  disp.classList.remove("empty");
  disp.innerHTML = buildConstellationSVG(z);
  disp.classList.remove("pop"); void disp.offsetWidth; disp.classList.add("pop");
  const em = ELEMENT_META[z.element];
  nameEl.innerHTML = `${z.jp}<span class="roma">${z.roma} ・ ${em.jp}の星</span>`;
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
    ? "ふたりの星座とお名前を入れて、星に問いかけましょう"
    : "ふたりのお名前を入れて、星に問いかけましょう";
  hint.textContent = ready ? "準備がととのいました。星に問いかけましょう ✦" : need;
}

/* ============================================================
   占いの儀式
   ============================================================ */
let ritualRAF = null;

function startDivination() {
  if (!(zodiacReady() && namesFilled())) {
    flashHint(state.mode === "zodiac"
      ? "ふたりの星座とお名前を入れてくださいね"
      : "ふたりのお名前を入れてくださいね");
    return;
  }
  const nameL = document.getElementById("name-left").value.trim();
  const nameR = document.getElementById("name-right").value.trim();

  // ── 結果は“この瞬間”に確定（障眼法：見せている間に裏では決まっている） ──
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

  // 5〜8秒の中でランダムに総尺を決める（毎回わずかに違う“間”）
  const total = 5600 + Math.random() * 2000; // 5.6〜7.6s
  const t0 = performance.now();

  const phases = [
    { at: 0.00, cls: "phase-enter", text: "星々が囁きはじめています…" },
    { at: 0.14, cls: "phase-wheel", text: "黄道十二宮が、ゆっくりと目を覚ましました" },
    { at: 0.34, cls: "phase-wheel", text: "ふたつの星が、たがいに惹かれ合っています…" },
    { at: 0.52, cls: "phase-bind",  text: "ふたりの運命の糸を、そっと結んでいます…" },
    { at: 0.74, cls: "phase-read",  text: "星詠みが、ふたりの相性を読み解いています…" },
    { at: 0.90, cls: "phase-read",  text: "まもなく、星のこたえが降りてきます ✦" },
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

// 四元素の相性（0〜1）
const ELEMENT_AFFINITY = {
  fire:  { fire: 0.85, air: 0.92, earth: 0.5,  water: 0.45 },
  earth: { earth: 0.85, water: 0.92, air: 0.55, fire: 0.5 },
  air:   { air: 0.85, fire: 0.92, water: 0.6,  earth: 0.55 },
  water: { water: 0.85, earth: 0.92, air: 0.6, fire: 0.45 },
};

function computeCompatibility(nameL, keyL, nameR, keyR) {
  const zL = findZodiac(keyL), zR = findZodiac(keyR);
  // 順不同で同じ結果になるよう、名前＋星座の組を整列して結合
  const a = nameL + "@" + keyL, b = nameR + "@" + keyR;
  const seed = [a, b].sort().join("|");
  const h = hashString(seed);

  const nameNoise = (h % 1000) / 1000;          // 0〜1
  const affinity = ELEMENT_AFFINITY[zL.element][zR.element];
  const sameSign = keyL === keyR ? 0.06 : 0;

  // 元素相性7割＋名前ゆらぎ3割
  let raw = affinity * 0.7 + nameNoise * 0.3 + sameSign;
  raw = Math.max(0, Math.min(1, raw));
  const score = Math.round(44 + raw * 55); // 44〜99

  return {
    mode: "zodiac",
    score, nameL, nameR, zL, zR,
    affinity,
    verdict: pickVerdict(score),
    message: pickMessage(score, zL, zR, h),
    aspect: aspectLabel(zL, zR),
  };
}

/* 名前だけの相性（ことだまの響き）。星座を使わず、
   ふたつの名前のハッシュから安定したスコアを導く。 */
function computeByName(nameL, nameR) {
  const seed = [nameL, nameR].sort().join("|");
  const h = hashString(seed);
  const h2 = hashString(seed + "✦");

  const noise = (h % 1000) / 1000;            // 0〜1
  const resonance = (h2 % 1000) / 1000;       // 0〜1（ことだまの共鳴）
  const sameName = nameL === nameR ? 0.05 : 0;

  let raw = noise * 0.5 + resonance * 0.5 + sameName;
  raw = Math.max(0, Math.min(1, raw));
  const score = Math.round(44 + raw * 55);    // 44〜99

  return {
    mode: "name",
    score, nameL, nameR, zL: null, zR: null,
    verdict: pickVerdict(score),
    message: pickMessage(score, null, null, h),
    aspect: nameResonanceLabel(score),
  };
}

function nameResonanceLabel(score) {
  if (score >= 92) return "ことだまが、ぴたりと重なり合う";
  if (score >= 82) return "ふたつの名が、やさしく響き合う";
  if (score >= 72) return "名の調べが、心地よく溶け合う";
  if (score >= 60) return "ふたつの音が、寄り添いはじめる";
  return "名の響きが、少しずつ近づいてゆく";
}

function pickVerdict(s) {
  if (s >= 92) return "運命の赤い糸 ─ 最高の相性";
  if (s >= 82) return "星も微笑む ─ とても良い相性";
  if (s >= 72) return "心かよう ─ 良い相性";
  if (s >= 60) return "歩み寄りで深まる相性";
  return "ゆっくり育てていく相性";
}

function aspectLabel(zL, zR) {
  const eL = ELEMENT_META[zL.element].jp, eR = ELEMENT_META[zR.element].jp;
  if (zL.element === zR.element) return `${eL}どうしの共鳴`;
  const pair = [zL.element, zR.element];
  const harmonic = (pair.includes("fire") && pair.includes("air")) ||
                   (pair.includes("water") && pair.includes("earth"));
  return harmonic ? `${eL}と${eR}の調和` : `${eL}と${eR}の引き合い`;
}

const MESSAGES = {
  high: [
    "出会うべくして出会ったふたり。互いの存在が、相手の世界をやわらかく照らします。言葉にしなくても伝わる安心感が、何よりの宝物。",
    "星々もそっと祝福する関係。違いさえも愛おしく感じられ、一緒にいるほど深まっていく絆です。",
    "磁石のように惹かれ合う相性。困難な夜ほど寄り添い、ふたりでひとつの光になれるでしょう。",
  ],
  mid: [
    "穏やかに育っていく相性。焦らず、相手のペースを尊重することで、信頼はゆっくり確かに根を張ります。",
    "ときに価値観の違いを感じても、それは互いを広げる扉。素直な言葉が、ふたりの距離をぐっと縮めます。",
    "心地よい風のような関係。小さな「ありがとう」を重ねるほど、ふたりの時間は温かく彩られていきます。",
  ],
  low: [
    "今はまだ手探りでも、だからこそ伸びしろは無限大。違いを面白がる心が、ふたりを強く結びます。",
    "ゆっくり時間をかけて育てるほど深まる縁。相手の小さな優しさに気づける人が、この相性を花ひらかせます。",
    "最初はすれ違っても、理解しようとする想いが奇跡を起こします。星は、歩み寄るふたりに味方します。",
  ],
};

function pickMessage(score, zL, zR, h) {
  const bucket = score >= 80 ? "high" : score >= 64 ? "mid" : "low";
  const arr = MESSAGES[bucket];
  return arr[h % arr.length];
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
  document.getElementById("score-label").textContent = "相性";

  if (o.mode === "zodiac") {
    const emL = ELEMENT_META[o.zL.element], emR = ELEMENT_META[o.zR.element];
    document.getElementById("result-aspects").innerHTML = `
      <div class="aspect"><b>${o.zL.glyph}</b><span>${o.zL.jp}</span><div class="el">${emL.jp}の星</div></div>
      <div class="aspect"><b>✧</b><span>${o.aspect}</span><div class="el">&nbsp;</div></div>
      <div class="aspect"><b>${o.zR.glyph}</b><span>${o.zR.jp}</span><div class="el">${emR.jp}の星</div></div>`;
  } else {
    document.getElementById("result-aspects").innerHTML = `
      <div class="aspect"><b>${escapeHTML(firstChar(o.nameL))}</b><span>${escapeHTML(o.nameL)}</span><div class="el">&nbsp;</div></div>
      <div class="aspect"><b>✧</b><span>${o.aspect}</span><div class="el">ことだまの響き</div></div>
      <div class="aspect"><b>${escapeHTML(firstChar(o.nameR))}</b><span>${escapeHTML(o.nameR)}</span><div class="el">&nbsp;</div></div>`;
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
