


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
    and email = 'ravi.boorla@gmail.com'
  );
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_auth_user_to_tenant"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update public.tenant_users
  set auth_user_id = new.id
  where lower(email) = lower(new.email)
  and auth_user_id is null;
  return new;
end;
$$;


ALTER FUNCTION "public"."link_auth_user_to_tenant"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select tenant_id from public.tenant_users
  where auth_user_id = auth.uid() 
  and active = true 
  limit 1;
$$;


ALTER FUNCTION "public"."my_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_strat101_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.slug = 'strat101' then
    raise exception 'The strat101 platform tenant cannot be deleted.';
  end if;
  return old;
end;
$$;


ALTER FUNCTION "public"."prevent_strat101_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."approval_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "tenant_id" "uuid",
    "user_id" "uuid",
    "company_name" "text",
    "username" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "text",
    "notes" "text",
    CONSTRAINT "approval_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "approval_requests_type_check" CHECK (("type" = ANY (ARRAY['new_tenant'::"text", 'join_tenant'::"text"])))
);


ALTER TABLE "public"."approval_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "size" "text" NOT NULL,
    "ext" "text",
    "storage_path" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "sender" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "message" "text" NOT NULL,
    "is_broadcast" boolean DEFAULT false,
    "read_by" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "requested_by" "text" NOT NULL,
    "feature_key" "text" NOT NULL,
    "reason" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actioned_by" "text",
    "actioned_at" timestamp with time zone,
    "tenant_name" "text" DEFAULT ''::"text" NOT NULL,
    "rejection_reason" "text",
    CONSTRAINT "feature_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."feature_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "amount" integer NOT NULL,
    "status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "period" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['paid'::"text", 'unpaid'::"text", 'overdue'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "depends_on" "uuid" NOT NULL
);


ALTER TABLE "public"."item_dependencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "from_id" "uuid" NOT NULL,
    "to_id" "uuid" NOT NULL
);


ALTER TABLE "public"."item_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."login_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "logged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "text",
    "device" "text"
);


ALTER TABLE "public"."login_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_reset_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actioned_at" timestamp with time zone,
    "actioned_by" "text",
    CONSTRAINT "password_reset_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."password_reset_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_intel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "record_type" "text" NOT NULL,
    "ref_key" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" NOT NULL,
    "owner" "text",
    "raised_by" "text",
    "raised_date" "date",
    "due_date" "date",
    "linked_item_id" "uuid",
    "notes" "text",
    "risk_category" "text",
    "probability" "text",
    "impact" "text",
    "risk_level" "text",
    "risk_response" "text",
    "mitigation" "text",
    "contingency" "text",
    "residual_risk" "text",
    "review_date" "date",
    "decision_type" "text",
    "options_considered" "text",
    "rationale" "text",
    "decision_made" "text",
    "decided_by" "text",
    "decision_date" "date",
    "review_trigger" "text",
    "outcome_status" "text",
    "outcome_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ride_intel_record_type_check" CHECK (("record_type" = ANY (ARRAY['risk'::"text", 'decision'::"text"])))
);


