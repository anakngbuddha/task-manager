import { Link } from 'react-router-dom'
import { Shield, ArrowLeft } from 'lucide-react'


export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 md:px-6 lg:py-16 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Privacy Policy</h1>
        </div>

        <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-primary hover:prose-a:text-primary/80 prose-p:leading-relaxed">
          <p className="text-lg text-slate-600 mb-8">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section className="mb-10 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-2xl mt-0 mb-4 text-slate-800">1. Information We Collect</h2>
            <p className="mb-4">
              We collect information to provide better services to our users. The data we collect includes:
            </p>
            <ul className="space-y-2 mb-0">
              <li><strong>Account Information:</strong> Name, email address, and authentication credentials when you register.</li>
              <li><strong>Usage Data:</strong> Pages visited, features used, and interactions within the platform.</li>
              <li><strong>Technical Data:</strong> IP address, device type, operating system, browser type, and timezone.</li>
              <li><strong>User Content:</strong> Projects, tasks, comments, and other materials you create or upload.</li>
            </ul>
          </section>

          <section className="mb-10 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-2xl mt-0 mb-4 text-slate-800">2. How We Use Your Information</h2>
            <p className="mb-4">
              We use the information we collect for the following purposes:
            </p>
            <ul className="space-y-2 mb-0">
              <li>To provide, maintain, and improve our services.</li>
              <li>To securely authenticate you and keep your session active.</li>
              <li>To monitor application performance, usage trends, and system health.</li>
              <li>To remember your preferences, such as sidebar layout and UI themes.</li>
              <li>To communicate with you regarding updates, security alerts, and support messages.</li>
            </ul>
          </section>

          <section className="mb-10 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-2xl mt-0 mb-4 text-slate-800">3. Cookies and Local Storage</h2>
            <p className="mb-4">
              We use cookies, local storage, and similar technologies to enhance your experience. These are categorized into:
            </p>
            <ul className="space-y-2 mb-0">
              <li><strong>Essential (Tier 1):</strong> Strictly necessary for the application to function securely, such as keeping you logged in. These cannot be disabled.</li>
              <li><strong>Analytics (Tier 2):</strong> Helps us understand how you use the app (e.g., page views, session duration) so we can improve it. Requires your consent.</li>
              <li><strong>Preferences (Tier 3):</strong> Remembers your customized UI settings (e.g., sidebar layout, terminal window size). Requires your consent.</li>
            </ul>
          </section>

          <section className="mb-10 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-2xl mt-0 mb-4 text-slate-800">4. Data Retention</h2>
            <p className="mb-0">
              We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy.
              Account information is kept as long as your account is active. Usage analytics data is typically retained for up to 12 months.
              If you delete your account, your data will be permanently removed from our active databases within 30 days.
            </p>
          </section>

          <section className="mb-10 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-2xl mt-0 mb-4 text-slate-800">5. Your Privacy Rights & Data Deletion</h2>
            <p className="mb-4">
              In accordance with the Philippines Data Privacy Act (RA 10173) and the GDPR, you have the right to:
            </p>
            <ul className="space-y-2 mb-4">
              <li>Access the personal information we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Withdraw consent for non-essential cookies and analytics at any time.</li>
              <li><strong>Request Deletion (Right to be Forgotten):</strong> You can request the permanent deletion of your account and associated personal data.</li>
            </ul>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-6">
              <p className="text-sm font-medium text-slate-700 mb-2">How to Request Data Deletion:</p>
              <p className="text-sm text-slate-600">
                To request the deletion of your data, please contact our support team at <a href="mailto:privacy@weworkit.com" className="font-semibold text-primary">privacy@weworkit.com</a> from the email address associated with your account. We will process your request within 30 days.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="container mx-auto px-4 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} We Work IT. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
