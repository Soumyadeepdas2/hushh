import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="1.4" fill="currentColor" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="16" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M11 13l8.5-8.5M16.5 6.5l3 3M14 9l2 2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"
        fill="currentColor"
      />
    </svg>
  )
}

function PillLockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10.5" width="15" height="10" rx="3" fill="currentColor" />
      <path
        d="M8 10.5V7.5a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12h15M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" fill="var(--ok)" />
      <path
        d="M8.6 12.1l2.3 2.3 4.4-4.6"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Landing() {
  return (
    <div className="landing">

      <header className="landing__nav">
        <Link to="/" className="landing__brand" aria-label="hushh home">
          <Logo size="sm" />
        </Link>
        <nav className="landing__nav-links">
          <Link to="/login" className="landing__pill">
            Sign in
          </Link>
          <Link to="/register" className="landing__pill landing__pill--yellow">
            Create your hushh
          </Link>
        </nav>
      </header>

      <div className="landing__top">
        <section className="hero">
          <div className="hero__text">
            <p className="hero__kicker">
              <PillLockIcon />
              Private real-time messaging
            </p>

            <h1 className="hero__title">
              <span className="hero__line">Say hello</span>
              <span className="hero__line hero__line--accent">
                quietly<span className="hero__dot">.</span>
                <span className="hero__rays" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </span>
            </h1>

            <p className="hero__sub">
              hushh is a private messenger built around a Chat ID — never your
              email address. Find people, say hello, and leave the noise
              behind.
            </p>

            <div className="hero__actions">
              <Link to="/register" className="btn btn--accent-pill btn--lg">
                <PlusIcon />
                Create your hushh
              </Link>
              <Link to="/login" className="btn btn--ghost-pill btn--lg">
                I already have one
                <ArrowIcon />
              </Link>
            </div>

            <p className="hero__note">
              <ShieldIcon />
              Your email address stays hidden. Always.
            </p>
          </div>

          <div className="hero__visual" aria-hidden="true">
            <div className="chat-preview">
              <div className="chat-preview__head">
                <span className="chat-preview__avatar">S</span>
                <div className="chat-preview__who">
                  <span className="chat-preview__name">soumyadeep</span>
                  <span className="chat-preview__status">
                    <i /> online
                  </span>
                </div>
                <span className="chat-preview__tag">
                  <PillLockIcon />
                  private
                </span>
              </div>

              <div className="chat-preview__msgs">
                <div className="pv-bubble pv-bubble--in">
                  <span>Hey! 👋</span>
                  <time>9:41</time>
                </div>
                <div className="pv-bubble pv-bubble--out">
                  <span>Hey! Long time no see</span>
                  <time>9:42</time>
                </div>
                <div className="pv-bubble pv-bubble--in">
                  <span>Coffee this week?</span>
                  <time>9:43</time>
                </div>
              </div>

              <div className="chat-preview__composer">
                <span className="chat-preview__input">Say hello…</span>
                <span className="chat-preview__send">Send</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <main className="landing__main">

        <div className="landing__deco" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <section className="how" id="how-it-works">
          <div className="how__head">
            <h2 className="how__title">How it works</h2>
            <p className="how__kicker">Three steps, no email</p>
          </div>
          <ol className="how__list">
            <li className="how__item">
              <span className="how__num">01</span>
              <h3>Choose your Chat ID</h3>
              <p>
                Pick something like <em>@soumyadeep</em> — or let hushh
                generate one. It&apos;s public, and it&apos;s how people find
                you.
              </p>
            </li>
            <li className="how__item">
              <span className="how__num">02</span>
              <h3>Find people by Chat ID</h3>
              <p>
                Search the directory and start a private one-to-one
                conversation. No contact syncing, no email invites.
              </p>
            </li>
            <li className="how__item">
              <span className="how__num">03</span>
              <h3>Chat in real time</h3>
              <p>
                Messages arrive instantly over Supabase Realtime. Text-only in
                v1 — fast, light, and quiet.
              </p>
            </li>
          </ol>
        </section>

        <div className="landing__reversed">

          <section className="features" id="quiet-by-design">
          <div className="how__head">
            <h2 className="features__title">Quiet by design</h2>
            <p className="features__kicker">Privacy, built in</p>
          </div>
          <div className="features__grid">
            <div className="feature">
              <span className="feature__icon">
                <ChatIcon />
              </span>
              <h3>No email address</h3>
              <p>
                Your email is never shown, searched or stored publicly. A Chat
                ID is all anyone ever sees.
              </p>
            </div>
            <div className="feature">
              <span className="feature__icon">
                <LockIcon />
              </span>
              <h3>Just between us</h3>
              <p>
                Conversations are visible only to the people in them —
                enforced by the database, not by good manners.
              </p>
            </div>
            <div className="feature">
              <span className="feature__icon">
                <KeyIcon />
              </span>
              <h3>Recover quietly</h3>
              <p>
                A secret Recovery ID plus your security answer gets you back
                in. The Chat ID alone never can.
              </p>
            </div>
            <div className="feature">
              <span className="feature__icon">
                <SparkIcon />
              </span>
              <h3>Text-only, no noise</h3>
              <p>
                No photos, no videos, no algorithmic feed. Just words — and
                the people you want to hear from.
              </p>
            </div>
          </div>
        </section>

        <section className="privacy" id="privacy">
          <div className="how__head">
            <h2 className="features__title">Privacy</h2>
            <p className="features__kicker">Your data stays yours</p>
          </div>
          <div className="privacy__grid">
            <div className="privacy__item">
              <h3>We never ask for your email</h3>
              <p>
                Your email address is never shown, searched or stored
                publicly. A Chat ID is all anyone ever sees.
              </p>
            </div>
            <div className="privacy__item">
              <h3>Messages are only for participants</h3>
              <p>
                Conversations are readable only by the people in them, and
                that&apos;s enforced by the database — not by good manners.
              </p>
            </div>
            <div className="privacy__item">
              <h3>Recovery secrets are hashed</h3>
              <p>
                Security answers and Recovery IDs are never stored in
                plaintext — only secure hashes, with a unique salt per user.
              </p>
            </div>
          </div>
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="site-footer__main">
          <div className="site-footer__brand">
            <Link to="/" className="site-footer__logo" aria-label="hushh home">
              <Logo size="sm" />
            </Link>
            <p className="site-footer__tagline">
              A private place to talk. Real-time messaging with a Chat ID —
              never your email address.
            </p>
          </div>

          <div className="site-footer__col">
            <h4>Product</h4>
            <ul>
              <li>
                <Link to="/register">Create your hushh</Link>
              </li>
              <li>
                <Link to="/login">Sign in</Link>
              </li>
              <li>
                <Link to="/forgot-password">Recover password</Link>
              </li>
            </ul>
          </div>

          <div className="site-footer__col">
            <h4>About</h4>
            <ul>
              <li>
                <a href="#how-it-works">How it works</a>
              </li>
              <li>
                <a href="#quiet-by-design">Quiet by design</a>
              </li>
              <li>
                <a href="#privacy">Privacy</a>
              </li>
            </ul>
          </div>

          <div className="site-footer__social">
            <h4>Say hello elsewhere</h4>
            <p>Quiet updates, occasional thoughts.</p>
            <div className="site-footer__social-actions">
              <div className="site-footer__social-icons">
                <a
                  className="social-btn"
                  href="https://www.linkedin.com/company/hushhconnect/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="hushh on LinkedIn"
                  title="hushh on LinkedIn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
                  </svg>
                </a>
                <a
                  className="social-btn"
                  href="https://www.instagram.com/hushhconnect/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="hushh on Instagram"
                  title="hushh on Instagram"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
                  </svg>
                </a>
              </div>

              <a
                className="btn btn--ghost site-footer__meet-btn"
                href="https://www.soumyadeep.space/"
                target="_blank"
                rel="noopener noreferrer"
                title="Soumyadeep Das — Developer, Vadodara"
              >
                Meet Soumyadeep
                <ArrowIcon />
              </a>
            </div>
          </div>
        </div>

        <div className="site-footer__bottom">
          <span className="site-footer__copy">
            <span>&copy; {new Date().getFullYear()} hushh</span>
            <span className="site-footer__copy-sep" aria-hidden="true">·</span>
            <span>Say hello quietly</span>
          </span>

          <div className="site-footer__bottom-links">
            <a href="#privacy">Privacy</a>
            <span className="site-footer__sep" />
            <a href="#privacy">Terms</a>
            <span className="site-footer__sep" />
            <Link to="/register">Create your hushh</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
