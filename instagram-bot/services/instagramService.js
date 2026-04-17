import axios from "axios";

const API_VERSION = process.env.INSTAGRAM_API_VERSION || "v25.0";
const GRAPH_BASE = "https://graph.instagram.com";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorPayload(err) {
  return err && err.response ? err.response.data : { message: err?.message || String(err) };
}

function isPermanentApiError(err) {
  const status = err?.response?.status;
  return status >= 400 && status < 500;
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
    console.log(
      JSON.stringify({ tag: "SEND_DRY_RUN", endpoint: messagesEndpoint, payload })
    );
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
      console.log(
        JSON.stringify({
          tag: "SEND_ATTEMPT",
          recipientId,
          endpoint: messagesEndpoint,
          attempt: attempt + 1
        })
      );
      const res = await axios.post(messagesEndpoint, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        }
      });
      console.log(JSON.stringify({ tag: "SEND_SUCCESS", recipientId, data: res.data }));
      return res.data;
    } catch (err) {
      lastError = err;
      attempt += 1;

      if (isPermanentApiError(err)) {
        const errorPayload = getErrorPayload(err);
        console.warn(
          JSON.stringify({
            tag: "SEND_PERMANENT_FAILURE",
            recipientId,
            attempt,
            status: err.response.status,
            error: errorPayload
          })
        );
        throw err;
      }

      const backoff = 500 * Math.pow(2, attempt - 1);
      console.warn(`sendAutoReply attempt ${attempt} failed, retrying in ${backoff}ms`);
      await wait(backoff);
    }
  }

  const errorPayload = getErrorPayload(lastError);
  console.error("sendAutoReply failed after retries:", errorPayload);
  throw lastError;
}
