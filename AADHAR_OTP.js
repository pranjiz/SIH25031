/* Dependencies install
npm init -y
npm install express mongoose crypto twilio axios express-rate-limit
*/

// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  aadhaar: { type: String, unique: true, required: true },
  name: String,
  mobile: { type: String, required: true }
});

module.exports = mongoose.model("User", userSchema);

// models/Otp.js
const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  aadhaar: { type: String, required: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Otp", otpSchema);

//server.js
const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const twilio = require("twilio");
const axios = require("axios");

const User = require("./models/User");
const Otp = require("./models/Otp");

const app = express();
app.use(express.json());

// --- CONFIG ---
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/janhit_test";
const SMS_PROVIDER = process.env.SMS_PROVIDER || "twilio"; // "twilio" or "msg91"

// Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "YOUR_TWILIO_SID";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "YOUR_TWILIO_AUTH";
const TWILIO_NUMBER = process.env.TWILIO_NUMBER || "+1XXXXXXXXXX";
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// MSG91
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY || "YOUR_MSG91_KEY";
const MSG91_FLOW_ID = process.env.MSG91_FLOW_ID || "YOUR_FLOW_ID";

// OTP settings
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;

// Rate limit
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  message: { error: "Too many requests, try later" }
});
app.use("/request-otp", limiter);
app.use("/verify-otp", limiter);

// --- HELPERS ---
function generateOtp() {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

function hashOtp(otp, salt) {
  return crypto.createHmac("sha256", salt).update(otp).digest("hex");
}

function maskMobile(mobile) {
  if (!mobile) return "";
  return "*****" + mobile.slice(-4);
}

async function sendSmsTwilio(toMobile, text) {
  try {
    const to = `+91${toMobile}`;
    const msg = await twilioClient.messages.create({
      body: text,
      from: TWILIO_NUMBER,
      to
    });
    return { success: true, sid: msg.sid };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function sendSmsMsg91(toMobile, text) {
  try {
    const res = await axios.post(
      "https://api.msg91.com/api/v5/flow/",
      {
        flow_id: MSG91_FLOW_ID,
        recipients: [{ mobiles: `91${toMobile}`, params: { OTP: text } }]
      },
      {
        headers: { authkey: MSG91_AUTH_KEY, "Content-Type": "application/json" }
      }
    );
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function sendSms(toMobile, text) {
  return SMS_PROVIDER === "msg91"
    ? sendSmsMsg91(toMobile, text)
    : sendSmsTwilio(toMobile, text);
}

// --- ROUTES ---

// Request OTP
app.post("/request-otp", async (req, res) => {
  const { aadhaar } = req.body;
  if (!aadhaar) return res.status(400).json({ error: "aadhaar is required" });

  try {
    const user = await User.findOne({ aadhaar });
    if (!user) return res.status(404).json({ error: "Aadhaar not found" });

    const otp = generateOtp();
    const salt = crypto.randomBytes(16).toString("hex");
    const otpHash = `${salt}:${hashOtp(otp, salt)}`;
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60000);

    await Otp.create({ aadhaar, otpHash, expiresAt });

    const msg = `Your Janhit Portal OTP is ${otp}. Valid for ${OTP_TTL_MINUTES} min.`;
    const sendResult = await sendSms(user.mobile, msg);

    if (!sendResult.success) {
      return res.status(500).json({ error: "Failed to send OTP" });
    }

    res.json({ success: true, message: `OTP sent to ${maskMobile(user.mobile)}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify OTP
app.post("/verify-otp", async (req, res) => {
  const { aadhaar, otp } = req.body;
  if (!aadhaar || !otp) return res.status(400).json({ error: "aadhaar and otp required" });

  try {
    const otpDoc = await Otp.findOne({ aadhaar, used: false }).sort({ createdAt: -1 });

    if (!otpDoc) return res.status(400).json({ error: "No OTP requested" });
    if (otpDoc.expiresAt < new Date()) {
      otpDoc.used = true;
      await otpDoc.save();
      return res.status(400).json({ error: "OTP expired" });
    }
    if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) {
      otpDoc.used = true;
      await otpDoc.save();
      return res.status(429).json({ error: "Too many attempts" });
    }

    const [salt, storedHash] = otpDoc.otpHash.split(":");
    const givenHash = hashOtp(otp, salt);

    if (givenHash === storedHash) {
      otpDoc.used = true;
      await otpDoc.save();
      return res.json({ success: true, message: "OTP verified" });
    } else {
      otpDoc.attempts += 1;
      if (otpDoc.attempts >= MAX_OTP_ATTEMPTS) otpDoc.used = true;
      await otpDoc.save();
      return res.status(400).json({ error: "Invalid OTP" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- START ---
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => console.error("DB connection error:", err));

  /* Dummy Data
  use janhit_test
db.users.insertOne({
  aadhaar: "111122223333",
  name: "Test User",
  mobile: "9876543210"
})
*/
/* Test API
Request api
curl -X POST http://localhost:3000/request-otp \
-H "Content-Type: application/json" \
-d '{"aadhaar":"111122223333"}'

verify api
curl -X POST http://localhost:3000/verify-otp \
-H "Content-Type: application/json" \
-d '{"aadhaar":"111122223333","otp":"123456"}'
*/

