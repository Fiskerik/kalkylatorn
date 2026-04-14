const FREE_ATTENDEE_LIMIT = 20;
const FULL_EXPORT_PRICE_LABEL = "$9.99";
const FIVE_EXPORTS_PRICE_LABEL = "$39.99";
const TEN_EXPORTS_PRICE_LABEL = "$69.99";
const DEFAULT_SUPABASE_URL = "https://vhemqgjwjqgjqrnjhvm.supabase.co";
const DEFAULT_APP_PUBLIC_URL = "https://prospectin.vercel.app";

const state = {
  attendees: [],
  viewMode: "detailed",
  attendeeLimit: 100,
  credits: 0,
  hasUnlimited: false,
  profile: null,
  session: null,
  config: {
    supabaseUrl: DEFAULT_SUPABASE_URL,
    supabaseAnonKey: "",
    appPublicUrl: DEFAULT_APP_PUBLIC_URL
  }
};

const attendeeListEl = document.getElementById("attendeeList");
const statusTextEl = document.getElementById("statusText");
const countBadgeEl = document.getElementById("countBadge");
const crmSelectEl = document.getElementById("crmSelect");
const detailedViewBtn = document.getElementById("detailedViewBtn");
const cardViewBtn = document.getElementById("cardViewBtn");
const attendeeLimitInputEl = document.getElementById("attendeeLimitInput");
const proHintEl = document.getElementById("proHint");
const csvBtnEl = document.getElementById("csvBtn");
const pdfBtnEl = document.getElementById("pdfBtn");
const creditsBadgeEl = document.getElementById("creditsBadge");
const buyOneBtnEl = document.getElementById("buyOneBtn");
const buyFiveBtnEl = document.getElementById("buyFiveBtn");
const buyTenBtnEl = document.getElementById("buyTenBtn");
const authEmailEl = document.getElementById("authEmail");
const authPasswordEl = document.getElementById("authPassword");
const signInBtnEl = document.getElementById("signInBtn");
const signOutBtnEl = document.getElementById("signOutBtn");
const syncAccountBtnEl = document.getElementById("syncAccountBtn");
const authStateEl = document.getElementById("authState");
const openWebAppBtnEl = document.getElementById("openWebAppBtn");

document.getElementById("scrapeBtn").addEventListener("click", handleScrape);
document.getElementById("saveBtn").addEventListener("click", handleSave);
csvBtnEl.addEventListener("click", exportCsv);
pdfBtnEl.addEventListener("click", exportPdf);
detailedViewBtn.addEventListener("click", () => setViewMode("detailed"));
cardViewBtn.addEventListener("click", () => setViewMode("card"));
buyOneBtnEl.addEventListener("click", () => handleBuyCredits("single"));
buyFiveBtnEl.addEventListener("click", () => handleBuyCredits("five"));
buyTenBtnEl.addEventListener("click", () => handleBuyCredits("ten"));
signInBtnEl.addEventListener("click", handleSignIn);
signOutBtnEl.addEventListener("click", handleSignOut);
syncAccountBtnEl.addEventListener("click", loadProfileFromSupabase);
openWebAppBtnEl.addEventListener("click", () => chrome.tabs.create({ url: state.config.appPublicUrl }));

crmSelectEl.addEventListener("change", () => {
  chrome.storage.local.set({ lastCrm: crmSelectEl.value });
});
attendeeLimitInputEl.addEventListener("change", handleAttendeeLimitChange);

init();

async function init() {
  const storage = await chrome.storage.local.get([
    "lastCrm",
    "attendeeViewMode",
    "attendeeLimit",
    "credits",
    "hasUnlimited",
    "session",
    "profile",
    "supabaseUrl",
    "supabaseAnonKey",
    "appPublicUrl"
  ]);

  if (storage.lastCrm) crmSelectEl.value = storage.lastCrm;
  if (storage.attendeeViewMode === "card" || storage.attendeeViewMode === "detailed") {
    state.viewMode = storage.attendeeViewMode;
  }
  if (Number.isInteger(storage.attendeeLimit) && storage.attendeeLimit > 0) {
    state.attendeeLimit = storage.attendeeLimit;
  }

  state.credits = Number.isInteger(storage.credits) && storage.credits > 0 ? storage.credits : 0;
  state.hasUnlimited = Boolean(storage.hasUnlimited);
  state.session = storage.session ?? null;
  state.profile = storage.profile ?? null;
  state.config.supabaseUrl = storage.supabaseUrl || DEFAULT_SUPABASE_URL;
  state.config.supabaseAnonKey = storage.supabaseAnonKey || "";
  state.config.appPublicUrl = storage.appPublicUrl || DEFAULT_APP_PUBLIC_URL;

  attendeeLimitInputEl.value = String(state.attendeeLimit);
  syncExportPaywallUI();
  syncViewModeUI();
  syncAuthUI();

  if (state.session?.access_token) {
    await loadProfileFromSupabase();
  }

  const response = await sendRuntimeMessage({ type: "GET_LAST_ATTENDEES" });
  if (response?.attendees?.length) {
    state.attendees = response.attendees;
    renderAttendees();
    setStatus(`${response.attendees.length} attendees from last scrape`);
  }
}

