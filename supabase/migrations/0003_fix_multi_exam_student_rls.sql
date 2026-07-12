-- student_row_id() picked an arbitrary students row for the current user
-- with no exam scoping ("select id from students where user_id = auth.uid()
-- limit 1"). A student enrolled in more than one exam has one students row
-- per exam, so any policy comparing student_id = student_row_id() would
-- silently check ownership against the wrong exam's enrollment for anyone
-- enrolled in 2+ exams. Replace it with a row-scoped check.

create or replace function is_own_student_row(student_id_input uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from students where id = student_id_input and user_id = auth.uid()
  );
$$;

-- attempts
alter policy attempts_select on attempts
  using (is_super_admin() or owns_exam(exam_id) or is_own_student_row(student_id));
alter policy attempts_insert on attempts
  with check (is_own_student_row(student_id));
alter policy attempts_update on attempts
  using (is_own_student_row(student_id) or is_super_admin() or owns_exam(exam_id));

-- answers
alter policy answers_select on answers
  using (
    is_super_admin()
    or exists (select 1 from attempts a where a.id = attempt_id and owns_exam(a.exam_id))
    or exists (select 1 from attempts a where a.id = attempt_id and is_own_student_row(a.student_id))
  );
alter policy answers_write_student on answers
  with check (exists (select 1 from attempts a where a.id = attempt_id and is_own_student_row(a.student_id)));
alter policy answers_update on answers
  using (
    exists (select 1 from attempts a where a.id = attempt_id and is_own_student_row(a.student_id))
    or is_super_admin()
    or exists (select 1 from attempts a where a.id = attempt_id and owns_exam(a.exam_id))
  );

-- proctoring_events
alter policy proctoring_events_select on proctoring_events
  using (
    is_super_admin()
    or exists (select 1 from attempts a where a.id = attempt_id and owns_exam(a.exam_id))
    or exists (select 1 from attempts a where a.id = attempt_id and is_own_student_row(a.student_id))
  );
alter policy proctoring_events_insert on proctoring_events
  with check (exists (select 1 from attempts a where a.id = attempt_id and is_own_student_row(a.student_id)));

-- results
alter policy results_select on results
  using (is_super_admin() or owns_exam(exam_id) or (is_own_student_row(student_id) and published));

-- storage: proctoring-snapshots
drop policy if exists "snapshots insert own attempt" on storage.objects;
create policy "snapshots insert own attempt"
  on storage.objects for insert
  with check (
    bucket_id = 'proctoring-snapshots'
    and exists (
      select 1 from attempts a
      where is_own_student_row(a.student_id)
      and (storage.foldername(name))[1] = a.id::text
    )
  );

drop policy if exists "snapshots select admin or owner" on storage.objects;
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
        where is_own_student_row(a.student_id)
        and (storage.foldername(name))[1] = a.id::text
      )
    )
  );

drop function if exists student_row_id();

-- Note: `questions` intentionally has no student-facing SELECT policy.
-- Students can never read correct_answer this way, even by accident — the
-- exam-taking route fetches questions with the service-role client instead
-- (see src/app/api/attempts/[attemptId]/data/route.ts), after verifying the
-- requesting user owns the attempt via the regular RLS-scoped client.
