const DEBUG_PREFIX = "[Event Attendee Extractor]";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "EXTRACT_ATTENDEES") {
    extractAttendees()
      .then((attendees) => {
        sendResponse({ ok: true, attendees });
      })
      .catch((error) => {
        console.error(DEBUG_PREFIX, "Extraction error:", error);
        sendResponse({ ok: false, error: error.message });
      });

    return true;
  }

  return false;
});

async function extractAttendees() {
  console.log(DEBUG_PREFIX, "Starting attendee extraction.");

  const allAttendees = [];

  // Extract current page
  const cards = collectAttendeeCards();
  for (const card of cards) {
const attendee = parseAttendeeCard(card);
if (attendee) allAttendees.push(attendee);
  }

  // Click through remaining pages
  const nextBtn = document.querySelector('[data-testid="pagination-controls-next-button-visible"]');
  if (nextBtn) {
    nextBtn.click();
    await sleep(2000);
    const moreCards = collectAttendeeCards();
    for (const card of moreCards) {
const attendee = parseAttendeeCard(card);
if (attendee) allAttendees.push(attendee);
    }
  }

  return dedupeAttendees(allAttendees);
}

function collectAttendeeCards() {
  const seen = new Set();
  const cards = [];

  document.querySelectorAll('[role="listitem"]').forEach((el) => {
    // Filter out non-person list items (pagination, upsell widgets, etc.)
    const hasProfileOrSearch = el.querySelector('a[href*="/in/"], a[href*="eventAttending"]');
    if (!hasProfileOrSearch) return;
    if (seen.has(el)) return;
    seen.add(el);
    cards.push(el);
  });

  return cards;
}

async function tryExpandAttendee(card) {
  const expandSelectors = [
    "button[aria-expanded='false']",
    "button[aria-label*='Show']",
    "button[aria-label*='Expand']",
    "button[aria-label*='Contact']"
  ];

  for (const selector of expandSelectors) {
    const button = card.querySelector(selector);
    if (!button) {
      continue;
    }

    button.click();
    console.log(DEBUG_PREFIX, "Clicked expand button.");
    await sleep(250);
    break;
  }
}

function parseAttendeeCard(card) {
  const nameAnchor = card.querySelector('a[href*="/in/"]');
  const name = cleanText(nameAnchor?.textContent ?? "");
  const profileLink = nameAnchor?.href?.split("?")[0] ?? "";

  // Get all non-empty paragraph texts in order
  const paragraphs = Array.from(card.querySelectorAll("p"))
    .map(p => cleanText(p.textContent))
    .filter(t => t.length > 0 && t !== name && !t.includes("• "));

  const title = paragraphs[0] ?? "";
  const location = paragraphs[1] ?? "";

  console.log(DEBUG_PREFIX, "Parsed card:", { name, title, location, profileLink });

  if (!name || name === "LinkedIn Member") return null;

  const cardText = cleanText(card.innerText);
  const contact = extractContactInfo(card, cardText);

  return { name, title, profileLink, email: contact.email, phone: contact.phone,
           website: contact.website, location, rawDetails: cardText };
}

function extractContactInfo(card, cardText) {
  const emailRegex =
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const phoneRegex =
    /(\+?\d[\d\s().-]{7,}\d)/;

  const emailMatch = cardText.match(emailRegex);
  const phoneMatch = cardText.match(phoneRegex);

  const links = Array.from(card.querySelectorAll("a[href]"));
  const website =
    links
      .map((link) => link.href)
      .find((href) =>
        href.startsWith("http") &&
        !href.includes("linkedin.com") &&
        !href.includes("mailto:")
      ) ?? "";

  const location =
    firstText(card, [
      ".t-12.t-normal.t-black--light",
      ".org-people-profile-card__profile-location"
    ]) ?? "";

  return {
    email: emailMatch?.[1] ?? "",
    phone: phoneMatch?.[1] ?? "",
    website,
    location: cleanText(location)
  };
}

function dedupeAttendees(attendees) {
  const seen = new Set();
  const unique = [];

  attendees.forEach((attendee) => {
    const key = `${attendee.name}|${attendee.profileLink}`.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(attendee);
  });

  return unique;
}

function firstText(container, selectors) {
  for (const selector of selectors) {
    const value = container.querySelector(selector)?.textContent;
    if (value && cleanText(value)) {
      return value;
    }
  }

  return "";
}

async function autoScroll(maxPasses, delayMs) {
  for (let i = 0; i < maxPasses; i += 1) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    await sleep(delayMs);
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
