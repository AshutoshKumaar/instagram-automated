import express from "express";
import { sendAutoReply } from "../services/instagramService.js";

const router = express.Router();

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "ashu_instagram_bot_verify";

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
    console.log("Incoming webhook payload:", JSON.stringify(req.body, null, 2));

    const body = req.body;

    // iterate entries if present
    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        // modern Webhooks often include 'changes' with message inside
        if (entry.messaging && Array.isArray(entry.messaging)) {
          for (const messageEvent of entry.messaging) {
            const senderId = messageEvent.sender && messageEvent.sender.id;
            const messageText = messageEvent.message && messageEvent.message.text;
            if (senderId) {
              console.log(`Received message from ${senderId}: ${messageText}`);
              // send auto-reply
              const replyText = "Hello 👋 Thanks for messaging. Our team will reply soon.";
              await sendAutoReply(senderId, replyText, process.env.PAGE_ACCESS_TOKEN);
            }
          }
        }

        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            // For Instagram Messaging, messages may appear under change.value.messages
            const value = change.value || {};
            if (value.messages && Array.isArray(value.messages)) {
              for (const msg of value.messages) {
                const senderId = msg.from && msg.from.id;
                const text = msg.text && msg.text.body ? msg.text.body : msg.text;
                if (senderId) {
                  console.log(`Received IG message from ${senderId}: ${text}`);
                  const replyText = "Hello 👋 Thanks for messaging. Our team will reply soon.";
                  await sendAutoReply(senderId, replyText, process.env.PAGE_ACCESS_TOKEN);
                }
              }
            }
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Error handling webhook POST:", err && err.response ? err.response.data : err.message || err);
    res.sendStatus(500);
  }
});

export default router;
