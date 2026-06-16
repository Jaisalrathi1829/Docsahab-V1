-- Docsahab Emergency Core Service — Database Migration
-- Generated from Prisma schema

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('SOS_TRIGGERED', 'AMBULANCE_ASSIGNED', 'AMBULANCE_EN_ROUTE', 'PATIENT_PICKED_UP', 'SEVERITY_SELECTED', 'HOSPITAL_SEARCHING', 'HOSPITAL_ACCEPTANCE_REQUESTED', 'HOSPITAL_ACCEPTED', 'HOSPITAL_NOTIFIED', 'EN_ROUTE_TO_HOSPITAL', 'ARRIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('RED', 'YELLOW', 'GREEN');

-- CreateEnum
CREATE TYPE "HospitalResponse" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "Emergency" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "EmergencyStatus" NOT NULL DEFAULT 'SOS_TRIGGERED',
    "severity" "Severity",
    "emergencyType" TEXT,
    "patientLatitude" DOUBLE PRECISION NOT NULL,
    "patientLongitude" DOUBLE PRECISION NOT NULL,
    "patientAddress" TEXT,
    "assignedAmbulanceId" TEXT,
    "assignedHospitalId" TEXT,
    "etaMinutes" INTEGER,
    "patientName" TEXT,
    "patientAge" INTEGER,
    "patientSex" TEXT,
    "patientBloodGroup" TEXT,
    "patientAllergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "patientConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criticalAlert" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Emergency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "emergencyId" TEXT NOT NULL,
    "status" "EmergencyStatus" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalCandidate" (
    "id" TEXT NOT NULL,
    "emergencyId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "hospitalName" TEXT,
    "rank" INTEGER NOT NULL,
    "response" "HospitalResponse" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HospitalCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Emergency_patientId_idx" ON "Emergency"("patientId");
CREATE INDEX "Emergency_status_idx" ON "Emergency"("status");
CREATE INDEX "Emergency_assignedAmbulanceId_idx" ON "Emergency"("assignedAmbulanceId");
CREATE INDEX "Emergency_assignedHospitalId_idx" ON "Emergency"("assignedHospitalId");
CREATE INDEX "Emergency_createdAt_idx" ON "Emergency"("createdAt");
CREATE INDEX "TimelineEvent_emergencyId_idx" ON "TimelineEvent"("emergencyId");
CREATE INDEX "TimelineEvent_createdAt_idx" ON "TimelineEvent"("createdAt");
CREATE INDEX "HospitalCandidate_emergencyId_idx" ON "HospitalCandidate"("emergencyId");
CREATE INDEX "HospitalCandidate_hospitalId_idx" ON "HospitalCandidate"("hospitalId");
CREATE UNIQUE INDEX "HospitalCandidate_emergencyId_hospitalId_key" ON "HospitalCandidate"("emergencyId", "hospitalId");

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "Emergency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalCandidate" ADD CONSTRAINT "HospitalCandidate_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "Emergency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma migration tracking
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
VALUES (gen_random_uuid()::varchar, 'manual', '20260611_init', now(), 1);
