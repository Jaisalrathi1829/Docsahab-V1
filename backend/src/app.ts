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
import workflowRoutes from "./routes/workflow.routes";
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
    // PUT is required by the profile endpoints (patient + ambulance), which
    // replace the whole profile rather than patching fields.
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Request logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// JSON body parsing
app.use(express.json());

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

// NOTE: the legacy, UNAUTHENTICATED hospital.routes.ts (find-hospitals,
// hospital-response, hospital requests inbox) is intentionally NOT mounted.
// The real hospital-decision-engine + authenticated Hospital console
// (workflowRoutes below) are the sole live hospital decision path — see
// hospital-engine.service.ts. hospital.routes.ts / hospital.controller.ts /
// hospital.service.ts's ranking functions remain in the repo for reference
// and existing unit tests, but are not reachable in the running server.

// Auth + patient app + ambulance app + hospital console routes (the finalized client workflow)
app.use("/api/v1", workflowRoutes);

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
