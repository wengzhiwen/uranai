/* ============================================================
   workspace-client.js — リモート占卜指令の受信と実行
   script.js の上にオーバーレイとして動作。
   既存の静的占い機能には一切干渉しない。
   ============================================================ */

(function () {
  "use strict";

  const PATH_TOKEN = window.__WS_PATH_TOKEN__;
  const WS_ALIAS = window.__WS_ALIAS__;
  const SKIN_IDS = new Set([
    "royal-violet",
    "starry-navy",
    "emerald-oracle",
    "black-gold",
    "wine-covenant",
    "teal-crystal",
    "rose-twinkle",
    "silver-mirror",
    "champagne-crown",
  ]);

  if (!PATH_TOKEN) return; // Not a workspace page
  applySkin(sessionStorage.getItem(skinStorageKey()) || "royal-violet");

  // ── subtitle ─────────────────────────────────────────
  const subtitleEl = document.getElementById("ws-subtitle");
  if (WS_ALIAS && subtitleEl) {
    subtitleEl.textContent = "― " + WS_ALIAS + " ―";
  }

  // ── audio unlock overlay ──────────────────────────────
  // 直播准备阶段点击一次即可解锁音频，之后整个会话期间无需再操作
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "10000",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(13,15,26,0.92)", cursor: "pointer",
  });
  overlay.innerHTML = `
    <div style="text-align:center; color:#e8e6f0;">
      <div style="font-size:48px; margin-bottom:16px;">✦</div>
      <div style="font-family:'Shippori Mincho',serif; font-size:22px; margin-bottom:8px;">
        絆占い
      </div>
      <div style="font-size:14px; opacity:0.7;">
        クリックして開始
      </div>
    </div>`;
  overlay.addEventListener("click", () => {
    // 解锁音频：播放并立即暂停
    if (typeof audioPool !== "undefined" && audioPool.length) {
      const a = audioPool[0];
      a.currentTime = 0;
      a.play().then(() => a.pause()).catch(() => {});
    }
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity .5s";
    setTimeout(() => overlay.remove(), 500);
  });
  document.body.appendChild(overlay);

  // ── socket ────────────────────────────────────────────
  const socket = io("/ws");

  function joinRoom() {
    socket.emit("join", { path_token: PATH_TOKEN });
    console.log("[ws] joined room for", PATH_TOKEN);
  }

  socket.on("connect", joinRoom);
  socket.on("reconnect", joinRoom);

  socket.on("alias_update", (data) => {
    if (subtitleEl && data.alias) {
      subtitleEl.textContent = "― " + data.alias + " ―";
    }
  });

  socket.on("skin_update", (data) => {
    applySkin(data.skin);
  });

  socket.on("divination_command", (payload) => {
    console.log("[ws] divination_command received", payload);
    if (payload.action === "reset") {
      executeRemoteReset(payload.mode || "name");
    } else {
      executeRemoteDivination(payload);
    }
  });

  // ── remote reset ──────────────────────────────────────

  function executeRemoteReset(mode) {
    // Stop any ongoing ritual
    const ritual = document.getElementById("ritual");
    ritual.classList.remove("active", "phase-enter", "phase-wheel", "phase-bind", "phase-read");
    ritual.setAttribute("aria-hidden", "true");
    stopRitualParticles();
    if (ritualAudio) {
      ritualAudio.pause();
      ritualAudio.currentTime = 0;
    }

    // Hide result
    const res = document.getElementById("result");
    res.classList.remove("active");
    res.setAttribute("aria-hidden", "true");

    // Reset score ring
    document.getElementById("ring-fill").style.strokeDashoffset = "603";
    document.getElementById("score-value").textContent = "0";

    // Show stage and switch mode
    document.getElementById("stage").style.display = "";
    setMode(mode);

    // Clear inputs
    document.getElementById("name-left").value = "";
    document.getElementById("name-right").value = "";
    if (mode === "zodiac") {
      const selL = document.getElementById("zodiac-left");
      const selR = document.getElementById("zodiac-right");
      if (selL) selL.selectedIndex = 0;
      if (selR) selR.selectedIndex = 0;
    }
  }

  // ── zodiac helper: accept both string keys and full objects ──
  function resolveZodiac(z) {
    return typeof z === "string" ? findZodiac(z) : z;
  }

  // ── remote divination executor ────────────────────────

  async function executeRemoteDivination(outcome) {
    // 1) Make sure result overlay is hidden and stage is visible
    const res = document.getElementById("result");
    res.classList.remove("active");
    res.setAttribute("aria-hidden", "true");
    document.getElementById("ring-fill").style.strokeDashoffset = "603";
    document.getElementById("score-value").textContent = "0";

    const stage = document.getElementById("stage");
    stage.style.display = "";

    // 2) Switch mode if needed
    if (outcome.mode === "zodiac" && outcome.zL && outcome.zR) {
      setMode("zodiac");
      // Select zodiac signs (extract key from full objects or use string directly)
      if (typeof selectZodiac === "function") {
        const zLKey = typeof outcome.zL === "string" ? outcome.zL : outcome.zL.key;
        const zRKey = typeof outcome.zR === "string" ? outcome.zR : outcome.zR.key;
        selectZodiac("left", zLKey);
        selectZodiac("right", zRKey);
      }
    } else {
      setMode("name");
    }

    // 3) Typewriter animation for names (1-2 seconds total)
    const nameLeft = document.getElementById("name-left");
    const nameRight = document.getElementById("name-right");
    nameLeft.value = "";
    nameRight.value = "";

    const totalChars = (outcome.nameL || "").length + (outcome.nameR || "").length;
    const targetDuration = 1500; // ms total for typewriter
    const perCharDelay = totalChars > 0 ? Math.min(120, Math.max(40, targetDuration / totalChars)) : 40;

    await typewriterFill(nameLeft, outcome.nameL || "", perCharDelay);
    await sleep(120);
    await typewriterFill(nameRight, outcome.nameR || "", perCharDelay);
    await sleep(200);

    // 4) Trigger divination with the pre-computed outcome
    // We'll start the ritual normally but intercept the result
    startRemoteRitual(outcome);
  }

  function typewriterFill(input, text, delay) {
    return new Promise((resolve) => {
      let i = 0;
      function type() {
        if (i < text.length) {
          input.value = text.substring(0, i + 1);
          i++;
          setTimeout(type, delay);
        } else {
          resolve();
        }
      }
      type();
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── ritual with pre-computed outcome ──────────────────

  function startRemoteRitual(outcome) {
    const nameL = outcome.nameL;
    const nameR = outcome.nameR;

    // Set up the ritual orbit bodies
    if (outcome.mode === "zodiac" && outcome.zL && outcome.zR) {
      document.getElementById("orbit-1").innerHTML = buildConstellationSVG(resolveZodiac(outcome.zL));
      document.getElementById("orbit-2").innerHTML = buildConstellationSVG(resolveZodiac(outcome.zR));
    } else {
      document.getElementById("orbit-1").innerHTML = buildNameOrbSVG(nameL, themeColor("--skin-score-high", "#f4a8c8"));
      document.getElementById("orbit-2").innerHTML = buildNameOrbSVG(nameR, themeColor("--skin-score-low", "#b9a4ff"));
    }

    const ritual = document.getElementById("ritual");
    ritual.classList.add("active");
    ritual.setAttribute("aria-hidden", "false");

    // Play BGM
    const loaded = audioPool.filter((a) => a.readyState >= 2);
    const track = (loaded.length ? loaded : audioPool)[
      Math.floor(Math.random() * (loaded.length || audioPool.length))
    ];
    if (ritualAudio) {
      ritualAudio.pause();
      ritualAudio.currentTime = 0;
    }
    ritualAudio = track;
    ritualAudio.currentTime = 0;
    ritualAudio.play().catch((e) => console.warn("[音效] 播放失败:", e));

    startRitualParticles();
    runRemoteRitualSequence(outcome);
  }

  function runRemoteRitualSequence(outcome) {
    const ritual = document.getElementById("ritual");
    const caption = document.getElementById("ritual-caption");
    const bar = document.getElementById("ritual-progress-bar");

    const total = 2000 + Math.random() * 1000;
    const t0 = performance.now();

    const phases = [
      { at: 0.0, cls: "phase-enter", text: "星々がささやきはじめています…" },
      { at: 0.12, cls: "phase-wheel", text: "黄道十二宮の導きをたどっています" },
      { at: 0.42, cls: "phase-bind", text: "運命の糸を、そっと結び合わせています…" },
      { at: 0.68, cls: "phase-read", text: "絆占いが、おふたりの相性を読み解いています…" },
      { at: 0.88, cls: "phase-read", text: "まもなく、鑑定結果をお届けします ✦" },
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

      let target = 0;
      for (let i = 0; i < phases.length; i++) if (prog >= phases[i].at) target = i;
      if (target !== phaseIdx) {
        phaseIdx = target;
        applyPhase(target);
      }

      if (prog < 1) {
        requestAnimationFrame(tick);
      } else {
        finishRemoteRitual(outcome);
      }
    }
    requestAnimationFrame(tick);
  }

  function finishRemoteRitual(outcome) {
    const ritual = document.getElementById("ritual");
    burstParticles(1.4);

    setTimeout(() => {
      ritual.classList.remove("active", "phase-enter", "phase-wheel", "phase-bind", "phase-read");
      ritual.setAttribute("aria-hidden", "true");
      stopRitualParticles();
      showRemoteResult(outcome);
    }, 650);
  }

  // ── show result from server-provided outcome ──────────

  function showRemoteResult(o) {
    const res = document.getElementById("result");

    // Names
    document.getElementById("result-names").innerHTML =
      `<b>${escapeHTML(o.nameL)}</b><span class="heart">♡</span><b>${escapeHTML(o.nameR)}</b>`;

    // Verdict & message
    document.getElementById("result-verdict").textContent = o.verdict;
    document.getElementById("result-message").textContent = o.message;
    document.getElementById("score-label").textContent = "相性度";

    // Aspects
    const aspectsEl = document.getElementById("result-aspects");
    if (o.mode === "zodiac" && o.zL && o.zR) {
      const zL = resolveZodiac(o.zL);
      const zR = resolveZodiac(o.zR);
      const emL = ELEMENT_META[zL.element];
      const emR = ELEMENT_META[zR.element];
      const sunLabel = o.sunSign ? `現在の太陽：${o.sunSign.glyph}${o.sunSign.jp}` : " ";
      aspectsEl.className = "result-aspects zodiac-aspects";
      aspectsEl.innerHTML = `
        <div class="aspect aspect-side"><b>${zL.glyph}</b><span>${zL.jp}</span><div class="el">${emL.jp}のエレメント</div></div>
        <div class="aspect aspect-center"><b>✧</b><span>${o.aspect}</span><div class="el">${sunLabel}</div></div>
        <div class="aspect aspect-side"><b>${zR.glyph}</b><span>${zR.jp}</span><div class="el">${emR.jp}のエレメント</div></div>`;
    } else {
      aspectsEl.className = "result-aspects name-aspects";
      aspectsEl.innerHTML = `
        <div class="aspect aspect-side"><b>${escapeHTML(firstChar(o.nameL))}</b><span>${escapeHTML(o.nameL)}</span><div class="el">&nbsp;</div></div>
        <div class="aspect aspect-center"><b>✧</b><span>${o.aspect}</span><div class="el">言霊の響き</div></div>
        <div class="aspect aspect-side"><b>${escapeHTML(firstChar(o.nameR))}</b><span>${escapeHTML(o.nameR)}</span><div class="el">&nbsp;</div></div>`;
    }

    res.classList.add("active");
    res.setAttribute("aria-hidden", "false");

    // Animate score ring
    const ring = document.getElementById("ring-fill");
    const circ = 2 * Math.PI * 96;
    ring.style.strokeDasharray = circ.toFixed(1);
    ring.style.strokeDashoffset = circ.toFixed(1);
    ring.style.stroke =
      o.score >= 80
        ? themeColor("--skin-score-high", "#f4a8c8")
        : o.score >= 64
          ? themeColor("--skin-score-mid", "#e8c97d")
          : themeColor("--skin-score-low", "#b9a4ff");

    requestAnimationFrame(() => {
      setTimeout(() => {
        ring.style.strokeDashoffset = (circ * (1 - o.score / 100)).toFixed(1);
        countUp(document.getElementById("score-value"), o.score, 2000);
      }, 250);
    });
  }

  function skinStorageKey() {
    return "ws_skin_" + PATH_TOKEN;
  }

  function applySkin(skin) {
    const id = SKIN_IDS.has(skin) ? skin : "royal-violet";
    document.body.dataset.skin = id;
    sessionStorage.setItem(skinStorageKey(), id);
  }

  function themeColor(name, fallback) {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return value || fallback;
  }
})();
