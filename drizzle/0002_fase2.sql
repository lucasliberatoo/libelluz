CREATE TABLE "essay_themes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"axis" text NOT NULL,
	"source" text,
	"notes" text,
	"status" text DEFAULT 'stock' NOT NULL,
	"pass_count" integer DEFAULT 0 NOT NULL,
	"drawn_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essays" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"theme_id" text,
	"title" text NOT NULL,
	"day" date NOT NULL,
	"score" integer,
	"competencies" jsonb,
	"error_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comments" text,
	"text" text,
	"photo" text,
	"material_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_parts" (
	"exam_id" text NOT NULL,
	"user_id" text NOT NULL,
	"part" text NOT NULL,
	"day" date NOT NULL,
	"correct" integer,
	"total" integer DEFAULT 45 NOT NULL,
	"minutes" integer,
	"essay_score" integer,
	"competencies" jsonb,
	CONSTRAINT "exam_parts_exam_id_part_pk" PRIMARY KEY("exam_id","part")
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"source" text,
	"enem_key" text,
	"url" text,
	"material_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"section" text DEFAULT 'material' NOT NULL,
	"area" text,
	"subject" text,
	"node_id" text,
	"url" text,
	"storage_key" text,
	"size" integer,
	"mime" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"correct" boolean NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"area" text NOT NULL,
	"subject" text,
	"topic" text,
	"node_id" text,
	"statement" text NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer" integer,
	"explanation" text,
	"source" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"node_id" text,
	"area" text NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"due_day" date NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"interval_days" integer DEFAULT 1 NOT NULL,
	"last_accuracy" integer,
	"done_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"node_id" text,
	"area" text NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"kind" text DEFAULT 'study' NOT NULL,
	"planned_min" integer NOT NULL,
	"done_min" real DEFAULT 0 NOT NULL,
	"done_at" timestamp,
	"review_id" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "week_minutes" jsonb DEFAULT '[0,180,180,180,180,180,120]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rest_day" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "essay_rhythm" text DEFAULT 'semana' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "essay_day" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "essay_themes" ADD CONSTRAINT "essay_themes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "essays" ADD CONSTRAINT "essays_theme_id_essay_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."essay_themes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_parts" ADD CONSTRAINT "exam_parts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_parts" ADD CONSTRAINT "exam_parts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_node_id_study_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."study_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_node_id_study_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."study_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_node_id_study_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."study_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_blocks" ADD CONSTRAINT "schedule_blocks_node_id_study_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."study_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "materials_user_idx" ON "materials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "attempts_user_q_idx" ON "question_attempts" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "questions_user_idx" ON "questions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reviews_user_due_idx" ON "reviews" USING btree ("user_id","due_day");--> statement-breakpoint
CREATE INDEX "blocks_user_day_idx" ON "schedule_blocks" USING btree ("user_id","day");