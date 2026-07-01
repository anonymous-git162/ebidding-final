-- AlterTable
ALTER TABLE "files" ADD COLUMN     "procurement_id" UUID;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "procurements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
