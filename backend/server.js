const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to DevPilot API",
  });
});

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "DevPilot backend is running",
    status: "healthy",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`DevPilot backend running at http://localhost:${PORT}`);
});