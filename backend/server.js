const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to DevPilot API",
  });
});

// Backend health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "DevPilot backend is running",
    status: "healthy",
  });
});

// Database health check
app.get("/api/db-health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS database_time");

    res.status(200).json({
      success: true,
      message: "PostgreSQL connected successfully",
      database: process.env.DB_NAME,
      time: result.rows[0].database_time,
    });
  } catch (error) {
    console.error("Database connection error:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Get all projects
app.get("/api/projects", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, description, created_at FROM projects ORDER BY created_at DESC"
    );

    res.json({
      success: true,
      projects: result.rows,
    });
  } catch (error) {
    console.error("Fetch projects error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
});

// Create a project
app.post("/api/projects", async (req, res) => {
  try {
    const { name, description = "" } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Project name cannot exceed 100 characters",
      });
    }

    if (typeof description !== "string") {
      return res.status(400).json({
        success: false,
        message: "Description must be a string",
      });
    }

    const result = await pool.query(
      `INSERT INTO projects (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at`,
      [name.trim(), description.trim()]
    );

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project: result.rows[0],
    });
  } catch (error) {
    console.error("Create project error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to create project",
    });
  }
});

app.listen(PORT, () => {
  console.log(`DevPilot backend running at http://localhost:${PORT}`);
});