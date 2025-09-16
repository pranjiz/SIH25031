// server.js
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());           // allow frontend requests
app.use(express.json());   // parse JSON request body

// Sample complaint data (normally from a database)
let complaints = [
  { id: 201, description: "Potholes on main road near market.", status: "pending" },
  { id: 202, description: "Streetlight not working outside my house.", status: "in-progress" },
  { id: 203, description: "Garbage not collected in the colony.", status: "resolved" }
];

// Routes
// Get all complaints
app.get("/api/complaints", (req, res) => {
  res.json(complaints);
});

// Add new complaint
app.post("/api/complaints", (req, res) => {
  const { description, status } = req.body;
  if (!description || !status) {
    return res.status(400).json({ error: "Description and status required" });
  }
  const newComplaint = {
    id: complaints.length + 1 + 200,
    description,
    status
  };
  complaints.push(newComplaint);
  res.status(201).json(newComplaint);
});

// Update complaint status
app.put("/api/complaints/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const complaint = complaints.find(c => c.id == id);
  if (!complaint) {
    return res.status(404).json({ error: "Complaint not found" });
  }
  complaint.status = status || complaint.status;
  res.json(complaint);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
