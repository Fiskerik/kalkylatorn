const state = { attendees: [] };

const attendeeListEl = document.getElementById("attendeeList");
const statusTextEl   = document.getElementById("statusText");
const countBadgeEl   = document.getElementById("countBadge");
const crmSelectEl    = document.getElementById("crmSelect");

document.getElementById("scrapeBtn").addEventListener("click", handleScrape);
document.getElementById("saveBtn").addEventListener("click", handleSave);
document.getElementById("csvBtn").addEventListener("click", exportCsv);
document.getElementById("pdfBtn").addEventListener("click", exportPdf);

// Persist the last-used CRM selection
chrome.storage.local.get(["lastCrm"], (r) => {
  if (r.lastCrm) crmSelectEl.value = r.lastCrm;
});
crmSelectEl.addEventListener("change", () => {
  chrome.storage.local.set({ lastCrm: crmSelectEl.value });
});

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

  const response = await sendRuntimeMessage({ type: "SCRAPE_ATTENDEES", tabId: activeTab?.id });

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
  if (!state.attendees.length) { setStatus("No attendees to export."); return; }

  const crm = crmSelectEl.value;
  const profile = window.CRM_PROFILES[crm] ?? window.CRM_PROFILES.generic;
  const csv = window.buildCrmCsv(state.attendees, crm);
  const filename = `attendees-${crm}-${datestamp()}.csv`;

  downloadBlob(csv, "text/csv;charset=utf-8", filename);
  setStatus(`Exported for ${profile.label}.`);
}

function exportPdf() {
  if (!state.attendees.length) { setStatus("No attendees to export."); return; }
  const pdfContent = buildSimplePdf(state.attendees);
  downloadBlob(new Blob([new Uint8Array(pdfContent)], { type: "application/pdf" }), "application/pdf", `attendees-${datestamp()}.pdf`);
  setStatus("PDF exported.");
}

function renderAttendees() {
  attendeeListEl.innerHTML = "";
  countBadgeEl.textContent = String(state.attendees.length);

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
          ${attendee.title    ? `<div class="attendee-title">${escapeHtml(attendee.title)}</div>` : ""}
          ${attendee.location ? `<div class="attendee-location">📍 ${escapeHtml(attendee.location)}</div>` : ""}
        </div>
        <span class="chevron">▼</span>
      </div>
      <div class="attendee-details">
        ${attendee.profileLink ? `<div class="detail-row"><span class="detail-label">Profile</span><span class="detail-value"><a ${profileHref}>LinkedIn ↗</a></span></div>` : ""}
        ${attendee.email   ? `<div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${escapeHtml(attendee.email)}</span></div>`   : ""}
        ${attendee.phone   ? `<div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${escapeHtml(attendee.phone)}</span></div>`   : ""}
        ${attendee.website ? `<div class="detail-row"><span class="detail-label">Web</span><span class="detail-value"><a href="${escapeHtml(attendee.website)}" target="_blank">${escapeHtml(attendee.website)}</a></span></div>` : ""}
      </div>
    `;

    item.querySelector(".attendee-summary").addEventListener("click", () => {
      item.classList.toggle("expanded");
    });

    attendeeListEl.appendChild(item);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

function setStatus(msg) { statusTextEl.textContent = msg; }

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
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildSimplePdf(attendees) {
  const lines = ["Event Attendees", ""];
  attendees.forEach((a, i) => {
    lines.push(`${i + 1}. ${safePdfText(a.name)}`);
    if (a.title)       lines.push(`   ${safePdfText(a.title)}`);
    if (a.location)    lines.push(`   ${safePdfText(a.location)}`);
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
  objects.forEach(obj => { offsets.push(pdf.length); pdf += `${obj}\n`; });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function safePdfText(v) { return String(v ?? "").slice(0, 90); }

function escapePdfString(v) {
  return v.replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)").replace(/[^\x20-\x7E]/g," ");
}
