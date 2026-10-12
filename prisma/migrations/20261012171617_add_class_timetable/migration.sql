-- CreateEnum
CREATE TYPE "timetable_status" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "timetables" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL DEFAULT '2024-2025',
    "department" TEXT DEFAULT 'Computer Science & Engineering',
    "effective_from" TIMESTAMP(3),
    "effective_till" TIMESTAMP(3),
    "status" "timetable_status" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "attachment_key" TEXT,
    "attachment_name" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "timetable_id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "subject_code" TEXT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "faculty_name" TEXT,
    "room_number" TEXT,
    "session_type" "component_type" NOT NULL DEFAULT 'theory',
    "section_name" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timetables_section_id_idx" ON "timetables"("section_id");

-- CreateIndex
CREATE INDEX "timetables_status_idx" ON "timetables"("status");

-- CreateIndex
CREATE INDEX "timetable_slots_timetable_id_idx" ON "timetable_slots"("timetable_id");

-- CreateIndex
CREATE INDEX "timetable_slots_day_idx" ON "timetable_slots"("day");

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
