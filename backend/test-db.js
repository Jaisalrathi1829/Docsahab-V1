// Quick connection test script
require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log("✅ Query result:", result);
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
