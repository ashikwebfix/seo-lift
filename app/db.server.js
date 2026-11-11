import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  const client = new PrismaClient();
  // Enable SQLite WAL mode and busy timeout to prevent lock contention during webhook/batch bursts.
  client.$queryRawUnsafe("PRAGMA journal_mode = WAL;").catch(() => {});
  client.$executeRawUnsafe("PRAGMA busy_timeout = 5000;").catch(() => {});
  return client;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal || !global.prismaGlobal.superAdminUser) {
    global.prismaGlobal = createPrismaClient();
  }
}

const prisma = global.prismaGlobal ?? createPrismaClient();

export default prisma;
