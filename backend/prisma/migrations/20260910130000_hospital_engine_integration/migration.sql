-- AlterEnum
ALTER TYPE "SessionRole" ADD VALUE 'HOSPITAL';

-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "profileCompleted" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "HospitalLiveStatus" (
    "hospitalId" TEXT NOT NULL,
    "acceptingEmergencyPatients" BOOLEAN NOT NULL DEFAULT true,
    "operationalStatus" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "emergencyDepartmentStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "traumaDepartmentStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "icuBedsAvailable" INTEGER NOT NULL DEFAULT 0,
    "generalBedsAvailable" INTEGER NOT NULL DEFAULT 0,
    "erBaysAvailable" INTEGER NOT NULL DEFAULT 0,
    "traumaBaysAvailable" INTEGER NOT NULL DEFAULT 0,
    "ventilatorsAvailable" INTEGER NOT NULL DEFAULT 0,
    "bloodProductsAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSource" TEXT NOT NULL DEFAULT 'HOSPITAL_OPERATED',

    CONSTRAINT "HospitalLiveStatus_pkey" PRIMARY KEY ("hospitalId")
);

-- CreateTable
CREATE TABLE "HospitalSelectionState" (
    "emergencyId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalSelectionState_pkey" PRIMARY KEY ("emergencyId")
);

-- CreateIndex
CREATE INDEX "HospitalLiveStatus_lastUpdated_idx" ON "HospitalLiveStatus"("lastUpdated");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_phoneNumber_key" ON "Hospital"("phoneNumber");

-- AddForeignKey
ALTER TABLE "HospitalLiveStatus" ADD CONSTRAINT "HospitalLiveStatus_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalSelectionState" ADD CONSTRAINT "HospitalSelectionState_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "Emergency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

