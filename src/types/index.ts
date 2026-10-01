import { Timestamp } from "firebase/firestore";

// ─── Users ────────────────────────────────────────────────────
export type UserRole = "student" | "admin";


export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  photoUrl: string | null;
  createdAt: Timestamp;
}


// ─── Courses ──────────────────────────────────────────────────
export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  price: number;
  currency: "GHS";
  published: boolean;
  instructorId: string;
  totalDuration: string;
  accessDurationDays: number;
  trackId: TrackId | null;       // ← ADD THIS
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MaterialType = "video" | "pdf" | "note";

export interface Material {
  id: string;
  title: string;
  type: MaterialType;
  order: number;
  videoUrl?: string;
  fileUrl?: string;
  description?: string;
  createdAt: Timestamp;
}

// ─── Enrollments ──────────────────────────────────────────────
export type EnrollmentStatus = "active" | "expired" | "suspended";

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  paymentReference: string;
  enrolledAt: Timestamp;
  expiryDate: Timestamp;
  progressPercent: number;
  completedMaterials: string[];       // legacy flat materials
  completedTopics: string[];          // NEW — topicIds fully completed
  topicMaterialsCompleted: Record<string, string[]>;  // NEW — {topicId: materialId[]}
  topicQuizzesPassed: Record<string, string[]>;       // NEW — {topicId: quizId[]}
}

// ─── Payments ────────────────────────────────────────────────
export type PaymentStatus = "pending" | "success" | "failed";

export interface Payment {
  id: string;
  userId: string;
  courseId: string;
  amount: number;
  currency: "GHS";
  status: PaymentStatus;
  paystackRef: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
  verifiedAt?: Timestamp;
}

// ─── Exams ───────────────────────────────────────────────────
export type QuestionType = "mcq_single" | "mcq_multi" | "subjective";

export interface Question {
  id: string;
  type: QuestionType;  // uses the shared QuestionType
  text: string;
  marks: number;
  order: number;
  options?: { A: string; B: string; C: string; D: string };
  correctAnswer?: string;    // legacy single answer
  correctAnswers?: string[]; // new multi-answer
  explanation?: string;
  imageUrl?: string;
}

export interface Exam {
  id: string;
  courseId: string;
  title: string;
  durationMinutes: number;
  passMark: number;
  published: boolean;
  randomizeQuestions: boolean;
  questionsPerPage: number;        // ← new: 0 means "show all"
  allowRetake: boolean;            // ← new
  maxAttempts: number | null;      // ← new: null = unlimited
  retakeDelayHours: number;        // ← new: 0 = immediate
  questions: Question[];
  createdAt: Timestamp;
}

// ─── Attempts ────────────────────────────────────────────────
export type AttemptStatus = "in_progress" | "submitted" | "graded";

export interface Attempt {
  id: string;
  userId: string;
  examId: string;
  courseId: string;
  status: AttemptStatus;
  attemptNumber: number;
  startTime: Timestamp;
  submitTime: Timestamp | null;
  answers: Record<string, string>;  // { [questionId]: answer }
  score: number | null;
  totalMarks: number;
  percentScore: number | null;
  passed: boolean | null;
  adminFeedback: string | null;
  gradedAt: Timestamp | null;
  gradedBy: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  courseId: string | null;  // null = platform-wide
  authorId: string;
  published: boolean;
  createdAt: Timestamp;
}

export interface Section {
  id: string;
  title: string;
  order: number;
  createdAt: Timestamp;
}


// ─── Tracks ───────────────────────────────────────────────
export type TrackId = "nclex" | "ielts";

export interface Track {
  id: TrackId;
  name: string;
  description: string;
  imageUrl?: string;
}

export const TRACKS: Track[] = [
  {
    id: "nclex",
    name: "NCLEX",
    description: "National Council Licensure Examination preparation",
  },
  {
    id: "ielts",
    name: "IELTS",
    description: "International English Language Testing System preparation",
  },
];

// ─── Modules ──────────────────────────────────────────────
export interface Module {
  id: string;
  title: string;
  overview: string;     // Rich text HTML
  order: number;
  createdAt: Timestamp;
}

// ─── Topic colors ─────────────────────────────────────────
export const TOPIC_COLORS = [
  { id: "blue",    label: "Blue",    bg: "bg-[#3B5BDB]", hex: "#3B5BDB", light: "bg-blue-50",   text: "text-[#3B5BDB]"  },
  { id: "teal",    label: "Teal",    bg: "bg-[#0F9B8E]", hex: "#0F9B8E", light: "bg-teal-50",   text: "text-[#0F9B8E]"  },
  { id: "rose",    label: "Rose",    bg: "bg-[#C2255C]", hex: "#C2255C", light: "bg-rose-50",   text: "text-[#C2255C]"  },
  { id: "violet",  label: "Violet",  bg: "bg-[#7048E8]", hex: "#7048E8", light: "bg-violet-50", text: "text-[#7048E8]"  },
  { id: "amber",   label: "Amber",   bg: "bg-[#E67700]", hex: "#E67700", light: "bg-amber-50",  text: "text-[#E67700]"  },
  { id: "emerald", label: "Emerald", bg: "bg-[#2F9E44]", hex: "#2F9E44", light: "bg-emerald-50",text: "text-[#2F9E44]"  },
] as const;

