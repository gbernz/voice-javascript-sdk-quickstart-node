const Router = require("express").Router;
const { tokenGenerator, voiceResponse, callbackResponse, aboutToConnect } = require("./handler");

const router = new Router();

router.get("/token", (req, res) => {
  res.send(tokenGenerator());
});

router.post("/about-to-connect", (req, res) => {
  res.send(aboutToConnect());
})

router.post("/voice", (req, res) => {
  res.set("Content-Type", "text/xml");
  res.send(voiceResponse(req.body));
});

router.post("/delivery-callback", (req, res) => {
  res.sendStatus(200);
  res.send(callbackResponse(req.body));
})

module.exports = router;
