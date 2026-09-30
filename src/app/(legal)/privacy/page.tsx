import type { Metadata } from "next";
import {
  LegalDoc,
  LegalSection,
  LegalList,
  ExternalLink,
  InternalLink,
} from "../_components/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy | Blueprint LMS",
  description:
    "How Blueprint LMS collects, uses and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      intro="Your privacy matters to us. This policy explains, in plain language, what personal information Blueprint LMS collects, why we collect it, and what your rights are."
    >
      <LegalSection number={1} title="Introduction">
        <p>
          Blueprint LMS (&quot;Blueprint&quot;, &quot;we&quot;, &quot;us&quot;) is
          an online learning platform operated by SteinKernel Systems. It is
          built for students and healthcare professionals in Ghana preparing
          for exams such as the NCLEX and IELTS.
        </p>
        <p>
          This policy covers the Blueprint LMS website at{" "}
          <ExternalLink href="https://blueprint-perin1.vercel.app">
            blueprint-perin1.vercel.app
          </ExternalLink>{" "}
          and every service offered through it, including course enrollment and
          Credentialing Assistance. By using the platform you acknowledge that
          you have read this policy.
        </p>
        <p>
          We handle your personal data in line with the Ghana Data Protection
          Act, 2012 (Act 843).
        </p>
      </LegalSection>

      <LegalSection number={2} title="Information We Collect">
        <p className="font-medium text-gray-900">Account information</p>
        <LegalList>
          <li>Your name and email address.</li>
          <li>
            Your profile photo, if you sign in with Google (we receive the link
            to your Google profile photo).
          </li>
        </LegalList>

        <p className="font-medium text-gray-900 pt-2">Payment information</p>
        <LegalList>
          <li>
            A transaction reference, the course or service you bought, the
            amount paid, and the payment status.
          </li>
          <li>
            We do <strong>not</strong> collect or store card numbers, CVV codes,
            mobile money PINs or any other raw payment credentials. These are
            entered on, and handled entirely by, Paystack.
          </li>
        </LegalList>

        <p className="font-medium text-gray-900 pt-2">Learning data</p>
        <LegalList>
          <li>The courses you are enrolled in and when your access expires.</li>
          <li>
            Your progress: lessons and materials completed, and quizzes passed.
          </li>
          <li>Your quiz and exam attempts, answers and scores.</li>
          <li>
            For Credentialing Assistance: your stage-by-stage progress, dates,
            and notes that our administrators record on your file.
          </li>
          <li>
            Reviews you choose to submit. A review is shown publicly on our
            landing page together with your name and rating.
          </li>
        </LegalList>

        <p className="font-medium text-gray-900 pt-2">Technical data</p>
        <LegalList>
          <li>A session cookie that keeps you signed in (see section 5).</li>
          <li>
            Your IP address and browser type, which are recorded in server logs
            by our hosting provider, Vercel.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection number={3} title="How We Use Your Information">
        <LegalList>
          <li>To give you access to the courses you have purchased.</li>
          <li>To track and show your learning progress and quiz results.</li>
          <li>To process payments through Paystack and confirm your purchase.</li>
          <li>
            To send password reset emails (sent through Firebase Authentication).
          </li>
          <li>To display announcements from Blueprint administrators.</li>
          <li>
            To manage the Credentialing Assistance workflow, including recording
            which stage you are on.
          </li>
          <li>To keep the platform secure and prevent fraud or misuse.</li>
        </LegalList>
        <p>
          We do not sell your personal information, and we do not use it for
          advertising.
        </p>
      </LegalSection>

      <LegalSection number={4} title="Third-Party Services">
        <p>
          We rely on trusted providers to run the platform. They process data on
          our behalf, and each has its own privacy policy that governs how they
          handle it:
        </p>
        <LegalList>
          <li>
            <strong>Google Firebase</strong> (sign-in, database and file
            storage) —{" "}
            <ExternalLink href="https://policies.google.com/privacy">
              Google Privacy Policy
            </ExternalLink>
          </li>
          <li>
            <strong>Paystack</strong> (payment processing) —{" "}
            <ExternalLink href="https://paystack.com/privacy/merchant">
              Paystack Privacy Policy
            </ExternalLink>
          </li>
          <li>
            <strong>Vimeo</strong> (lesson video hosting) —{" "}
            <ExternalLink href="https://vimeo.com/privacy">
              Vimeo Privacy Policy
            </ExternalLink>
          </li>
          <li>
            <strong>Vercel</strong> (website hosting) —{" "}
            <ExternalLink href="https://vercel.com/legal/privacy-policy">
              Vercel Privacy Policy
            </ExternalLink>
          </li>
        </LegalList>
        <p>
          Some of these providers store or process data on servers outside
          Ghana. By using the platform you understand that your data may be
          transferred to and processed in other countries.
        </p>
      </LegalSection>

      <LegalSection number={5} title="Cookies">
        <p>
          We use a single session cookie, which is <code>httpOnly</code> and
          secure, to keep you signed in. It is essential for the service to
          work. We do not use advertising or tracking cookies. More detail is in
          our <InternalLink href="/cookies">Cookie Policy</InternalLink>.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Data Retention">
        <LegalList>
          <li>
            Your account and learning data are kept for as long as your account
            is active.
          </li>
          <li>
            {/* TODO: Client to confirm this policy */}
            Payment records are kept for 7 years to meet legal and accounting
            obligations, even if your account is deleted.
          </li>
          <li>
            You can ask us to delete your account and personal data at any time
            (see section 7). Some records may be kept where the law requires it.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection number={7} title="Your Rights (Ghana Data Protection Act, 2012)">
        <p>You have the right to:</p>
        <LegalList>
          <li>Access the personal data we hold about you.</li>
          <li>Ask us to correct data that is inaccurate or out of date.</li>
          <li>Ask us to delete your personal data.</li>
          <li>
            Withdraw your consent to us processing your data. Note that we may
            not be able to provide the service without some of it.
          </li>
        </LegalList>
        <p>
          To exercise any of these rights, email us at{" "}
          {/* TODO: Client to replace this placeholder email address */}
          <a
            href="mailto:privacy@blueprintlms.com"
            className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            privacy@blueprintlms.com
          </a>
          . We may need to confirm your identity first, and we will respond as
          soon as reasonably possible. If you are unhappy with how we handle
          your data, you may also contact Ghana&apos;s Data Protection
          Commission.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Data Security">
        <LegalList>
          <li>
            Data is encrypted in transit using HTTPS/TLS, provided through
            Vercel.
          </li>
          <li>
            Firebase security rules restrict who can read and write data, and
            administrative actions are checked on our servers.
          </li>
          <li>
            Passwords are managed by Google Firebase Authentication. We never see
            or store your password in plain text.
          </li>
          <li>We do not store payment card details.</li>
        </LegalList>
        <p>
          No system is completely secure, but we work to protect your
          information and will act promptly if we learn of a problem.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Children's Privacy">
        <p>
          Blueprint LMS is intended for adults aged 18 and over. We do not
          knowingly collect personal data from anyone under 18. If you believe a
          minor has created an account, please contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Contact">
        <p>
          Questions about this policy? Get in touch:
        </p>
        <LegalList>
          <li>
            Email:{" "}
            {/* TODO: Client to replace this placeholder email address */}
            <a
              href="mailto:privacy@blueprintlms.com"
              className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
            >
              privacy@blueprintlms.com
            </a>
          </li>
          <li>Company: SteinKernel Systems</li>
        </LegalList>
        <p>
          We may update this policy from time to time. The &quot;Last
          updated&quot; date at the top shows when it last changed.
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
