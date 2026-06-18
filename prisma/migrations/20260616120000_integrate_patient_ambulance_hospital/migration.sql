-- ============================================================================
-- Integrate Person 5 Entity Models into the Emergency Core Service
-- ============================================================================
-- The init migration (20260611161631_init) created the emergency-domain tables
-- (Emergency, TimelineEvent, HospitalCandidate) before the Patient/Ambulance/
-- Hospital entities were integrated into the schema. This migration brings the
-- database in line with the unified schema by:
--   1. Creating the Patient, Ambulance, Hospital tables (Person 5 entities)
--   2. Adding their indexes / unique constraints
--   3. Wiring the foreign keys that make Emergency reference real entities:
--        Emergency.patientId           -> Patient(id)   [required, RESTRICT]
--        Emergency.assignedAmbulanceId -> Ambulance(id) [optional, SET NULL]
--        Emergency.assignedHospitalId  -> Hospital(id)  [optional, SET NULL]
--        HospitalCandidate.hospitalId  -> Hospital(id)  [required, RESTRICT]
--
-- This migration is purely additive (no DROP, no column rewrite) and therefore
-- safe to run against an existing database that already holds emergency rows.
-- ============================================================================

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "sex" TEXT,
    "bloodGroup" TEXT NOT NULL,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phoneNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ambulance" (
    "id" TEXT NOT NULL,
    "vehicleNo" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ambulance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "hasICU" BOOLEAN NOT NULL,
    "hasTraumaCare" BOOLEAN NOT NULL,
    "hasCardiology" BOOLEAN NOT NULL,
    "availableBeds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_phoneNumber_key" ON "Patient"("phoneNumber");

-- CreateIndex
CREATE INDEX "Patient_phoneNumber_idx" ON "Patient"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Ambulance_vehicleNo_key" ON "Ambulance"("vehicleNo");

-- CreateIndex
CREATE INDEX "Ambulance_isAvailable_idx" ON "Ambulance"("isAvailable");

-- CreateIndex
CREATE INDEX "Hospital_availableBeds_idx" ON "Hospital"("availableBeds");

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_assignedAmbulanceId_fkey" FOREIGN KEY ("assignedAmbulanceId") REFERENCES "Ambulance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_assignedHospitalId_fkey" FOREIGN KEY ("assignedHospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalCandidate" ADD CONSTRAINT "HospitalCandidate_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
