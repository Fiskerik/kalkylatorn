const __cbNoopLogger = { log() {}, warn() {}, error() {} };

const statusTitle = document.getElementById("statusTitle");
const statusMessage = document.getElementById("statusMessage");
const statusContainer = document.getElementById("statusContainer");
const spinner = document.getElementById("spinner");
const closeBtn = document.getElementById("closeBtn");

closeBtn.addEventListener("click", () => window.close());

function showStatus(type, title, message, debugInfo = null) {
  const box = document.createElement("div");
  box.className = `status-box ${type}`;
  box.innerHTML = `
    <div class="status-title">${escapeHtml(title)}</div>
    <div class="status-message">${escapeHtml(message)}</div>
    ${debugInfo ? `<div class="debug-info">${debugInfo}</div>` : ""}
  `;

  statusContainer.innerHTML = "";
  statusContainer.appendChild(box);

  if (type === "error") {
    closeBtn.style.display = "inline-block";
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function decodeJwtPayload(accessToken) {
  const tokenParts = accessToken.split(".");
  if (tokenParts.length !== 3) {
    throw new Error("Invalid access token format received from Supabase.");
  }

  const base64Payload = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
  const paddedPayload = base64Payload + "=".repeat((4 - (base64Payload.length % 4)) % 4);

  const jsonPayload = atob(paddedPayload);
  return JSON.parse(jsonPayload);
}

function getCallbackParams() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);

  return {
    accessToken: hashParams.get("access_token") || queryParams.get("access_token") || "",
    refreshToken: hashParams.get("refresh_token") || queryParams.get("refresh_token") || "",
    expiresIn: hashParams.get("expires_in") || queryParams.get("expires_in") || "",
    tokenType: hashParams.get("token_type") || queryParams.get("token_type") || "bearer",
    errorCode: hashParams.get("error") || queryParams.get("error") || "",
    errorDescription: hashParams.get("error_description") || queryParams.get("error_description") || "",
  };
}

async function handleAuthCallback() {
  try {
    __cbNoopLogger.log("[signin-callback] starting auth callback handler");
    __cbNoopLogger.log("[signin-callback] raw location", {
      href: window.location.href,
      search: window.location.search,
      hash: window.location.hash,
    });

    const params = getCallbackParams();

    if (params.errorCode || params.errorDescription) {
      throw new Error(params.errorDescription || `Authentication error: ${params.errorCode}`);
    }

    if (!params.accessToken) {
      throw new Error("No authentication data found in callback URL. The sign-in flow may have expired or been cancelled.");
    }

    const payload = decodeJwtPayload(params.accessToken);
    const email = String(payload.email || payload.user_metadata?.email || "").trim();
    const authProvider = String(payload.app_metadata?.provider || payload.user_metadata?.provider || "email").toLowerCase();
    const expiresAt = payload.exp || Math.floor(Date.now() / 1000) + parseInt(params.expiresIn || "3600", 10);

    if (!email) {
      throw new Error("No email found in authentication token. Please try signing in again.");
    }

    const methodLabel = authProvider === "google" ? "Google" : "email link/code";
    showStatus("info", "Saving session...", `Signed in via ${methodLabel} as ${email}. Saving to extension storage...`);

    const response = await chrome.runtime.sendMessage({
      type: "SUPABASE_AUTH_CALLBACK",
      session: {
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
        expires_at: expiresAt,
        token_type: params.tokenType,
        user: {
          id: payload.sub || payload.user_id || "",
          email,
        },
      },
    });

    if (!response) {
      throw new Error("No response from extension background script. Please reload the extension and try again.");
    }

    if (!response.success) {
      throw new Error(response.error || "Failed to store authentication session in extension.");
    }

    spinner.style.display = "none";
    statusTitle.textContent = "Signed in successfully! ✓";
    statusMessage.textContent = `Welcome back, ${email}`;

    const expiresDate = new Date(expiresAt * 1000).toLocaleString();
    showStatus(
      "success",
      "Authentication complete",
      "You can close this tab now. Your Prospect In extension is now signed in and ready to use.",
      `Method: ${escapeHtml(methodLabel)}<br>Email: ${escapeHtml(email)}<br>Session expires: ${escapeHtml(expiresDate)}`,
    );

    try {
      await chrome.runtime.sendMessage({
        type: "AUTH_SUCCESS_CALLBACK",
        email,
      });
    } catch (err) {
      __cbNoopLogger.warn("[signin-callback] could not trigger auth success callback", err);
    }

    setTimeout(() => {
      window.close();
    }, 2500);
  } catch (error) {
    __cbNoopLogger.error("[signin-callback] authentication failed:", error);

    spinner.style.display = "none";
    statusTitle.textContent = "Authentication failed";
    statusMessage.textContent = "Something went wrong during sign-in.";

    showStatus(
      "error",
      "Error",
      error.message,
      `Error type: ${escapeHtml(error.name)}<br>Please close this tab and try again from the extension side panel.`,
    );
  }
}

document.addEventListener("DOMContentLoaded", handleAuthCallback);
