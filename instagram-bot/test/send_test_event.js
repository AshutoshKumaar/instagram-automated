import axios from "axios";

async function sendTest() {
  const url = "http://localhost:3000/webhook";
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: { id: "TEST_SENDER_123" },
                  text: { body: "Hello there, bot!" }
                }
              ]
            }
          }
        ]
      }
    ]
  };

  try {
    const res = await axios.post(url, payload, { headers: { "Content-Type": "application/json" } });
    console.log("Test webhook posted, status:", res.status);
  } catch (err) {
    console.error("Error posting test webhook:", err.message || err);
    if (err.response) console.error(err.response.data);
  }
}

sendTest();
