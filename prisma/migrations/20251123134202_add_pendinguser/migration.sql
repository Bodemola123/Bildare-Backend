/*
  Warnings:

  - You are about to drop the column `password_hash` on the `PendingUser` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `PendingUser` table. All the data in the column will be lost.
  - Made the column `otp_request_count` on table `PendingUser` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "PendingUser" DROP COLUMN "password_hash",
DROP COLUMN "username",
ADD COLUMN     "is_otp_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "otp" DROP NOT NULL,
ALTER COLUMN "otp_expires" DROP NOT NULL,
ALTER COLUMN "otp_request_count" SET NOT NULL;
