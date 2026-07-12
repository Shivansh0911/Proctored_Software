-- Proctored Online Examination Platform — initial schema
-- Built by Shivansh Shekhar Ojha

create extension if not exists "pgcrypto";

-- =========================================================
-- ENUMS
-- =========================================================
create type user_role as enum ('super_admin', 'admin', 'student');
create type question_type as enum ('mcq', 'numeric', 'subjective');
create type exam_status as enum ('draft', 'published', 'closed');
create type student_status as enum ('active', 'disabled');
create type attempt_status as enum ('in_progress', 'submitted', 'auto_submitted');
create type proctoring_event_type as enum (
  'tab_switch', 'window_blur', 'fullscreen_exit',
  'face_missing', 'multiple_faces', 'copy_paste', 'right_click', 'devtools'
);
create type proctoring_severity as enum ('low', 'medium', 'high');

-- =========================================================
-- PROFILES  (super_admin + admin; backed by Supabase Auth users)
-- =========================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  display_name text not null,
  email text not null,
  created_by uuid references profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =========================================================
-- EXAMS
-- =========================================================
create table exams (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  instructions text default '',
  duration_minutes int not null check (duration_minutes > 0),
  window_start timestamptz,
  window_end timestamptz,
  negative_marking boolean not null default false,
  negative_marking_value numeric not null default 0,
  shuffle_questions boolean not null default false,
  proctoring_settings jsonb not null default '{
    "camera": true,
    "face_detection": true,
    "tab_switch_limit": 3,
    "fullscreen_required": true,
    "fullscreen_exit_limit": 3,
    "auto_submit_on_violation": false,
    "disable_copy_paste": true,
    "disable_right_click": true
  }'::jsonb,
  status exam_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- QUESTIONS
-- =========================================================
create table questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams(id) on delete cascade,
  type question_type not null,
  text text not null,
  options jsonb, -- [{ "key": "A", "text": "..." }, ...] for mcq
  correct_answer text, -- never sent to client
  marks numeric not null default 1,
  negative_marks numeric not null default 0,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

-- =========================================================
-- STUDENTS  (per-exam roster/enrollment, backed by Supabase Auth users)
-- =========================================================
create table students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  name text not null,
  email text not null,
  roll_no text not null,
  must_change_password boolean not null default true,
  status student_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (exam_id, roll_no),
  unique (exam_id, email)
);

-- =========================================================
-- ATTEMPTS
-- =========================================================
create table attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status attempt_status not null default 'in_progress',
  session_token uuid not null default gen_random_uuid(),
  violation_count int not null default 0,
  unique (student_id, exam_id)
);

-- =========================================================
-- ANSWERS
-- =========================================================
create table answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  response text,
  marked_for_review boolean not null default false,
  is_correct boolean,
  marks_awarded numeric,
  graded boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- =========================================================
-- PROCTORING EVENTS
-- =========================================================
create table proctoring_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references attempts(id) on delete cascade,
  type proctoring_event_type not null,
  severity proctoring_severity not null default 'low',
  timestamp timestamptz not null default now(),
  snapshot_path text -- path in storage bucket; signed URL generated on demand
);