export type TopicColorId = typeof TOPIC_COLORS[number]["id"];

// ─── Topics ───────────────────────────────────────────────
export interface Topic {
  id: string;
  title: string;
  colorId: TopicColorId;
  imageUrl: string;
  order: number;
  lessonContent: string;  // Rich text HTML
  createdAt: Timestamp;
}

// ─── Topic Material (same as existing Material) ────────────
// Reuse existing Material type

// ─── Topic Quiz (extends existing Exam) ───────────────────
export type QuizType = "quiz" | "case_study";


export interface TopicQuestion {
  id: string;
  type: QuestionType;
  text: string;
  imageUrl?: string;
  explanation?: string;
  options?: { A: string; B: string; C: string; D: string };
  correctAnswers: string[];   // Array — supports single ["A"] or multi ["A","C"]
  marks: number;
  order: number;
}

export interface TopicQuiz {
  id: string;
  topicId: string;
  moduleId: string;
  courseId: string;
  title: string;
  type: QuizType;
  caseScenario?: string;      // Rich text for case study preamble
  durationMinutes: number;
  passMark: number;
  published: boolean;
  allowRetake: boolean;
  maxAttempts: number | null;
  retakeDelayHours: number;
  questionsPerPage: number;
  questions: TopicQuestion[];
  createdAt: Timestamp;
}

// ─── Topic Attempt (extends existing Attempt) ─────────────
export interface TopicAttempt {
  id: string;
  userId: string;
  quizId: string;
  topicId: string;
  moduleId: string;
  courseId: string;
  attemptNumber: number;
  status: "in_progress" | "submitted" | "graded";
  startTime: Timestamp;
  submitTime: Timestamp | null;
  answers: Record<string, string | string[]>;  // string[] for multi-answer
  score: number | null;
  totalMarks: number;
  percentScore: number | null;
  passed: boolean | null;
  adminFeedback: string | null;
  gradedAt: Timestamp | null;
  gradedBy: string | null;
}

// ─── Mastery thresholds ───────────────────────────────────
export const MASTERY_THRESHOLDS = [
  { stars: 5, minPercent: 90, label: "Excellent" },
  { stars: 4, minPercent: 75, label: "Good" },
  { stars: 3, minPercent: 60, label: "Satisfactory" },
  { stars: 2, minPercent: 45, label: "Needs Improvement" },
  { stars: 1, minPercent: 0,  label: "Beginning" },
] as const;

export function getMasteryStars(percentScore: number): number {
  for (const threshold of MASTERY_THRESHOLDS) {
    if (percentScore >= threshold.minPercent) return threshold.stars;
  }
  return 1;
}

// ─── Extended enrollment progress ─────────────────────────
// ─── Credentialing ────────────────────────────────────────
export const CREDENTIALING_PHASES = [
  { index: 0,  name: "Candidate Assessment" },
  { index: 1,  name: "Select Nursing Regulatory Body (State Board)" },
  { index: 2,  name: "CPD Course — For New York BON Only" },
  { index: 3,  name: "State Board Application" },
  { index: 4,  name: "MOH Clearance / NMC Verification" },
  { index: 5,  name: "Fingerprinting & Background Check" },
  { index: 6,  name: "TruMerit Application & Verification" },
  { index: 7,  name: "Pearson VUE Registration" },
  { index: 8,  name: "Eligibility & Authorization to Test (ATT)" },
  { index: 9,  name: "Schedule NCLEX-RN" },
  { index: 10, name: "NCLEX-RN Examination" },
] as const;

export type PhaseStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "on_hold";

export interface CredentialingPhase {
  index: number;
  name: string;
  status: PhaseStatus;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  notes: string;
  updatedAt: Timestamp | null;
  updatedBy: string | null;
}

export interface CredentialingEnrollment {
  id: string;
  userId: string;
  status: "active" | "expired" | "suspended";
  paymentReference: string;
  enrolledAt: Timestamp;
  expiryDate: Timestamp;
  currentPhaseIndex: number;
  phases: CredentialingPhase[];
}

export interface CredentialingResource {
  id: string;
  title: string;
  type: "pdf" | "note" | "link";
  fileUrl?: string;
  linkUrl?: string;
  content?: string;
  order: number;
  createdAt: Timestamp;
}