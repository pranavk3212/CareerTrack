const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dns = require("dns");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

require("dotenv").config();

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const Job = require("./models/Job");
const User = require("./models/User");

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   MONGODB CONNECTION
========================= */

mongoose.connection.on("connected", () => {
  console.log("MongoDB EVENT: connected");
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB EVENT: disconnected");
});

mongoose.connection.on("error", (error) => {
  console.error("MongoDB EVENT ERROR:", error.message);
});

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    console.log("MongoDB connected successfully");

    // Verify that MongoDB is actually responding
    await mongoose.connection.db.admin().ping();

    console.log("MongoDB ping successful");
  } catch (error) {
    console.error("MongoDB connection failed:");
    console.error(error.message);

    process.exit(1);
  }
}

/* =========================
   AUTHENTICATION
========================= */

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(403).json({
      message: "Invalid or expired token",
    });
  }
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "CareerTrack backend is running!",
    mongoState: mongoose.connection.readyState,
  });
});

/* =========================
   REGISTER
========================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    console.log("REGISTER: request received");
    console.log(
      "REGISTER: MongoDB state:",
      mongoose.connection.readyState
    );

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Database is not connected",
        mongoState: mongoose.connection.readyState,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    console.log("REGISTER: checking existing user");

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    console.log("REGISTER: creating password hash");

    const hashedPassword = await bcrypt.hash(
      password,
      12
    );

    console.log("REGISTER: creating user");

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    console.log("REGISTER: user created successfully");

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      message: "Failed to create account",
      error: error.message,
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    console.log("LOGIN: request received");
    console.log(
      "LOGIN: MongoDB state:",
      mongoose.connection.readyState
    );

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Database is not connected",
        mongoState: mongoose.connection.readyState,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    console.log("LOGIN: finding user");

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      message: "Failed to login",
      error: error.message,
    });
  }
});

/* =========================
   CURRENT USER
========================= */

app.get(
  "/api/auth/me",
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select(
        "-password"
      );

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      res.json({
        id: user._id,
        name: user.name,
        email: user.email,
      });
    } catch (error) {
      console.error("AUTH ME ERROR:", error);

      res.status(500).json({
        message: "Failed to fetch user",
      });
    }
  }
);

/* =========================
   JOBS
========================= */

app.get(
  "/api/jobs",
  authenticateToken,
  async (req, res) => {
    try {
      console.log("GET JOBS USER ID:", req.user.id);
      console.log("DATABASE:", mongoose.connection.name);

      const jobs = await Job.find({
        userId: req.user.id,
      }).sort({ createdAt: -1 });

      console.log("GET JOBS RESULT COUNT:", jobs.length);

      res.json(jobs);
    } catch (error) {
      console.error("GET /api/jobs ERROR:", error);

      res.status(500).json({
        message: "Failed to fetch applications",
        error: error.message,
      });
    }
  }
);

app.post(
  "/api/jobs",
  authenticateToken,
  async (req, res) => {
    try {
      const job = await Job.create({
        ...req.body,
        userId: req.user.id,
      });

      res.status(201).json(job);
    } catch (error) {
      console.error("POST /api/jobs ERROR:", error);

      res.status(400).json({
        message: "Failed to create application",
        error: error.message,
      });
    }
  }
);

app.put(
  "/api/jobs/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const updatedJob =
        await Job.findOneAndUpdate(
          {
            _id: req.params.id,
            userId: req.user.id,
          },
          req.body,
          {
            new: true,
            runValidators: true,
          }
        );

      if (!updatedJob) {
        return res.status(404).json({
          message: "Application not found",
        });
      }

      res.json(updatedJob);
    } catch (error) {
      console.error("PUT /api/jobs ERROR:", error);

      res.status(400).json({
        message: "Failed to update application",
        error: error.message,
      });
    }
  }
);

app.delete(
  "/api/jobs/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const deletedJob =
        await Job.findOneAndDelete({
          _id: req.params.id,
          userId: req.user.id,
        });

      if (!deletedJob) {
        return res.status(404).json({
          message: "Application not found",
        });
      }

      res.json({
        message: "Application deleted successfully",
      });
    } catch (error) {
      console.error("DELETE /api/jobs ERROR:", error);

      res.status(500).json({
        message: "Failed to delete application",
        error: error.message,
      });
    }
  }
);

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(
      `CareerTrack server running on port ${PORT}`
    );
  });
}

startServer();