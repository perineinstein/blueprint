"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Course } from "@/types";
import { formatPrice } from "@/lib/utils/formatting";
import CourseThumbnail from "@/components/student/CourseThumbnail";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────
interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: any;
  published: boolean;
}

// ── Hardcoded fallback courses ─────────────────────────────
const FALLBACK_COURSES = [
  {
    id: "f1",
    title: "Fundamentals of Nursing",
    description: "Core nursing principles and patient care techniques.",
    price: 20000,
    category: "Nursing",
  },
  {
    id: "f2",
    title: "Clinical Practice Essentials",
    description: "Hands-on clinical skills for healthcare professionals.",
    price: 25000,
    category: "Healthcare",
  },
  {
    id: "f3",
    title: "Medical Ethics & Law",
    description: "Legal and ethical frameworks in modern healthcare.",
    price: 15000,
    category: "Professional",
  },
  {
    id: "f4",
    title: "Patient Care Management",
    description: "Managing patient care from admission to discharge.",
    price: 30000,
    category: "Nursing",
  },
];

const HARDCODED_REVIEWS = [
  {
    id: "h1",
    userName: "Abena Mensah",
    role: "Nursing Student, Accra",
    rating: 5,
    comment:
      "Blueprint made it so easy to study at my own pace. The exam system is brilliant — I could retake until I was confident.",
  },
  {
    id: "h2",
    userName: "Kofi Asante",
    role: "Healthcare Professional, Kumasi",
    rating: 5,
    comment:
      "The video quality is excellent and the PDFs are always available. I completed my certification entirely online.",
  },
];

