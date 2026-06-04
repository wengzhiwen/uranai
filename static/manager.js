/* ============================================================
   占いワークスペース管理 — クライアントロジック
   ============================================================ */

(function () {
  "use strict";
  "use strict";

  // ── i18n ──────────────────────────────────────────────
  let _lang = localStorage.getItem("mgr_lang") || "ja";
  let _translations = {};

  async function loadLang(lang) {
    if (_translations._lang === lang) return;
    const resp = await fetch(`/i18n/${lang}.json`);
    _translations = await resp.json();
    _translations._lang = lang;
  }

  function applyLang(lang) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (_translations[key]) el.textContent = _translations[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (_translations[key]) el.placeholder = _translations[key];
    });
    document.documentElement.lang = lang;
    // Update active button
    document.querySelectorAll(".lang-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.lang === lang);
    });
  }

  function t(key) {
    return _translations[key] || key;
  }

  const SKINS = [
    {
      id: "royal-violet",
      swatches: ["#2a174c", "#e8c97d"],
      tone: { ja: "紫 × ゴールド", zh: "紫 × 金" },
      name: { ja: "紫金ミラージュ", zh: "紫金幻星" },
    },
    {
      id: "starry-navy",
      swatches: ["#0e2b4b", "#e0ba62"],
      tone: { ja: "ネイビー × ゴールド", zh: "海军蓝 × 金" },
      name: { ja: "星降る紺金", zh: "深海金谕" },
    },
    {
      id: "emerald-oracle",
      swatches: ["#0b3e27", "#d5b15b"],
      tone: { ja: "ダークグリーン × ゴールド", zh: "深绿 × 金" },
      name: { ja: "深森オラクル", zh: "森绿秘签" },
    },
    {
      id: "black-gold",
      swatches: ["#0c0b09", "#d6a94e"],
      tone: { ja: "ブラック × ゴールド", zh: "黑 × 金" },
      name: { ja: "黒金グリモワール", zh: "黑金秘卷" },
    },
    {
      id: "wine-covenant",
      swatches: ["#5b111d", "#e1bd68"],
      tone: { ja: "ワインレッド × ゴールド", zh: "酒红 × 金" },
      name: { ja: "ワインレッドの誓い", zh: "酒红誓约" },
    },
    {
      id: "teal-crystal",
      swatches: ["#0b4951", "#dfbd68"],
      tone: { ja: "ティール × ゴールド", zh: "青绿 × 金" },
      name: { ja: "ティール水晶", zh: "青晶预言" },
    },
    {
      id: "rose-twinkle",
      swatches: ["#f0448a", "#c48a10"],
      tone: { ja: "ピンク × ローズゴールド", zh: "粉色 × 玫瑰金" },
      name: { ja: "ローズ恋きらめき", zh: "桃金恋咒" },
    },
    {
      id: "silver-mirror",
      swatches: ["#ffffff", "#aeb5bd"],
      tone: { ja: "ホワイト × シルバー", zh: "白 × 银" },
      name: { ja: "白銀ムーンミラー", zh: "银白月镜" },
    },
    {
      id: "champagne-crown",
      swatches: ["#ffe28a", "#d59c20"],
      tone: { ja: "ゴールド × シャンパン", zh: "金 × 香槟金" },
      name: { ja: "シャンパン金環", zh: "香槟王冠" },
    },
  ];

  // ── state ─────────────────────────────────────────────
  let _workspace = null;
  let _socket = null;
  let _pageConnected = false;
  let _launchMode = "name";
  let _launchCooldown = false;
  let _rerunCooldown = false;
  let _skinId = "royal-violet";

  // ── DOM refs ──────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  // ── init ──────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async () => {
    await loadLang(_lang);
    applyLang(_lang);
    bindLangSwitch();
    bindLanding();
    // Check if already logged in
    try {
      const resp = await api("GET", "/api/workspace/info");
      if (resp.ok) {
        const data = await resp.json();
        _workspace = data.workspace;
        enterDashboard();
      }
    } catch {
      // Not logged in, show landing
    }
  });

  // ── language switching ────────────────────────────────

  function bindLangSwitch() {
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        _lang = btn.dataset.lang;
        localStorage.setItem("mgr_lang", _lang);
        await loadLang(_lang);
        applyLang(_lang);
        // Re-render records if on dashboard
        if (_workspace) {
          renderSkinOptions();
          refreshRecords();
        }
      });
      btn.classList.toggle("active", btn.dataset.lang === _lang);
    });
  }

  // ── landing ───────────────────────────────────────────

  function bindLanding() {
    $("btn-show-create").addEventListener("click", () => {
      $("form-create").style.display = "flex";
      $("form-join").style.display = "none";
      $("code-reveal").style.display = "none";
      $("landing-error").textContent = "";
    });

    $("btn-show-join").addEventListener("click", () => {
      $("form-join").style.display = "flex";
      $("form-create").style.display = "none";
      $("code-reveal").style.display = "none";
      $("landing-error").textContent = "";
      $("input-join-code").focus();
    });

    $("form-create").addEventListener("submit", async (e) => {
      e.preventDefault();
      $("landing-error").textContent = "";
      try {
        const resp = await api("POST", "/api/workspace/create");
        const data = await resp.json();
        $("form-create").style.display = "none";
        $("code-reveal").style.display = "flex";
        $("new-code-text").textContent = data.access_code;
        _workspace = data.workspace;
      } catch (err) {
        $("landing-error").textContent = err.message || "Error";
      }
    });

    $("form-join").addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = $("input-join-code").value.trim();
      if (!code) return;
      $("landing-error").textContent = "";
      try {
        const resp = await api("POST", "/api/workspace/join", {
          access_code: code,
        });
        if (!resp.ok) {
          const data = await resp.json();
          $("landing-error").textContent = data.error || "Error";
          return;
        }
        const data = await resp.json();
        _workspace = data.workspace;
        enterDashboard();
      } catch (err) {
        $("landing-error").textContent = err.message || "Error";
      }
    });

    $("btn-copy-code").addEventListener("click", () => {
      copyText($("new-code-text").textContent);
      toast("Copied!");
    });

    $("btn-go-dash").addEventListener("click", () => enterDashboard());
  }

  // ── dashboard ─────────────────────────────────────────

  function enterDashboard() {
    $("landing-screen").style.display = "none";
    $("dash-screen").style.display = "block";

    // Fill workspace info
    $("alias-input").value = _workspace.alias || "";
    const url = buildDivinationUrl(_workspace.path_token);
    $("divination-url").value = url;
    $("btn-open-url").href = url;
    _skinId = localStorage.getItem(skinStorageKey()) || "royal-violet";
    renderSkinOptions();

    setupSocket();
    bindDashboard();
    refreshRecords();
  }

  function buildDivinationUrl(pathToken) {
    return `${location.origin}/d/${pathToken}`;
  }

  function bindDashboard() {
    // Alias save
    $("btn-save-alias").addEventListener("click", async () => {
      const alias = $("alias-input").value.trim();
      await api("PUT", "/api/workspace/alias", { alias });
      toast(t("dash.alias_save"));
    });

    // Copy URL
    $("btn-copy-url").addEventListener("click", () => {
      copyText($("divination-url").value);
      toast("Copied!");
    });

    // Logout
    $("btn-logout").addEventListener("click", () => {
      // Clear session by posting to join with invalid code (simple approach)
      // Or just reload to reset session cookie
      fetch("/api/workspace/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_code: "__logout__" }),
      }).finally(() => location.reload());
    });

    // Reset button
    $("btn-reset").addEventListener("click", async () => {
      await api("POST", "/api/divination/reset", { mode: _launchMode });
    });

    // Mode toggle
    document.querySelectorAll("#launch-form .mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        _launchMode = btn.dataset.mode;
        document.querySelectorAll("#launch-form .mode-btn").forEach((b) =>
          b.classList.toggle("active", b === btn)
        );
        $("zodiac-fields").style.display =
          _launchMode === "zodiac" ? "grid" : "none";
      });
    });

    // Launch form
    $("launch-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (_launchCooldown) return;
      $("launch-error").textContent = "";
      const body = {
        mode: _launchMode,
        name_left: $("launch-name-left").value.trim(),
        name_right: $("launch-name-right").value.trim(),
      };
      if (_launchMode === "zodiac") {
        body.zodiac_left = $("launch-zodiac-left").value;
        body.zodiac_right = $("launch-zodiac-right").value;
      }
      const scoreVal = $("launch-score").value;
      if (scoreVal !== "") {
        body.score = parseInt(scoreVal, 10);
        if (isNaN(body.score) || body.score < 0 || body.score > 100) {
          $("launch-error").textContent = "Score must be 0-100";
          return;
        }
      }
      try {
        const resp = await api("POST", "/api/divination/launch", body);
        if (!resp.ok) {
          const data = await resp.json();
          $("launch-error").textContent = data.error || "Error";
          return;
        }
        // Clear score field, keep names
        $("launch-score").value = "";
        refreshRecords();
        toast("✦");
        // 5-second cooldown via flag + button style
        _launchCooldown = true;
        const submitBtn = $("launch-form").querySelector('[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.removeAttribute("data-i18n");
        let remaining = 5;
        submitBtn.textContent = `${remaining}`;
        const timer = setInterval(() => {
          remaining--;
          const btn = $("launch-form").querySelector('[type="submit"]');
          if (remaining <= 0) {
            clearInterval(timer);
            _launchCooldown = false;
            btn.disabled = false;
            btn.setAttribute("data-i18n", "launch.btn_launch");
            btn.textContent = t("launch.btn_launch");
          } else {
            btn.textContent = `${remaining}`;
          }
        }, 1000);
      } catch (err) {
        $("launch-error").textContent = err.message || "Error";
      }
    });
  }

  // ── skin remote ──────────────────────────────────────

  function skinStorageKey() {
    return _workspace ? `mgr_skin_${_workspace.id}` : "mgr_skin";
  }

  function renderSkinOptions() {
    const grid = $("skin-grid");
    if (!grid) return;
    grid.innerHTML = SKINS.map((skin) => {
      const name = skin.name[_lang] || skin.name.ja;
      const tone = skin.tone[_lang] || skin.tone.ja;
      const active = skin.id === _skinId;
      const swatches = skin.swatches
        .map((color) => `<span class="skin-swatch" style="background:${color}"></span>`)
        .join("");
      return `<button type="button" class="skin-option${active ? " active" : ""}" data-skin="${skin.id}" role="radio" aria-checked="${active ? "true" : "false"}">
        <span class="skin-swatches">${swatches}</span>
        <span>
          <span class="skin-name">${esc(name)}</span>
          <span class="skin-tone">${esc(tone)}</span>
        </span>
      </button>`;
    }).join("");

    grid.querySelectorAll(".skin-option").forEach((btn) => {
      btn.addEventListener("click", async () => {
        _skinId = btn.dataset.skin;
        localStorage.setItem(skinStorageKey(), _skinId);
        renderSkinOptions();
        await sendSkin(_skinId);
      });
    });
  }

  async function sendSkin(skin, silent) {
    const resp = await api("POST", "/api/workspace/skin", { skin });
    if (!resp.ok) {
      if (!silent) toast("Error");
      return;
    }
    if (!silent) toast("✦");
  }

  // ── records ───────────────────────────────────────────

  async function refreshRecords() {
    const resp = await api("GET", "/api/divination/recent");
    if (!resp.ok) return;
    const data = await resp.json();
    renderRecords(data.records);
  }

  function renderRecords(records) {
    const wrap = $("records-wrap");
    if (!records.length) {
      wrap.innerHTML = `<p class="empty-hint" data-i18n="records.empty">${t("records.empty")}</p>`;
      return;
    }

    const modeLabel = (m) => (m === "zodiac" ? t("records.mode_zodiac") : t("records.mode_name"));

    let html = `<table>
      <thead><tr>
        <th data-i18n="records.col_time">${t("records.col_time")}</th>
        <th data-i18n="records.col_mode">${t("records.col_mode")}</th>
        <th data-i18n="records.col_names">${t("records.col_names")}</th>
        <th data-i18n="records.col_score">${t("records.col_score")}</th>
        <th data-i18n="records.col_miracle">${t("records.col_miracle")}</th>
        <th data-i18n="records.col_action">${t("records.col_action")}</th>
      </tr></thead><tbody>`;

    records.forEach((r) => {
      const ts = r.created_at ? new Date(r.created_at).toLocaleString() : "";
      const names = `${esc(r.name_left)} × ${esc(r.name_right)}`;
      let miracleHtml = "";
      if (r.miracle === "high")
        miracleHtml = `<span class="miracle-badge high">★ HIGH</span>`;
      else if (r.miracle === "low")
        miracleHtml = `<span class="miracle-badge low">☆ LOW</span>`;
      if (r.score_overridden)
        miracleHtml += ` <span class="miracle-badge overridden">${t("records.overridden")}</span>`;

      html += `<tr>
        <td>${esc(ts)}</td>
        <td>${esc(modeLabel(r.mode))}</td>
        <td>${names}</td>
        <td class="score-cell">${r.score}%</td>
        <td>${miracleHtml}</td>
        <td><button class="btn-rerun" data-id="${r.id}" data-i18n="records.btn_rerun">${t("records.btn_rerun")}</button></td>
      </tr>`;
    });

    html += "</tbody></table>";
    wrap.innerHTML = html;

    // Apply cooldown state to freshly rendered buttons
    if (_rerunCooldown) {
      wrap.querySelectorAll(".btn-rerun").forEach((b) => { b.disabled = true; });
    }

    // Bind rerun buttons
    wrap.querySelectorAll(".btn-rerun").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (_rerunCooldown) return;
        _rerunCooldown = true;
        const id = btn.dataset.id;
        await api("POST", `/api/divination/rerun/${id}`);
        refreshRecords();
        toast("✦");
        // 5-second cooldown: refreshRecords replaces DOM, so track via flag + update whichever btn is active
        let remaining = 5;
        const tick = () => {
          remaining--;
          if (remaining <= 0) {
            _rerunCooldown = false;
            wrap.querySelectorAll(".btn-rerun").forEach((b) => { b.disabled = false; b.removeAttribute("data-i18n-disabled"); });
          } else {
            wrap.querySelectorAll(".btn-rerun").forEach((b) => { b.disabled = true; });
            setTimeout(tick, 1000);
          }
        };
        wrap.querySelectorAll(".btn-rerun").forEach((b) => { b.disabled = true; });
        setTimeout(tick, 1000);
      });
    });
  }

  // ── socket ────────────────────────────────────────────

  function setupSocket() {
    if (_socket) return;
    _socket = io("/mgr");

    function joinRoom() {
      _socket.emit("join", { workspace_id: _workspace.id });
    }

    _socket.on("connect", joinRoom);
    _socket.on("reconnect", joinRoom);

    _socket.on("page_connected", () => {
      _pageConnected = true;
      updatePageStatus(true);
      sendSkin(_skinId, true);
    });

    _socket.on("page_disconnected", () => {
      _pageConnected = false;
      updatePageStatus(false);
    });

    _socket.connect();
  }

  function updatePageStatus(connected) {
    const dot = $("page-status-dot");
    const text = $("page-status-text");
    dot.classList.toggle("connected", connected);
    text.classList.toggle("connected", connected);
    text.textContent = connected ? t("dash.page_connected") : t("dash.page_disconnected");
  }

  // ── helpers ───────────────────────────────────────────

  async function api(method, path, body) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    };
    if (body) opts.body = JSON.stringify(body);
    return fetch(path, opts);
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function toast(msg) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.remove("show");
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => el.classList.remove("show"), 2000);
  }
})();
