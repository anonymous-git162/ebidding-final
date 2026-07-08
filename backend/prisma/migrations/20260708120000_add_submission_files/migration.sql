-- AlterTable
ALTER TABLE "files" ADD COLUMN "submission_id" UUID;

-- AlterTable
ALTER TABLE "ebidding_rounds" ADD COLUMN "file_ids" UUID[] DEFAULT ARRAY[]::UUID[];