async function handleSignIn() {
  const email = authEmailEl.value.trim();
  const password = authPasswordEl.value;
  if (!email || !password) {
    setStatus("Email and password are required.");
    return;
  }

  if (!state.config.supabaseAnonKey) {
    setStatus("Missing Supabase anon key. Save supabaseAnonKey in extension storage.");
    return;
  }

  console.log("[Prospect In] Signing in user:", email);
  setStatus("Signing in...");

  try {
    const response = await fetch(`${state.config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: state.config.supabaseAnonKey
      },
      body: JSON.stringify({ email, password })
    });
    const payload = await response.json();

    if (!response.ok || !payload?.access_token) {
      console.log("[Prospect In] Sign in failed response:", payload);
      setStatus(payload?.error_description || payload?.msg || "Sign in failed.");
      return;
    }

    state.session = payload;
    await chrome.storage.local.set({ session: payload });
    await loadProfileFromSupabase();
    syncAuthUI();
    setStatus("Signed in.");
  } catch (error) {
    console.error("[Prospect In] Sign in error:", error);
    setStatus("Could not sign in.");
  }
}

async function handleSignOut() {
  state.session = null;
  state.profile = null;
  state.credits = 0;
  state.hasUnlimited = false;
  await chrome.storage.local.remove(["session", "profile"]);
  await chrome.storage.local.set({ credits: 0, hasUnlimited: false });
  syncAuthUI();
  syncExportPaywallUI();
  setStatus("Signed out.");
}

async function loadProfileFromSupabase() {
  if (!state.session?.access_token || !state.session?.user?.id) {
    syncAuthUI();
    return;
  }
  if (!state.config.supabaseAnonKey) {
    setStatus("Missing Supabase anon key. Save supabaseAnonKey in extension storage.");
    return;
  }

  setStatus("Syncing account...");
  try {
    const profileUrl = `${state.config.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(state.session.user.id)}&select=id,email,credits,has_unlimited,updated_at`;
    const response = await fetch(profileUrl, {
      headers: {
        apikey: state.config.supabaseAnonKey,
        Authorization: `Bearer ${state.session.access_token}`
      }
    });
    const rows = await response.json();

    if (!response.ok) {
      console.log("[Prospect In] Profile fetch failed:", rows);
      setStatus("Failed to sync account profile.");
      return;
    }

    const profile = Array.isArray(rows) ? rows[0] : null;
    state.profile = profile;
    state.credits = Number.isInteger(profile?.credits) ? profile.credits : 0;
    state.hasUnlimited = Boolean(profile?.has_unlimited);

    await chrome.storage.local.set({
      profile,
      credits: state.credits,
      hasUnlimited: state.hasUnlimited
    });

    syncAuthUI();
    syncExportPaywallUI();
    setStatus("Account synced.");
  } catch (error) {
    console.error("[Prospect In] Profile sync error:", error);
    setStatus("Could not sync account.");
  }
}

async function handleScrape() {
  setStatus("Extracting…");
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log("[Event Attendee Extractor] Scrape requested for tab:", activeTab?.id, activeTab?.url);
  console.log("[Event Attendee Extractor] Scrape attendee limit:", state.attendeeLimit);

  const response = await sendRuntimeMessage({
    type: "SCRAPE_ATTENDEES",
    tabId: activeTab?.id,
    attendeeLimit: state.attendeeLimit
  });

  if (!response?.ok) {
    setStatus(response?.error ?? "Extraction failed.");
    return;
  }

  state.attendees = response.attendees;
  renderAttendees();
  setStatus(`${state.attendees.length} attendees extracted`);
}

function handleSave() {
  chrome.storage.local.set(
    { lastAttendees: state.attendees, lastScrapedAt: new Date().toISOString() },
    () => setStatus(`Saved ${state.attendees.length} attendees locally.`)
  );
}

function exportCsv() {
  if (!state.attendees.length) {
    setStatus("No attendees to export.");
    return;
  }

  const exportScope = getCsvExportScope(state.attendees);
  const crm = crmSelectEl.value;
  const profile = window.CRM_PROFILES[crm] ?? window.CRM_PROFILES.generic;
  const csv = window.buildCrmCsv(exportScope.attendees, crm);
  const filename = `attendees-${crm}-${datestamp()}.csv`;

  downloadBlob(csv, "text/csv;charset=utf-8", filename);

  if (exportScope.usedCredit) {
    consumeCredit();
  }

  syncExportPaywallUI();

  if (exportScope.isTruncated) {
    setStatus(`Exported first ${FREE_ATTENDEE_LIMIT} attendees for ${profile.label}. Upgrade for full download.`);
    return;
  }

  setStatus(`Exported full list for ${profile.label}.`);
}

function exportPdf() {
  if (!state.attendees.length) {
    setStatus("No attendees to export.");
    return;
  }

  const hasAccess = checkPaidAccess(state.attendees.length);
  if (!hasAccess) {
    setStatus(`PDF full export requires 1 credit or unlimited. CSV still exports first ${FREE_ATTENDEE_LIMIT} for free.`);
    return;
  }

  const pdfContent = buildSimplePdf(state.attendees);
  downloadBlob(new Blob([new Uint8Array(pdfContent)], { type: "application/pdf" }), "application/pdf", `attendees-${datestamp()}.pdf`);
  if (!state.hasUnlimited && state.attendees.length > FREE_ATTENDEE_LIMIT) {
    consumeCredit();
  }
  syncExportPaywallUI();
  setStatus("PDF exported.");
}

function getCsvExportScope(attendees) {
  const canExportFull = attendees.length <= FREE_ATTENDEE_LIMIT || state.hasUnlimited || state.credits > 0;
  if (canExportFull) {
    return {
      attendees,
      isTruncated: false,
      usedCredit: attendees.length > FREE_ATTENDEE_LIMIT && !state.hasUnlimited
    };
  }

  return {
    attendees: attendees.slice(0, FREE_ATTENDEE_LIMIT),
    isTruncated: true,
    usedCredit: false
  };
}

function handleAttendeeLimitChange() {
  const parsed = Number.parseInt(attendeeLimitInputEl.value, 10);
  const nextLimit = Number.isInteger(parsed) && parsed > 0 ? parsed : 100;
  state.attendeeLimit = nextLimit;
  attendeeLimitInputEl.value = String(nextLimit);
  chrome.storage.local.set({ attendeeLimit: nextLimit });
}

function syncExportPaywallUI() {
  const hasPaidAccess = state.hasUnlimited || state.credits > 0;
  creditsBadgeEl.textContent = state.hasUnlimited ? "Credits: Unlimited" : `Credits: ${state.credits}`;
  buyOneBtnEl.hidden = hasPaidAccess;
  buyFiveBtnEl.hidden = hasPaidAccess;
  buyTenBtnEl.hidden = hasPaidAccess;

  const needsUpgrade = state.attendees.length > FREE_ATTENDEE_LIMIT && !hasPaidAccess;
  proHintEl.hidden = !needsUpgrade;
  if (needsUpgrade) {
    proHintEl.textContent = `Free CSV exports include first ${FREE_ATTENDEE_LIMIT}. Full list: ${FULL_EXPORT_PRICE_LABEL}, 5 credits: ${FIVE_EXPORTS_PRICE_LABEL}, 10 credits: ${TEN_EXPORTS_PRICE_LABEL}.`;
  }
}

function syncAuthUI() {
  const email = state.profile?.email || state.session?.user?.email;
  authStateEl.textContent = email ? `Signed in as ${email}` : "Not signed in";
  signOutBtnEl.hidden = !email;
  signInBtnEl.hidden = Boolean(email);
  syncAccountBtnEl.hidden = !email;
  authEmailEl.disabled = Boolean(email);
  authPasswordEl.disabled = Boolean(email);
}

function setViewMode(mode) {
  if (mode !== "card" && mode !== "detailed") {
    return;
  }

  state.viewMode = mode;
  chrome.storage.local.set({ attendeeViewMode: mode });
  syncViewModeUI();
  renderAttendees();
}

function syncViewModeUI() {
  attendeeListEl.classList.toggle("card-view", state.viewMode === "card");
  detailedViewBtn.classList.toggle("active", state.viewMode === "detailed");
  cardViewBtn.classList.toggle("active", state.viewMode === "card");
}

function renderAttendees() {
  attendeeListEl.innerHTML = "";
  countBadgeEl.textContent = String(state.attendees.length);
  syncViewModeUI();
  syncExportPaywallUI();

  if (!state.attendees.length) {
    attendeeListEl.innerHTML = `
      <div class="empty">
        <div class="empty-icon">👥</div>
        Click <strong>Extract attendees</strong><br>while on the event page.
      </div>`;
    return;
  }

  state.attendees.forEach((attendee) => {
    const item = document.createElement("article");
    item.className = "attendee-item";

    const profileHref = attendee.profileLink
      ? `href="${escapeHtml(attendee.profileLink)}" target="_blank"`
      : "";

    item.innerHTML = `
      <div class="attendee-summary">
        <div class="attendee-info">
          <div class="attendee-name">${escapeHtml(attendee.name || "Unknown")}</div>
          ${attendee.title ? `<div class="attendee-title">${escapeHtml(attendee.title)}</div>` : ""}
          ${attendee.location ? `<div class="attendee-location">📍 ${escapeHtml(attendee.location)}</div>` : ""}
        </div>
        <span class="chevron">▼</span>
      </div>
      <div class="attendee-details">
        ${attendee.profileLink ? `<div class="detail-row"><span class="detail-label">Profile</span><span class="detail-value"><a ${profileHref}>LinkedIn ↗</a></span></div>` : ""}
        ${attendee.email ? `<div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${escapeHtml(attendee.email)}</span></div>` : ""}
        ${attendee.phone ? `<div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${escapeHtml(attendee.phone)}</span></div>` : ""}
        ${attendee.website ? `<div class="detail-row"><span class="detail-label">Web</span><span class="detail-value"><a href="${escapeHtml(attendee.website)}" target="_blank">${escapeHtml(attendee.website)}</a></span></div>` : ""}
      </div>
    `;

    if (state.viewMode === "detailed") {
      item.querySelector(".attendee-summary").addEventListener("click", () => {
        item.classList.toggle("expanded");
      });
    } else {
      item.classList.add("expanded");
    }

    attendeeListEl.appendChild(item);
  });
}

function checkPaidAccess(requestedCount) {
  console.log("[Event Attendee Extractor] Paid access check:", {
    requestedCount,
    freeLimit: FREE_ATTENDEE_LIMIT,
    credits: state.credits,
    hasUnlimited: state.hasUnlimited
  });

  if (requestedCount <= FREE_ATTENDEE_LIMIT) {
    return true;
  }

  if (state.credits > 0 || state.hasUnlimited) {
    return true;
  }

  return false;
}

function consumeCredit() {
  if (state.hasUnlimited || state.credits <= 0) {
    return;
  }
  state.credits -= 1;
  chrome.storage.local.set({ credits: state.credits });
  console.log("[Event Attendee Extractor] Credit consumed. Remaining:", state.credits);
}

function handleBuyCredits(plan) {
  const checkoutUrl = new URL(`${state.config.appPublicUrl}/pricing`);
  checkoutUrl.searchParams.set("source", "extension");
  checkoutUrl.searchParams.set("plan", plan);
  console.log("[Event Attendee Extractor] Opening pricing URL:", checkoutUrl.toString());
  chrome.tabs.create({ url: checkoutUrl.toString() });
}

function sendRuntimeMessage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

function setStatus(msg) {
  statusTextEl.textContent = msg;
}

function datestamp() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(data, mimeType, filename) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function escapeHtml(input) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildSimplePdf(attendees) {
  const lines = ["Event Attendees", ""];
  attendees.forEach((a, i) => {
    lines.push(`${i + 1}. ${safePdfText(a.name)}`);
    if (a.title) lines.push(`   ${safePdfText(a.title)}`);
    if (a.location) lines.push(`   ${safePdfText(a.location)}`);
    if (a.profileLink) lines.push(`   ${safePdfText(a.profileLink)}`);
    lines.push("");
  });

  const textLines = lines.slice(0, 180);
  let stream = "BT\n/F1 10 Tf\n14 TL\n50 770 Td\n";
  textLines.forEach((line, i) => {
    stream += i === 0
      ? `(${escapePdfString(line)}) Tj\n`
      : `T* (${escapePdfString(line)}) Tj\n`;
  });
  stream += "ET";

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj) => {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function safePdfText(v) {
  return String(v ?? "").slice(0, 90);
}

function escapePdfString(v) {
  return v.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)").replace(/[^\x20-\x7E]/g, " ");
}
