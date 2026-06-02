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

  // ── state ─────────────────────────────────────────────
  let _workspace = null;
  let _socket = null;
  let _pageConnected = false;
  let _launchMode = "name";

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
        if (_workspace) refreshRecords();
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
      } catch (err) {
        $("launch-error").textContent = err.message || "Error";
      }
    });
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

    // Bind rerun buttons
    wrap.querySelectorAll(".btn-rerun").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        await api("POST", `/api/divination/rerun/${id}`);
        refreshRecords();
        toast("✦");
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
