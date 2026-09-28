"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && appUser) {
      router.push("/dashboard");
    }
  }, [appUser, loading, router]);

  // Navbar scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Hero entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white overflow-x-hidden">

      {/* ── Navbar ───────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[#0a0a1a]/95 backdrop-blur-md border-b border-white/10 py-3"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center
                            justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-white font-semibold text-lg">Blueprint</span>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8">
            {["Courses", "About", "Features", "Contact"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm text-white/70 hover:text-white
                           transition-colors duration-200"
              >
                {item}
              </a>
            ))}
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-white/80 hover:text-white
                         transition-colors duration-200"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white
                         text-sm font-medium rounded-lg transition-all duration-200
                         hover:shadow-lg hover:shadow-blue-500/25"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center
                   overflow-hidden"
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-gradient-to-br from-blue-900/40
                        via-[#0a0a1a] to-violet-900/30"
          />

          {/* Animated orbs */}
          <div
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20
                        rounded-full blur-3xl animate-pulse"
            style={{ animationDuration: "4s" }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/20
                        rounded-full blur-3xl animate-pulse"
            style={{ animationDuration: "6s", animationDelay: "2s" }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-64 h-64 bg-teal-600/10 rounded-full blur-3xl animate-pulse"
            style={{ animationDuration: "8s", animationDelay: "1s" }}
          />
        </div>

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-blue-400/40 rounded-full
                         animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDuration: `${2 + Math.random() * 4}s`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Hero content */}
        <div className="relative z-10 text-center max-w-5xl mx-auto px-6">

          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full
                        border border-blue-500/30 bg-blue-500/10 text-blue-300
                        text-xs font-medium mb-8 transition-all duration-700 ${
                          visible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-4"
                        }`}
            style={{ transitionDelay: "0ms" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            The future of online education
          </div>

          {/* Headline */}
          <h1
            className={`text-5xl md:text-7xl font-bold leading-tight mb-6
                        transition-all duration-700 ${
                          visible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-8"
                        }`}
            style={{ transitionDelay: "150ms" }}
          >
            <span className="text-white">Bringing</span>
            <br />
            <span
              className="bg-gradient-to-r from-blue-400 via-violet-400 to-teal-400
                         bg-clip-text text-transparent"
            >
              knowledge to life
            </span>
            <br />
            <span className="text-white">for everyone.</span>
          </h1>

          {/* Subtitle */}
          <p
            className={`text-lg text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed
                        transition-all duration-700 ${
                          visible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-8"
                        }`}
            style={{ transitionDelay: "300ms" }}
          >
            A professional learning platform where students enroll, learn,
            and grow. Built for the modern learner.
          </p>

          {/* CTA buttons */}
          <div
            className={`flex items-center justify-center gap-4 mb-16
                        transition-all duration-700 ${
                          visible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-8"
                        }`}
            style={{ transitionDelay: "450ms" }}
          >
            <Link
              href="/register"
              className="group px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white
                         font-semibold rounded-xl transition-all duration-300
                         hover:shadow-2xl hover:shadow-blue-500/30
                         hover:-translate-y-0.5 text-sm"
            >
              Start learning today
              <span className="ml-2 group-hover:translate-x-1 inline-block
                               transition-transform duration-200">
                →
              </span>
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 border border-white/20 hover:border-white/40
                         text-white/80 hover:text-white font-medium rounded-xl
                         transition-all duration-300 hover:-translate-y-0.5 text-sm
                         backdrop-blur-sm"
            >
              Sign in
            </Link>
          </div>

          {/* Stats */}
          <div
            className={`flex items-center justify-center gap-12 transition-all
                        duration-700 ${
                          visible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-8"
                        }`}
            style={{ transitionDelay: "600ms" }}
          >
            {[
              { value: "100%", label: "Online" },
              { value: "Auto", label: "Enrollment" },
              { value: "HD", label: "Video Quality" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/40 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col
                        items-center gap-2 animate-bounce">
          <span className="text-xs text-white/30">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">

          {/* Section label */}
          <div className="text-center mb-16">
            <span className="text-xs font-medium text-blue-400 uppercase
                             tracking-widest">
              Why Blueprint
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">
              Everything you need to learn
            </h2>
            <p className="text-white/50 mt-3 max-w-xl mx-auto text-sm">
              A complete platform built for serious learners and educators.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: "🎥",
                title: "HD Video Lessons",
                desc: "Watch high-quality video content hosted on Vimeo. Stream anywhere, anytime.",
                color: "from-blue-500/20 to-blue-600/5",
                border: "border-blue-500/20",
              },
              {
                icon: "⚡",
                title: "Instant Access",
                desc: "Pay and get immediate access. No manual activation. Fully automated enrollment.",
                color: "from-violet-500/20 to-violet-600/5",
                border: "border-violet-500/20",
              },
              {
                icon: "📝",
                title: "Smart Exams",
                desc: "MCQ auto-grading with timed exams. Subjective questions reviewed by instructors.",
                color: "from-teal-500/20 to-teal-600/5",
                border: "border-teal-500/20",
              },
              {
                icon: "📊",
                title: "Track Progress",
                desc: "See your progress across all courses. Mark lessons complete and track your journey.",
                color: "from-emerald-500/20 to-emerald-600/5",
                border: "border-emerald-500/20",
              },
              {
                icon: "📄",
                title: "PDF Resources",
                desc: "Download course materials, notes, and resources directly from the platform.",
                color: "from-amber-500/20 to-amber-600/5",
                border: "border-amber-500/20",
              },
              {
                icon: "🔒",
                title: "Secure Payments",
                desc: "Pay safely via Paystack. Your data is protected with enterprise-grade security.",
                color: "from-rose-500/20 to-rose-600/5",
                border: "border-rose-500/20",
              },
            ].map((feature, i) => (
              <FeatureCard key={i} {...feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="py-24 px-6 relative">
        <div
          className="absolute inset-0 bg-gradient-to-b from-transparent
                      via-blue-900/10 to-transparent"
        />
        <div className="max-w-4xl mx-auto relative">
          <div className="text-center mb-16">
            <span className="text-xs font-medium text-blue-400 uppercase tracking-widest">
              How it works
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mt-3">
              Simple. Fast. Effective.
            </h2>
          </div>

          <div className="relative">
            {/* Connecting line */}
            <div
              className="absolute left-8 top-8 bottom-8 w-px
                          bg-gradient-to-b from-blue-500/50 via-violet-500/50
                          to-teal-500/50 hidden md:block"
            />

            <div className="space-y-8">
              {[
                {
                  step: "01",
                  title: "Create your account",
                  desc: "Sign up in seconds. No credit card required to browse courses.",
                  color: "bg-blue-500",
                },
                {
                  step: "02",
                  title: "Browse and choose",
                  desc: "Explore our course catalogue and find the right course for your goals.",
                  color: "bg-violet-500",
                },
                {
                  step: "03",
                  title: "Pay and get access",
                  desc: "Secure payment via Paystack. Access is granted instantly after payment.",
                  color: "bg-teal-500",
                },
                {
                  step: "04",
                  title: "Learn and grow",
                  desc: "Watch videos, read PDFs, take exams, and track your progress.",
                  color: "bg-emerald-500",
                },
              ].map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-6 group"
                >
                  <div
                    className={`w-16 h-16 ${step.color} rounded-2xl flex items-center
                                justify-center flex-shrink-0 text-white font-bold text-sm
                                group-hover:scale-110 transition-transform duration-300
                                shadow-lg relative z-10`}
                  >
                    {step.step}
                  </div>
                  <div className="pt-3">
                    <h3 className="text-white font-semibold mb-1">
                      {step.title}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Section ──────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div
            className="relative rounded-3xl overflow-hidden border border-white/10
                        bg-gradient-to-br from-blue-600/20 via-violet-600/10
                        to-teal-600/20 p-12 text-center"
          >
            {/* Glow */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-1
                          bg-gradient-to-r from-transparent via-blue-400
                          to-transparent"
            />

            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to start learning?
            </h2>
            <p className="text-white/60 mb-8 max-w-lg mx-auto text-sm">
              Join Blueprint today and get instant access to world-class
              courses. Your journey starts here.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/register"
                className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white
                           font-semibold rounded-xl transition-all duration-300
                           hover:shadow-2xl hover:shadow-blue-500/30
                           hover:-translate-y-0.5 text-sm"
              >
                Create free account →
              </Link>
              <Link
                href="/login"
                className="px-8 py-4 border border-white/20 text-white/80
                           hover:text-white rounded-xl transition-all duration-300
                           text-sm"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center
                            justify-center">
              <span className="text-white font-bold text-xs">B</span>
            </div>
            <span className="text-white/60 text-sm">Blueprint LMS</span>
          </div>
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Blueprint. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ── Feature Card with scroll animation ───────────────────────
function FeatureCard({
  icon,
  title,
  desc,
  color,
  border,
  index,
}: {
  icon: string;
  title: string;
  desc: string;
  color: string;
  border: string;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), index * 100);
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
      className={`relative rounded-2xl border ${border} bg-gradient-to-br
                  ${color} p-6 transition-all duration-700 hover:-translate-y-1
                  hover:border-opacity-50 group ${
                    visible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-8"
                  }`}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100
                    transition-opacity duration-300 bg-white/[0.02]"
      />

      <span className="text-3xl mb-4 block">{icon}</span>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}