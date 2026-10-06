CREATE TABLE "discipline_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"apps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"base_tokens" integer DEFAULT 3 NOT NULL,
	"minutes_per_token" integer DEFAULT 10 NOT NULL,
	"block_notifications" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_spends" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"pkg" text NOT NULL,
	"label" text NOT NULL,
	"minutes" integer NOT NULL,
	"client_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discipline_settings" ADD CONSTRAINT "discipline_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_spends" ADD CONSTRAINT "token_spends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spends_user_day_idx" ON "token_spends" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "spends_client_idx" ON "token_spends" USING btree ("user_id","client_id");