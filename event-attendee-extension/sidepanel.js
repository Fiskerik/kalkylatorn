const state = {
  attendees: []
};

const attendeeListEl = document.getElementById("attendeeList");
const statusTextEl = document.getElementById("statusText");
const countBadgeEl = document.getElementById("countBadge");

document.getElementById("scrapeBtn").addEventListener("click", handleScrape);
document.getElementById("saveBtn").addEventListener("click", handleSave);
document.getElementById("csvBtn").addEventListener("click", exportCsv);
document.getElementById("pdfBtn").addEventListener("click", exportPdf);

init();

async function init() {
  const response = await sendRuntimeMessage({ type: "GET_LAST_ATTENDEES" });

  if (response?.attendees?.length) {
    state.attendees = response.attendees;
    renderAttendees();
    statusTextEl.textContent =
      `Loaded ${response.attendees.length} attendees from previous scrape.`;
  }
}

async function handleScrape() {
  setStatus("Extracting attendees from current page...");

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log("[Event Attendee Extractor] Scrape requested for tab:", activeTab?.id, activeTab?.url);

  const response = await sendRuntimeMessage({
    type: "SCRAPE_ATTENDEES",
    tabId: activeTab?.id
  });

  if (!response?.ok) {
    setStatus(response?.error ?? "Failed to extract attendees.");
    return;
  }

  state.attendees = response.attendees;
  renderAttendees();
  setStatus(`Extracted ${state.attendees.length} attendees.`);
}

function handleSave() {
  chrome.storage.local.set(
    {
      lastAttendees: state.attendees,
      lastScrapedAt: new Date().toISOString()
    },
    () => {
      setStatus(`Saved ${state.attendees.length} attendees locally.`);
    }
  );
}

function exportCsv() {
  if (!state.attendees.length) {
    setStatus("No attendees available for CSV export.");
    return;
  }

  const headers = [
    "Name",
    "Title",
    "Profile Link",
    "Email",
    "Phone",
    "Website",
    "Location",
    "Raw Details"
  ];

  const rows = state.attendees.map((attendee) => [
    attendee.name,
    attendee.title,
    attendee.profileLink,
    attendee.email,
    attendee.phone,
    attendee.website,
    attendee.location,
    attendee.rawDetails
  ]);

  const csv = [headers, ...rows]
    .map((line) => line.map(escapeCsv).join(","))
    .join("\n");

  downloadBlob(csv, "text/csv;charset=utf-8", "attendees.csv");
  setStatus("CSV export complete.");
}

function exportPdf() {
  if (!state.attendees.length) {
    setStatus("No attendees available for PDF export.");
    return;
  }

  const pdfContent = buildSimplePdf(state.attendees);
  const byteArray = new Uint8Array(pdfContent);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  downloadBlob(blob, "application/pdf", "attendees.pdf");
  setStatus("PDF export complete.");
}

function renderAttendees() {
  attendeeListEl.innerHTML = "";
  countBadgeEl.textContent = String(state.attendees.length);

  if (!state.attendees.length) {
    attendeeListEl.innerHTML =
      '<div class="empty">No attendees yet. Click "Extract attendees".</div>';
    return;
  }

  state.attendees.forEach((attendee, index) => {
    const item = document.createElement("article");
    item.className = "attendee-item";

    const summary = document.createElement("div");
    summary.className = "attendee-summary";
    summary.innerHTML = `
      <div>
        <div class="attendee-name">${escapeHtml(attendee.name || "Unknown")}</div>
        <div class="attendee-title">${escapeHtml(attendee.title || "")}</div>
      </div>
      <div aria-hidden="true">▼</div>
    `;

    const details = document.createElement("div");
    details.className = "attendee-details";
    details.innerHTML = `
      ${detailRow("Profile", attendee.profileLink)}
      ${detailRow("Email", attendee.email)}
      ${detailRow("Phone", attendee.phone)}
      ${detailRow("Website", attendee.website)}
      ${detailRow("Location", attendee.location)}
    `;

    summary.addEventListener("click", () => {
      item.classList.toggle("expanded");
      console.log("[Event Attendee Extractor] Toggle attendee:", index);
    });

    item.appendChild(summary);
    item.appendChild(details);
    attendeeListEl.appendChild(item);
  });
}

function detailRow(label, value) {
  const renderedValue = value ? escapeHtml(value) : "-";
  return `<div><strong>${label}:</strong> ${renderedValue}</div>`;
}

function sendRuntimeMessage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Event Attendee Extractor] Runtime message error:",
          chrome.runtime.lastError
        );
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }

      resolve(response);
    });
  });
}

function setStatus(message) {
  statusTextEl.textContent = message;
}

function escapeCsv(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function downloadBlob(data, mimeType, filename) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download(
    {
      url,
      filename,
      saveAs: true
    },
    () => {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  );
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

  attendees.forEach((attendee, index) => {
    lines.push(`${index + 1}. ${safePdfText(attendee.name)}`);
    lines.push(`Title: ${safePdfText(attendee.title)}`);
    lines.push(`Email: ${safePdfText(attendee.email)}`);
    lines.push(`Phone: ${safePdfText(attendee.phone)}`);
    lines.push(`Website: ${safePdfText(attendee.website)}`);
    lines.push(`Location: ${safePdfText(attendee.location)}`);
    lines.push("");
  });

  const textLines = lines.slice(0, 180);

  let stream = "BT\n/F1 10 Tf\n14 TL\n50 770 Td\n";
  textLines.forEach((line, i) => {
    if (i === 0) {
      stream += `(${escapePdfString(line)}) Tj\n`;
      return;
    }

    stream += `T* (${escapePdfString(line)}) Tj\n`;
  });
  stream += "ET";

  const objects = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj");
  objects.push(
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj"
  );
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
  objects.push(
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`
  );

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((obj) => {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  });

  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += "trailer\n";
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function safePdfText(value) {
  return String(value ?? "").slice(0, 90);
}

function escapePdfString(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[^\x20-\x7E]/g, " ");
}
