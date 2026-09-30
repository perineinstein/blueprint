import type { Metadata } from "next";
import {
  LegalDoc,
  LegalSection,
  LegalList,
  ExternalLink,
  InternalLink,
} from "../_components/LegalDoc";

export const metadata: Metadata = {
  title: "Cookie Policy | Blueprint LMS",
  description: "The cookies Blueprint LMS uses, and why.",
};

const SESSION_COOKIE_DETAILS = [
  { label: "Name", value: "session" },
  { label: "Purpose", value: "Keeps you logged in securely" },
  { label: "Type", value: "Essential / strictly necessary" },
  { label: "Duration", value: "7 days" },
  {
    label: "HttpOnly",
    value: "Yes (cannot be read by JavaScript)",
  },
  { label: "Secure", value: "Yes (only sent over HTTPS)" },
];

export default function CookiePolicyPage() {
  return (
    <LegalDoc
      title="Cookie Policy"
      intro="We keep cookies to the bare minimum. This page explains which cookies Blueprint LMS uses and what you can do about them."
    >
      <LegalSection number={1} title="What Are Cookies?">
        <p>
          Cookies are small text files that a website saves in your browser.
          They let the site remember things between page visits, such as the
          fact that you are signed in.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Cookies We Use">
        <p>
          Blueprint LMS sets one cookie of its own, and it is essential for the
          platform to work.
        </p>
        <div className="rounded-2xl border border-gray-100 overflow-hidden">
          <dl className="divide-y divide-gray-100">
            {SESSION_COOKIE_DETAILS.map((row) => (
              <div
                key={row.label}
                className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3"
              >
                <dt className="sm:w-32 text-sm font-medium text-gray-900 flex-shrink-0">
                  {row.label}
                </dt>
                <dd className="text-sm text-gray-600">
                  {row.label === "Name" ? (
                    <code className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-800">
                      {row.value}
                    </code>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </LegalSection>

      <LegalSection number={3} title="Cookies We Do NOT Use">
        <LegalList>
          <li>No advertising cookies.</li>
          <li>No tracking or analytics cookies.</li>
          <li>No third-party marketing cookies.</li>
        </LegalList>
      </LegalSection>

      <LegalSection number={4} title="Third-Party Cookies">
        <p>
          Some services we use may set their own cookies while you use them.
          These are controlled by the provider, not by us:
        </p>
        <LegalList>
          <li>
            <strong>Google Firebase</strong> may set cookies or similar storage
            for authentication.{" "}
            <ExternalLink href="https://policies.google.com/technologies/cookies">
              Google&apos;s cookie information
            </ExternalLink>
          </li>
          <li>
            <strong>Vimeo</strong> may set cookies when you play a lesson video.{" "}
            <ExternalLink href="https://vimeo.com/cookie_policy">
              Vimeo Cookie Policy
            </ExternalLink>
          </li>
          <li>
            <strong>Paystack</strong> may set cookies while you pay.{" "}
            <ExternalLink href="https://paystack.com/privacy/merchant">
              Paystack Privacy Policy
            </ExternalLink>
          </li>
        </LegalList>
        <p>
          Each provider&apos;s own policy explains how its cookies work and how
          to manage them.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Your Control">
        <p>
          The session cookie is essential. Without it you cannot log in, so we
          do not offer a way to switch it off while using the platform.
        </p>
        <p>
          You can clear or block cookies at any time in your browser settings.
          Clearing the session cookie will log you out, and you will need to
          sign in again.
        </p>
        <p>
          For more on how we handle your data, see our{" "}
          <InternalLink href="/privacy">Privacy Policy</InternalLink>.
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