// Published courses rarely change; cache them for the lifetime of the tab so
// repeat visits to the landing page don't re-read the whole collection.
let coursesCache: { data: Course[]; fetchedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function getCachedCourses(): Promise<Course[]> {
  if (coursesCache && Date.now() - coursesCache.fetchedAt < CACHE_TTL) {
    return coursesCache.data;
  }
  const snap = await getDocs(
    query(collection(db, "courses"), where("published", "==", true))
  );
  const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
  coursesCache = { data, fetchedAt: Date.now() };
  return data;
}

export default function LandingPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    if (!loading && appUser) router.push("/dashboard");
  }, [appUser, loading, router]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  // Fetch published courses — pick 4 randomly
  useEffect(() => {
    async function fetchCourses() {
      try {
        const all = await getCachedCourses();

        // Shuffle a copy (never mutate the cached array) and pick 4
        const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, 4);
        setCourses(shuffled);
      } catch (e) {
        console.error("Courses fetch error:", e);
      }
    }
    fetchCourses();
  }, []);

  // Fetch published reviews
  useEffect(() => {
    async function fetchReviews() {
      try {
        const snap = await getDocs(
          query(
            collection(db, "reviews"),
            where("published", "==", true),
            orderBy("createdAt", "desc"),
            limit(6)
          )
        );
        setReviews(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review))
        );
      } catch (e) {
        console.error("Reviews fetch error:", e);
      }
    }
    fetchReviews();
  }, []);

  // Submit review
  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewError("");

    if (!reviewName.trim()) {
      setReviewError("Please enter your name.");
      return;
    }
    if (!reviewComment.trim()) {
      setReviewError("Please write a comment.");
      return;
    }
    if (reviewComment.trim().length < 20) {
      setReviewError("Comment must be at least 20 characters.");
      return;
    }

    setSubmittingReview(true);
    try {
      await addDoc(collection(db, "reviews"), {
        userId: appUser?.id ?? "anonymous",
        userName: appUser?.name ?? reviewName,
        rating: reviewRating,
        comment: reviewComment,
        published: true,
        createdAt: serverTimestamp(),
      });

      setReviewSuccess(true);
      setReviewComment("");
      setReviewName("");
      setReviewRating(5);
      setShowReviewForm(false);

      // Refresh reviews
      const snap = await getDocs(
        query(
          collection(db, "reviews"),
          where("published", "==", true),
          orderBy("createdAt", "desc"),
          limit(6)
        )
      );
      setReviews(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review))
      );
    } catch (err) {
      setReviewError("Failed to submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  }

  const steps = [
    {
      icon: "🔍",
      title: "Browse Courses",
      desc: "Explore our growing catalogue of professional courses across multiple disciplines.",
    },
    {
      icon: "📋",
      title: "Enroll Instantly",
      desc: "Register for your chosen course in seconds with a simple account signup.",
    },
    {
      icon: "💳",
      title: "Pay Securely",
      desc: "Complete your payment via Paystack. Fast, safe, and fully encrypted.",
    },
    {
      icon: "🎓",
      title: "Start Learning",
      desc: "Get immediate access to videos, PDFs, and exams. Learn at your own pace.",
    },
  ];

  const faqs = [
    {
      q: "How do I enroll in a course?",
      a: "Create a free account, browse our course catalogue, select your course and complete payment via Paystack. Access is granted instantly.",
    },
    {
      q: "Can I access courses on my phone?",
      a: "Yes. Blueprint is fully responsive and works on any device — phone, tablet, or desktop.",
    },
    {
      q: "What payment methods are accepted?",
      a: "We accept all major cards and mobile money via Paystack. Payments are fully secured and encrypted.",
    },
    {
      q: "How long do I have access after enrolling?",
      a: "Access duration varies per course and is set by the instructor. Most courses offer at least 1 year of access.",
    },
    {
      q: "Can I retake exams?",
      a: "This depends on the course settings. Some courses allow multiple attempts with a cooldown period between tries.",
    },
  ];

  // Combine real reviews with hardcoded ones
  const allReviews = [
    ...reviews.map((r) => ({
      id: r.id,
      userName: r.userName,
      role: "Blueprint Student",
      rating: r.rating,
      comment: r.comment,
      isReal: true,
    })),
    ...HARDCODED_REVIEWS.map((r) => ({ ...r, isReal: false })),
  ].slice(0, 6);

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 py-3"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Blueprint logo"
              width={80}
              height={80}
              className="rounded-lg w-12 h-12 md:w-20 md:h-20"
            />
            <span className="font-bold text-lg text-gray-900">Blueprint</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {["Home", "Courses", "About", "FAQ"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm text-gray-600 hover:text-blue-600
                           transition-colors font-medium"
              >
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-1 md:gap-3">
            <Link
              href="/login"
              className="px-3 md:px-4 py-2.5 md:py-2 text-sm font-medium text-gray-700
                         hover:text-blue-600 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="px-4 md:px-5 py-2.5 md:py-2 bg-blue-600 hover:bg-blue-700 text-white
                         text-sm font-semibold rounded-xl transition-all
                         shadow-md shadow-blue-500/20"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        id="home"
        className="relative min-h-screen flex items-center pt-20 pb-12 md:pb-0
                   bg-gradient-to-br from-blue-50 via-white to-indigo-50
                   overflow-hidden"
      >
        {/* Background blobs */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px]
                        bg-blue-100 rounded-full -translate-y-1/3
                        translate-x-1/3 opacity-40" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-100
                        rounded-full translate-y-1/2 -translate-x-1/3 opacity-30" />

        <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12
                        items-center relative z-10">
          {/* Left */}
          <div>
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-100
                          text-blue-700 rounded-full text-xs font-semibold mb-6
                          transition-all duration-700 ${
                            visible
                              ? "opacity-100 translate-y-0"
                              : "opacity-0 translate-y-4"
                          }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              Professional Online Learning Platform
            </div>

            <h1
              className={`text-3xl md:text-5xl font-bold text-gray-900 leading-tight mb-6
                          transition-all duration-700 delay-100 ${
                            visible
                              ? "opacity-100 translate-y-0"
                              : "opacity-0 translate-y-6"
                          }`}
            >
              Learn from the{" "}
              <span className="text-blue-600">best.</span>
              <br />
              Grow faster.
            </h1>

            <p
              className={`text-base md:text-lg text-gray-500 mb-8 leading-relaxed
                          transition-all duration-700 delay-200 ${
                            visible
                              ? "opacity-100 translate-y-0"
                              : "opacity-0 translate-y-6"
                          }`}
            >
              Blueprint is a professional learning platform built for
              healthcare students and practitioners. Pay once, access
              world-class courses instantly.
            </p>

            <div
              className={`flex flex-wrap items-center gap-3 md:gap-4 mb-10 transition-all
                          duration-700 delay-300 ${
                            visible
                              ? "opacity-100 translate-y-0"
                              : "opacity-0 translate-y-6"
                          }`}
            >
              <Link
                href="/register"
                className="px-6 md:px-7 py-3.5 bg-blue-600 hover:bg-blue-700
                           text-white font-semibold rounded-xl transition-all
                           shadow-lg shadow-blue-500/25 hover:-translate-y-0.5
                           text-sm"
              >
                Get started free
              </Link>
              <Link
                href="#courses"
                className="flex items-center gap-2 px-6 md:px-7 py-3.5 border-2
                           border-gray-200 hover:border-blue-300 text-gray-700
                           hover:text-blue-600 font-semibold rounded-xl
                           transition-all text-sm"
              >
                <span className="w-7 h-7 bg-blue-50 rounded-full flex
                                 items-center justify-center text-xs">
                  ▶
                </span>
                Browse courses
              </Link>
            </div>

            {/* Stats */}
            <div
              className={`flex flex-wrap items-center gap-x-6 gap-y-3 md:gap-8 transition-all duration-700
                          delay-400 ${
                            visible
                              ? "opacity-100 translate-y-0"
                              : "opacity-0 translate-y-6"
                          }`}
            >
              {[
                { value: "50+", label: "Courses Available" },
                { value: "500+", label: "Students Enrolled" },
                { value: "98%", label: "Positive Feedback" },
              ].map((stat, i) => (
                <div key={i}>
                  <p className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Real nurse photo */}
          <div
            className={`relative transition-all duration-700 delay-200 ${
              visible
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-8"
            }`}
          >
            <div className="relative w-full max-w-lg mx-auto aspect-square">
              {/* Blue circle background */}
              <div className="absolute inset-8 bg-blue-600 rounded-full" />

              {/* Nurse photo */}
              <div className="absolute inset-0 flex items-end justify-center
                              overflow-hidden">
                <div className="relative w-full h-full">
                  <Image
                    src="/nurse.jpg"
                    alt="Healthcare professional"
                    fill
                    className="object-cover object-top rounded-full p-6
                               drop-shadow-2xl"
                    priority
                  />
                </div>
              </div>

              {/* Floating card — Students */}
              <div className="absolute bottom-8 -left-2 md:-left-4 bg-white rounded-2xl
                              shadow-xl p-4 flex items-center gap-3
                              min-w-[180px] z-10">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center
                                justify-center flex-shrink-0">
                  <span className="text-lg">🎓</span>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Students Enrolled</p>
                  <p className="text-sm font-bold text-gray-900">
                    500+ Learners
                  </p>
                </div>
              </div>

              {/* Floating card — Rating */}
              <div className="absolute top-12 -right-2 md:-right-4 bg-white rounded-2xl
                              shadow-xl p-4 min-w-[160px] z-10">
                <div className="flex items-center gap-0.5 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-xs font-semibold text-gray-900">
                  Rated 4.9/5.0
                </p>
                <p className="text-xs text-gray-400">by our students</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full">
            <path
              d="M0 60L1440 60L1440 30Q1080 0 720 30Q360 60 0 30Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* ── Steps ────────────────────────────────────────────── */}
      <section className="py-12 md:py-20 px-4 md:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-600 text-sm font-semibold uppercase
                          tracking-widest mb-2">
              Hassle Free Solution
            </p>
            <h2 className="text-3xl font-bold text-gray-900">
              Easy steps for your learning
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {steps.map((step, i) => (
              <StepCard key={i} step={step} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── About ────────────────────────────────────────────── */}
      <section
        id="about"
        className="py-12 md:py-20 px-4 md:px-6 bg-gradient-to-br from-blue-50 to-indigo-50"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="relative mb-6 md:mb-0">
            <div className="bg-blue-200 rounded-3xl h-[300px] md:h-[420px] flex items-center
                            justify-center overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400
                              to-blue-600 opacity-20" />
              <div className="relative z-10 text-center p-8">
                <div className="w-32 h-32 bg-blue-600 rounded-full flex items-center
                                justify-center mx-auto mb-6 shadow-xl">
                  <span className="text-5xl">📚</span>
                </div>
                <p className="text-blue-900 font-bold text-xl">
                  World-Class Learning
                </p>
                <p className="text-blue-700 text-sm mt-2">
                  Professional content by expert instructors
                </p>
              </div>
              <div className="absolute top-8 right-8 w-16 h-16 bg-blue-300
                              rounded-full opacity-50" />
              <div className="absolute bottom-8 left-8 w-24 h-24 bg-indigo-300
                              rounded-full opacity-40" />
            </div>

            <div className="absolute -bottom-6 -right-2 md:-right-6 bg-white rounded-2xl
                            shadow-xl p-4 md:p-5 flex items-center gap-3 md:gap-4">
              {[
                { value: "50+", label: "Courses" },
                { value: "500+", label: "Students" },
                { value: "98%", label: "Satisfaction" },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <p className="text-lg font-bold text-blue-600">{s.value}</p>
                  <p className="text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-blue-600 text-sm font-semibold uppercase
                          tracking-widest mb-3">
              About Us
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-5 leading-tight">
              Quality education starts
              <br />
              with quality instructors.
            </h2>
            <p className="text-gray-500 mb-4 leading-relaxed">
              Blueprint is a professional online learning management system
              designed for healthcare and technical education. We partner
              with certified professionals to deliver the best learning
              experience.
            </p>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Whether you're a nursing student, a healthcare professional
              looking to upskill, or an institution delivering online
              education — Blueprint has you covered.
            </p>
            <div className="space-y-3 mb-8">
              {[
                "Expert-designed course content",
                "Instant access after payment",
                "Timed exams with detailed feedback",
                "Track your progress at every step",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center
                                  justify-center flex-shrink-0">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-sm text-gray-700">{item}</span>
                </div>
              ))}
            </div>
            <Link
              href="/register"
              className="inline-block px-7 py-3 bg-blue-600 hover:bg-blue-700
                         text-white font-semibold rounded-xl transition-all
                         shadow-lg shadow-blue-500/25 text-sm"
            >
              Learn more →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Courses ──────────────────────────────────────────── */}
      <section id="courses" className="py-12 md:py-20 px-4 md:px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-0 mb-8 md:mb-12">
            <div>
              <p className="text-blue-600 text-sm font-semibold uppercase
                            tracking-widest mb-2">
                Our Courses
              </p>
              <h2 className="text-3xl font-bold text-gray-900">
                Browse Popular Courses
              </h2>
            </div>
            <Link
              href="/login"
              className="px-5 py-2.5 border-2 border-blue-600 text-blue-600
                         hover:bg-blue-600 hover:text-white font-semibold
                         rounded-xl transition-all text-sm"
            >
              View all courses →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {courses.length > 0
              ? courses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-white rounded-2xl border border-gray-100
                               shadow-sm hover:shadow-md transition-all
                               hover:-translate-y-1 overflow-hidden"
                  >
                    <CourseThumbnail
                      courseId={course.id}
                      title={course.title}
                      thumbnailUrl={course.thumbnail}
                      size="md"
                    />
                    <div className="p-4">
                      <h3 className="text-sm font-semibold text-gray-900
                                     mb-1 line-clamp-2">
                        {course.title}
                      </h3>
                      <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                        {course.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-blue-700">
                          {formatPrice(course.price)}
                        </span>
                        <Link
                          href="/login"
                          className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700
                                     rounded-lg font-medium hover:bg-blue-100
                                     transition-colors"
                        >
                          Enroll
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              : FALLBACK_COURSES.map((course, i) => (
                  <div
                    key={course.id}
                    className="bg-white rounded-2xl border border-gray-100
                               shadow-sm hover:shadow-md transition-all
                               hover:-translate-y-1 overflow-hidden"
                  >
                    <div
                      className={`h-36 flex items-center justify-center
                                  text-3xl font-bold text-white ${
                                    [
                                      "bg-blue-500",
                                      "bg-violet-500",
                                      "bg-teal-500",
                                      "bg-indigo-500",
                                    ][i]
                                  }`}
                    >
                      {course.title
                        .split(" ")
                        .filter(
                          (w) =>
                            !["of", "the", "a", "an", "and", "to"].includes(
                              w.toLowerCase()
                            )
                        )
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="p-4">
                      <span className="text-xs text-blue-600 font-medium">
                        {course.category}
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900
                                     mt-1 mb-3">
                        {course.title}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-blue-700">
                          {formatPrice(course.price)}
                        </span>
                        <Link
                          href="/login"
                          className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700
                                     rounded-lg font-medium hover:bg-blue-100
                                     transition-colors"
                        >
                          Enroll
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* ── Enroll CTA ───────────────────────────────────────── */}
      <section className="py-12 md:py-20 px-4 md:px-6 bg-blue-600 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full
                        -translate-y-1/2 translate-x-1/2 opacity-50" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-700 rounded-full
                        translate-y-1/2 -translate-x-1/2 opacity-50" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center
                        relative z-10">
          <div>
            <p className="text-blue-200 text-sm font-semibold uppercase
                          tracking-widest mb-3">
              Book Enrollment
            </p>
            <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
              Enroll in a course today.
              <br />
              Start learning immediately.
            </h2>
            <p className="text-blue-100 mb-8 leading-relaxed">
              Join hundreds of students already learning on Blueprint.
              Pay once, access your course for up to 1 year. No hidden
              fees, no subscriptions.
            </p>
            <div className="space-y-3 mb-8">
              {[
                "Instant access after payment",
                "Learn at your own pace",
                "Professional certification exams",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-white/20 rounded-full flex items-center
                                  justify-center flex-shrink-0">
                    <span className="text-white text-xs">✓</span>
                  </div>
                  <span className="text-blue-100 text-sm">{item}</span>
                </div>
              ))}
            </div>
            <Link
              href="/register"
              className="inline-block px-8 py-3.5 bg-white text-blue-700
                         font-semibold rounded-xl hover:bg-blue-50 transition-all
                         shadow-xl text-sm"
            >
              See availability →
            </Link>
          </div>

          {/* Sign up card */}
          <div className="bg-white rounded-3xl p-5 md:p-8 shadow-2xl w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-6">
              Create your account
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Full name
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200
                                rounded-xl text-sm text-gray-400">
                  Enter your full name
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Email address
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200
                                rounded-xl text-sm text-gray-400">
                  Enter your email
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Password
                </label>
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200
                                rounded-xl text-sm text-gray-400">
                  Create a password
                </div>
              </div>
              <Link
                href="/register"
                className="block w-full text-center py-3.5 bg-blue-600
                           hover:bg-blue-700 text-white font-semibold rounded-xl
                           transition-colors text-sm"
              >
                Get started for free
              </Link>
              <p className="text-xs text-center text-gray-400">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────── */}
      <section className="py-12 md:py-20 px-4 md:px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-0 mb-8 md:mb-12">
            <div>
              <p className="text-blue-600 text-sm font-semibold uppercase
                            tracking-widest mb-2">
                Happy Students
              </p>
              <h2 className="text-3xl font-bold text-gray-900">
                Reviews from our students
              </h2>
            </div>

            {/* Leave a review button */}
            <button
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="px-5 py-2.5 border-2 border-blue-600 text-blue-600
                         hover:bg-blue-600 hover:text-white font-semibold
                         rounded-xl transition-all text-sm"
            >
              {showReviewForm ? "Cancel" : "Leave a review"}
            </button>
          </div>

          {/* Review form */}
          {showReviewForm && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8
                            shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Share your experience
              </h3>

              {reviewSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-100
                               rounded-xl text-sm text-green-600">
                  ✓ Thank you! Your review has been submitted.
                </div>
              )}

              {reviewError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100
                               rounded-xl text-sm text-red-600">
                  {reviewError}
                </div>
              )}

              <form onSubmit={handleSubmitReview} className="space-y-4">
                {/* Name — only show if not logged in */}
                {!appUser && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Your name
                    </label>
                    <input
                      type="text"
                      value={reviewName}
                      onChange={(e) => setReviewName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200
                                 rounded-xl text-sm text-gray-900 bg-white
                                 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter your name"
                    />
                  </div>
                )}

                {/* Star rating */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">
                    Rating
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setReviewRating(star)}
                        className="text-3xl transition-transform hover:scale-110"
                      >
                        <span
                          className={
                            star <= (hoverRating || reviewRating)
                              ? "text-yellow-400"
                              : "text-gray-200"
                          }
                        >
                          ★
                        </span>
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-gray-500 self-center">
                      {["", "Poor", "Fair", "Good", "Great", "Excellent"][
                        hoverRating || reviewRating
                      ]}
                    </span>
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Your review
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-200
                               rounded-xl text-sm text-gray-900 bg-white
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               resize-none"
                    placeholder="Tell others about your experience with Blueprint..."
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Minimum 20 characters ({reviewComment.length}/20)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700
                             disabled:bg-blue-400 text-white text-sm font-semibold
                             rounded-xl transition-colors"
                >
                  {submittingReview ? "Submitting..." : "Submit review"}
                </button>
              </form>
            </div>
          )}

          {/* Reviews grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {allReviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-2xl p-6 shadow-sm border
                           border-gray-100 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(review.rating)].map((_, j) => (
                    <span key={j} className="text-yellow-400">★</span>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-6 italic">
                  "{review.comment}"
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full bg-gradient-to-br
                                from-blue-400 to-violet-500 flex items-center
                                justify-center flex-shrink-0"
                  >
                    <span className="text-white text-sm font-semibold">
                      {review.userName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {review.userName}
                    </p>
                    <p className="text-xs text-gray-400">{review.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" className="py-12 md:py-20 px-4 md:px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-blue-600 text-sm font-semibold uppercase
                          tracking-widest mb-2">
              Frequently Asked Questions
            </p>
            <h2 className="text-3xl font-bold text-gray-900">
              Got questions? We have answers.
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="border border-gray-200 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4
                             text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-900">
                    {faq.q}
                  </span>
                  <span
                    className={`text-blue-600 text-lg transition-transform
                               duration-200 flex-shrink-0 ml-4 ${
                                 faqOpen === i ? "rotate-45" : ""
                               }`}
                  >
                    +
                  </span>
                </button>
                {faqOpen === i && (
                  <div className="px-6 pb-4 border-t border-gray-100 pt-3">
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section
        className="py-12 md:py-16 px-4 md:px-6 bg-gradient-to-br from-blue-600 to-indigo-700
                   relative overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
            backgroundSize: "30px 30px",
          }}
        />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-3xl font-bold text-white mb-4">
            Get started with Blueprint today
          </h2>
          <p className="text-blue-100 mb-8 text-sm">
            Join hundreds of students already learning. Sign up free — no
            credit card required to browse.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 md:gap-4">
            <Link
              href="/register"
              className="px-8 py-3.5 bg-white text-blue-700 font-semibold
                         rounded-xl hover:bg-blue-50 transition-all shadow-xl text-sm text-center"
            >
              Create free account
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 border-2 border-white/50 text-white
                         font-semibold rounded-xl hover:border-white
                         transition-all text-sm text-center"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-white py-10 md:py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src="/logo.png"
                  alt="Blueprint logo"
                  width={50}
                  height={50}
                  className="rounded-lg"
                />
                <span className="font-bold text-lg">Blueprint</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Professional online learning for healthcare and technical
                education.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4">Company</h4>
              <div className="space-y-2">
                {["About", "Courses", "FAQ", "Contact"].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className="block text-sm text-gray-400 hover:text-white
                               transition-colors"
                  >
                    {item}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-4">Support</h4>
              <div className="space-y-2">
                {["Help Center", "Privacy Policy", "Terms of Service"].map(
                  (item) => (
                    <a
                      key={item}
                      href="#"
                      className="block text-sm text-gray-400 hover:text-white
                                 transition-colors"
                    >
                      {item}
                    </a>
                  )
                )}
              </div>
            </div>
            <div className="col-span-2 md:col-span-1">
              <h4 className="font-semibold text-sm mb-4">Newsletter</h4>
              <p className="text-gray-400 text-xs mb-3">
                Get the latest course updates and announcements.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Email address"
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700
                             rounded-lg text-sm text-white placeholder:text-gray-500
                             focus:outline-none focus:border-blue-500"
                />
                <button
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white
                             text-xs font-medium rounded-lg transition-colors"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center
                          justify-between gap-3 sm:gap-0 text-center">
            <p className="text-gray-500 text-xs">
              © {new Date().getFullYear()} Blueprint. All rights reserved.
            </p>
            <p className="text-gray-500 text-xs mt-1">
              Made by <span className="font-bold text-gray-400">SteinKernel Systems</span>
            </p>
            <div className="flex items-center gap-4">
              {["Privacy", "Terms", "Cookies"].map((item) => (
                <a
                  key={item}
                  href="#"
                  className="text-xs text-gray-500 hover:text-gray-300
                             transition-colors"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Step card with scroll animation
function StepCard({
  step,
  index,
}: {
  step: { icon: string; title: string; desc: string };
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), index * 120);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div
      ref={ref}
      className={`bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100
                  hover:shadow-md hover:-translate-y-1 transition-all duration-500
                  text-center ${
                    visible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-8"
                  }`}
    >
      <div
        suppressHydrationWarning
        className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center
                  justify-center mx-auto mb-4 text-3xl"
      >
        {step.icon}
      </div>
      <h3 className="text-sm font-bold text-gray-900 mb-2">{step.title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
    </div>
  );
}