ALTER TABLE "public"."ride_intel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suspension_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "tenant_name" "text" NOT NULL,
    "requested_by" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actioned_at" timestamp with time zone,
    "actioned_by" "text",
    CONSTRAINT "suspension_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."suspension_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid",
    "auth_user_id" "uuid",
    "username" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_login" timestamp with time zone,
    "last_login_ip" "text",
    "temp_password" "text",
    "password_reset_at" timestamp with time zone,
    "must_change_pwd" boolean DEFAULT false NOT NULL,
    "approval_status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "approval_requested_at" timestamp with time zone,
    "approval_actioned_at" timestamp with time zone,
    "approval_actioned_by" "text",
    "rejection_reason" "text",
    "password_changed_at" timestamp with time zone,
    CONSTRAINT "tenant_users_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "tenant_users_role_check" CHECK (("role" = ANY (ARRAY['global_admin'::"text", 'local_admin'::"text", 'editor'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."tenant_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "plan" "text" DEFAULT 'starter'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sub_status" "text" DEFAULT 'trialling'::"text" NOT NULL,
    "trial_start" "date",
    "trial_end" "date",
    "period_start" "date",
    "period_end" "date",
    "auto_renew" boolean DEFAULT true NOT NULL,
    "billing_name" "text",
    "billing_email" "text",
    "vat_id" "text",
    "card_last4" "text",
    "card_expiry" "text",
    "item_count" integer DEFAULT 0 NOT NULL,
    "ai_calls" integer DEFAULT 0 NOT NULL,
    "feat_kanban" boolean DEFAULT true NOT NULL,
    "feat_workitems" boolean DEFAULT true NOT NULL,
    "feat_create" boolean DEFAULT true NOT NULL,
    "feat_bot" boolean DEFAULT true NOT NULL,
    "feat_reports" boolean DEFAULT true NOT NULL,
    "approval_status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "requested_by" "text",
    "approval_requested_at" timestamp with time zone,
    "industry" "text",
    "sector" "text",
    "pwd_expiry_days" integer,
    "enabled_item_types" "text"[],
    "feat_ride" boolean DEFAULT false,
    "feat_chat" boolean DEFAULT false,
    CONSTRAINT "tenants_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "tenants_plan_check" CHECK (("plan" = ANY (ARRAY['starter'::"text", 'pro'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "tenants_sub_status_check" CHECK (("sub_status" = ANY (ARRAY['trialling'::"text", 'active'::"text", 'past_due'::"text", 'cancelled'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text",
    "current_status" "text",
    "current_status_at" timestamp with time zone,
    "risk_statement" "text",
    "status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "priority" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "health" "text" DEFAULT 'Green'::"text" NOT NULL,
    "risk" "text" DEFAULT 'Low'::"text" NOT NULL,
    "impact" "text",
    "impact_type" "text",
    "owner" "text",
    "assigned" "text",
    "sponsor" "text",
    "business_unit" "text",
    "approved_budget" numeric,
    "actual_cost" numeric,
    "start_date" "date",
    "end_date" "date",
    "progress" integer DEFAULT 0 NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "key_result" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "work_items_health_check" CHECK (("health" = ANY (ARRAY['Green'::"text", 'Amber'::"text", 'Red'::"text"]))),
    CONSTRAINT "work_items_priority_check" CHECK (("priority" = ANY (ARRAY['Critical'::"text", 'High'::"text", 'Medium'::"text", 'Low'::"text"]))),
    CONSTRAINT "work_items_risk_check" CHECK (("risk" = ANY (ARRAY['High'::"text", 'Medium'::"text", 'Low'::"text"]))),
    CONSTRAINT "work_items_status_check" CHECK (("status" = ANY (ARRAY['Draft'::"text", 'In Progress'::"text", 'On Hold'::"text", 'Completed'::"text", 'Cancelled'::"text"]))),
    CONSTRAINT "work_items_type_check" CHECK (("type" = ANY (ARRAY['vision'::"text", 'mission'::"text", 'goal'::"text", 'okr'::"text", 'kr'::"text", 'initiative'::"text", 'program'::"text", 'project'::"text", 'task'::"text", 'subtask'::"text"])))
);


ALTER TABLE "public"."work_items" OWNER TO "postgres";


ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_requests"
    ADD CONSTRAINT "feature_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_dependencies"
    ADD CONSTRAINT "item_dependencies_item_id_depends_on_key" UNIQUE ("item_id", "depends_on");



ALTER TABLE ONLY "public"."item_dependencies"
    ADD CONSTRAINT "item_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_links"
    ADD CONSTRAINT "item_links_from_id_to_id_key" UNIQUE ("from_id", "to_id");



ALTER TABLE ONLY "public"."item_links"
    ADD CONSTRAINT "item_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."login_history"
    ADD CONSTRAINT "login_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_requests"
    ADD CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ride_intel"
    ADD CONSTRAINT "ride_intel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suspension_requests"
    ADD CONSTRAINT "suspension_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_pkey" PRIMARY KEY ("id");



CREATE INDEX "attachments_item_id_idx" ON "public"."attachments" USING "btree" ("item_id");



CREATE INDEX "comments_item_id_idx" ON "public"."comments" USING "btree" ("item_id");



CREATE INDEX "item_dependencies_item_id_idx" ON "public"."item_dependencies" USING "btree" ("item_id");



CREATE INDEX "item_links_from_id_idx" ON "public"."item_links" USING "btree" ("from_id");



CREATE INDEX "item_links_to_id_idx" ON "public"."item_links" USING "btree" ("to_id");



CREATE INDEX "login_history_user_id_idx" ON "public"."login_history" USING "btree" ("user_id");



