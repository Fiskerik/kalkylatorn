chrome.runtime.onInstalled.addListener(() => {
  console.log("[Event Attendee Extractor] Extension installed.");
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  await chrome.sidePanel.open({ tabId: tab.id });
  console.log("[Event Attendee Extractor] Side panel opened.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SCRAPE_ATTENDEES") {
    scrapeFromActiveTab(sendResponse, sender, message?.tabId);
    return true;
  }

  if (message?.type === "GET_LAST_ATTENDEES") {
    chrome.storage.local.get(["lastAttendees", "lastScrapedAt"], (result) => {
      sendResponse({
        attendees: result.lastAttendees ?? [],
        lastScrapedAt: result.lastScrapedAt ?? null
      });
    });
    return true;
  }

  return false;
});

async function scrapeFromActiveTab(sendResponse, sender, requestedTabId) {
  try {
    const tabId = await resolveTargetTabId(sender, requestedTabId);

    if (!tabId) {
      sendResponse({ ok: false, error: "No valid browser tab found." });
      return;
    }

    const response = await requestAttendeesFromTab(tabId);

    if (!response?.ok) {
      sendResponse({
        ok: false,
        error: response?.error ?? "Content script did not return data."
      });
      return;
    }

    const payload = {
      lastAttendees: response.attendees,
      lastScrapedAt: new Date().toISOString()
    };

    chrome.storage.local.set(payload, () => {
      console.log(
        "[Event Attendee Extractor] Saved attendees to storage:",
        response.attendees.length
      );
      sendResponse({ ok: true, attendees: response.attendees });
    });
  } catch (error) {
    console.error("[Event Attendee Extractor] Failed to scrape:", error);
    sendResponse({
      ok: false,
      error: "Could not extract attendees on this page."
    });
  }
}

async function resolveTargetTabId(sender, requestedTabId) {
  const candidates = [];

  if (Number.isInteger(requestedTabId)) {
    candidates.push(await safeGetTab(requestedTabId));
  }

  if (sender?.tab?.id) {
    candidates.push(await safeGetTab(sender.tab.id));
  }

  const [activeTab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });
  candidates.push(activeTab);

  const allTabs = await chrome.tabs.query({ lastFocusedWindow: true });
  const linkedinTabs = allTabs.filter((tab) => tab?.url?.includes("linkedin.com"));
  candidates.push(...linkedinTabs);

  const validTab = candidates.find((tab) => isScrapableUrl(tab?.url));

  console.log(
    "[Event Attendee Extractor] Target tab resolution:",
    candidates
      .filter(Boolean)
      .map((tab) => ({ id: tab.id, url: tab.url, scrapable: isScrapableUrl(tab.url) }))
  );

  return validTab?.id ?? null;
}

async function safeGetTab(tabId) {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

function isScrapableUrl(url) {
  return typeof url === "string" &&
    url.includes("linkedin.com/events") &&
    url.includes("/attendees");
}

async function requestAttendeesFromTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: "EXTRACT_ATTENDEES"
    });
  } catch (error) {
    if (!isReceivingEndMissingError(error)) {
      throw error;
    }

    console.log(
      "[Event Attendee Extractor] Content script unavailable; injecting and retrying.",
      tabId
    );

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });

    return chrome.tabs.sendMessage(tabId, {
      type: "EXTRACT_ATTENDEES"
    });
  }
}

function isReceivingEndMissingError(error) {
  const message = String(error?.message ?? "");
  return message.includes("Receiving end does not exist");
}
