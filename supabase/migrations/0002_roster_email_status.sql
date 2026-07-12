-- Tracks credential-email delivery per student for the resend/status UI.
alter table students
  add column last_email_status text check (last_email_status in ('sent', 'failed')),
  add column last_email_at timestamptz;
