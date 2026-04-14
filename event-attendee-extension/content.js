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
  await autoScroll(12, 1500); 

  const attendeeCards = collectAttendeeCards();
  console.log(DEBUG_PREFIX, "Cards discovered:", attendeeCards.length);

  const attendees = [];

  for (const card of attendeeCards) {
    await tryExpandAttendee(card);

    const attendee = parseAttendeeCard(card);
    if (!attendee.name) {
      continue;
    }

    attendees.push(attendee);
  }

  const uniqueAttendees = dedupeAttendees(attendees);
  console.log(DEBUG_PREFIX, "Unique attendees extracted:", uniqueAttendees.length);
  return uniqueAttendees;
}

function collectAttendeeCards() {
  const selectorGroups = [
    "li.artdeco-list__item",
    "li.org-people-profile-card",
    "li.scaffold-finite-scroll__content-item",
    "div[data-view-name*='event'][role='listitem']",
    "[role='list'] > li"
  ];

  const seen = new Set();
  const cards = [];

  selectorGroups.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      const text = cleanText(el.innerText);
      if (text.length < 3) {
        return;
      }

      if (!seen.has(el)) {
        seen.add(el);
        cards.push(el);
      }
    });
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
  const name =
    firstText(card, [
      ".artdeco-entity-lockup__title",
      ".org-people-profile-card__profile-title",
      "a[href*='/in/']",
      "span[aria-hidden='true']"
    ]) ?? "";

  const title =
    firstText(card, [
      ".artdeco-entity-lockup__subtitle",
      ".org-people-profile-card__profile-info",
      ".t-14.t-normal",
      ".t-black--light"
    ]) ?? "";

  const profileLink =
    card.querySelector("a[href*='/in/']")?.href?.trim() ?? "";

  const cardText = cleanText(card.innerText);
  const contact = extractContactInfo(card, cardText);

  return {
    name: cleanText(name),
    title: cleanText(title),
    profileLink,
    email: contact.email,
    phone: contact.phone,
    website: contact.website,
    location: contact.location,
    rawDetails: cardText
  };
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