-- =========================================================
-- RESULTS
-- =========================================================
create table results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references attempts(id) on delete cascade,
  exam_id uuid not null references exams(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  total_marks numeric not null default 0,
  rank int,
  percentile numeric,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_questions_exam on questions(exam_id);
create index idx_students_exam on students(exam_id);
create index idx_attempts_exam on attempts(exam_id);
create index idx_answers_attempt on answers(attempt_id);
create index idx_proctoring_events_attempt on proctoring_events(attempt_id);
create index idx_results_exam on results(exam_id);

-- =========================================================
-- HELPER FUNCTIONS (SECURITY DEFINER, used inside RLS policies)
-- =========================================================
create or replace function current_role_is(check_role user_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = check_role and is_active
  );
$$;

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select current_role_is('super_admin');
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select current_role_is('admin');
$$;

create or replace function owns_exam(exam_id_input uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from exams where id = exam_id_input and admin_id = auth.uid()
  );
$$;

create or replace function is_student_of_exam(exam_id_input uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students where exam_id = exam_id_input and user_id = auth.uid()
  );
$$;

create or replace function student_row_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from students where user_id = auth.uid() limit 1;
$$;

-- =========================================================
-- RLS
-- =========================================================
alter table profiles enable row level security;
alter table exams enable row level security;
alter table questions enable row level security;
alter table students enable row level security;
alter table attempts enable row level security;
alter table answers enable row level security;
alter table proctoring_events enable row level security;
alter table results enable row level security;

-- PROFILES: super admin sees all; admin/student see only themselves
create policy profiles_select on profiles for select
  using (is_super_admin() or id = auth.uid());
create policy profiles_insert_super_admin on profiles for insert
  with check (is_super_admin());
create policy profiles_update_super_admin on profiles for update
  using (is_super_admin() or id = auth.uid());

-- EXAMS: super admin sees all; admin sees/manages only own; students see published exams they're enrolled in
create policy exams_select on exams for select
  using (
    is_super_admin()
    or admin_id = auth.uid()
    or is_student_of_exam(id)
  );
create policy exams_insert on exams for insert
  with check (is_admin() and admin_id = auth.uid());
create policy exams_update on exams for update
  using (is_super_admin() or (is_admin() and admin_id = auth.uid()));
create policy exams_delete on exams for delete
  using (is_super_admin() or (is_admin() and admin_id = auth.uid()));

-- QUESTIONS: admin who owns exam manages; students can only read via server (never correct_answer) —
-- client-side select is restricted to owning admin/super admin only. Students fetch a sanitized
-- view through a server API route using the service role key, never directly.
create policy questions_select_admin on questions for select
  using (is_super_admin() or owns_exam(exam_id));
create policy questions_write_admin on questions for all
  using (is_super_admin() or owns_exam(exam_id))
  with check (is_super_admin() or owns_exam(exam_id));

-- STUDENTS: admin who owns exam manages roster; student can see own row
create policy students_select on students for select
  using (is_super_admin() or owns_exam(exam_id) or user_id = auth.uid());
create policy students_write_admin on students for insert
  with check (is_super_admin() or owns_exam(exam_id));
create policy students_update on students for update
  using (is_super_admin() or owns_exam(exam_id) or user_id = auth.uid());
create policy students_delete on students for delete
  using (is_super_admin() or owns_exam(exam_id));

-- ATTEMPTS: student manages own attempt; owning admin can view/monitor
create policy attempts_select on attempts for select
  using (is_super_admin() or owns_exam(exam_id) or student_id = student_row_id());
create policy attempts_insert on attempts for insert
  with check (student_id = student_row_id());
create policy attempts_update on attempts for update
  using (student_id = student_row_id() or is_super_admin() or owns_exam(exam_id));

-- ANSWERS: student manages own answers (via attempt ownership); admin can read for grading
create policy answers_select on answers for select
  using (
    is_super_admin()
    or exists (select 1 from attempts a where a.id = attempt_id and owns_exam(a.exam_id))
    or exists (select 1 from attempts a where a.id = attempt_id and a.student_id = student_row_id())
  );
create policy answers_write_student on answers for insert
  with check (exists (select 1 from attempts a where a.id = attempt_id and a.student_id = student_row_id()));
create policy answers_update on answers for update
  using (
    exists (select 1 from attempts a where a.id = attempt_id and a.student_id = student_row_id())
    or is_super_admin()
    or exists (select 1 from attempts a where a.id = attempt_id and owns_exam(a.exam_id))
  );

-- PROCTORING EVENTS: student can insert own; owning admin can read
create policy proctoring_events_select on proctoring_events for select
  using (
    is_super_admin()
    or exists (select 1 from attempts a where a.id = attempt_id and owns_exam(a.exam_id))
    or exists (select 1 from attempts a where a.id = attempt_id and a.student_id = student_row_id())
  );
create policy proctoring_events_insert on proctoring_events for insert
  with check (exists (select 1 from attempts a where a.id = attempt_id and a.student_id = student_row_id()));

-- RESULTS: admin who owns exam manages; students see own row only when published
create policy results_select on results for select
  using (
    is_super_admin()
    or owns_exam(exam_id)
    or (student_id = student_row_id() and published)
  );
create policy results_write_admin on results for all
  using (is_super_admin() or owns_exam(exam_id))
  with check (is_super_admin() or owns_exam(exam_id));

-- =========================================================
-- STORAGE (snapshots bucket, private; signed URLs only)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('proctoring-snapshots', 'proctoring-snapshots', false)
on conflict (id) do nothing;

create policy "snapshots insert own attempt"
  on storage.objects for insert
  with check (
    bucket_id = 'proctoring-snapshots'
    and exists (
      select 1 from attempts a
      where a.student_id = student_row_id()
      and (storage.foldername(name))[1] = a.id::text
    )
  );

create policy "snapshots select admin or owner"
  on storage.objects for select
  using (
    bucket_id = 'proctoring-snapshots'
    and (
      is_super_admin()
      or exists (
        select 1 from attempts a
        where owns_exam(a.exam_id)
        and (storage.foldername(name))[1] = a.id::text
      )
      or exists (
        select 1 from attempts a
        where a.student_id = student_row_id()
        and (storage.foldername(name))[1] = a.id::text
      )
    )
  );
