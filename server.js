import express from "express";

const app = express();

const VERIFY_TOKEN = "ashu_instagram_bot_verify";

app.get("/webhook", (req,res)=>{

const mode = req.query["hub.mode"];
const token = req.query["hub.verify_token"];
const challenge = req.query["hub.challenge"];

if(mode === "subscribe" && token === VERIFY_TOKEN){
 return res.status(200).send(challenge);
}

res.sendStatus(403);

});

app.post("/webhook",(req,res)=>{
 console.log(req.body);
 res.sendStatus(200);
});

app.listen(3000,()=>{
 console.log("Webhook running");
});