-- Migration: Add all new features for Ortholab
-- Created: 2025-01-27

-- Add new Role EXPEDITION
ALTER TYPE "Role" ADD VALUE 'EXPEDITION';

-- Create EntryType enum
CREATE TYPE "EntryType" AS ENUM ('NEW_PATIENT', 'PLANNING_FORM', 'COMPLETION_FORM', 'OTHER_SERVICES_FORM', 'STL_FILE');

-- Create EntryStatus enum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'ARCHIVED');

-- Create ApprovalVideoStatus enum
CREATE TYPE "ApprovalVideoStatus" AS ENUM ('PENDING', 'VIEWED', 'APPROVED', 'REJECTED', 'DOWNLOADED');

-- Create ApprovalDocStatus enum
CREATE TYPE "ApprovalDocStatus" AS ENUM ('PENDING', 'VIEWED', 'APPROVED', 'REJECTED', 'DOWNLOADED');

-- Create Entry table
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dentistId" TEXT NOT NULL,
    "caseId" TEXT,
    "entryType" "EntryType" NOT NULL,
    "sourceId" TEXT,
    "sourceType" TEXT,
    "boxNumber" TEXT,
    "lastStlDate" TIMESTAMP(3),
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- Create CaseApprovalVideo table
CREATE TABLE "CaseApprovalVideo" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "fileSize" INTEGER,
    "duration" INTEGER,
    "status" "ApprovalVideoStatus" NOT NULL DEFAULT 'PENDING',
    "viewedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseApprovalVideo_pkey" PRIMARY KEY ("id")
);

-- Create CaseApprovalDocument table
CREATE TABLE "CaseApprovalDocument" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileType" TEXT NOT NULL DEFAULT 'application/pdf',
    "status" "ApprovalDocStatus" NOT NULL DEFAULT 'PENDING',
    "viewedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseApprovalDocument_pkey" PRIMARY KEY ("id")
);

-- Create indexes for Entry
CREATE INDEX "Entry_patientId_idx" ON "Entry"("patientId");
CREATE INDEX "Entry_dentistId_idx" ON "Entry"("dentistId");
CREATE INDEX "Entry_status_idx" ON "Entry"("status");
CREATE INDEX "Entry_createdAt_idx" ON "Entry"("createdAt");

-- Create indexes for CaseApprovalVideo
CREATE INDEX "CaseApprovalVideo_caseId_idx" ON "CaseApprovalVideo"("caseId");
CREATE INDEX "CaseApprovalVideo_status_idx" ON "CaseApprovalVideo"("status");

-- Create indexes for CaseApprovalDocument
CREATE INDEX "CaseApprovalDocument_caseId_idx" ON "CaseApprovalDocument"("caseId");
CREATE INDEX "CaseApprovalDocument_status_idx" ON "CaseApprovalDocument"("status");

-- Add foreign keys for Entry
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign keys for CaseApprovalVideo
ALTER TABLE "CaseApprovalVideo" ADD CONSTRAINT "CaseApprovalVideo_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseApprovalVideo" ADD CONSTRAINT "CaseApprovalVideo_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign keys for CaseApprovalDocument
ALTER TABLE "CaseApprovalDocument" ADD CONSTRAINT "CaseApprovalDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseApprovalDocument" ADD CONSTRAINT "CaseApprovalDocument_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
