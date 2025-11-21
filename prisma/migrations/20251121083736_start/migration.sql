-- AlterTable
ALTER TABLE "User" ADD COLUMN     "otp_request_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otp_request_date" TIMESTAMP(3);
