// ============================================================================
// Server Entry Point
// ============================================================================
// Starts the Express server and connects to the database.
// ============================================================================

import http from "http";
import app from "./app";
import { prisma } from "./prisma/client";
import { registerHospitalEventHandlers } from "./services/hospital.service";
import { registerHospitalSelectionProvider } from "./providers/hospital-selection.provider";
import { initRealtime } from "./services/realtime.service";

const PORT = process.env.PORT ?? 3000;

// Person 4: Socket.IO shares the SAME HTTP server as the Express API — one
// backend, one port. `initRealtime` attaches the websocket gateway and the
// emergencyEvents → rooms broadcast bridge.
const server = http.createServer(app);

async function main() {
  try {
    // Verify database connectivity
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    // Person 3: hospital discovery auto-starts on AMBULANCE_EN_ROUTE and the
    // assignment locks on PATIENT_PICKED_UP (event-driven, via emergencyEvents).
    registerHospitalEventHandlers();

    // Hospital selection: with no hospital-facing console yet, the simulation
    // provider accepts on the best-ranked hospital's behalf as soon as the
    // ranking engine publishes candidates — so hospital coordination completes
    // while the ambulance is still driving to the patient.
    registerHospitalSelectionProvider();

    // Person 4: realtime gateway (rooms + event broadcasting).
    initRealtime(server);

    server.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🏥 Docsahab Emergency Core Service             ║
║                                                  ║
║   Running on: http://localhost:${String(PORT).padEnd(5)}              ║
║   Health:     http://localhost:${String(PORT).padEnd(5)}/api/v1/health ║
║   Environment: ${(process.env.NODE_ENV ?? "development").padEnd(33)} ║
║                                                  ║
╚══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received — shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received — shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

main();
