import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

// ---------------------------------------------------------------------------
// Landing — quiet, premium, product-feeling. Compact nav, composed hero with
// a private-chat preview visual, structured "How it works" and "Quiet by
// design" feature sections, compact footer.
// ---------------------------------------------------------------------------

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

export default function Landing() {
  return (
    <div className="landing">
      {/* ---------------- compact nav ---------------- */}
      <header className="landing__nav">
        <Link to="/" className="landing__brand" aria-label="hushh home">
          <Logo size="sm" />
        </Link>
        <nav className="landing__nav-links">
          <Link to="/login" className="btn btn--ghost">
            Sign in
          </Link>
          <Link to="/register" className="btn btn--accent">
            Create your hushh
          </Link>
        </nav>
      </header>

      <main className="landing__main">
        {/* ---------------- hero ---------------- */}
        <section className="hero">
          <div className="hero__text">
            <p className="hero__kicker">Private real-time messaging</p>
            <h1 className="hero__title">
              Say hello <span className="hero__accent">quietly</span>.
            </h1>
            <p className="hero__sub">
              hushh is a private messenger built around a Chat ID — never your
              email address. Find people, say hello, and leave the noise
              behind.
            </p>
            <div className="hero__actions">
              <Link to="/register" className="btn btn--accent btn--lg">
                Create your hushh
              </Link>
              <Link to="/login" className="btn btn--ghost btn--lg">
                I already have one
              </Link>
            </div>
            <p className="hero__note">
              <span className="dot" /> Your email address stays hidden. Always.
            </p>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <span className="stamp">just between us</span>
            <div className="chat-preview">
              <div className="chat-preview__head">
                <span className="avatar avatar--sm">S</span>
                <div className="chat-preview__who">
                  <span className="chat-preview__name">soumyadeep</span>
                  <span className="chat-preview__status">
                    <i /> online
                  </span>
                </div>
                <span className="chat-preview__tag">private</span>
              </div>
              <div className="chat-preview__msgs">
                <div className="bubble bubble--in">
                  <span className="bubble__text">Hello! 👋</span>
                  <time>9:41</time>
                </div>
                <div className="bubble bubble--out">
                  <span className="bubble__text">Hey! Long time no see</span>
                  <time>9:42</time>
                </div>
                <div className="bubble bubble--in">
                  <span className="bubble__text">Coffee this week?</span>
                  <time>9:43</time>
                </div>
              </div>
              <div className="chat-preview__composer">
                <span>Say hello…</span>
                <span className="chat-preview__send">Send</span>
              </div>
            </div>
            <span className="hero-deco hero-deco--dot" />
            <span className="hero-deco hero-deco--ring" />
          </div>
        </section>

        {/* ---------------- how it works ---------------- */}
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

        {/* ---------------- quiet by design ---------------- */}
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

        {/* ---------------- privacy ---------------- */}
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
      </main>

      {/* ---------------- footer ---------------- */}
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
            <div className="site-footer__social-icons">
              <a
                className="social-btn"
                href="#"
                aria-label="hushh on X"
                title="hushh on X"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                className="social-btn"
                href="#"
                aria-label="hushh on Instagram"
                title="hushh on Instagram"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                className="social-btn"
                href="#"
                aria-label="hushh on GitHub"
                title="hushh on GitHub"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.72-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.6.69.49A10.25 10.25 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="site-footer__bottom">
          <span>© {new Date().getFullYear()} hushh — a private place to talk.</span>
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
