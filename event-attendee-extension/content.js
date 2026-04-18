const DEBUG_PREFIX = "[Event Attendee Extractor]";

const HUMANIZED_TIMING = {
  attendeeListPollMinMs: 200,
  attendeeListPollMaxMs: 480,
  pageChangePollMinMs: 210,
  pageChangePollMaxMs: 420,
  betweenCardsMinMs: 70,
  betweenCardsMaxMs: 190,
  nextClickPauseMinMs: 750,
  nextClickPauseMaxMs: 1700,
  scrollDelayMinMs: 420,
  scrollDelayMaxMs: 980,
  pauseEveryCards: 18,
  pauseMinMs: 850,
  pauseMaxMs: 1850
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "EXTRACT_ATTENDEES") {
    extractAttendees(message?.maxAttendees)
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

async function extractAttendees(maxAttendeesInput) {
  const maxAttendees = Number.isInteger(maxAttendeesInput) && maxAttendeesInput > 0 ? maxAttendeesInput : 100;
  console.log(DEBUG_PREFIX, "Starting attendee extraction.");
  console.log(DEBUG_PREFIX, "Max attendees limit:", maxAttendees);

  const allAttendees = [];
  const visitedPageKeys = new Set();
  let pageNumber = 1;

  while (true) {
    await waitForAttendeeList();
    await autoScroll(3);
    const cards = collectAttendeeCards();
    const pageKey = buildPageKey(cards);

    console.log(DEBUG_PREFIX, `Page ${pageNumber}:`, {
      cards: cards.length,
      pageKey,
      url: location.href
    });

    if (visitedPageKeys.has(pageKey)) {
      console.log(DEBUG_PREFIX, "Detected repeated page; stopping pagination.");
      break;
    }

    visitedPageKeys.add(pageKey);

    for (const card of cards) {
      const attendee = parseAttendeeCard(card);
      if (attendee) {
        allAttendees.push(attendee);
        if (allAttendees.length % HUMANIZED_TIMING.pauseEveryCards === 0) {
          const pauseMs = randomBetween(HUMANIZED_TIMING.pauseMinMs, HUMANIZED_TIMING.pauseMaxMs);
          console.log(DEBUG_PREFIX, `Taking periodic pause for ${pauseMs}ms after ${allAttendees.length} attendees.`);
          await sleep(pauseMs);
        }

        if (allAttendees.length >= maxAttendees) {
          console.log(DEBUG_PREFIX, `Reached attendee limit (${maxAttendees}); stopping pagination.`);
          const uniqueLimited = dedupeAttendees(allAttendees).slice(0, maxAttendees);
          console.log(DEBUG_PREFIX, `Extraction done. Total unique attendees: ${uniqueLimited.length}`);
          return uniqueLimited;
        }
      }

      await sleep(randomBetween(HUMANIZED_TIMING.betweenCardsMinMs, HUMANIZED_TIMING.betweenCardsMaxMs));
    }

    const nextBtn = findNextButton();
    if (!nextBtn || isPaginationButtonDisabled(nextBtn)) {
      console.log(DEBUG_PREFIX, "No next page button available; extraction complete.");
      break;
    }

    const previousUrl = location.href;
    nextBtn.click();
    const nextClickPauseMs = randomBetween(HUMANIZED_TIMING.nextClickPauseMinMs, HUMANIZED_TIMING.nextClickPauseMaxMs);
    console.log(DEBUG_PREFIX, `Clicked next page from page ${pageNumber}; waiting ${nextClickPauseMs}ms before checking for page change.`);
    await sleep(nextClickPauseMs);

    const moved = await waitForPageChange(previousUrl, pageKey);
    if (!moved) {
      console.log(DEBUG_PREFIX, "Next click did not move to a new page; stopping.");
      break;
    }

    pageNumber += 1;
  }

  const unique = dedupeAttendees(allAttendees);
  console.log(DEBUG_PREFIX, `Extraction done. Total unique attendees: ${unique.length}`);
  return unique;
}

function collectAttendeeCards() {
  return Array.from(document.querySelectorAll('[role="listitem"]')).filter((el) => {
    const hasProfileOrSearch = el.querySelector('a[href*="/in/"], a[href*="eventAttending"]');
    return Boolean(hasProfileOrSearch);
  });
}

function findNextButton() {
  const selectors = [
    '[data-testid="pagination-controls-next-button-visible"]',
    'button[aria-label*="Next"]',
    'button[aria-label*="next"]',
    'button.artdeco-pagination__button--next'
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button) {
      return button;
    }
  }

  return null;
}

function isPaginationButtonDisabled(button) {
  if (!button) return true;
  return button.disabled || button.getAttribute("aria-disabled") === "true";
}

function buildPageKey(cards) {
  const firstProfile = cards[0]?.querySelector('a[href*="/in/"]')?.getAttribute("href") || "no-first";
  const lastProfile = cards[cards.length - 1]?.querySelector('a[href*="/in/"]')?.getAttribute("href") || "no-last";
  return `${cards.length}|${firstProfile}|${lastProfile}`;
}

async function waitForPageChange(previousUrl, previousPageKey) {
  for (let i = 0; i < 25; i += 1) {
    await sleep(randomBetween(HUMANIZED_TIMING.pageChangePollMinMs, HUMANIZED_TIMING.pageChangePollMaxMs));
    const cards = collectAttendeeCards();
    const newKey = buildPageKey(cards);
    if (location.href !== previousUrl || (cards.length > 0 && newKey !== previousPageKey)) {
      return true;
    }
  }

  return false;
}

async function waitForAttendeeList() {
  for (let i = 0; i < 20; i += 1) {
    const cards = collectAttendeeCards();
    if (cards.length > 0) {
      return;
    }
    await sleep(randomBetween(HUMANIZED_TIMING.attendeeListPollMinMs, HUMANIZED_TIMING.attendeeListPollMaxMs));
  }
}

function parseAttendeeCard(card) {
  const nameAnchor = card.querySelector('a[href*="/in/"]');
  const name = cleanText(nameAnchor?.textContent ?? "");
  const profileLink = nameAnchor?.href?.split("?")[0] ?? "";

  const paragraphs = Array.from(card.querySelectorAll("p"))
    .map((p) => cleanText(p.textContent))
    .filter((t) => t.length > 0 && t !== name && !t.includes("• "));

  const title = paragraphs[0] ?? "";
  const location = paragraphs[1] ?? "";

  if (!name || name === "LinkedIn Member") return null;

  const cardText = cleanText(card.innerText);
  const contact = extractContactInfo(card, cardText);

  return {
    name,
    title,
    profileLink,
    email: contact.email,
    phone: contact.phone,
    website: contact.website,
    location,
    rawDetails: cardText
  };
}

function extractContactInfo(card, cardText) {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/;

  const emailMatch = cardText.match(emailRegex);
  const phoneMatch = cardText.match(phoneRegex);

  const links = Array.from(card.querySelectorAll("a[href]"));
  const website = links
    .map((link) => link.href)
    .find((href) => href.startsWith("http") && !href.includes("linkedin.com") && !href.includes("mailto:")) ?? "";

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

async function autoScroll(maxPasses) {
  for (let i = 0; i < maxPasses; i += 1) {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    await sleep(randomBetween(HUMANIZED_TIMING.scrollDelayMinMs, HUMANIZED_TIMING.scrollDelayMaxMs));
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function randomBetween(minMs, maxMs) {
  const lower = Math.ceil(minMs);
  const upper = Math.floor(maxMs);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
