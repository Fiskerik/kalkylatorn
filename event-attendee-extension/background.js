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
    scrapeFromActiveTab(sendResponse);
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

async function scrapeFromActiveTab(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab?.id) {
      sendResponse({ ok: false, error: "No active tab found." });
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_ATTENDEES"
    });

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
