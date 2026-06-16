// ============================================================================
// Server Entry Point
// ============================================================================
// Starts the Express server and connects to the database.
// ============================================================================

import app from "./app";
import { prisma } from "./prisma/client";

const PORT = process.env.PORT ?? 3000;

async function main() {
  try {
    // Verify database connectivity
    await prisma.$connect();
    console.log("✅ Database connected successfully");

    app.listen(PORT, () => {
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
