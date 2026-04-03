import axios from "axios";

const GRAPH_BASE = "https://graph.facebook.com/v18.0";
const PAGE_MESSAGES_ENDPOINT = `${GRAPH_BASE}/me/messages`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendAutoReply(recipientId, text, pageAccessToken) {
  const dryRun = process.env.DRY_RUN === "true";

  const payload = {
    recipient: { id: recipientId },
    message: { text }
  };

  if (dryRun) {
    console.log("[DRY_RUN] Would send message:", JSON.stringify({ payload, access_token: pageAccessToken }));
    return { ok: true, dry_run: true };
  }

  const maxAttempts = 3;
  let attempt = 0;
  let lastError;

  while (attempt < maxAttempts) {
    try {
      const res = await axios.post(PAGE_MESSAGES_ENDPOINT, payload, {
        params: { access_token: pageAccessToken }
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

  // after retries failed
  const errorPayload = lastError && lastError.response ? lastError.response.data : lastError;
  console.error("sendAutoReply failed after retries:", errorPayload);
  throw lastError;
}
