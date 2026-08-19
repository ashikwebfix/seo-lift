-- CreateTable
CREATE TABLE "AppState" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "stateJson" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
