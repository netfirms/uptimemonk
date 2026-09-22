import type { Metadata } from "next";
import Link from "next/link";

/**
 * The privacy policy.
 *
 * Written from an audit of what the code actually stores, not from a template.
 * Every item below was traced to a table, a Firebase product or an outbound
 * request — a policy that lists things the product does not collect is as
 * wrong as one that omits things it does, and the app stores check.
 *
 * A server component with no client JavaScript: this is a static export, the
 * page never changes between builds, and a legal page that needs a hydrated
 * bundle to render is a page that can fail to render.
 *
 * When the data practices change, change this page in the same commit. The
 * "last updated" line below is not decoration — a stale policy is a
 * misrepresentation, not merely untidy documentation.
 */

const LAST_UPDATED = "22 September 2026";
const CONTACT_EMAIL = "privacy@uptimemonke.com";

export const metadata: Metadata = {
  // Just the page name: the root layout's template appends "| UptimeMonke",
  // and spelling it out here produced "Privacy Policy | UptimeMonke | UptimeMonke".
  title: "Privacy Policy",
  description:
    "What UptimeMonke collects, why, who it is shared with, how long it is kept, and how to delete it.",
  alternates: { canonical: "https://uptimemonke.com/privacy" },
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link href="/" className="legal-back">
          ← UptimeMonke
        </Link>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated {LAST_UPDATED}</p>
      </header>

      <div className="legal-summary">
        <p>
          <strong>The short version.</strong> We collect the email address you sign in
          with, the monitors you create, and the destinations you tell us to send alerts
          to. We do not sell anything to anyone, we do not run advertising, and we do not
          track you across other sites. You can delete your account and everything in it
          at any time.
        </p>
      </div>

      <Section id="who" title="Who we are">
        <p>
          UptimeMonke is an uptime monitoring service operated from Singapore. This policy
          covers the website at uptimemonke.com, the API at api.uptimemonke.com, and the
          UptimeMonke mobile apps for Android and iOS.
        </p>
      </Section>

      <Section id="what" title="What we collect, and why">
        <h3>Account information</h3>
        <p>
          When you create an account we receive, from you or from the identity provider you
          choose to sign in with (Google, GitHub or Apple):
        </p>
        <ul>
          <li>
            <strong>Your email address</strong> — to identify your account, to send you the
            confirmation link, and to reach you about your workspace.
          </li>
          <li>
            <strong>Your display name and profile picture</strong>, where the provider
            supplies them — shown to you in the app. These are optional and you can change
            the name.
          </li>
          <li>
            <strong>An account identifier</strong> issued by Firebase Authentication.
          </li>
        </ul>
        <p>
          <strong>We never receive your password.</strong> Authentication is handled by
          Firebase Authentication; if you sign in with Google, GitHub or Apple, your
          password is never sent to us at all.
        </p>

        <h3>What you put into the service</h3>
        <ul>
          <li>
            <strong>Monitors</strong> — the name, the address being checked, and any
            settings for that check type, such as a keyword to look for, a port, or a DNS
            record.
          </li>
          <li>
            <strong>Alert contacts</strong> — the channel and the destination you enter:
            an email address, a Slack or Discord webhook URL, a chat identifier, or your
            own webhook endpoint.
          </li>
          <li>
            <strong>Your workspace name.</strong>
          </li>
        </ul>

        <h3>What the service produces</h3>
        <ul>
          <li>
            <strong>Check results</strong> — whether each check succeeded, how long it
            took, and the error text when it failed.
          </li>
          <li>
            <strong>Incidents</strong> — when a monitor went down, when it recovered, and
            the cause reported by the check.
          </li>
        </ul>

        <h3>Mobile app</h3>
        <ul>
          <li>
            <strong>A push notification token</strong>, if you allow notifications. It
            identifies your device to Firebase Cloud Messaging so an alert can reach it. It
            is deleted when you sign out or disable notifications.
          </li>
        </ul>

        <h3>Usage analytics</h3>
        <p>
          We use Google Analytics, through Firebase, to understand which features get used
          and where people get stuck. Events record the action — that a monitor was
          created, that a sign-in failed — together with an opaque workspace identifier and
          whether the workspace is on the free tier.
        </p>
        <p>
          <strong>Analytics never receives your email address, your monitor addresses, or
          your alert destinations.</strong> That is a deliberate constraint in the code, not
          a policy promise: those values are not passed to the analytics layer.
        </p>

        <h3>Anti-abuse</h3>
        <p>
          Sign-up and sign-in are protected by Google reCAPTCHA, which analyses the request
          to distinguish a person from automated abuse. Google&apos;s handling of that is
          governed by its own privacy policy.
        </p>

        <h3>Donations</h3>
        <p>
          Donations are processed by Stripe. <strong>Card details never reach our
          servers</strong> — they are entered on Stripe&apos;s own checkout. We receive
          confirmation that a payment succeeded and the amount, which is what we use to
          raise your check allowance.
        </p>
      </Section>

      <Section id="not" title="What we do not do">
        <ul>
          <li>We do not sell or rent personal information to anyone.</li>
          <li>We do not show advertising, and we do not share data with ad networks.</li>
          <li>We do not track you across other websites.</li>
          <li>
            We do not read the content of the sites you monitor beyond what the check
            itself needs — a status code, a response time, and a keyword match where you
            configured one.
          </li>
        </ul>
      </Section>

      <Section id="shared" title="Who else sees it">
        <p>
          We use a small number of providers to run the service. Each receives only what it
          needs to do its job.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>What it handles</th>
                <th>What it sees</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Google Firebase</td>
                <td>Sign-in, configuration storage, push notifications, analytics</td>
                <td>Account details, monitor configuration, device token</td>
              </tr>
              <tr>
                <td>Amazon Web Services</td>
                <td>The servers that run the checks and the API</td>
                <td>Everything the service stores, as its host</td>
              </tr>
              <tr>
                <td>Mailgun</td>
                <td>Sending confirmation and alert emails</td>
                <td>The recipient address and the message</td>
              </tr>
              <tr>
                <td>Stripe</td>
                <td>Donations</td>
                <td>Payment details, which we never receive</td>
              </tr>
              <tr>
                <td>Slack, Discord, your own webhooks</td>
                <td>Delivering alerts you configured</td>
                <td>The alert content, sent only to destinations you entered</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          We will also disclose information if the law requires it, and we will tell you
          when we are permitted to.
        </p>
      </Section>

      <Section id="public" title="Public status pages">
        <p>
          A monitor appears on your public status page <strong>only if you tick that
          option</strong> on the monitor itself. Absence means private — a monitor created
          before that setting existed does not become public by default.
        </p>
        <p>
          A published status page shows the monitor&apos;s name and its health. It never
          shows the address being checked, the keyword being matched, your alert contacts,
          or the text of an error.
        </p>
      </Section>

      <Section id="retention" title="How long we keep it">
        <ul>
          <li>
            <strong>Account and monitor configuration</strong> — for as long as your
            account exists.
          </li>
          <li>
            <strong>Individual check results</strong> — about 35 days, after which they are
            compacted into daily summaries.
          </li>
          <li>
            <strong>Daily uptime summaries</strong> — retained to draw the longer history
            windows on your charts and status page.
          </li>
          <li>
            <strong>Incidents</strong> — about a year.
          </li>
          <li>
            <strong>Push notification tokens</strong> — until you sign out or turn
            notifications off.
          </li>
        </ul>
      </Section>

      <Section id="rights" title="Your choices">
        <ul>
          <li>
            <strong>See and correct it.</strong> Your account details, monitors and alert
            contacts are all visible and editable in the app.
          </li>
          <li>
            <strong>Delete it.</strong> Deleting your account removes your workspace, its
            monitors, their history and your alert contacts. Email us at the address below
            and we will action it.
          </li>
          <li>
            <strong>Turn off push notifications</strong> in your device settings, or from
            the app, which removes the device token.
          </li>
          <li>
            <strong>Export it.</strong> Ask and we will send you what we hold in a machine-
            readable form.
          </li>
        </ul>
        <p>
          If you are in the UK, EU or another region with equivalent law, you also have the
          right to object to processing, to restrict it, and to complain to your data
          protection authority.
        </p>
      </Section>

      <Section id="security" title="Security">
        <p>
          Traffic to the site and API is encrypted in transit. Authentication is handled by
          Firebase, so we never hold your password. Alert contacts must be confirmed before
          they can receive anything, so a channel cannot be pointed at someone who did not
          agree to it.
        </p>
        <p>
          No service can promise perfect security, and we are not going to. If we discover
          a breach affecting your data, we will tell you.
        </p>
      </Section>

      <Section id="children" title="Children">
        <p>
          UptimeMonke is a tool for people running websites and services, and is not
          directed at children. We do not knowingly collect information from anyone under
          16. If you believe a child has given us information, email us and we will delete
          it.
        </p>
      </Section>

      <Section id="changes" title="Changes to this policy">
        <p>
          When our data practices change, this page changes with them and the date at the
          top is updated. If a change materially affects how we handle your information, we
          will tell you by email before it takes effect.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          Questions about this policy, or a request about your data:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </Section>

      <footer className="legal-footer">
        <Link href="/" className="legal-back">
          ← Back to UptimeMonke
        </Link>
      </footer>
    </main>
  );
}
