import axios from "axios";

const API_VERSION = process.env.INSTAGRAM_API_VERSION || "v21.0";
const GRAPH_BASE = "https://graph.instagram.com";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendAutoReply(recipientId, text, accessTokenFromCaller) {
  const dryRun = process.env.DRY_RUN === "true";
  const accessToken =
    accessTokenFromCaller ||
    process.env.PAGE_ACCESS_TOKEN ||
    process.env.INSTAGRAM_ACCESS_TOKEN;
  const instagramUserId = process.env.IG_BUSINESS_ID || "me";
  const messagesEndpoint = `${GRAPH_BASE}/${API_VERSION}/${instagramUserId}/messages`;

  const payload = {
    recipient: { id: recipientId },
    message: { text }
  };

  if (dryRun) {
    console.log("[DRY_RUN] Would send message:", JSON.stringify({ endpoint: messagesEndpoint, payload }));
    return { ok: true, dry_run: true };
  }

  if (!accessToken) {
    throw new Error("Missing Instagram access token. Set PAGE_ACCESS_TOKEN or INSTAGRAM_ACCESS_TOKEN.");
  }

  const maxAttempts = 3;
  let attempt = 0;
  let lastError;

  while (attempt < maxAttempts) {
    try {
      const res = await axios.post(messagesEndpoint, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      });
      return res.data;
    } catch (err) {
      lastError = err;
      attempt += 1;
      const backoff = 500 * Math.pow(2, attempt - 1);
      console.warn(`sendAutoReply attempt ${attempt} failed, retrying in ${backoff}ms`);
      await wait(backoff);
    }
  }

  const errorPayload = lastError && lastError.response ? lastError.response.data : lastError;
  console.error("sendAutoReply failed after retries:", errorPayload);
  throw lastError;
}
