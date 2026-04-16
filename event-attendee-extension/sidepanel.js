// ── Constants ────────────────────────────────────────────────────────────────
const FREE_LIMIT = 20;
const DEFAULT_SUPABASE_URL = "https://vhemqgjwqjqgjqrnjhvm.supabase.co";
const DEFAULT_APP_URL = "https://prospectin.vercel.app";
const SYNC_INTERVAL_MS = 15000;
const SIGNIN_CALLBACK_PATH = "signin-callback.html";

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  attendees: [],
  viewMode: "detailed",
  attendeeLimit: 100,
  credits: 0,
  hasUnlimited: false,
  session: null,
  profile: null,
  pollTimer: null,
  pendingExportFormat: null,
  exportInProgress: false,
  config: {
    supabaseUrl: DEFAULT_SUPABASE_URL,
    supabaseAnonKey: "",
    appUrl: DEFAULT_APP_URL,
  },
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const statusEl = $("statusText");
const attendeeListEl = $("attendeeList");
const countBadgeEl = $("countBadge");
const crmSelectEl = $("crmSelect");
const accountBadgeEl = $("accountBadge");
const accountEmailEl = $("accountEmail");
const accountCreditsEl = $("accountCredits");
const historySectionEl = $("historySection");
const historyListEl = $("historyList");
const limitInputEl = $("attendeeLimitInput");

// auth modal
const authModalEl = $("authModal");
const authEmailEl = $("authEmail");
const authPasswordEl = $("authPassword");
const authErrorEl = $("authError");

// export modal
const exportModalEl = $("exportModal");
const exportModalSubEl = $("exportModalSub");
const exportTotalCountEl = $("exportTotalCount");
const exportCreditDescEl = $("exportCreditDesc");
const buyCreditsSection = $("buyCreditsSection");

// ── Wire up events ────────────────────────────────────────────────────────────
$("scrapeBtn").addEventListener("click", handleScrape);
$("signInHeaderBtn").addEventListener("click", () => showAuthModal());
$("csvBtn").addEventListener("click", () => openExportModal("csv"));
$("saveJsonBtn").addEventListener("click", handleSaveJson);
$("detailedViewBtn").addEventListener("click", () => setViewMode("detailed"));
$("cardViewBtn").addEventListener("click", () => setViewMode("card"));
$("signOutBtn").addEventListener("click", handleSignOut);
$("signInBtn").addEventListener("click", handleSignIn);
$("magicLinkBtn").addEventListener("click", handleMagicLink);
$("googleSignInBtn").addEventListener("click", handleGoogleSignIn);
$("closeAuthModal").addEventListener("click", () => hideModal(authModalEl));
$("closeExportModal").addEventListener("click", () => hideModal(exportModalEl));
$("exportFreeBtn").addEventListener("click", () => doExport(false));
$("openWebAppLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: state.config.appUrl });
});

// Toggle between email/password and magic link forms
$("showMagicLinkBtn").addEventListener("click", () => {
  $("passwordForm").style.display = "none";
  $("magicLinkForm").style.display = "flex";
  $("showPasswordBtn").style.display = "inline";
  $("showMagicLinkBtn").style.display = "none";
});
$("showPasswordBtn").addEventListener("click", () => {
  $("passwordForm").style.display = "flex";
  $("magicLinkForm").style.display = "none";
  $("showPasswordBtn").style.display = "none";
  $("showMagicLinkBtn").style.display = "inline";
});

document.querySelectorAll(".pricing-btn").forEach((btn) => {
  btn.addEventListener("click", () => handleBuy(btn.dataset.plan));
});

