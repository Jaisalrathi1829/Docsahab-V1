-- CreateEnum
CREATE TYPE "SessionRole" AS ENUM ('PATIENT', 'AMBULANCE');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('NONE', 'INITIATED', 'ACTIVE', 'ENDED');

-- AlterTable
ALTER TABLE "Ambulance" ADD COLUMN     "ambulanceType" TEXT,
ADD COLUMN     "baseLocation" TEXT,
ADD COLUMN     "driverLicense" TEXT,
ADD COLUMN     "driverName" TEXT,
ADD COLUMN     "drivingExperience" TEXT,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "serviceArea" TEXT;

-- AlterTable
ALTER TABLE "Emergency" ADD COLUMN     "callEndedAt" TIMESTAMP(3),
ADD COLUMN     "callStartedAt" TIMESTAMP(3),
ADD COLUMN     "callStatus" "CallStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "hospitalLockedAt" TIMESTAMP(3),
ADD COLUMN     "hospitalNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "patientMedications" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "medications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "profileCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "SessionRole" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "role" "SessionRole" NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_role_subjectId_idx" ON "Session"("role", "subjectId");

-- CreateIndex
CREATE INDEX "OtpChallenge_phoneNumber_role_idx" ON "OtpChallenge"("phoneNumber", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Ambulance_phoneNumber_key" ON "Ambulance"("phoneNumber");

-- CreateIndex
CREATE INDEX "Ambulance_isOnline_idx" ON "Ambulance"("isOnline");

-- CreateIndex
CREATE INDEX "Ambulance_phoneNumber_idx" ON "Ambulance"("phoneNumber");

