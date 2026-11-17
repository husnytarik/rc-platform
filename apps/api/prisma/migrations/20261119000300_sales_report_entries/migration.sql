-- Satış personeli rapor girdileri. Eklemelidir.
CREATE TABLE "sales_report_entries" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_report_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sales_report_entries_authorId_occurredAt_idx" ON "sales_report_entries"("authorId", "occurredAt");
CREATE INDEX "sales_report_entries_occurredAt_idx" ON "sales_report_entries"("occurredAt");
