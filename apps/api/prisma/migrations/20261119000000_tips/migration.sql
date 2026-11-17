-- Günün ipucu. Eklemelidir.
CREATE TABLE "tips" (
    "id" UUID NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tips_pkey" PRIMARY KEY ("id")
);