crmSelectEl.addEventListener("change", () => chrome.storage.local.set({ lastCrm: crmSelectEl.value }));
limitInputEl.addEventListener("change", handleLimitChange);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && state.session?.access_token) syncProfile({ silent: true });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "AUTH_STATE_CHANGED") return;
  console.log("[sidepanel] AUTH_STATE_CHANGED received", {
    at: message?.at || null,
    email: message?.email || null,
  });
  refreshSessionFromStorage();
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const s = await chrome.storage.local.get([
    "lastCrm",
    "attendeeViewMode",
    "attendeeLimit",
    "credits",
    "hasUnlimited",
    "session",
    "profile",
    "supabaseUrl",
    "supabaseAnonKey",
    "appUrl",
    "exportHistory",
  ]);

  if (s.lastCrm) crmSelectEl.value = s.lastCrm;
  if (s.attendeeViewMode) state.viewMode = s.attendeeViewMode;
  state.attendeeLimit = s.attendeeLimit > 0 ? s.attendeeLimit : 100;
  state.credits = s.credits ?? 0;
  state.hasUnlimited = Boolean(s.hasUnlimited);
  state.session = s.session ?? null;
  state.profile = s.profile ?? null;
  state.config.supabaseUrl = s.supabaseUrl || DEFAULT_SUPABASE_URL;
  state.config.supabaseAnonKey = s.supabaseAnonKey || "";
  state.config.appUrl = s.appUrl || DEFAULT_APP_URL;

  limitInputEl.value = state.attendeeLimit;
  syncViewModeUI();
  syncAccountUI();
  renderHistory(s.exportHistory ?? []);
  $("openWebAppLink").href = state.config.appUrl;

  if (state.session?.access_token) {
    await syncProfile({ silent: true });
    startPoll();
  }

  const res = await sendMsg({ type: "GET_LAST_ATTENDEES" });
  if (res?.attendees?.length) {
    state.attendees = res.attendees;
    renderAttendees();
    setStatus(`${res.attendees.length} attendees from last scrape`);
  }
}

init();

// ── Scrape ────────────────────────────────────────────────────────────────────
async function handleScrape() {
  setStatus("Extracting…");
  $("scrapeBtn").disabled = true;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const res = await sendMsg({
    type: "SCRAPE_ATTENDEES",
    tabId: tab?.id,
    attendeeLimit: state.attendeeLimit,
  });

  $("scrapeBtn").disabled = false;

  if (!res?.ok) {
    setStatus(res?.error ?? "Extraction failed.");
    return;
  }

  state.attendees = res.attendees;
  renderAttendees();
  setStatus(`${state.attendees.length} attendees extracted`);
}

// ── Export flow ───────────────────────────────────────────────────────────────
function openExportModal(format) {
  if (!state.attendees.length) {
    setStatus("No attendees to export.");
    return;
  }

  state.pendingExportFormat = format;
  const total = state.attendees.length;
  const needsCredit = total > FREE_LIMIT;

  exportModalSubEl.textContent = `Found ${total} attendees on this event.`;
  if (exportTotalCountEl) exportTotalCountEl.textContent = total;

  if (state.hasUnlimited) {
    exportCreditDescEl.textContent = "Unlimited plan — no credit used";
    $("exportCreditBtn").disabled = false;
  } else if (state.credits > 0) {
    exportCreditDescEl.textContent = `You have ${state.credits} credit${state.credits !== 1 ? "s" : ""} remaining`;
    $("exportCreditBtn").disabled = false;
  } else if (state.session) {
    exportCreditDescEl.textContent = "You have 0 credits — buy below";
    $("exportCreditBtn").disabled = true;
  } else {
    exportCreditDescEl.textContent = "Sign in and buy credits to unlock";
    $("exportCreditBtn").disabled = true;
  }

  buyCreditsSection.hidden = !(state.session && !state.hasUnlimited && state.credits <= 0 && needsCredit);

  $("exportCreditBtn").onclick = () => {
    if (!state.session) {
      hideModal(exportModalEl);
      showAuthModal();
      return;
    }
    doExport(true);
  };

  showModal(exportModalEl);
}

