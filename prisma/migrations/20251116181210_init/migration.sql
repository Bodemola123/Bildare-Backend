-- AlterTable
ALTER TABLE "User" ADD COLUMN     "otp" TEXT,
ADD COLUMN     "otp_expires" TIMESTAMP(3),
ADD COLUMN     "refresh_token" TEXT,
ADD COLUMN     "reset_password_expires" TIMESTAMP(3),
ADD COLUMN     "reset_password_token" TEXT,
ADD COLUMN     "role" TEXT,
ALTER COLUMN "region" DROP NOT NULL;
