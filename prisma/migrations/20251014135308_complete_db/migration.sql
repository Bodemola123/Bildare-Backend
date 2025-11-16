/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `createdAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `interests` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `region` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "createdAt",
DROP COLUMN "id",
DROP COLUMN "name",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "interests" JSONB NOT NULL,
ADD COLUMN     "is_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referred_by" INTEGER,
ADD COLUMN     "region" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" SERIAL NOT NULL,
ADD COLUMN     "username" TEXT NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("user_id");

-- CreateTable
CREATE TABLE "UserProfile" (
    "profile_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "bio" TEXT,
    "avatar_url" TEXT,
    "social_links" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("profile_id")
);

-- CreateTable
CREATE TABLE "Role" (
    "role_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "assigned_by" INTEGER,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "Category" (
    "category_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "Template" (
    "template_id" TEXT NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" INTEGER,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "usability_score" DOUBLE PRECISION,
    "stack" TEXT[],
    "downloads_count" INTEGER NOT NULL DEFAULT 0,
    "users_count" INTEGER NOT NULL DEFAULT 0,
    "avg_rating" DOUBLE PRECISION,
    "example_links" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("template_id")
);

-- CreateTable
CREATE TABLE "TemplateMedia" (
    "media_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order_index" INTEGER,

    CONSTRAINT "TemplateMedia_pkey" PRIMARY KEY ("media_id")
);

-- CreateTable
CREATE TABLE "TemplateUsecase" (
    "usecase_id" SERIAL NOT NULL,
    "template_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "TemplateUsecase_pkey" PRIMARY KEY ("usecase_id")
);

-- CreateTable
CREATE TABLE "TemplateTag" (
    "tag_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TemplateTag_pkey" PRIMARY KEY ("tag_id")
);

-- CreateTable
CREATE TABLE "TemplateTagOnTemplate" (
    "template_id" TEXT NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "TemplateTagOnTemplate_pkey" PRIMARY KEY ("template_id","tag_id")
);

-- CreateTable
CREATE TABLE "RelatedTemplates" (
    "base_template_id" TEXT NOT NULL,
    "related_template_id" TEXT NOT NULL,

    CONSTRAINT "RelatedTemplates_pkey" PRIMARY KEY ("base_template_id","related_template_id")
);

-- CreateTable
CREATE TABLE "TemplateUpdateLog" (
    "log_id" SERIAL NOT NULL,
    "template_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changelog" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateUpdateLog_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "purchase_id" TEXT NOT NULL,
    "buyer_id" INTEGER NOT NULL,
    "template_id" TEXT NOT NULL,
    "amount_paid" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_id" TEXT NOT NULL,
    "license_signed_url" TEXT,
    "downloaded" BOOLEAN NOT NULL DEFAULT false,
    "refund_status" TEXT NOT NULL DEFAULT 'none',
    "refund_requested_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("purchase_id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "payment_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL,
    "gateway_response" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "refund_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "requested_by" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("refund_id")
);

-- CreateTable
CREATE TABLE "Review" (
    "review_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "template_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "AiEditSession" (
    "session_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "template_id" TEXT NOT NULL,
    "prompt_text" TEXT NOT NULL,
    "edited_code_url" TEXT,
    "preview_url" TEXT,
    "status" TEXT NOT NULL,
    "cost_credits" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "AiEditSession_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "payout_id" TEXT NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "payout_status" TEXT NOT NULL,
    "gateway_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("payout_id")
);

-- CreateTable
CREATE TABLE "Download" (
    "download_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "template_id" TEXT NOT NULL,
    "downloaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT NOT NULL,

    CONSTRAINT "Download_pkey" PRIMARY KEY ("download_id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "code" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "AuthorTeamMember" (
    "id" TEXT NOT NULL,
    "author_user_id" INTEGER NOT NULL,
    "member_user_id" INTEGER NOT NULL,
    "permissions" JSONB NOT NULL,

    CONSTRAINT "AuthorTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminTeamMember" (
    "id" TEXT NOT NULL,
    "admin_user_id" INTEGER NOT NULL,
    "member_user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "AdminTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "event_id" TEXT NOT NULL,
    "user_id" INTEGER,
    "template_id" TEXT,
    "event_type" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "Share" (
    "share_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "template_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("share_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_user_id_key" ON "UserProfile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateTag_name_key" ON "TemplateTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_purchase_id_key" ON "Payment"("purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_purchase_id_key" ON "Refund"("purchase_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "User"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "User"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "Role"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateMedia" ADD CONSTRAINT "TemplateMedia_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "Template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateUsecase" ADD CONSTRAINT "TemplateUsecase_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "Template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTagOnTemplate" ADD CONSTRAINT "TemplateTagOnTemplate_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "Template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTagOnTemplate" ADD CONSTRAINT "TemplateTagOnTemplate_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "TemplateTag"("tag_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatedTemplates" ADD CONSTRAINT "RelatedTemplates_base_template_id_fkey" FOREIGN KEY ("base_template_id") REFERENCES "Template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatedTemplates" ADD CONSTRAINT "RelatedTemplates_related_template_id_fkey" FOREIGN KEY ("related_template_id") REFERENCES "Template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateUpdateLog" ADD CONSTRAINT "TemplateUpdateLog_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "Template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "Template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "Purchase"("purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "Purchase"("purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "Template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEditSession" ADD CONSTRAINT "AiEditSession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEditSession" ADD CONSTRAINT "AiEditSession_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "Template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "Purchase"("purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Download" ADD CONSTRAINT "Download_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "Template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorTeamMember" ADD CONSTRAINT "AuthorTeamMember_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorTeamMember" ADD CONSTRAINT "AuthorTeamMember_member_user_id_fkey" FOREIGN KEY ("member_user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTeamMember" ADD CONSTRAINT "AdminTeamMember_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTeamMember" ADD CONSTRAINT "AdminTeamMember_member_user_id_fkey" FOREIGN KEY ("member_user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "Template"("template_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "Template"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;