function doExport(fullReport) {
  if (state.exportInProgress) {
    console.log("[sidepanel] export blocked: already in progress", { fullReport });
    return;
  }
  state.exportInProgress = true;
  hideModal(exportModalEl);
  const fmt = state.pendingExportFormat;
  const attendees = fullReport ? state.attendees : state.attendees.slice(0, FREE_LIMIT);
  const usedCredit = fullReport && !state.hasUnlimited && state.attendees.length > FREE_LIMIT;

  const crm = crmSelectEl.value;
  const label = (window.CRM_PROFILES?.[crm] ?? window.CRM_PROFILES?.generic)?.label ?? crm;

  if (fmt === "csv") {
    const csv = window.buildCrmCsv(attendees, crm);
    downloadBlob(csv, "text/csv;charset=utf-8", `attendees-${crm}-${today()}.csv`);
  } else {
    const bytes = buildSimplePdf(attendees);
    downloadBlob(
      new Blob([bytes], { type: "application/pdf" }),
      "application/pdf",
      `attendees-${today()}.pdf`,
    );
  }

  if (usedCredit) {
    console.log("[sidepanel] deducting credit for full report export", {
      beforeCredits: state.credits,
      totalAttendees: state.attendees.length,
    });
    state.credits = Math.max(0, state.credits - 1);
    chrome.storage.local.set({ credits: state.credits });
    syncAccountUI();
  }

  if (state.session && fullReport) saveToHistory(attendees.length, fmt, crm);

  const truncNote = !fullReport && state.attendees.length > FREE_LIMIT ? ` (first ${FREE_LIMIT})` : "";
  setStatus(`Exported ${attendees.length} attendees for ${label}${truncNote}.`);
  setTimeout(() => {
    state.exportInProgress = false;
  }, 300);
}

// ── JSON save — free limit unless signed in ────────────────────────────────
function handleSaveJson() {
  if (!state.attendees.length) {
    setStatus("No attendees to save.");
    return;
  }

  const isSignedIn = Boolean(state.session?.access_token);
  const attendees = isSignedIn ? state.attendees : state.attendees.slice(0, FREE_LIMIT);
  const truncNote = !isSignedIn && state.attendees.length > FREE_LIMIT ? ` (first ${FREE_LIMIT} — sign in for full list)` : "";

  const json = JSON.stringify(attendees, null, 2);
  downloadBlob(json, "application/json", `attendees-${today()}.json`);
  setStatus(`Saved ${attendees.length} attendees as JSON${truncNote}.`);
}

// ── History ───────────────────────────────────────────────────────────────────
async function saveToHistory(count, fmt, crm) {
  const s = await chrome.storage.local.get("exportHistory");
  const history = s.exportHistory ?? [];
  history.unshift({ count, fmt, crm, date: new Date().toISOString() });
  const trimmed = history.slice(0, 30);
  chrome.storage.local.set({ exportHistory: trimmed });
  renderHistory(trimmed);
}

