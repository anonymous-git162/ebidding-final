-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'PROCUREMENT', 'VENDOR', 'EVALUATOR', 'LEAD_EVALUATOR', 'APPROVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProcurementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_PROCUREMENT_REVIEW', 'RETURNED_FOR_REVISION', 'APPROVED', 'RFI_PUBLISHED', 'RFI_COLLECTING', 'RFI_CLOSED', 'RFP_DRAFTING', 'RFP_PUBLISHED', 'RFQ_OPEN', 'VENDOR_RESPONSE_IN_PROGRESS', 'EBIDDING_PREP', 'EBIDDING_OPEN', 'EBIDDING_CLOSED', 'EVALUATION', 'PENDING_APPROVAL', 'RETURNED_FROM_APPROVAL', 'AWARD_APPROVED', 'AWARD_ANNOUNCED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CurrentOwnerRole" AS ENUM ('REQUESTER', 'PROCUREMENT', 'VENDOR', 'EVALUATOR', 'LEAD_EVALUATOR', 'APPROVER', 'CLOSED');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('RFI', 'RFP', 'RFQ');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "EbiddingRoundStatus" AS ENUM ('PENDING', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'RETURNED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "tax_id" TEXT,
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "property_id" UUID NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurements" (
    "id" UUID NOT NULL,
    "request_no" TEXT NOT NULL,
    "request_type" "RequestType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "business_need" TEXT,
    "property_id" UUID,
    "department_id" UUID,
    "category" TEXT,
    "budget_estimate" DECIMAL(65,30),
    "justification" TEXT,
    "requester_id" UUID NOT NULL,
    "status" "ProcurementStatus" NOT NULL DEFAULT 'DRAFT',
    "current_owner_role" "CurrentOwnerRole" NOT NULL DEFAULT 'REQUESTER',
    "current_stage" TEXT,
    "approval_status" TEXT,
    "final_decision_reason" TEXT,
    "published_at" TIMESTAMP(3),
    "submission_deadline" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_timeline" (
    "id" UUID NOT NULL,
    "procurement_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "actor_id" UUID,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "procurement_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_invitations" (
    "id" UUID NOT NULL,
    "procurement_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "invitation_status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "vendor_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_submissions" (
    "id" UUID NOT NULL,
    "procurement_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "proposal_text" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfq_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ebidding_rounds" (
    "id" UUID NOT NULL,
    "procurement_id" UUID NOT NULL,
    "round_no" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "status" "EbiddingRoundStatus" NOT NULL DEFAULT 'PENDING',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ebidding_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ebidding_responses" (
    "id" UUID NOT NULL,
    "ebidding_round_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "bid_amount" DECIMAL(65,30) NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ebidding_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluator_assignments" (
    "id" UUID NOT NULL,
    "procurement_id" UUID NOT NULL,
    "evaluator_id" UUID NOT NULL,
    "is_lead" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluator_reviews" (
    "id" UUID NOT NULL,
    "evaluator_id" UUID NOT NULL,
    "procurement_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluator_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_consolidations" (
    "id" UUID NOT NULL,
    "procurement_id" UUID NOT NULL,
    "avg_score" DOUBLE PRECISION NOT NULL,
    "vote_summary" JSONB NOT NULL,
    "variance" DOUBLE PRECISION,
    "recommendation" TEXT,
    "lead_commentary" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lead_evaluator_id" UUID,

    CONSTRAINT "evaluation_consolidations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "procurement_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_results" (
    "id" UUID NOT NULL,
    "procurement_id" UUID NOT NULL,
    "winning_vendor_id" UUID,
    "announcement_text" TEXT,
    "announced_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "procurement_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "module" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID,
    "actor_role" TEXT,
    "before_data" JSONB,
    "after_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_user_id_key" ON "vendors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "properties_code_key" ON "properties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "procurements_request_no_key" ON "procurements"("request_no");

-- CreateIndex
CREATE INDEX "procurements_status_idx" ON "procurements"("status");

-- CreateIndex
CREATE INDEX "procurements_requester_id_idx" ON "procurements"("requester_id");

-- CreateIndex
CREATE INDEX "procurements_property_id_idx" ON "procurements"("property_id");

-- CreateIndex
CREATE INDEX "procurements_current_owner_role_idx" ON "procurements"("current_owner_role");

-- CreateIndex
CREATE INDEX "procurement_timeline_procurement_id_idx" ON "procurement_timeline"("procurement_id");

-- CreateIndex
CREATE INDEX "vendor_invitations_procurement_id_idx" ON "vendor_invitations"("procurement_id");

-- CreateIndex
CREATE INDEX "vendor_invitations_vendor_id_idx" ON "vendor_invitations"("vendor_id");

-- CreateIndex
CREATE INDEX "rfq_submissions_procurement_id_idx" ON "rfq_submissions"("procurement_id");

-- CreateIndex
CREATE INDEX "rfq_submissions_vendor_id_idx" ON "rfq_submissions"("vendor_id");

-- CreateIndex
CREATE INDEX "ebidding_rounds_procurement_id_idx" ON "ebidding_rounds"("procurement_id");

-- CreateIndex
CREATE INDEX "ebidding_responses_ebidding_round_id_idx" ON "ebidding_responses"("ebidding_round_id");

-- CreateIndex
CREATE INDEX "ebidding_responses_vendor_id_idx" ON "ebidding_responses"("vendor_id");

-- CreateIndex
CREATE INDEX "evaluator_assignments_procurement_id_idx" ON "evaluator_assignments"("procurement_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluator_assignments_procurement_id_evaluator_id_key" ON "evaluator_assignments"("procurement_id", "evaluator_id");

-- CreateIndex
CREATE INDEX "evaluator_reviews_procurement_id_idx" ON "evaluator_reviews"("procurement_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluator_reviews_evaluator_id_procurement_id_vendor_id_key" ON "evaluator_reviews"("evaluator_id", "procurement_id", "vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_consolidations_procurement_id_key" ON "evaluation_consolidations"("procurement_id");

-- CreateIndex
CREATE INDEX "approvals_procurement_id_idx" ON "approvals"("procurement_id");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_results_procurement_id_key" ON "procurement_results"("procurement_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurements" ADD CONSTRAINT "procurements_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurements" ADD CONSTRAINT "procurements_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurements" ADD CONSTRAINT "procurements_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_timeline" ADD CONSTRAINT "procurement_timeline_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "procurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invitations" ADD CONSTRAINT "vendor_invitations_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "procurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_invitations" ADD CONSTRAINT "vendor_invitations_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_submissions" ADD CONSTRAINT "rfq_submissions_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "procurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_submissions" ADD CONSTRAINT "rfq_submissions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ebidding_rounds" ADD CONSTRAINT "ebidding_rounds_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "procurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ebidding_responses" ADD CONSTRAINT "ebidding_responses_ebidding_round_id_fkey" FOREIGN KEY ("ebidding_round_id") REFERENCES "ebidding_rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ebidding_responses" ADD CONSTRAINT "ebidding_responses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignments" ADD CONSTRAINT "evaluator_assignments_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "procurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_assignments" ADD CONSTRAINT "evaluator_assignments_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_reviews" ADD CONSTRAINT "evaluator_reviews_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_reviews" ADD CONSTRAINT "evaluator_reviews_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "procurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluator_reviews" ADD CONSTRAINT "evaluator_reviews_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_consolidations" ADD CONSTRAINT "evaluation_consolidations_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "procurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_consolidations" ADD CONSTRAINT "evaluation_consolidations_lead_evaluator_id_fkey" FOREIGN KEY ("lead_evaluator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "procurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_results" ADD CONSTRAINT "procurement_results_procurement_id_fkey" FOREIGN KEY ("procurement_id") REFERENCES "procurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_results" ADD CONSTRAINT "procurement_results_winning_vendor_id_fkey" FOREIGN KEY ("winning_vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
