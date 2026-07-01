-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "entity_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "procurements" ADD COLUMN     "currency" TEXT DEFAULT 'USD';
