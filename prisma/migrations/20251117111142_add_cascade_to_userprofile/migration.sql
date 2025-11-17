-- DropForeignKey
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_user_id_fkey";

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
