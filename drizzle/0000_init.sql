CREATE TABLE "accounts" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "daily_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"title" text NOT NULL,
	"node_id" text,
	"area" text,
	"planned_min" integer,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"node_id" text,
	"area" text NOT NULL,
	"subject" text NOT NULL,
	"topic" text NOT NULL,
	"kind" text NOT NULL,
	"method" text NOT NULL,
	"planned_min" integer NOT NULL,
	"started_at" timestamp NOT NULL,
	"paused_at" timestamp,
	"paused_ms" integer DEFAULT 0 NOT NULL,
	"ended_at" timestamp,
	"duration_min" real,
	"day" date,
	"questions_done" integer,
	"questions_correct" integer,
	"mood" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"water_cups" integer DEFAULT 0 NOT NULL,
	"mood" integer,
	"journal" text,
	"reading_min" integer DEFAULT 0 NOT NULL,
	"exercise" boolean DEFAULT false NOT NULL,
	CONSTRAINT "habit_logs_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"code" text PRIMARY KEY NOT NULL,
	"created_by" text,
	"used_by" text,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"level" text NOT NULL,
	"area" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"phase" text,
	"relevance" text,
	"theory" boolean DEFAULT false NOT NULL,
	"practice" boolean DEFAULT false NOT NULL,
	"mastery" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"password_hash" text,
	"pet_name" text DEFAULT 'Brasa' NOT NULL,
	"enem_date" date,
	"water_goal" integer DEFAULT 8 NOT NULL,
	"reading_goal_min" integer DEFAULT 30 NOT NULL,
	"focus_goal_min" integer DEFAULT 180 NOT NULL,
	"questions_goal" integer DEFAULT 30 NOT NULL,
	"daily_xp_goal" integer DEFAULT 150 NOT NULL,
	"weekly_xp_goal" integer DEFAULT 900 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "xp_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"dedupe" text
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_node_id_study_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."study_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_node_id_study_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."study_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_nodes" ADD CONSTRAINT "study_nodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_user_day_idx" ON "daily_tasks" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "focus_user_day_idx" ON "focus_sessions" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "study_nodes_user_idx" ON "study_nodes" USING btree ("user_id","parent_id");--> statement-breakpoint
CREATE INDEX "xp_user_day_idx" ON "xp_events" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_dedupe_idx" ON "xp_events" USING btree ("user_id","dedupe");