"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { GraduationCap, Hand, Mail } from "lucide-react";

export default function AuthPage() {
  const { login, register } = useAuth();
  const router = useRouter();

  const [activeView, setActiveView] = useState<"login" | "register">("login");
  const [showForgot, setShowForgot] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  // Google state
  const [googleLoading, setGoogleLoading] = useState(false);

  // ── Login ───────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await login(loginEmail, loginPassword);
      router.push("/dashboard");
    } catch (err: any) {
      setLoginError(firebaseError(err.code));
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Register ────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    if (regPassword !== regConfirm) {
      setRegError("Passwords do not match.");
      return;
    }
    if (regPassword.length < 6) {
      setRegError("Password must be at least 6 characters.");
      return;
    }
    setRegLoading(true);
    try {
      await register(regName, regEmail, regPassword);
      router.push("/dashboard");
    } catch (err: any) {
      setRegError(firebaseError(err.code));
    } finally {
      setRegLoading(false);
    }
  }

  // ── Forgot password ─────────────────────────────────────
  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/login`,
        handleCodeInApp: false,
      };
      await sendPasswordResetEmail(auth, forgotEmail.trim(), actionCodeSettings);
      setForgotSent(true);
    } catch (err: any) {
      console.error("Password reset error:", err?.code, err?.message);
      setForgotError(firebaseError(err.code));
    } finally {
      setForgotLoading(false);
    }
  }

  // ── Google sign in ──────────────────────────────────────
  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user doc exists — create if not
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          name: user.displayName ?? "Student",
          email: user.email,
          role: "student",
          photoUrl: user.photoURL ?? null,
          createdAt: serverTimestamp(),
        });
      }

      // Set session cookie
      const idToken = await user.getIdToken();
      const sessionRes = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionRes.ok) {
        const errData = await sessionRes.json().catch(() => ({}));
        console.error("Session error:", sessionRes.status, errData);
        setLoginError("Authentication failed. Please try again.");
        return;
      }

      router.push("/dashboard");
    } catch (err: any) {
      setLoginError(firebaseError(err.code));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4 pt-16 md:pt-4">

      {/* Back to home */}
      
      <a href="/" className="absolute md:fixed top-4 left-4 md:top-6 md:left-6 py-2 md:py-0 flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors">
        Home 
      </a>
      

      {/* Card */}
      <div
        className="relative w-full max-w-[680px] md:h-[520px] rounded-3xl
                   overflow-hidden shadow-2xl shadow-black/50"
        style={{ perspective: "1000px" }}
      >

        {/* ── Sliding gradient background ─────────────────── */}
        <div
          className="hidden md:block absolute top-0 bottom-0 w-1/2 z-20 rounded-2xl
                     transition-all duration-700 ease-in-out"
          style={{
            background: "linear-gradient(135deg, #3b23c9, #6b50ff, #8b5cf6)",
            left: activeView === "login" ? "50%" : "0%",
          }}
        >
          {/* Orbs inside gradient panel */}
          <div
            className="absolute top-8 right-8 w-24 h-24 rounded-full
                        bg-white/10 blur-xl"
          />
          <div
            className="absolute bottom-8 left-8 w-32 h-32 rounded-full
                        bg-white/10 blur-xl"
          />
        </div>

        {/* ── White form background ───────────────────────── */}
        <div className="absolute inset-0 bg-white rounded-3xl" />

        {/* ── Login form (left side) ───────────────────────── */}
        <div
          className={`relative md:absolute md:top-0 md:bottom-0 md:left-0 md:w-1/2 ${
            activeView === "login" ? "flex" : "hidden md:flex"
          } flex-col items-center justify-center px-6 py-8 md:px-8 md:py-0
                     transition-all duration-700 ease-in-out z-10`}
          style={{
            opacity: activeView === "login" ? 1 : 0,
            transform:
              activeView === "login"
                ? "translateX(0)"
                : "translateX(-30px)",
            pointerEvents: activeView === "login" ? "auto" : "none",
          }}
        >
          {!showForgot ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Welcome back
              </h2>
              <p className="text-xs text-gray-400 mb-6">
                Sign in to your account
              </p>

              {loginError && (
                <div className="w-full mb-3 p-2.5 bg-red-50 border border-red-100
                               rounded-xl text-xs text-red-600">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="w-full space-y-3">
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200
                             rounded-xl text-sm text-gray-900 placeholder:text-gray-400
                             focus:outline-none focus:ring-2 focus:ring-blue-500
                             focus:border-transparent transition-all"
                />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200
                             rounded-xl text-sm text-gray-900 placeholder:text-gray-400
                             focus:outline-none focus:ring-2 focus:ring-blue-500
                             focus:border-transparent transition-all"
                />

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-xs text-blue-600 hover:text-blue-700
                               hover:underline transition-colors py-2 md:py-0"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 bg-gradient-to-r from-blue-600
                             to-violet-600 hover:from-blue-500 hover:to-violet-500
                             text-white text-sm font-semibold rounded-xl
                             transition-all duration-300 hover:shadow-lg
                             hover:shadow-blue-500/25 disabled:opacity-50"
                >
                  {loginLoading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 w-full my-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Google button */}
              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                className="w-full py-3 border border-gray-200 hover:border-gray-300
                           bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium
                           rounded-xl transition-all duration-200 flex items-center
                           justify-center gap-2 disabled:opacity-50"
              >
                <GoogleIcon />
                {googleLoading ? "Connecting..." : "Continue with Google"}
              </button>

              <p className="md:hidden mt-5 text-sm text-gray-500 text-center">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveView("register");
                    setLoginError("");
                    setShowForgot(false);
                  }}
                  className="text-blue-600 font-semibold hover:underline py-2"
                >
                  Sign up
                </button>
              </p>
            </>
          ) : (
            // ── Forgot password view ──────────────────────
            <>
              <button
                onClick={() => {
                  setShowForgot(false);
                  setForgotSent(false);
                  setForgotError("");
                }}
                className="self-start text-xs text-gray-400 hover:text-gray-600
                           mb-4 transition-colors"
              >
                ← Back to login
              </button>

              <h2 className="text-xl font-bold text-gray-900 mb-1 self-start">
                Reset password
              </h2>
              <p className="text-xs text-gray-400 mb-6 self-start">
                We'll send a reset link to your email
              </p>

              {forgotSent ? (
                <div className="w-full p-4 bg-green-50 border border-green-100
                               rounded-xl text-center">
                  <Mail size={28} className="mx-auto mb-2 text-green-600" />
                  <p className="text-sm font-medium text-green-700">
                    Reset link sent!
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Check your email inbox and follow the instructions.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="w-full space-y-3">
                  {forgotError && (
                    <div className="p-2.5 bg-red-50 border border-red-100
                                   rounded-xl text-xs text-red-600">
                      {forgotError}
                    </div>
                  )}
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Your email address"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200
                               rounded-xl text-sm text-gray-900 placeholder:text-gray-400
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               focus:border-transparent transition-all"
                  />
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full py-3 bg-gradient-to-r from-blue-600
                               to-violet-600 text-white text-sm font-semibold
                               rounded-xl transition-all duration-300
                               hover:shadow-lg hover:shadow-blue-500/25
                               disabled:opacity-50"
                  >
                    {forgotLoading ? "Sending..." : "Send reset link"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* ── Register form (right side) ───────────────────── */}
        <div
          className={`relative md:absolute md:top-0 md:bottom-0 md:right-0 md:w-1/2 ${
            activeView === "register" ? "flex" : "hidden md:flex"
          } flex-col items-center justify-center px-6 py-8 md:px-8 md:py-0
                     transition-all duration-700 ease-in-out z-10`}
          style={{
            opacity: activeView === "register" ? 1 : 0,
            transform:
              activeView === "register"
                ? "translateX(0)"
                : "translateX(30px)",
            pointerEvents: activeView === "register" ? "auto" : "none",
          }}
        >
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Create account
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Start your learning journey
          </p>

          {regError && (
            <div className="w-full mb-3 p-2.5 bg-red-50 border border-red-100
                           rounded-xl text-xs text-red-600">
              {regError}
            </div>
          )}

          <form onSubmit={handleRegister} className="w-full space-y-3">
            <input
              type="text"
              required
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-3 md:py-2.5 bg-gray-50 border border-gray-200
                         rounded-xl text-sm text-gray-900 placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-violet-500
                         focus:border-transparent transition-all"
            />
            <input
              type="email"
              required
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-4 py-3 md:py-2.5 bg-gray-50 border border-gray-200
                         rounded-xl text-sm text-gray-900 placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-violet-500
                         focus:border-transparent transition-all"
            />
            <input
              type="password"
              required
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 md:py-2.5 bg-gray-50 border border-gray-200
                         rounded-xl text-sm text-gray-900 placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-violet-500
                         focus:border-transparent transition-all"
            />
            <input
              type="password"
              required
              value={regConfirm}
              onChange={(e) => setRegConfirm(e.target.value)}
              placeholder="Confirm password"
              className="w-full px-4 py-3 md:py-2.5 bg-gray-50 border border-gray-200
                         rounded-xl text-sm text-gray-900 placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-violet-500
                         focus:border-transparent transition-all"
            />

            <button
              type="submit"
              disabled={regLoading}
              className="w-full py-3 bg-gradient-to-r from-violet-600
                         to-blue-600 hover:from-violet-500 hover:to-blue-500
                         text-white text-sm font-semibold rounded-xl
                         transition-all duration-300 hover:shadow-lg
                         hover:shadow-violet-500/25 disabled:opacity-50"
            >
              {regLoading ? "Creating account..." : "Create account"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 w-full my-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full py-3 md:py-2.5 border border-gray-200 hover:border-gray-300
                       bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium
                       rounded-xl transition-all duration-200 flex items-center
                       justify-center gap-2 disabled:opacity-50"
          >
            <GoogleIcon />
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </button>

          <p className="md:hidden mt-4 text-sm text-gray-500 text-center">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setActiveView("login");
                setRegError("");
              }}
              className="text-blue-600 font-semibold hover:underline py-2"
            >
              Log in
            </button>
          </p>
        </div>

        {/* ── Hero panel: Login side (right, slides left) ──── */}
        <div
          className="absolute top-0 bottom-0 w-1/2 z-30 hidden md:flex flex-col
                     items-center justify-center gap-5 px-8 text-center
                     transition-all duration-700 ease-in-out"
          style={{
            right: 0,
            transform:
              activeView === "login" ? "translateX(0)" : "translateX(100%)",
          }}
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center
                          justify-center mb-2">
            <Hand size={24} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Hello there!</h2>
          <p className="text-sm text-white/70 leading-relaxed">
            Don't have an account yet? Join Blueprint and start your
            learning journey today.
          </p>
          <button
            onClick={() => {
              setActiveView("register");
              setLoginError("");
              setShowForgot(false);
            }}
            className="px-8 py-3 rounded-full border border-white/80
                       text-white text-sm font-semibold hover:bg-white
                       hover:text-violet-700 transition-all duration-300
                       tracking-wide"
          >
            SIGN UP
          </button>
        </div>

        {/* ── Hero panel: Register side (left, slides right) ── */}
        <div
          className="absolute top-0 bottom-0 w-1/2 z-30 hidden md:flex flex-col
                     items-center justify-center gap-5 px-8 text-center
                     transition-all duration-700 ease-in-out"
          style={{
            left: 0,
            transform:
              activeView === "register"
                ? "translateX(0)"
                : "translateX(-100%)",
          }}
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center
                          justify-center mb-2">
            <GraduationCap size={24} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Welcome back!</h2>
          <p className="text-sm text-white/70 leading-relaxed">
            Already have an account? Sign in to continue your learning
            journey.
          </p>
          <button
            onClick={() => {
              setActiveView("login");
              setRegError("");
            }}
            className="px-8 py-3 rounded-full border border-white/80
                       text-white text-sm font-semibold hover:bg-white
                       hover:text-blue-700 transition-all duration-300
                       tracking-wide"
          >
            LOGIN
          </button>
        </div>
      </div>
    </div>
  );
}

// Google icon SVG
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function firebaseError(code: string): string {
  const errors: Record<string, string> = {
    "auth/user-not-found": "No account found with this email address.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many requests. Please try again later.",
    "auth/unauthorized-continue-uri":
      "This domain is not authorized for password reset. Contact support.",
    "auth/invalid-continue-uri":
      "Password reset is misconfigured. Contact support.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/cancelled-popup-request": "Only one popup allowed at a time.",
    "auth/unauthorized-domain":
      "This domain is not authorized for sign-in. Contact support.",
    "auth/internal-error": "An internal error occurred. Please try again.",
    "auth/popup-blocked":
      "Popup was blocked. Please allow popups for this site.",
  };
  return errors[code] ?? "Something went wrong. Please try again.";
}