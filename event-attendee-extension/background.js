
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoZW1xZ2p3cWpxZ2pxcm5qaHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTUyNDcsImV4cCI6MjA5MTczMTI0N30.Gyt1fxQgwM3_WFt6yEri-wRxvIg4m_z2TjjbwyzLOfI",
    supabaseUrl: "https://vhemqgjwqjqgjqrnjhvm.supabase.co",
    appUrl: "https://prospectin.vercel.app"
  });
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
    scrapeFromActiveTab(sendResponse, sender, message?.tabId, message?.attendeeLimit);
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

  if (message?.type === "SUPABASE_AUTH_CALLBACK") {
    storeSupabaseSession(message?.session)
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error("[Event Attendee Extractor] Failed to store callback session:", error);
        sendResponse({ success: false, error: "Failed to store callback session." });
      });
    return true;
  }

  if (message?.type === "AUTH_SUCCESS_CALLBACK") {
    chrome.runtime.sendMessage({
      type: "AUTH_STATE_CHANGED",
      email: message?.email || null,
      at: Date.now(),
    }).catch(() => {});

    sendResponse({ success: true });
    return true;
  }

  return false;
});

async function scrapeFromActiveTab(sendResponse, sender, requestedTabId, attendeeLimit) {
  try {
    const tabId = await resolveTargetTabId(sender, requestedTabId);

    if (!tabId) {
      sendResponse({ ok: false, error: "No valid browser tab found." });
      return;
    }

    const response = await requestAttendeesFromTab(tabId, attendeeLimit);

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
  if (!url || typeof url !== "string") return false;
  return url.includes("linkedin.com") && /^https?:\/\//.test(url);
}

async function requestAttendeesFromTab(tabId, attendeeLimit) {
  const maxAttendees = Number.isInteger(attendeeLimit) && attendeeLimit > 0 ? attendeeLimit : 100;
  console.log("[Event Attendee Extractor] Requesting attendees with limit:", maxAttendees);

  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: "EXTRACT_ATTENDEES",
      maxAttendees
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
      type: "EXTRACT_ATTENDEES",
      maxAttendees
    });
  }
}

function isReceivingEndMissingError(error) {
  const message = String(error?.message ?? "");
  return message.includes("Receiving end does not exist");
}

async function storeSupabaseSession(session) {
  if (!session?.access_token) {
    return { success: false, error: "Missing access token in callback." };
  }

  const userFromToken = session?.user?.id ? session.user : null;
  const user = userFromToken || (await fetchSupabaseUser(session.access_token));

  if (!user?.id) {
    return { success: false, error: "Unable to resolve signed in user from callback token." };
  }

  const normalizedSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token || "",
    expires_at: session.expires_at || null,
    token_type: session.token_type || "bearer",
    user,
  };

  await chrome.storage.local.set({ session: normalizedSession });

  return {
    success: true,
    session: normalizedSession,
  };
}

async function fetchSupabaseUser(accessToken) {
  const { supabaseUrl, supabaseAnonKey } = await chrome.storage.local.get(["supabaseUrl", "supabaseAnonKey"]);
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) return null;
  return res.json();
}
