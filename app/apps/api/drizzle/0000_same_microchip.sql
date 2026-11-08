CREATE TABLE "expediting_packages" (
	"project_id" text NOT NULL,
	"id" text NOT NULL,
	"discipline" text NOT NULL,
	"code" text NOT NULL,
	"name" text,
	"vendor" text,
	"status" text NOT NULL,
	"plan_pct" double precision,
	"actual_pct" double precision,
	"variance" double precision,
	"ros_date" date,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "expediting_packages_project_id_id_pk" PRIMARY KEY("project_id","id")
);
--> statement-breakpoint
CREATE TABLE "module_state_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"module_key" text NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text,
	"actor" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procurement_packages" (
	"project_id" text NOT NULL,
	"id" text NOT NULL,
	"code" text NOT NULL,
	"discipline" text,
	"description" text,
	"vendor_code" text,
	"vendor" text,
	"origins" text,
	"loa_no" text,
	"loa_date" date,
	"po_no" text,
	"po_date" date,
	"buyer" text,
	"expeditor" text,
	"pe" text,
	"vqc" text,
	"status" text NOT NULL,
	CONSTRAINT "procurement_packages_project_id_id_pk" PRIMARY KEY("project_id","id")
);
--> statement-breakpoint
CREATE TABLE "project_modules" (
	"project_id" text NOT NULL,
	"module_key" text NOT NULL,
	"state" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_modules_project_id_module_key_pk" PRIMARY KEY("project_id","module_key")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"contract" text NOT NULL,
	"cutoff" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scurve_points" (
	"project_id" text NOT NULL,
	"point_date" date NOT NULL,
	"plan" double precision,
	"forecast" double precision,
	"actual" double precision,
	CONSTRAINT "scurve_points_project_id_point_date_pk" PRIMARY KEY("project_id","point_date")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"due" date NOT NULL,
	"priority" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_packages" (
	"project_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"weight" double precision,
	"last_week_plan" double precision,
	"last_week_actual" double precision,
	"achieved_plan" double precision,
	"achieved_actual" double precision,
	"this_week_plan" double precision,
	"this_week_actual" double precision,
	CONSTRAINT "work_packages_project_id_code_pk" PRIMARY KEY("project_id","code")
);
--> statement-breakpoint
ALTER TABLE "expediting_packages" ADD CONSTRAINT "expediting_packages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_state_changes" ADD CONSTRAINT "module_state_changes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procurement_packages" ADD CONSTRAINT "procurement_packages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_modules" ADD CONSTRAINT "project_modules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scurve_points" ADD CONSTRAINT "scurve_points_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expediting_discipline_idx" ON "expediting_packages" USING btree ("project_id","discipline");--> statement-breakpoint
CREATE INDEX "procurement_discipline_idx" ON "procurement_packages" USING btree ("project_id","discipline");