function renderHistory(history) {
  if (!state.session || !history.length) {
    historySectionEl.hidden = true;
    return;
  }
  historySectionEl.hidden = false;
  historyListEl.innerHTML = "";
  history.forEach((item) => {
    const div = document.createElement("div");
    div.className = "history-item";
    const d = new Date(item.date);
    const dateStr =
      d.toLocaleDateString("sv-SE") +
      " " +
      d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    div.innerHTML = `
      <div>
        <div>${item.count} attendees · ${item.fmt?.toUpperCase()} · ${item.crm ?? "generic"}</div>
        <div class="history-meta">${dateStr}</div>
      </div>
    `;
    historyListEl.appendChild(div);
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function showAuthModal() {
  authErrorEl.hidden = true;
  if (authEmailEl) authEmailEl.value = "";
  if (authPasswordEl) authPasswordEl.value = "";
  // Reset to password form view
  $("passwordForm").style.display = "flex";
  $("magicLinkForm").style.display = "none";
  $("showPasswordBtn").style.display = "none";
  $("showMagicLinkBtn").style.display = "inline";
  showModal(authModalEl);
}

async function handleSignIn() {
  const email = authEmailEl.value.trim();
  const pw = authPasswordEl.value;
  if (!email || !pw) {
    showAuthError("Email and password required.");
    return;
  }
  if (!state.config.supabaseAnonKey) {
    showAuthError("Missing Supabase anon key in extension config.");
    return;
  }

  $("signInBtn").disabled = true;
  $("signInBtn").textContent = "Signing in…";

  try {
    const res = await fetch(`${state.config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: state.config.supabaseAnonKey },
      body: JSON.stringify({ email, password: pw }),
    });
    const data = await res.json();

    if (!res.ok || !data?.access_token) {
      showAuthError(data?.error_description || data?.msg || "Sign in failed.");
      return;
    }

    state.session = data;
    await chrome.storage.local.set({ session: data });
    hideModal(authModalEl);
    await syncProfile();
    startPoll();
    syncAccountUI();

    if (state.pendingExportFormat) openExportModal(state.pendingExportFormat);
  } catch {
    showAuthError("Network error — please try again.");
  } finally {
    $("signInBtn").disabled = false;
    $("signInBtn").textContent = "Sign in";
  }
}

async function handleMagicLink() {
  const emailEl = $("magicLinkEmail");
  const email = emailEl?.value?.trim();
  if (!email) {
    showAuthError("Please enter your email.");
    return;
  }
  if (!state.config.supabaseAnonKey) {
    showAuthError("Missing Supabase anon key.");
    return;
  }

  $("magicLinkBtn").disabled = true;
  $("magicLinkBtn").textContent = "Sending…";

  try {
    const redirectTo = chrome.runtime.getURL(SIGNIN_CALLBACK_PATH);
    console.log("[sidepanel] magic link redirect target", { redirectTo, email });
    const res = await fetch(`${state.config.supabaseUrl}/auth/v1/magiclink`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: state.config.supabaseAnonKey },
      body: JSON.stringify({ email, options: { emailRedirectTo: redirectTo } }),
    });

    if (res.ok) {
      authErrorEl.textContent = "✅ Check your email for the magic link!";
      authErrorEl.style.color = "#057642";
      authErrorEl.style.background = "#e6f7ee";
      authErrorEl.style.border = "1px solid #b7e4c7";
      authErrorEl.hidden = false;
    } else {
      const data = await res.json();
      showAuthError(data?.msg || "Could not send magic link.");
    }
  } catch {
    showAuthError("Network error — please try again.");
  } finally {
    $("magicLinkBtn").disabled = false;
    $("magicLinkBtn").textContent = "Send magic link";
  }
}

async function handleGoogleSignIn() {
  if (!state.config.supabaseAnonKey) {
    showAuthError("Missing Supabase anon key.");
    return;
  }

  const redirectTo = chrome.runtime.getURL(SIGNIN_CALLBACK_PATH);
  const googleOAuthUrl =
    `${state.config.supabaseUrl}/auth/v1/authorize?provider=google` +
    `&redirect_to=${encodeURIComponent(redirectTo)}`;
  console.log("[sidepanel] google oauth flow start", {
    redirectTo,
    googleOAuthUrl,
  });

  // Open OAuth in a new tab — user will be redirected back to extension callback page
  chrome.tabs.create({ url: googleOAuthUrl });
  setStatus("Google sign-in opened in new tab…");
  hideModal(authModalEl);
}

async function handleSignOut() {
  const accessToken = state.session?.access_token || null;
  console.log("[sidepanel] sign out started", {
    hadSession: Boolean(accessToken),
    hadProfile: Boolean(state.profile),
    credits: state.credits,
    hasUnlimited: state.hasUnlimited,
  });

  if (accessToken && state.config.supabaseAnonKey) {
    try {
      const res = await fetch(`${state.config.supabaseUrl}/auth/v1/logout`, {
        method: "POST",
        headers: {
          apikey: state.config.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      console.log("[sidepanel] supabase logout response", { ok: res.ok, status: res.status });
    } catch (error) {
      console.warn("[sidepanel] supabase logout failed", error);
    }
  }

  stopPoll();
  state.session = null;
  state.profile = null;
  state.credits = 0;
  state.hasUnlimited = false;
  await chrome.storage.local.remove(["session", "profile"]);
  chrome.storage.local.set({ credits: 0, hasUnlimited: false });
  syncAccountUI();
  renderHistory([]);
  setStatus("Signed out.");
}

function showAuthError(msg) {
  authErrorEl.textContent = msg;
  authErrorEl.style.color = "#c0392b";
  authErrorEl.style.background = "#fdf0ef";
  authErrorEl.style.border = "1px solid #f5c6c2";
  authErrorEl.hidden = false;
}

// ── Profile sync ──────────────────────────────────────────────────────────────
async function syncProfile({ silent = false } = {}) {
  ensureSessionUserShape();
  if (!state.session?.access_token || !state.session?.user?.id) {
    console.warn("[sidepanel] syncProfile skipped due to missing token/user id");
    return;
  }
  if (!state.config.supabaseAnonKey) return;

  try {
    const url = `${state.config.supabaseUrl}/rest/v1/profiles?id=eq.${state.session.user.id}&select=id,email,credits,has_unlimited`;
    console.log("[sidepanel] syncProfile request", {
      url,
      userId: state.session.user.id,
      silent,
    });
    const res = await fetch(url, {
      headers: {
        apikey: state.config.supabaseAnonKey,
        Authorization: `Bearer ${state.session.access_token}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[sidepanel] syncProfile failed", { status: res.status, body });
      return;
    }
    const rows = await res.json();
    const profile = Array.isArray(rows) ? rows[0] : null;
    if (!profile) return;

    const prevCredits = state.credits;
    state.profile = profile;
    state.credits = profile.credits ?? 0;
    state.hasUnlimited = Boolean(profile.has_unlimited);

    chrome.storage.local.set({ profile, credits: state.credits, hasUnlimited: state.hasUnlimited });
    syncAccountUI();

    const s = await chrome.storage.local.get("exportHistory");
    renderHistory(s.exportHistory ?? []);

    if (!silent && state.credits > prevCredits) {
      setStatus("Purchase confirmed — credits updated!");
    }
  } catch (error) {
    console.error("[sidepanel] syncProfile unexpected error", error);
  }
}

function startPoll() {
  stopPoll();
  state.pollTimer = setInterval(() => syncProfile({ silent: true }), SYNC_INTERVAL_MS);
}

function stopPoll() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

// ── Buy ───────────────────────────────────────────────────────────────────────
function handleBuy(plan) {
  ensureSessionUserShape();
  const url = new URL(`${state.config.appUrl}/checkout`);
  url.searchParams.set("plan", plan);
  url.searchParams.set("source", "extension");
  if (state.session?.user?.id) url.searchParams.set("user_id", state.session.user.id);
  console.log("[sidepanel] opening checkout", {
    url: url.toString(),
    userId: state.session?.user?.id || null,
    plan,
  });
  chrome.tabs.create({ url: url.toString() });
  setStatus("Opening checkout… credits sync automatically.");
}

// ── Render attendees ──────────────────────────────────────────────────────────
function renderAttendees() {
  attendeeListEl.innerHTML = "";
  countBadgeEl.textContent = state.attendees.length;
  syncViewModeUI();

  if (!state.attendees.length) {
    attendeeListEl.innerHTML = `<div class="empty"><div class="empty-icon">👥</div>Click <strong>Extract attendees</strong><br>while on a LinkedIn event page.</div>`;
    return;
  }

  state.attendees.forEach((a) => {
    const item = document.createElement("article");
    item.className = "attendee-item";
    const href = a.profileLink ? `href="${esc(a.profileLink)}" target="_blank"` : "";
    item.innerHTML = `
      <div class="attendee-summary">
        <div class="attendee-info">
          <div class="attendee-name">${esc(a.name || "Unknown")}</div>
          ${a.title ? `<div class="attendee-title">${esc(a.title)}</div>` : ""}
          ${a.location ? `<div class="attendee-location">📍 ${esc(a.location)}</div>` : ""}
        </div>
        <span class="chevron">▼</span>
      </div>
      <div class="attendee-details">
        ${a.profileLink ? `<div class="detail-row"><span class="detail-label">Profile</span><span class="detail-value"><a ${href}>LinkedIn ↗</a></span></div>` : ""}
        ${a.email ? `<div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${esc(a.email)}</span></div>` : ""}
        ${a.phone ? `<div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${esc(a.phone)}</span></div>` : ""}
        ${a.website ? `<div class="detail-row"><span class="detail-label">Web</span><span class="detail-value"><a href="${esc(a.website)}" target="_blank">${esc(a.website)}</a></span></div>` : ""}
      </div>`;
    if (state.viewMode === "detailed") {
      item.querySelector(".attendee-summary").addEventListener("click", () => item.classList.toggle("expanded"));
    } else {
      item.classList.add("expanded");
    }
    attendeeListEl.appendChild(item);
  });
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function syncAccountUI() {
  ensureSessionUserShape();
  const email = state.profile?.email || state.session?.user?.email;
  const signedOutBadge = $("signedOutBadge");

  if (email) {
    // Signed in
    accountBadgeEl.hidden = false;
    accountBadgeEl.style.display = "flex";
    if (signedOutBadge) {
      signedOutBadge.hidden = true;
      signedOutBadge.style.display = "none";
    }
    accountEmailEl.textContent = email;
    accountCreditsEl.textContent = state.hasUnlimited
      ? "∞ credits"
      : `${state.credits} credit${state.credits !== 1 ? "s" : ""}`;
  } else {
    // Signed out
    accountBadgeEl.hidden = true;
    accountBadgeEl.style.display = "none";
    if (signedOutBadge) {
      signedOutBadge.hidden = false;
      signedOutBadge.style.display = "flex";
    }
    accountEmailEl.textContent = "";
    accountCreditsEl.textContent = "";
    setStatus("Sign in to unlock full exports.");
  }
}


function setViewMode(mode) {
  state.viewMode = mode;
  chrome.storage.local.set({ attendeeViewMode: mode });
  syncViewModeUI();
  renderAttendees();
}

function syncViewModeUI() {
  attendeeListEl.classList.toggle("card-view", state.viewMode === "card");
  $("detailedViewBtn").classList.toggle("active", state.viewMode === "detailed");
  $("cardViewBtn").classList.toggle("active", state.viewMode === "card");
}

function handleLimitChange() {
  const n = parseInt(limitInputEl.value, 10);
  state.attendeeLimit = n > 0 ? n : 100;
  limitInputEl.value = state.attendeeLimit;
  chrome.storage.local.set({ attendeeLimit: state.attendeeLimit });
}

function setStatus(msg) {
  statusEl.textContent = msg;
}
function showModal(el) {
  el.hidden = false;
}
function hideModal(el) {
  el.hidden = true;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(data, mime, filename) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () =>
    setTimeout(() => URL.revokeObjectURL(url), 1000),
  );
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sendMsg(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(res);
    });
  });
}

