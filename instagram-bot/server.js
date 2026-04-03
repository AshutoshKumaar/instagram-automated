import express from "express";
import dotenv from "dotenv";
import webhookRouter from "./routes/webhook.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/auth/callback", (req, res) => {
  console.log("Instagram business login callback:", JSON.stringify(req.query, null, 2));
  res.status(200).send("Instagram auth callback received. You can close this page.");
});

app.use("/webhook", webhookRouter);

app.use((req, res) => {
  res.status(404).send("Not Found");
});

app.listen(PORT, () => {
  console.log(`Instagram webhook server running on port ${PORT}`);
});
