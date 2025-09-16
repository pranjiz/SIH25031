const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

// ================== MongoDB Connection ==================
mongoose.connect("mongodb://127.0.0.1:27017/janhit_portal", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));

// ================== Schemas ==================

// Counter schema for auto-increment IDs
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model("Counter", counterSchema);

// Complaint schema
const complaintSchema = new mongoose.Schema({
  complaintId: { type: String, unique: true },
  aadhaar: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now }
});
const Complaint = mongoose.model("Complaint", complaintSchema);

// ================== Helper Function ==================
async function generateComplaintId() {
  const counter = await Counter.findOneAndUpdate(
    { name: "complaint" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const year = new Date().getFullYear();
  const padded = String(counter.seq).padStart(5, "0"); // e.g., 00001
  return `CMP${year}${padded}`;
}

// ================== Express Setup ==================
const app = express();
app.use(bodyParser.json());

// ================== Routes ==================

// Submit a complaint
app.post("/complaint", async (req, res) => {
  const { aadhaar, subject, description } = req.body;

  if (!aadhaar || !subject || !description) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const complaintId = await generateComplaintId();

    const newComplaint = await Complaint.create({
      complaintId,
      aadhaar,
      subject,
      description
    });

    res.json({
      success: true,
      message: "Complaint submitted successfully",
      complaintId: newComplaint.complaintId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check complaint status
app.get("/complaint-status/:id", async (req, res) => {
  try {
    const complaint = await Complaint.findOne({ complaintId: req.params.id });

    if (!complaint) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    res.json({
      complaintId: complaint.complaintId,
      status: complaint.status,
      subject: complaint.subject,
      description: complaint.description,
      createdAt: complaint.createdAt
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== Start Server ==================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});


/* DUMMY DB
Start User
{
  node server.js


  Submit a complaint
curl -X POST http://localhost:3000/complaint \
-H "Content-Type: application/json" \
-d '{
  "aadhaar": "111122223333",
  "subject": "Street Light not working",
  "description": "Street light near my house is broken for 2 weeks"
}'

example
{
  "success": true,
  "message": "Complaint submitted successfully",
  "complaintId": "CMP202500001"
}

