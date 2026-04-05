import express from "express";
import { sendAutoReply } from "../services/instagramService.js";

const router = express.Router();

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "ashu_instagram_bot_verify";
const REPLY_TEXT = "Hello! Thanks for messaging. Our team will reply soon.";
const ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || process.env.INSTAGRAM_ACCESS_TOKEN;
const IG_ACCOUNT_ID = process.env.IG_BUSINESS_ID;

function extractText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.text === "string") return value.text;
  if (value.text && typeof value.text.body === "string") return value.text.body;
  if (typeof value.body === "string") return value.body;
  if (typeof value.message === "string") return value.message;
  if (value.message && typeof value.message.text === "string") return value.message.text;
  if (value.message && typeof value.message.body === "string") return value.message.body;
  if (typeof value.title === "string") return value.title;
  return "";
}

function buildEvent(source, senderId, text, raw) {
  return {
    source,
    senderId,
    text: text || "",
    raw
  };
}

function extractMessageEvents(body) {
  const events = [];

  if (!body || !Array.isArray(body.entry)) {
    return events;
  }

  for (const entry of body.entry) {
    if (Array.isArray(entry.messaging)) {
      for (const messageEvent of entry.messaging) {
        const senderId =
          messageEvent?.sender?.id ||
          messageEvent?.from?.id ||
          messageEvent?.message?.from?.id;
        const text = extractText(messageEvent?.message) || extractText(messageEvent);
        events.push(buildEvent("entry.messaging", senderId, text, messageEvent));
      }
    }

    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        const value = change?.value || {};

        if (Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            const senderId =
              msg?.from?.id ||
              msg?.sender?.id ||
              value?.sender?.id;
            const text = extractText(msg);
            events.push(buildEvent(`entry.changes.${change.field || "unknown"}.messages[]`, senderId, text, msg));
          }
        }

        if (value.message && typeof value.message === "object") {
          const senderId =
            value?.from?.id ||
            value?.sender?.id ||
            value?.message?.from?.id;
          const text = extractText(value.message) || extractText(value);
          events.push(buildEvent(`entry.changes.${change.field || "unknown"}.message`, senderId, text, value));
        }
      }
    }
  }

  return events.filter((event) => event.senderId);
}

router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

router.post("/", express.json(), async (req, res) => {
  try {
    const body = req.body;
    console.log("[WEBHOOK] Incoming payload:", JSON.stringify(body, null, 2));
    console.log(
      "[WEBHOOK] Top-level summary:",
      JSON.stringify({
        object: body?.object,
        entryCount: Array.isArray(body?.entry) ? body.entry.length : 0,
        topLevelKeys: body ? Object.keys(body) : []
      })
    );

    const events = extractMessageEvents(body);
    console.log(`[WEBHOOK] Actionable message events found: ${events.length}`);

    if (events.length === 0) {
      if (Array.isArray(body?.entry)) {
        for (const [entryIndex, entry] of body.entry.entries()) {
          console.log(
            `[WEBHOOK] Entry ${entryIndex} summary:`,
            JSON.stringify({
              keys: Object.keys(entry || {}),
              changeFields: Array.isArray(entry?.changes)
                ? entry.changes.map((change) => change?.field || "unknown")
                : [],
              messagingCount: Array.isArray(entry?.messaging) ? entry.messaging.length : 0
            })
          );
        }
      }
    }

    for (const [index, event] of events.entries()) {
      console.log(
        `[WEBHOOK] Event ${index + 1}:`,
        JSON.stringify({
          source: event.source,
          senderId: event.senderId,
          text: event.text,
          rawKeys: event.raw ? Object.keys(event.raw) : []
        })
      );

      if (IG_ACCOUNT_ID && event.senderId === IG_ACCOUNT_ID) {
        console.log(`[WEBHOOK] Skipping self-sent event from account ${event.senderId}`);
        continue;
      }

      if (!event.text) {
        console.log(`[WEBHOOK] Event from ${event.senderId} has no text body, replying anyway.`);
      }

      console.log(`[WEBHOOK] Sending auto-reply to ${event.senderId}`);
      const replyResult = await sendAutoReply(event.senderId, REPLY_TEXT, ACCESS_TOKEN);
      console.log(
        `[WEBHOOK] Auto-reply result for ${event.senderId}:`,
        JSON.stringify(replyResult)
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(
      "Error handling webhook POST:",
      err && err.response ? err.response.data : err.message || err
    );
    res.sendStatus(500);
  }
});

export default router;
