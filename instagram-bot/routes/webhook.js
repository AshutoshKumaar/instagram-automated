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

function getMessagingEventType(messageEvent) {
  if (!messageEvent || typeof messageEvent !== "object") return "unknown";
  if (messageEvent.message) return "message";
  if (messageEvent.read) return "read";
  if (messageEvent.delivery) return "delivery";
  if (messageEvent.postback) return "postback";
  if (messageEvent.reaction || messageEvent.message_reaction) return "reaction";
  if (messageEvent.optin) return "optin";
  if (messageEvent.referral) return "referral";
  if (messageEvent.standby) return "standby";
  return "unknown";
}

function extractIgnoredEvents(body) {
  const ignored = [];

  if (!body || !Array.isArray(body.entry)) {
    return ignored;
  }

  for (const [entryIndex, entry] of body.entry.entries()) {
    if (Array.isArray(entry.messaging)) {
      for (const [eventIndex, messageEvent] of entry.messaging.entries()) {
        const senderId =
          messageEvent?.sender?.id ||
          messageEvent?.from?.id ||
          messageEvent?.message?.from?.id ||
          null;
        const eventType = getMessagingEventType(messageEvent);

        if (eventType !== "message" || !senderId) {
          ignored.push({
            source: "entry.messaging",
            entryIndex,
            eventIndex,
            eventType,
            senderId,
            keys: messageEvent ? Object.keys(messageEvent) : [],
            reason: eventType === "message"
              ? "message_event_missing_sender"
              : "non_message_event"
          });
        }
      }
    }

    if (Array.isArray(entry.changes)) {
      for (const [changeIndex, change] of entry.changes.entries()) {
        const value = change?.value || {};
        const hasMessages = Array.isArray(value.messages) && value.messages.length > 0;
        const hasMessage = value.message && typeof value.message === "object";

        if (!hasMessages && !hasMessage) {
          ignored.push({
            source: `entry.changes.${change?.field || "unknown"}`,
            entryIndex,
            changeIndex,
            eventType: change?.field || "unknown",
            keys: value ? Object.keys(value) : [],
            reason: "change_without_message_payload"
          });
        }
      }
    }
  }

  return ignored;
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

router.post("/", express.json({ type: "*/*" }), async (req, res) => {
  try {
    const body = req.body;
    console.log(
      JSON.stringify({
        tag: "WEBHOOK_HEADERS",
        method: req.method,
        contentType: req.headers["content-type"] || null,
        userAgent: req.headers["user-agent"] || null
      })
    );
    console.log(
      JSON.stringify({
        tag: "WEBHOOK_PAYLOAD",
        body: body ?? null
      })
    );
    console.log(
      JSON.stringify({
        tag: "WEBHOOK_SUMMARY",
        object: body?.object ?? null,
        entryCount: Array.isArray(body?.entry) ? body.entry.length : 0,
        topLevelKeys: body ? Object.keys(body) : []
      })
    );

    const events = extractMessageEvents(body);
    console.log(JSON.stringify({ tag: "WEBHOOK_EVENT_COUNT", count: events.length }));

    const ignoredEvents = extractIgnoredEvents(body);
    console.log(JSON.stringify({ tag: "WEBHOOK_IGNORED_EVENT_COUNT", count: ignoredEvents.length }));
    for (const ignoredEvent of ignoredEvents) {
      console.log(JSON.stringify({ tag: "WEBHOOK_IGNORED_EVENT", ...ignoredEvent }));
    }

    if (events.length === 0) {
      console.log(
        JSON.stringify({
          tag: "WEBHOOK_NO_ACTIONABLE_MESSAGE",
          reason: ignoredEvents.length > 0
            ? "received_only_non_message_or_incomplete_events"
            : "no_supported_message_payload_found"
        })
      );

      if (Array.isArray(body?.entry)) {
        for (const [entryIndex, entry] of body.entry.entries()) {
          console.log(
            JSON.stringify({
              tag: "WEBHOOK_ENTRY_SUMMARY",
              entryIndex,
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
        JSON.stringify({
          tag: "WEBHOOK_EVENT",
          eventIndex: index + 1,
          source: event.source,
          senderId: event.senderId,
          text: event.text,
          rawKeys: event.raw ? Object.keys(event.raw) : []
        })
      );

      if (IG_ACCOUNT_ID && event.senderId === IG_ACCOUNT_ID) {
        console.log(JSON.stringify({ tag: "WEBHOOK_SKIP_SELF", senderId: event.senderId }));
        continue;
      }

      if (!event.text) {
        console.log(JSON.stringify({ tag: "WEBHOOK_NO_TEXT", senderId: event.senderId }));
      }

      console.log(JSON.stringify({ tag: "WEBHOOK_REPLY_ATTEMPT", senderId: event.senderId }));
      const replyResult = await sendAutoReply(event.senderId, REPLY_TEXT, ACCESS_TOKEN);
      console.log(
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
