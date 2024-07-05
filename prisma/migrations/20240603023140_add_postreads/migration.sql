-- CreateTable
CREATE TABLE "PostRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "clientId" TEXT,
    "postSlug" TEXT NOT NULL,
    CONSTRAINT "PostRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PostRead_userId_postSlug_idx" ON "PostRead"("userId", "postSlug");

-- CreateIndex
CREATE INDEX "PostRead_clientId_postSlug_idx" ON "PostRead"("clientId", "postSlug");

-- CreateIndex
CREATE INDEX "PostRead_postSlug_createdAt_idx" ON "PostRead"("postSlug", "createdAt");

-- CreateIndex
CREATE INDEX "PostRead_createdAt_userId_idx" ON "PostRead"("createdAt", "userId");
