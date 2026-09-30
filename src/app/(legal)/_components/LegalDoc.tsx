import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const LEGAL_LAST_UPDATED = "30 September 2026";

export function LegalDoc({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <article>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500
                   hover:text-blue-600 mb-6 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to home
      </Link>
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
        {title}
      </h1>
      <p className="text-sm text-gray-400 mb-6">
        Last updated: {LEGAL_LAST_UPDATED}
      </p>
      {intro && (
        <p className="text-base text-gray-600 leading-relaxed mb-8 pb-8 border-b border-gray-100">
          {intro}
        </p>
      )}
      <div className="space-y-10">{children}</div>
    </article>
  );
}

export function LegalSection({
  number,
  title,
  children,
}: {
  number?: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900 mb-3">
        {number !== undefined && (
          <span className="text-blue-600 mr-2">{number}.</span>
        )}
        {title}
      </h2>
      <div className="space-y-3 text-gray-600 leading-relaxed text-[15px]">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 marker:text-blue-400">
      {children}
    </ul>
  );
}

export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
    >
      {children}
    </a>
  );
}

export function InternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
    >
      {children}
    </Link>
  );
}
