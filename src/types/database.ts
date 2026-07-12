export type UserRole = "super_admin" | "admin" | "student";
export type QuestionType = "mcq" | "numeric" | "subjective";
export type ExamStatus = "draft" | "published" | "closed";
export type StudentStatus = "active" | "disabled";
export type AttemptStatus = "in_progress" | "submitted" | "auto_submitted";
export type ProctoringEventType =
  | "tab_switch"
  | "window_blur"
  | "fullscreen_exit"
  | "face_missing"
  | "multiple_faces"
  | "copy_paste"
  | "right_click"
  | "devtools";
export type ProctoringSeverity = "low" | "medium" | "high";

export interface ProctoringSettings {
  camera: boolean;
  face_detection: boolean;
  tab_switch_limit: number;
  fullscreen_required: boolean;
  fullscreen_exit_limit: number;
  auto_submit_on_violation: boolean;
  disable_copy_paste: boolean;
  disable_right_click: boolean;
}

export interface Profile {
  id: string;
  role: UserRole;
  display_name: string;
  email: string;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Exam {
  id: string;
  admin_id: string;
  title: string;
  instructions: string;
  duration_minutes: number;
  window_start: string | null;
  window_end: string | null;
  negative_marking: boolean;
  negative_marking_value: number;
  shuffle_questions: boolean;
  proctoring_settings: ProctoringSettings;
  status: ExamStatus;
  created_at: string;
  updated_at: string;
}

export interface QuestionOption {
  key: string;
  text: string;
}

export interface Question {
  id: string;
  exam_id: string;
  type: QuestionType;
  text: string;
  options: QuestionOption[] | null;
  correct_answer: string | null;
  marks: number;
  negative_marks: number;
  order_index: number;
  created_at: string;
}

export type PublicQuestion = Omit<Question, "correct_answer">;

export interface StudentRow {
  id: string;
  user_id: string;
  exam_id: string;
  name: string;
  email: string;
  roll_no: string;
  must_change_password: boolean;
  status: StudentStatus;
  created_at: string;
  last_email_status: "sent" | "failed" | null;
  last_email_at: string | null;
}

export interface Attempt {
  id: string;
  student_id: string;
  exam_id: string;
  started_at: string;
  submitted_at: string | null;
  status: AttemptStatus;
  session_token: string;
  violation_count: number;
}

export interface Answer {
  id: string;
  attempt_id: string;
  question_id: string;
  response: string | null;
  marked_for_review: boolean;
  is_correct: boolean | null;
  marks_awarded: number | null;
  graded: boolean;
  updated_at: string;
}

export interface ProctoringEvent {
  id: string;
  attempt_id: string;
  type: ProctoringEventType;
  severity: ProctoringSeverity;
  timestamp: string;
  snapshot_path: string | null;
}

export interface Result {
  id: string;
  attempt_id: string;
  exam_id: string;
  student_id: string;
  total_marks: number;
  rank: number | null;
  percentile: number | null;
  published: boolean;
  created_at: string;
}
