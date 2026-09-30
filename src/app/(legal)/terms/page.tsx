import type { Metadata } from "next";
import {
  LegalDoc,
  LegalSection,
  LegalList,
  InternalLink,
} from "../_components/LegalDoc";

export const metadata: Metadata = {
  title: "Terms and Conditions | Blueprint LMS",
  description:
    "The terms that apply when you use Blueprint LMS, including course purchases and Credentialing Assistance.",
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms and Conditions"
      intro="Please read these terms carefully. They explain the rules for using Blueprint LMS, what you can expect from us, and what we expect from you."
    >
      <LegalSection number={1} title="Introduction and Acceptance">
        <p>
          Blueprint LMS (&quot;Blueprint&quot;, &quot;we&quot;, &quot;us&quot;) is
          an online learning platform operated by SteinKernel Systems. By
          creating an account, buying a course, or otherwise using the platform,
          you agree to these Terms and Conditions and to our{" "}
          <InternalLink href="/privacy">Privacy Policy</InternalLink>. If you do
          not agree, please do not use the platform.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Account Registration">
        <LegalList>
          <li>You must give accurate and up-to-date information.</li>
          <li>
            You are responsible for keeping your account secure, and for
            everything that happens under your account.
          </li>
          <li>Each person may hold only one account.</li>
          <li>You must be at least 18 years old to register.</li>
        </LegalList>
        <p>
          Please tell us straight away if you think someone else has accessed
          your account.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Course Access and Enrollment">
        <LegalList>
          <li>Courses are purchased individually.</li>
          <li>Access is granted only after your payment has been verified.</li>
          <li>
            The length of access is shown for each course and is typically one
            year from the date of enrollment. When it ends, you will no longer
            be able to open the course.
          </li>
          <li>
            Access is personal and non-transferable. Your enrollment is for your
            use only.
          </li>
          <li>
            We may update, improve or add to course content over time.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection number={4} title="Payment Terms">
        <LegalList>
          <li>All prices are shown and charged in Ghana Cedis (GHS).</li>
          <li>
            Payments are processed securely by Paystack. We never see or store
            your card details.
          </li>
          <li>
            Once Paystack confirms your payment, your access is activated
            automatically. This can take a short moment.
          </li>
          <li>
            We may change course prices at any time. A price change does not
            affect courses you have already bought.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection number={5} title="Refund Policy">
        {/* TODO: Client to confirm this policy */}
        <LegalList>
          <li>
            Because course content is digital and available immediately, all
            sales are generally final once course access has been granted.
          </li>
          <li>
            If a technical problem prevents you from accessing a course you paid
            for, contact us within 7 days of your purchase and we will work to
            fix it.
          </li>
          <li>
            Credentialing Assistance fees are non-refundable once the service
            has commenced.
          </li>
        </LegalList>
        <p>
          Nothing in this section limits any rights you have under Ghanaian
          consumer protection law.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Credentialing Assistance">
        <LegalList>
          <li>
            Credentialing Assistance is a separate paid service from course
            enrollment.
          </li>
          <li>
            It is a guidance and tracking service. It does <strong>not</strong>{" "}
            guarantee NCLEX licensure, an Authorization to Test, or any other
            specific outcome.
          </li>
          <li>
            Your progress through each stage is updated by Blueprint
            administrators.
          </li>
          <li>
            Timelines depend on third parties such as nursing regulatory bodies,
            verification services and testing providers. These are outside our
            control, and we cannot promise how long any stage will take.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection number={7} title="Acceptable Use">
        <p>When using Blueprint LMS you agree that you will not:</p>
        <LegalList>
          <li>Share your account login details with anyone else.</li>
          <li>
            Copy, record, redistribute or resell course content, including
            videos, documents and quiz questions.
          </li>
          <li>
            Try to get around payment, access or security controls, or to reach
            content or accounts that are not yours.
          </li>
          <li>Use the platform for any unlawful purpose.</li>
        </LegalList>
        <p>
          If you break these rules we may suspend or close your account without
          a refund.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Intellectual Property">
        <p>
          All course content on the platform is owned by Blueprint LMS and
          SteinKernel Systems, or is licensed to us by its instructors and
          authors. When you enroll, you receive a limited, non-exclusive,
          non-transferable licence to view the content for your own personal
          learning only. No ownership rights are transferred to you.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Limitation of Liability">
        <LegalList>
          <li>
            The platform is provided &quot;as is&quot;. We work hard to keep it
            available and accurate, but we do not promise it will always be
            uninterrupted or error-free.
          </li>
          <li>
            We are not responsible for the result of any professional or
            language examination, including the NCLEX and IELTS. Our courses
            help you prepare; they do not guarantee you will pass.
          </li>
          <li>
            Our total liability to you for any claim is limited to the amount
            you paid for the course or service the claim relates to.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection number={10} title="Governing Law">
        <p>
          These terms are governed by the laws of Ghana. Any dispute that
          cannot be settled amicably will be subject to the jurisdiction of the
          courts of Ghana.
        </p>
      </LegalSection>

      <LegalSection number={11} title="Changes to These Terms">
        <p>
          We may update these terms from time to time. When we make a
          significant change, we will let users know, for example through an
          announcement on the platform. The &quot;Last updated&quot; date at the
          top shows the latest version. If you keep using Blueprint LMS after a
          change, you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection number={12} title="Contact">
        <p>
          Questions about these terms? Email us at{" "}
          {/* TODO: Client to replace this placeholder email address */}
          <a
            href="mailto:support@blueprintlms.com"
            className="text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            support@blueprintlms.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalDoc>
  );
}
