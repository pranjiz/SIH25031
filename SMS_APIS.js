//npm install express mysql2 twilio body-parser
//first install above then run below code 
// Database example in last take referal

const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const twilio = require("twilio");

const app = express();
app.use(bodyParser.json());

// ✅ Twilio credentials (get from https://www.twilio.com/console)
const accountSid = "YOUR_TWILIO_ACCOUNT_SID";
const authToken = "YOUR_TWILIO_AUTH_TOKEN";
const twilioNumber = "+1XXXXXXXXXX"; // Your Twilio number
const client = new twilio(accountSid, authToken);

// ✅ Database connection
async function getConnection() {
  return await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "yourpassword",
    database: "janhit_portal"
  });
}

// ✅ Send SMS via Twilio
async function sendSms(to, message) {
  try {
    const response = await client.messages.create({
      body: message,
      from: twilioNumber,
      to: `+91${to}` // Indian numbers
    });
    console.log("✅ SMS sent:", response.sid);
  } catch (error) {
    console.error("❌ Error sending SMS:", error.message);
  }
}

// ✅ Route to update complaint status
app.post("/update-status", async (req, res) => {
  const { complaintId, newStatus } = req.body;

  if (!complaintId || !newStatus) {
    return res.status(400).json({ error: "complaintId and newStatus are required" });
  }

  try {
    const connection = await getConnection();

    // Update complaint status
    const [result] = await connection.execute(
      "UPDATE complaints SET status = ? WHERE id = ?",
      [newStatus, complaintId]
    );

    if (result.affectedRows === 0) {
      await connection.end();
      return res.status(404).json({ error: "Complaint not found" });
    }

    // Get user mobile
    const [rows] = await connection.execute(
      "SELECT mobile FROM complaints WHERE id = ?",
      [complaintId]
    );

    await connection.end();

    if (rows.length > 0) {
      const mobile = rows[0].mobile;
      const message = `Dear citizen, your complaint #${complaintId} status has been updated to "${newStatus}". - Janhit Portal`;

      // Send SMS notification
      await sendSms(mobile, message);
    }

    res.json({ success: true, message: "Complaint updated and SMS sent" });

  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

/*CREATE DATABASE janhit_portal;

USE janhit_portal;

CREATE TABLE complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  mobile VARCHAR(15),
  status VARCHAR(50)
);

-- Example data
INSERT INTO complaints (user_id, mobile, status)
VALUES (1, '9876543210', 'Pending');
*/