CREATE INDEX "tenant_users_auth_user_id_idx" ON "public"."tenant_users" USING "btree" ("auth_user_id");



CREATE INDEX "tenant_users_tenant_id_idx" ON "public"."tenant_users" USING "btree" ("tenant_id");



CREATE INDEX "work_items_tenant_id_idx" ON "public"."work_items" USING "btree" ("tenant_id");



CREATE INDEX "work_items_tenant_id_type_idx" ON "public"."work_items" USING "btree" ("tenant_id", "type");



CREATE OR REPLACE TRIGGER "protect_strat101" BEFORE DELETE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_strat101_deletion"();



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approval_requests"
    ADD CONSTRAINT "approval_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."tenant_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attachments"
    ADD CONSTRAINT "attachments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feature_requests"
    ADD CONSTRAINT "feature_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_dependencies"
    ADD CONSTRAINT "item_dependencies_depends_on_fkey" FOREIGN KEY ("depends_on") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_dependencies"
    ADD CONSTRAINT "item_dependencies_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_dependencies"
    ADD CONSTRAINT "item_dependencies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_links"
    ADD CONSTRAINT "item_links_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_links"
    ADD CONSTRAINT "item_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_links"
    ADD CONSTRAINT "item_links_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."login_history"
    ADD CONSTRAINT "login_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."tenant_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_reset_requests"
    ADD CONSTRAINT "password_reset_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_intel"
    ADD CONSTRAINT "ride_intel_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suspension_requests"
    ADD CONSTRAINT "suspension_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



CREATE POLICY "admin full access tenants" ON "public"."tenants" TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "admin manages approvals" ON "public"."approval_requests" TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "allow tenant lookup for registration" ON "public"."tenants" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon insert pwd request" ON "public"."password_reset_requests" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "anon login lookup" ON "public"."tenant_users" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."approval_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attachments full access" ON "public"."attachments" TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."my_tenant_id"()));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comments full access" ON "public"."comments" TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."my_tenant_id"()));



ALTER TABLE "public"."feature_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "global admin cross-tenant chat insert" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tenant_users"
  WHERE (("tenant_users"."auth_user_id" = "auth"."uid"()) AND ("tenant_users"."role" = 'global_admin'::"text")))));



CREATE POLICY "global admin reads all tenants" ON "public"."tenants" FOR SELECT TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "global admin updates all tenants" ON "public"."tenants" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices full access" ON "public"."invoices" TO "authenticated" USING ((("tenant_id" = "public"."my_tenant_id"()) OR "public"."is_platform_admin"())) WITH CHECK ((("tenant_id" = "public"."my_tenant_id"()) OR "public"."is_platform_admin"()));



CREATE POLICY "item deps full access" ON "public"."item_dependencies" TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "item links full access" ON "public"."item_links" TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."my_tenant_id"()));



ALTER TABLE "public"."item_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "local admin delete own tenant" ON "public"."tenant_users" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "local admin insert own tenant" ON "public"."tenant_users" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "local admin insert reinstate" ON "public"."suspension_requests" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "local admin read own" ON "public"."suspension_requests" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "local admin update own tenant" ON "public"."tenant_users" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "login history full access" ON "public"."login_history" TO "authenticated" USING (("user_id" IN ( SELECT "tenant_users"."id"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."auth_user_id" = "auth"."uid"()))));



ALTER TABLE "public"."login_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform admin" ON "public"."chat_messages" TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "platform admin" ON "public"."ride_intel" TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "platform admin all" ON "public"."suspension_requests" TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "platform admin all pwd requests" ON "public"."password_reset_requests" TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "platform admin delete" ON "public"."tenant_users" FOR DELETE TO "authenticated" USING (("public"."is_platform_admin"() OR ("tenant_id" = "public"."my_tenant_id"())));



CREATE POLICY "platform admin insert" ON "public"."tenant_users" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_platform_admin"() OR ("tenant_id" = "public"."my_tenant_id"())));



CREATE POLICY "platform admin read all" ON "public"."tenant_users" FOR SELECT TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "platform admin read all requests" ON "public"."feature_requests" FOR SELECT TO "authenticated" USING ("public"."is_platform_admin"());



