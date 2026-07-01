-- AlterTable
ALTER TABLE "users" ADD COLUMN     "department_id" UUID,
ADD COLUMN     "property_id" UUID;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
