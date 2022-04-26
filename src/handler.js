const VoiceResponse = require("twilio").twiml.VoiceResponse;
const AccessToken = require("twilio").jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const nameGenerator = require("../name_generator");
const config = require("../config");
const { request } = require("express");

const fs = require('fs');
const path = require('path');
var tempFilePath = path.join(__dirname, "..", "public", "queue.json");
fs.writeFileSync(tempFilePath, '{"queueData":[]}');

var identity;
var identityList = [];

exports.tokenGenerator = function tokenGenerator() {
  identity = nameGenerator();
  identityList.push(identity); // push created identity to our identity list

  const accessToken = new AccessToken(
    config.accountSid,
    config.apiKey,
    config.apiSecret
  );
  accessToken.identity = identity;
  const grant = new VoiceGrant({
    outgoingApplicationSid: config.twimlAppSid,
    incomingAllow: true,
  });
  accessToken.addGrant(grant);

  // Include identity and token in a JSON response
  return {
    identity: identity,
    token: accessToken.toJwt(),
  };
};

exports.aboutToConnect = function aboutToConnect() {
  const response = new VoiceResponse();
  response.say('You are now being connected to Bobs Scuba Shop.');
  return response.toString();
};

exports.voiceResponse = function voiceResponse(requestBody) {
  // Use Cases
  // 1 - client outbounds PSTN number
  // 2 - client outbounds another client
  // 3 - PSTN inbounds client
  // 4 - Another client inbounds client
  // 5 - client REST requests to dial queue (API handled separately)

  const response = new VoiceResponse();
  const callerId = config.callerId;
  const queuecallerId = config.queuecallerId;
  console.log(`Incoming call... requestBody.To = ${requestBody.To}, requestBody.From = ${requestBody.From}, callerId = ${callerId}, identityList[0] = ${identityList[0]}, identity = ${identity}`);



  // If the request to the /voice endpoint is TO your Twilio Number
  // or your (main) client identity, then it is an incoming call towards 
  // your Twilio.Device.
  // => Gets enqueued in "BobsScubaShopQueue"
  if (requestBody.To == callerId || requestBody.To == identityList[0]){

    // Create a new caller obj
    var currentDate = new Date().toString();
    //console.log(currentDate);
    var newCaller = {
      "number": requestBody.From,
      "dateTime": currentDate
    }
    
    // Set filepath for queue.json
    let filePath = path.join(__dirname, "..", "public", "queue.json");

    // Read existing callers from queue.json
    let readData = fs.readFileSync(filePath, 'utf8');
    let queue = JSON.parse(readData);

    // Write new caller to queue.json
    queue.queueData.push(newCaller);
    let data = JSON.stringify(queue);
    fs.writeFileSync(filePath, data);
    
    // This will add the caller to the queue
    response.say({
      voice: 'Polly.Joanna'
    }, 'Hi there and welcome to Bobs Scuba Shop. We are currently assisting other customers. Your call will be answered by the next available representative. Thank you for continuing to hold.')
    response.enqueue({}, 'BobsScubaShopQueue');

    // Log events
    console.log(`Caller: ${requestBody.From} added to queue.`);

  // If the request to the /voice endpoint is TO the 2nd Twilio Number
  // for Bob's queue, check to make sure its from the (main) client
  // to avoid accidentally dequeuing the next call. This will only
  // occur if Bob inputs the 2nd Twilio Number manually.
  // => Dials queue to pull next call at the front of the line
  } else if (requestBody.To == queuecallerId && requestBody.From == `client:${identityList[0]}`){

    // Notify BobsScubaShop of connecting with the next caller
    response.say({
      voice: 'Polly.Joanna'
    }, 'Now connecting you to the next caller.');

    // Bridge with the next caller in the queue
    let dial = response.dial();
    dial.queue({
      url: 'https://74ac-174-51-54-54.ngrok.io/about-to-connect' // replace with URL of choice that houses instructions
    }, 'BobsScubaShopQueue');


  // If the request to the /voice endpoint is TO anything else, then it 
  // is an outgoing call.
  // => Dials outbound to either a PSTN number or another client
  } else if (requestBody.To){
    // This is an outgoing call

    // set the callerId
    let dial = response.dial({ callerId });

    // Check if the 'To' parameter is a Phone Number or Client Name
    // in order to use the appropriate TwiML noun 
    const attr = isAValidPhoneNumber(requestBody.To)
      ? "number"
      : "client";
    dial[attr]({}, requestBody.To);
  } else {
    response.say("Thanks for calling!");
  }

  return response.toString();
}

exports.callbackResponse = function callbackResponse(requestBody) {
  // When a call is completed
  
  // Set filepath for queue.json
  let filePath = path.join(__dirname, "..", "public", "queue.json");

  // Read existing callers from queue.json
  let readData = fs.readFileSync(filePath, 'utf8');
  let queue = JSON.parse(readData);

  // Find caller in queue (if exists) and remove from queue
  for (var i = 0; i < queue.queueData.length; i++){
    if (queue.queueData[i].number == requestBody.From){
      queue.queueData.splice(i, 1);


      // Write new array to queue.json
      let data = JSON.stringify(queue);
      fs.writeFileSync(filePath, data);

      // Log events
      console.log(`Caller: ${requestBody.From} removed from queue.`);

      break;
    }
  }

  
};

/**
 * Checks if the given value is valid as phone number
 * @param {Number|String} number
 * @return {Boolean}
 */
function isAValidPhoneNumber(number) {
  return /^[\d\+\-\(\) ]+$/.test(number);
}
