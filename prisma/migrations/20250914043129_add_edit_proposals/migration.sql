-- CreateTable
CREATE TABLE "public"."edit_proposals" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "originalContent" TEXT NOT NULL,
    "patch" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edit_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "edit_proposals_documentId_idx" ON "public"."edit_proposals"("documentId");

-- CreateIndex
CREATE INDEX "edit_proposals_status_idx" ON "public"."edit_proposals"("status");

-- AddForeignKey
ALTER TABLE "public"."edit_proposals" ADD CONSTRAINT "edit_proposals_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
