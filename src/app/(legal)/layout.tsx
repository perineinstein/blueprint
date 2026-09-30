import Link from "next/link";
import Image from "next/image";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/cookies", label: "Cookie Policy" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Blueprint logo"
              width={40}
              height={40}
              className="rounded-lg w-10 h-10"
            />
            <span className="font-bold text-lg text-gray-900">Blueprint</span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-blue-600 hover:text-blue-700
                       transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 md:px-6 py-10 md:py-14">
        {children}
      </main>

      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Blueprint LMS, operated by SteinKernel
            Systems.
          </p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-gray-500 hover:text-blue-600
                           transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
