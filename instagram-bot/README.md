# Instagram Automation Backend

Quick start:

1. Create a `.env` in `instagram-bot/` with these variables (example in `.env.sample`):

```
PAGE_ACCESS_TOKEN=PASTE_YOUR_PAGE_ACCESS_TOKEN_HERE
VERIFY_TOKEN=ashu_instagram_bot_verify
IG_BUSINESS_ID=1237636151858886
PORT=3000
```

2. Install and run:

```bash
cd instagram-bot
npm install
node server.js
# expose via ngrok
ngrok http 3000
```

Webhook endpoints:
- `GET /webhook` — verification
- `POST /webhook` — receives incoming Instagram messages and auto-replies

Testing locally (dry-run):

1. Set `DRY_RUN=true` in your `.env` to avoid calling the Graph API while testing.

2. Start the server and run the test script which simulates an incoming IG message:

```bash
cd instagram-bot
DRY_RUN=true node server.js &
node test/send_test_event.js
```

You should see the server log the incoming payload and the dry-run send message payload in the console.
