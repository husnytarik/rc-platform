-- Reçeteler (Günün reçetesi). Eklemelidir.
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,
    "prepMinutes" INTEGER NOT NULL DEFAULT 5,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "difficulty" TEXT NOT NULL DEFAULT 'kolay',
    "ingredients" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "tip" TEXT,
    "productCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "recipes_slug_key" ON "recipes"("slug");
