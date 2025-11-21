-- CreateTable
CREATE TABLE "PendingUser" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "otp_expires" TIMESTAMP(3) NOT NULL,
    "username" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "otp_request_count" INTEGER DEFAULT 0,
    "otp_request_date" TIMESTAMP(3),

    CONSTRAINT "PendingUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingUser_email_key" ON "PendingUser"("email");
