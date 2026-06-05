/* ============================================================
   workspace-client.js — リモート占卜指令の受信と実行
   script.js の上にオーバーレイとして動作。
   多言語対応：ja / zh-TW / ko / vi
   ============================================================ */

(function () {
  "use strict";

  const PATH_TOKEN = window.__WS_PATH_TOKEN__;
  const WS_ALIAS = window.__WS_ALIAS__;
  const SKIN_IDS = new Set([
    "royal-violet", "starry-navy", "emerald-oracle",
    "black-gold", "wine-covenant", "teal-crystal",
    "rose-twinkle", "silver-mirror", "champagne-crown",
  ]);

  if (!PATH_TOKEN) return; // Not a workspace page

  // ── i18n ──────────────────────────────────────────────
  let _wsLang = window.__WS_LANG__ || "ja";
  let _wsTranslations = {};
  let _i18nReady = false;

  async function loadWsLang(lang) {
    try {
      const resp = await fetch(`/i18n/${lang}.json`);
      _wsTranslations = await resp.json();
    } catch (e) {
      console.warn("[i18n] load failed:", e);
    }
    _i18nReady = true;
  }

  function wt(key) {
    return _wsTranslations[key] || key;
  }

  function applyWsLang() {
    window.__URANAI_T__ = wt;
    localizeZodiacData();
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (_wsTranslations[key]) el.textContent = _wsTranslations[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (_wsTranslations[key]) el.placeholder = _wsTranslations[key];
    });
    document.documentElement.lang = _wsLang === "zh-TW" ? "zh-Hant" : _wsLang;
    updateOverlayText();
    refreshZodiacChrome();
  }

  // Localized zodiac/element name helpers
  function zodiacDisplayName(z) {
    if (!z) return "";
    return z[_wsLang] || z.jp || z.roma || "";
  }
  function elementDisplayName(em) {
    if (!em) return "";
    return em[_wsLang] || em.jp || "";
  }

  function rememberOriginal(obj, key) {
    const prop = `__original_${key}`;
    if (!Object.prototype.hasOwnProperty.call(obj, prop)) {
      Object.defineProperty(obj, prop, {
        value: obj[key],
        writable: true,
        enumerable: false,
      });
    }
    return obj[prop];
  }

  function localizeZodiacData() {
    if (typeof ZODIAC !== "undefined") {
      ZODIAC.forEach((z) => {
        const original = rememberOriginal(z, "jp");
        z.jp = _wsLang === "ja" ? original : (z[_wsLang] || original);
      });
    }
    if (typeof ELEMENT_META !== "undefined") {
      Object.values(ELEMENT_META).forEach((em) => {
        const original = rememberOriginal(em, "jp");
        em.jp = _wsLang === "ja" ? original : (em[_wsLang] || original);
      });
    }
  }

  function refreshZodiacChrome() {
    if (typeof ZODIAC !== "undefined") {
      document.querySelectorAll(".zodiac-cell").forEach((cell) => {
        const z = ZODIAC.find((item) => item.key === cell.dataset.key);
        if (!z) return;
        const label = zodiacDisplayName(z);
        cell.title = label;
        cell.setAttribute("aria-label", label);
      });
    }
    document.querySelectorAll(".zodiac-prev").forEach((btn) => {
      btn.setAttribute("aria-label", wt("ws.zodiac_prev"));
    });
    document.querySelectorAll(".zodiac-next").forEach((btn) => {
      btn.setAttribute("aria-label", wt("ws.zodiac_next"));
    });
    document.querySelectorAll(".zodiac-viewport").forEach((viewport) => {
      viewport.setAttribute("aria-label", wt("ws.zodiac_slider"));
    });
    if (typeof updateSide !== "undefined") {
      updateSide("left");
      updateSide("right");
    }
    if (typeof updatePicker !== "undefined") {
      updatePicker("left", false);
      updatePicker("right", false);
    }
  }

  // Apply skin immediately
  applySkin(sessionStorage.getItem(skinStorageKey()) || "royal-violet");

  // ── boot: load i18n then set up page ──────────────────
  loadWsLang(_wsLang).then(() => {
    applyWsLang();
    setupOverlay();
    overrideScriptGlobals();
  });

  // ── subtitle ─────────────────────────────────────────
  const subtitleEl = document.getElementById("ws-subtitle");
  if (WS_ALIAS && subtitleEl) {
    subtitleEl.textContent = "― " + WS_ALIAS + " ―";
    subtitleEl.removeAttribute("data-i18n"); // alias overrides i18n
  }

  // ── audio unlock overlay ──────────────────────────────
  function setupOverlay() {
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", zIndex: "10000",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(13,15,26,0.92)", cursor: "pointer",
    });
    overlay.innerHTML = `
      <div style="text-align:center; color:#e8e6f0;">
        <div style="font-size:48px; margin-bottom:16px;">✦</div>
        <div class="audio-overlay-title" style="font-family:'Shippori Mincho',serif; font-size:22px; margin-bottom:8px;">
          ${wt("ws.overlay_title")}
        </div>
        <div class="audio-overlay-click" style="font-size:14px; opacity:0.7;">
          ${wt("ws.overlay_click")}
        </div>
      </div>`;
    overlay.addEventListener("click", () => {
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
  }

  function updateOverlayText() {
    document.querySelectorAll(".audio-overlay-title").forEach((el) => {
      el.textContent = wt("ws.overlay_title");
    });
    document.querySelectorAll(".audio-overlay-click").forEach((el) => {
      el.textContent = wt("ws.overlay_click");
    });
  }

  // ── override script.js globals for i18n ───────────────

  function overrideScriptGlobals() {
    // Intercept fetch to inject lang parameter for local divination
    const _origFetch = window.fetch;
    window.fetch = function (url, opts) {
      if (typeof url === "string" && url.includes("/api/divination") && opts && opts.body) {
        try {
          const body = JSON.parse(opts.body);
          body.lang = _wsLang;
          opts = Object.assign({}, opts, { body: JSON.stringify(body) });
        } catch (e) { /* ignore parse errors */ }
      }
      return _origFetch.call(this, url, opts);
    };

    // Override showResult to use i18n-aware rendering
    if (typeof showResult !== "undefined") {
      const _origShowResult = showResult;
      showResult = function (o) {
        // Use our i18n-aware result renderer
        showI18nResult(o);
      };
    }

    // Override refreshReady for localized hint text
    if (typeof refreshReady !== "undefined") {
      refreshReady = function () {
        const ready = zodiacReady() && namesFilled();
        const btn = document.getElementById("divine-btn");
        btn.classList.toggle("ready", !!ready);
        const hint = document.getElementById("hint-text");
        const need = state.mode === "zodiac"
          ? wt("ws.hint_both")
          : wt("ws.hint_name_only");
        hint.textContent = ready ? wt("ws.hint_ready") : need;
      };
      // Re-bind input events to trigger our override
      document.getElementById("name-left").addEventListener("input", refreshReady);
      document.getElementById("name-right").addEventListener("input", refreshReady);
    }
  }

  // ── i18n-aware result rendering (replaces showResult) ──

  function showI18nResult(o) {
    const res = document.getElementById("result");

    // Names
    document.getElementById("result-names").innerHTML =
      `<b>${escapeHTML(o.nameL)}</b><span class="heart">♡</span><b>${escapeHTML(o.nameR)}</b>`;

    // Verdict & message (already localized by backend)
    document.getElementById("result-verdict").textContent = o.verdict;
    document.getElementById("result-message").textContent = o.message;
    document.getElementById("score-label").textContent = wt("ws.score_label");

    // Aspects
    const aspectsEl = document.getElementById("result-aspects");
    if (o.mode === "zodiac" && o.zL && o.zR) {
      const zL = resolveZodiac(o.zL);
      const zR = resolveZodiac(o.zR);
      const emL = ELEMENT_META[zL.element];
      const emR = ELEMENT_META[zR.element];
      const sunLabel = o.sunSign
        ? wt("ws.sun_current").replace("{0}", o.sunSign.glyph).replace("{1}", zodiacDisplayName(o.sunSign))
        : " ";
      aspectsEl.className = "result-aspects zodiac-aspects";
      aspectsEl.innerHTML = `
        <div class="aspect aspect-side"><b>${zL.glyph}</b><span>${zodiacDisplayName(zL)}</span><div class="el">${wt("ws.element_of").replace("{0}", elementDisplayName(emL))}</div></div>
        <div class="aspect aspect-center"><b>✧</b><span>${o.aspect}</span><div class="el">${sunLabel}</div></div>
        <div class="aspect aspect-side"><b>${zR.glyph}</b><span>${zodiacDisplayName(zR)}</span><div class="el">${wt("ws.element_of").replace("{0}", elementDisplayName(emR))}</div></div>`;
    } else {
      aspectsEl.className = "result-aspects name-aspects";
      aspectsEl.innerHTML = `
        <div class="aspect aspect-side"><b>${escapeHTML(firstChar(o.nameL))}</b><span>${escapeHTML(o.nameL)}</span><div class="el">&nbsp;</div></div>
        <div class="aspect aspect-center"><b>✧</b><span>${o.aspect}</span><div class="el">${wt("ws.name_resonance")}</div></div>
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

  socket.on("lang_update", async (data) => {
    _wsLang = data.lang;
    await loadWsLang(_wsLang);
    applyWsLang();
    // Re-trigger refreshReady to update hint text
    if (typeof refreshReady !== "undefined") refreshReady();
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
    const ritual = document.getElementById("ritual");
    ritual.classList.remove("active", "phase-enter", "phase-wheel", "phase-bind", "phase-read");
    ritual.setAttribute("aria-hidden", "true");
    stopRitualParticles();
    if (ritualAudio) {
      ritualAudio.pause();
      ritualAudio.currentTime = 0;
    }

    const res = document.getElementById("result");
    res.classList.remove("active");
    res.setAttribute("aria-hidden", "true");

    document.getElementById("ring-fill").style.strokeDashoffset = "603";
    document.getElementById("score-value").textContent = "0";

    document.getElementById("stage").style.display = "";
    setMode(mode);

    document.getElementById("name-left").value = "";
    document.getElementById("name-right").value = "";
    if (mode === "zodiac") {
      const selL = document.getElementById("zodiac-left");
      const selR = document.getElementById("zodiac-right");
      if (selL) selL.selectedIndex = 0;
      if (selR) selR.selectedIndex = 0;
    }
  }

  // ── zodiac helper ────────────────────────────────────
  function resolveZodiac(z) {
    return typeof z === "string" ? findZodiac(z) : z;
  }

  // ── remote divination executor ────────────────────────

  async function executeRemoteDivination(outcome) {
    const res = document.getElementById("result");
    res.classList.remove("active");
    res.setAttribute("aria-hidden", "true");
    document.getElementById("ring-fill").style.strokeDashoffset = "603";
    document.getElementById("score-value").textContent = "0";

    const stage = document.getElementById("stage");
    stage.style.display = "";

    if (outcome.mode === "zodiac" && outcome.zL && outcome.zR) {
      setMode("zodiac");
      if (typeof selectZodiac === "function") {
        const zLKey = typeof outcome.zL === "string" ? outcome.zL : outcome.zL.key;
        const zRKey = typeof outcome.zR === "string" ? outcome.zR : outcome.zR.key;
        selectZodiac("left", zLKey);
        selectZodiac("right", zRKey);
      }
    } else {
      setMode("name");
    }

    const nameLeft = document.getElementById("name-left");
    const nameRight = document.getElementById("name-right");
    nameLeft.value = "";
    nameRight.value = "";

    const totalChars = (outcome.nameL || "").length + (outcome.nameR || "").length;
    const targetDuration = 1500;
    const perCharDelay = totalChars > 0 ? Math.min(120, Math.max(40, targetDuration / totalChars)) : 40;

    await typewriterFill(nameLeft, outcome.nameL || "", perCharDelay);
    await sleep(120);
    await typewriterFill(nameRight, outcome.nameR || "", perCharDelay);
    await sleep(200);

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
    ritualAudio.play().catch((e) => console.warn("[audio] play failed:", e));

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
      { at: 0.0,  cls: "phase-enter", text: wt("ws.ritual_phase1") },
      { at: 0.12, cls: "phase-wheel", text: wt("ws.ritual_phase2") },
      { at: 0.42, cls: "phase-bind",  text: wt("ws.ritual_phase3") },
      { at: 0.68, cls: "phase-read",  text: wt("ws.ritual_phase4") },
      { at: 0.88, cls: "phase-read",  text: wt("ws.ritual_phase5") },
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
      showI18nResult(outcome);
    }, 650);
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
