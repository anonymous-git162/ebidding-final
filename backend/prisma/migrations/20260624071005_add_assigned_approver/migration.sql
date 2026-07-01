-- AlterTable
ALTER TABLE "procurements" ADD COLUMN     "assigned_approver_id" UUID;

-- AddForeignKey
ALTER TABLE "procurements" ADD CONSTRAINT "procurements_assigned_approver_id_fkey" FOREIGN KEY ("assigned_approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