CREATE POLICY "platform admin update all" ON "public"."tenant_users" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "platform admin update requests" ON "public"."feature_requests" FOR UPDATE TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "read own row" ON "public"."tenant_users" FOR SELECT TO "authenticated" USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "read own tenant pwd requests" ON "public"."password_reset_requests" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "read own tenant users" ON "public"."tenant_users" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"()));



ALTER TABLE "public"."ride_intel" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "see own tenant" ON "public"."tenants" FOR SELECT TO "authenticated" USING ((("id" = "public"."my_tenant_id"()) OR "public"."is_platform_admin"()));



CREATE POLICY "self register insert" ON "public"."tenant_users" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "self register tenant insert" ON "public"."tenants" FOR INSERT TO "authenticated", "anon" WITH CHECK (("approval_status" = 'pending'::"text"));



ALTER TABLE "public"."suspension_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant delete" ON "public"."ride_intel" FOR DELETE TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "tenant delete own" ON "public"."chat_messages" FOR DELETE TO "authenticated" USING ((("tenant_id" = "public"."my_tenant_id"()) AND ("sender" = ( SELECT "tenant_users"."username"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."auth_user_id" = "auth"."uid"())
 LIMIT 1))));



CREATE POLICY "tenant insert" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "tenant insert" ON "public"."ride_intel" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "tenant insert own requests" ON "public"."feature_requests" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "tenant read" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "tenant read" ON "public"."ride_intel" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "tenant read own requests" ON "public"."feature_requests" FOR SELECT TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "tenant update" ON "public"."chat_messages" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"()));



CREATE POLICY "tenant update" ON "public"."ride_intel" FOR UPDATE TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"()));



ALTER TABLE "public"."tenant_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user sees own request" ON "public"."approval_requests" FOR SELECT TO "authenticated" USING (("email" = ( SELECT "tenant_users"."email"
   FROM "public"."tenant_users"
  WHERE ("tenant_users"."auth_user_id" = "auth"."uid"())
 LIMIT 1)));



CREATE POLICY "work items full access" ON "public"."work_items" TO "authenticated" USING (("tenant_id" = "public"."my_tenant_id"())) WITH CHECK (("tenant_id" = "public"."my_tenant_id"()));



ALTER TABLE "public"."work_items" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."item_dependencies";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."item_links";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."work_items";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_auth_user_to_tenant"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_auth_user_to_tenant"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_auth_user_to_tenant"() TO "service_role";



GRANT ALL ON FUNCTION "public"."my_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_strat101_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_strat101_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_strat101_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


















GRANT ALL ON TABLE "public"."approval_requests" TO "anon";
GRANT ALL ON TABLE "public"."approval_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."approval_requests" TO "service_role";



GRANT ALL ON TABLE "public"."attachments" TO "anon";
GRANT ALL ON TABLE "public"."attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."attachments" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."feature_requests" TO "anon";
GRANT ALL ON TABLE "public"."feature_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_requests" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."item_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."item_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."item_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."item_links" TO "anon";
GRANT ALL ON TABLE "public"."item_links" TO "authenticated";
GRANT ALL ON TABLE "public"."item_links" TO "service_role";



GRANT ALL ON TABLE "public"."login_history" TO "anon";
GRANT ALL ON TABLE "public"."login_history" TO "authenticated";
GRANT ALL ON TABLE "public"."login_history" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_requests" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_requests" TO "service_role";



GRANT ALL ON TABLE "public"."ride_intel" TO "anon";
GRANT ALL ON TABLE "public"."ride_intel" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_intel" TO "service_role";



GRANT ALL ON TABLE "public"."suspension_requests" TO "anon";
GRANT ALL ON TABLE "public"."suspension_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."suspension_requests" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_users" TO "anon";
GRANT ALL ON TABLE "public"."tenant_users" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_users" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."work_items" TO "anon";
GRANT ALL ON TABLE "public"."work_items" TO "authenticated";
GRANT ALL ON TABLE "public"."work_items" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































drop extension if exists "pg_net";

drop policy "anon insert pwd request" on "public"."password_reset_requests";

drop policy "self register insert" on "public"."tenant_users";

drop policy "self register tenant insert" on "public"."tenants";


  create policy "anon insert pwd request"
  on "public"."password_reset_requests"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "self register insert"
  on "public"."tenant_users"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "self register tenant insert"
  on "public"."tenants"
  as permissive
  for insert
  to anon, authenticated
with check ((approval_status = 'pending'::text));


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.link_auth_user_to_tenant();


