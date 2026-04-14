const FREE_ATTENDEE_LIMIT = 20;
const FULL_EXPORT_PRICE_LABEL = "$9.99";
const BUY_CREDITS_URL = "https://your-stripe-checkout-url.example/full-export";
const state = {
  attendees: [],
  viewMode: "detailed",
  attendeeLimit: 100,
  credits: 0,
  hasUnlimited: false
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
const buyCreditsBtnEl = document.getElementById("buyCreditsBtn");

document.getElementById("scrapeBtn").addEventListener("click", handleScrape);
document.getElementById("saveBtn").addEventListener("click", handleSave);
csvBtnEl.addEventListener("click", exportCsv);
pdfBtnEl.addEventListener("click", exportPdf);
detailedViewBtn.addEventListener("click", () => setViewMode("detailed"));
cardViewBtn.addEventListener("click", () => setViewMode("card"));
buyCreditsBtnEl.addEventListener("click", handleBuyCredits);

chrome.storage.local.get(["lastCrm", "attendeeViewMode", "attendeeLimit", "credits", "hasUnlimited"], (r) => {
  if (r.lastCrm) crmSelectEl.value = r.lastCrm;
  if (r.attendeeViewMode === "card" || r.attendeeViewMode === "detailed") {
    state.viewMode = r.attendeeViewMode;
  }
  if (Number.isInteger(r.attendeeLimit) && r.attendeeLimit > 0) {
    state.attendeeLimit = r.attendeeLimit;
  }
  state.credits = Number.isInteger(r.credits) && r.credits > 0 ? r.credits : 0;
  state.hasUnlimited = Boolean(r.hasUnlimited);
  attendeeLimitInputEl.value = String(state.attendeeLimit);
  buyCreditsBtnEl.textContent = `Get full list (${FULL_EXPORT_PRICE_LABEL})`;
  syncExportPaywallUI();
  syncViewModeUI();
});

crmSelectEl.addEventListener("change", () => {
  chrome.storage.local.set({ lastCrm: crmSelectEl.value });
});
attendeeLimitInputEl.addEventListener("change", handleAttendeeLimitChange);

init();

async function init() {
  const response = await sendRuntimeMessage({ type: "GET_LAST_ATTENDEES" });
  if (response?.attendees?.length) {
    state.attendees = response.attendees;
    renderAttendees();
    setStatus(`${response.attendees.length} attendees from last scrape`);
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

  const hasAccess = checkAccess(state.attendees.length);
  if (!hasAccess) {
    return;
  }

  const crm = crmSelectEl.value;
  const profile = window.CRM_PROFILES[crm] ?? window.CRM_PROFILES.generic;
  const csv = window.buildCrmCsv(state.attendees, crm);
  const filename = `attendees-${crm}-${datestamp()}.csv`;

  downloadBlob(csv, "text/csv;charset=utf-8", filename);
  consumeCreditIfNeeded(state.attendees.length);
  syncExportPaywallUI();
  setStatus(`Exported for ${profile.label}.`);
}

function exportPdf() {
  if (!state.attendees.length) {
    setStatus("No attendees to export.");
    return;
  }
  const hasAccess = checkAccess(state.attendees.length);
  if (!hasAccess) {
    return;
  }
  const pdfContent = buildSimplePdf(state.attendees);
  downloadBlob(new Blob([new Uint8Array(pdfContent)], { type: "application/pdf" }), "application/pdf", `attendees-${datestamp()}.pdf`);
  consumeCreditIfNeeded(state.attendees.length);
  syncExportPaywallUI();
  setStatus("PDF exported.");
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
  const hasFreeAccess = state.attendees.length > 0 && state.attendees.length <= FREE_ATTENDEE_LIMIT;
  const canExport = hasPaidAccess || hasFreeAccess;
  csvBtnEl.disabled = !canExport;
  pdfBtnEl.disabled = !canExport;
  proHintEl.hidden = hasPaidAccess || hasFreeAccess;
  if (!proHintEl.hidden) {
    proHintEl.textContent = `Limit reached. Get the full list for ${FULL_EXPORT_PRICE_LABEL}.`;
  }
  creditsBadgeEl.textContent = state.hasUnlimited ? "Credits: Unlimited" : `Credits: ${state.credits}`;
  buyCreditsBtnEl.hidden = hasPaidAccess || hasFreeAccess;
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

function checkAccess(requestedCount) {
  console.log("[Event Attendee Extractor] Access check:", {
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

  setStatus(`Limit reached. Get the full list for ${FULL_EXPORT_PRICE_LABEL}`);
  showBuyButton();
  return false;
}

function consumeCreditIfNeeded(requestedCount) {
  if (requestedCount <= FREE_ATTENDEE_LIMIT || state.hasUnlimited || state.credits <= 0) {
    return;
  }
  state.credits -= 1;
  chrome.storage.local.set({ credits: state.credits });
  console.log("[Event Attendee Extractor] Credit consumed. Remaining:", state.credits);
}

function showBuyButton() {
  buyCreditsBtnEl.hidden = false;
}

function handleBuyCredits() {
  console.log("[Event Attendee Extractor] Opening buy credits URL:", BUY_CREDITS_URL);
  chrome.tabs.create({ url: BUY_CREDITS_URL });
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
