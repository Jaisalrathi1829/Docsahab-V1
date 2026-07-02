// ============================================================================
// Express Application Setup
// ============================================================================
// Configures Express with security headers, CORS, JSON parsing, routes,
// and the global error handler. Exported for use by server.ts and testing.
// ============================================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import emergencyRoutes from "./routes/emergency.routes";
import ambulanceRoutes from "./routes/ambulance.routes";
import hospitalRoutes from "./routes/hospital.routes";
import { errorHandler } from "./middleware/error-handler.middleware";
import { errorResponse } from "./utils/api-response";

const app = express();

// --------------------------------------------------------------------------
// Middleware
// --------------------------------------------------------------------------

// Security headers
app.use(helmet());

// CORS — allow all origins in development, restrict in production
app.use(
  cors({
    origin: process.env.NODE_ENV === "production"
      ? process.env.ALLOWED_ORIGINS?.split(",")
      : "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Request logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// JSON body parsing
app.use(express.json());

// Serve static files from Front End directory (for active-emergency.json)
import path from "path";
app.use(express.static(path.resolve(__dirname, "../../Front End")));

// --------------------------------------------------------------------------
// Routes
// --------------------------------------------------------------------------

// Health check
app.get("/api/v1/health", (_req, res) => {
  res.json({
    success: true,
    data: {
      service: "docsahab-emergency-core",
      status: "healthy",
      timestamp: new Date().toISOString(),
    },
    message: "Service is running",
  });
});

// Emergency Core Service routes
app.use("/api/v1", emergencyRoutes);

// Ambulance Matching module routes (Person 2) — mounted alongside, same prefix
app.use("/api/v1", ambulanceRoutes);

// Hospital Ranking & Acceptance module routes (Person 3) — same prefix
app.use("/api/v1", hospitalRoutes);

// --------------------------------------------------------------------------
// 404 handler
// --------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json(
    errorResponse("NOT_FOUND", "The requested endpoint does not exist")
  );
});

// --------------------------------------------------------------------------
// Global error handler (must be last)
// --------------------------------------------------------------------------

app.use(errorHandler);

export default app;
