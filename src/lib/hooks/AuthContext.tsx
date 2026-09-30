"use client";

import {
  useState,
  useEffect,
  createContext,
  useContext,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { AppUser } from "@/types";

export interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAppUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  appUser: null,
  loading: true,
  register: async () => {},
  login: async () => {},
  logout: async () => {},
  refreshAppUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          // Always refresh session cookie when auth restores
          const idToken = await firebaseUser.getIdToken(true); // force refresh
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });

          const docSnap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (docSnap.exists()) {
            setAppUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
          }
        } catch (error) {
          console.error("Error restoring session:", error);
        }
      } else {
        setUser(null);
        setAppUser(null);
        await fetch("/api/auth/session", { method: "DELETE" });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function register(name: string, email: string, password: string) {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    await updateProfile(credential.user, { displayName: name });

    const userDoc: Omit<AppUser, "id"> = {
      name,
      email,
      role: "student",
      photoUrl: null,
      createdAt: serverTimestamp() as any,
    };

    await setDoc(doc(db, "users", credential.user.uid), userDoc);

    const idToken = await credential.user.getIdToken();
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    setAppUser({ id: credential.user.uid, ...userDoc } as AppUser);
  }

  async function login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await credential.user.getIdToken();
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  }

  async function logout() {
    await signOut(auth);
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
    setAppUser(null);
  }

  // Re-read users/{uid}. Needed after Google sign-in creates the user doc:
  // onAuthStateChanged fires before that doc exists, so appUser would
  // otherwise stay null until the next page load.
  async function refreshAppUser() {
    const current = auth.currentUser;
    if (!current) return;
    const docSnap = await getDoc(doc(db, "users", current.uid));
    if (docSnap.exists()) {
      setAppUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        appUser,
        loading,
        register,
        login,
        logout,
        refreshAppUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}