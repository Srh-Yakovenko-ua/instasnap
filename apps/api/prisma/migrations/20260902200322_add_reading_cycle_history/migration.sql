-- AlterTable
ALTER TABLE "book_reading_progress_events" ADD COLUMN     "reading_cycle_id" UUID;

-- AlterTable
ALTER TABLE "reading_goal_books" ADD COLUMN     "qualified_reading_cycle_id" UUID;

-- CreateTable
CREATE TABLE "book_reading_cycles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "state" TEXT NOT NULL,
    "started_at" DATE,
    "finished_at" DATE,
    "ended_at" DATE,
    "rating" DOUBLE PRECISION,
    "completion_metadata" JSONB,
    "first_completion_reliability" TEXT,
    "legacy_source_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "book_reading_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reading_history_state" (
    "user_id" UUID NOT NULL,
    "activity_reliable_from" DATE NOT NULL,
    "cycle_history_cutover_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_reading_history_state_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_reading_cycles_legacy_source_key_key" ON "book_reading_cycles"("legacy_source_key");

-- CreateIndex
CREATE INDEX "book_reading_cycles_user_id_finished_at_idx" ON "book_reading_cycles"("user_id", "finished_at");

-- CreateIndex
CREATE INDEX "book_reading_cycles_book_id_state_idx" ON "book_reading_cycles"("book_id", "state");

-- CreateIndex
CREATE INDEX "book_reading_progress_events_reading_cycle_id_idx" ON "book_reading_progress_events"("reading_cycle_id");

-- CreateIndex
CREATE INDEX "reading_goal_books_qualified_reading_cycle_id_idx" ON "reading_goal_books"("qualified_reading_cycle_id");

-- AddForeignKey
ALTER TABLE "book_reading_progress_events" ADD CONSTRAINT "book_reading_progress_events_reading_cycle_id_fkey" FOREIGN KEY ("reading_cycle_id") REFERENCES "book_reading_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_reading_cycles" ADD CONSTRAINT "book_reading_cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_reading_cycles" ADD CONSTRAINT "book_reading_cycles_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reading_history_state" ADD CONSTRAINT "user_reading_history_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_goal_books" ADD CONSTRAINT "reading_goal_books_qualified_reading_cycle_id_fkey" FOREIGN KEY ("qualified_reading_cycle_id") REFERENCES "book_reading_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