async function refreshSessionFromStorage() {
  const { session } = await chrome.storage.local.get("session");
  if (!session?.access_token) {
    console.log("[sidepanel] no session in storage after auth state update");
    return;
  }
  state.session = session;
  ensureSessionUserShape();
  await syncProfile({ silent: true });
  startPoll();
  syncAccountUI();
  setStatus("Signed in successfully!");
}

function ensureSessionUserShape() {
  if (!state.session?.access_token) return;
  if (!state.session.user) state.session.user = {};
  const payload = decodeJwtPayloadSafe(state.session.access_token);
  if (!state.session.user.id && payload?.sub) {
    state.session.user.id = payload.sub;
  }
  if (!state.session.user.email && payload?.email) {
    state.session.user.email = payload.email;
  }
}

function decodeJwtPayloadSafe(accessToken) {
  try {
    const [, payloadPart] = String(accessToken).split(".");
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// ── PDF builder ───────────────────────────────────────────────────────────────
function buildSimplePdf(attendees) {
  const lines = ["Event Attendees", ""];
  attendees.forEach((a, i) => {
    lines.push(`${i + 1}. ${String(a.name ?? "").slice(0, 90)}`);
    if (a.title) lines.push(`   ${String(a.title).slice(0, 90)}`);
    if (a.location) lines.push(`   ${String(a.location).slice(0, 90)}`);
    if (a.profileLink) lines.push(`   ${String(a.profileLink).slice(0, 90)}`);
    lines.push("");
  });
  const ls = lines.slice(0, 200);
  const pdfStr = (v) =>
    v
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)")
      .replace(/[^\x20-\x7E]/g, " ");
  let stream = "BT\n/F1 10 Tf\n14 TL\n50 770 Td\n";
  ls.forEach((l, i) => {
    stream += i === 0 ? `(${pdfStr(l)}) Tj\n` : `T* (${pdfStr(l)}) Tj\n`;
  });
  stream += "ET";
  const objs = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];
  let pdf = "%PDF-1.4\n";
  const off = [0];
  objs.forEach((o) => {
    off.push(pdf.length);
    pdf += `${o}\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < off.length; i++)
    pdf += `${String(off[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
