import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (p) => readFileSync(resolve(root, p), 'utf8')
const has = (p) => existsSync(resolve(root, p))

const landing = read('src/pages/Landing.jsx')
const css = read('src/styles/global.css')
const html = read('index.html')

describe('landing fonts are self-hosted (no third-party font requests)', () => {
  it('defines @font-face for the headline + landing body faces', () => {
    expect(css).toContain("font-family: 'Shantell Sans';")
    expect(css).toContain("font-family: 'Nunito';")
    expect(css).toContain("url('/fonts/shantell-sans.woff2')")
    expect(css).toContain("url('/fonts/nunito.woff2')")
  })

  it('does not pull fonts from Google/any origin', () => {
    expect(css).not.toContain('fonts.googleapis.com')
    expect(css).not.toContain('fonts.gstatic.com')
    expect(html).not.toContain('fonts.googleapis.com')
    expect(html).not.toContain('fonts.gstatic.com')
  })

  it('the font files exist and are preloaded', () => {
    expect(has('public/fonts/shantell-sans.woff2')).toBe(true)
    expect(has('public/fonts/nunito.woff2')).toBe(true)
    expect(html).toContain('rel="preload"')
    expect(html).toContain('/fonts/shantell-sans.woff2')
  })

  it('ships a refresh script so the fonts can be re-fetched', () => {
    expect(has('scripts/fetch-landing-fonts.py')).toBe(true)
  })
})

describe('the landing page alternates the supplied artwork direction', () => {
  it('keeps one continuous normal pattern through the hero and How it works', () => {
    const page = css.slice(
      css.indexOf('.landing {'),
      css.indexOf('.landing__top {'),
    )
    expect(page).toContain(
      "background-image: url('/landing-background-cut.png')",
    )
    expect(page).toContain('background-size: 100% auto')
    expect(page).toContain('background-position: center top')
    expect(page).toContain('background-repeat: repeat-y')
    expect(page).toContain('background-attachment: scroll')
  })

  it('mirrors only Quiet by design + Privacy without the crossed right shape', () => {
    expect(landing).toContain('<div className="landing__reversed">')
    expect(has('public/landing-background-lower.png')).toBe(true)
    const reversed = css.slice(
      css.indexOf('.landing__reversed {'),
      css.indexOf('.landing__deco {'),
    )
    expect(reversed).toContain('.landing__reversed::before')
    expect(reversed).toContain(
      "background-image: url('/landing-background-lower.png')",
    )
    expect(reversed).toContain('background-repeat: repeat-y')
    expect(reversed).toContain('transform: scaleX(-1)')
    expect(reversed).not.toContain('mask-image:')
    expect(reversed).toContain('pointer-events: none')
  })

  it('does not paint an extra faded copy over the hero', () => {
    expect(css).not.toContain('.landing__top::before')
    expect(css).not.toContain('.landing__top::after')
  })

  it('ships the supplied asset while auth pages keep their own artwork', () => {
    expect(has('public/landing-background-cut.png')).toBe(true)
    expect(css).toContain("url('/background.jpg')")
  })

  it('disables duplicate orange decorations and keeps footer content readable', () => {
    expect(css).toMatch(/\.landing__deco\s*\{\s*display: none;/)
    expect(css).toMatch(
      /\.site-footer\s*\{[\s\S]*?background: rgba\(255, 250, 240, 0\.88\)/,
    )
  })

  it('app chrome keeps the cool hairlines (redesign stays landing-scoped)', () => {
    expect(css).toMatch(
      /\.composer \{[\s\S]*?border-top: 1px solid var\(--line\)/,
    )
    expect(css).toMatch(
      /\.settings__logout \{[\s\S]*?border-top: 1px solid var\(--line\)/,
    )
  })
})

describe('headline: hand-drawn display face with a swoosh', () => {
  it('the hero title uses the display font at a strong weight', () => {
    expect(css).toMatch(
      /\.hero__title\s*\{[\s\S]*?font-family: var\(--font-display\)[\s\S]*?font-size: clamp\(3rem, 5\.6vw, 4\.6rem\)/,
    )
  })

  it('the headline stays dominant on phones (no tiny override)', () => {
    expect(css).not.toContain('font-size: 2.3rem')
    expect(css).toMatch(
      /\.hero__title\s*\{\s*font-size: clamp\(3rem, 13vw, 3\.6rem\)/,
    )
  })

  it('highlights quietly with a rounded gold block and orange rays', () => {
    expect(landing).toContain('hero__line--accent')
    expect(landing).toContain('hero__rays')
    expect(landing.match(/<i \/>/g).length).toBeGreaterThanOrEqual(3)
    expect(landing).not.toContain('hero__swoosh')
    expect(css).toMatch(
      /\.hero__line--accent\s*\{[\s\S]*?color: var\(--ink\)[\s\S]*?background: #e0ad4f[\s\S]*?border-radius: 0\.36em/,
    )
    expect(css).toMatch(
      /\.hero__rays i\s*\{[\s\S]*?background: var\(--orange\)/,
    )
    expect(css).toMatch(
      /\.hero__title\s*\{[\s\S]*?margin-left: clamp\(0\.75rem, 2vw, 2rem\)/,
    )
  })
})

describe('hero chat card mirrors the REAL chat screen', () => {
  it('has no read receipts (hushh has none)', () => {
    expect(landing).not.toMatch(/double.?tick/i)

    expect(landing).not.toContain('✓✓')
    expect(landing).not.toContain('✔✔')
  })

  it('uses a labelled Send button, not an icon button', () => {
    expect(landing).toContain('chat-preview__send')
    expect(landing).toMatch(/className="chat-preview__send">Send</)
    expect(css).toMatch(
      /\.chat-preview__send\s*\{[\s\S]*?background: var\(--ink\)[\s\S]*?border-radius: var\(--radius\)/,
    )
  })

  it('bubble geometry matches .msg / .msg--own / .msg--other', () => {
    expect(css).toMatch(/\.pv-bubble\s*\{[\s\S]*?border-radius: 15px/)
    expect(css).toMatch(
      /\.pv-bubble--in\s*\{[\s\S]*?border-bottom-left-radius: 5px/,
    )
    expect(css).toMatch(
      /\.pv-bubble--out\s*\{[\s\S]*?border-bottom-right-radius: 5px/,
    )
  })

  it('the own-message timestamp uses --yellow-soft like the real chat', () => {
    expect(css).toMatch(
      /\.pv-bubble--out time\s*\{[\s\S]*?var\(--yellow-soft\)/,
    )
  })
})

describe('the redesign is landing-scoped', () => {
  it('pill CTAs are landing-only classes, not global .btn overrides', () => {
    expect(css).toContain('.btn--accent-pill')
    expect(css).toContain('.btn--ghost-pill')

    expect(css).toMatch(/\.btn--accent\s*\{\s*background: var\(--yellow\)/)
  })

  it('landing tokens live on .landing, not :root', () => {
    const landingRule = css.split('.landing {')[1].slice(0, 400)
    expect(landingRule).toContain('--font-display')
    expect(landingRule).toContain('--pill-bg')
  })

  it('the app palette is unchanged (chat + auth keep their colours)', () => {
    expect(css).toContain('--yellow: #f6b500;')
    expect(css).toContain('--cream: #f5eddb;')
    expect(css).toContain('--ink: #16232e;')
  })

  it('the auth pages still own their top bar and artwork', () => {
    for (const page of ['Login.jsx', 'Register.jsx', 'ForgotPassword.jsx']) {
      const src = read(`src/pages/${page}`)
      expect(src, page).toContain('<header className="topbar auth-topbar">')
    }
    expect(css).toMatch(/\.auth-wrap\s*\{[\s\S]*?url\('\/background\.jpg'\)/)
  })
})

describe('nav remains usable on phones', () => {
  it('uses one hero artwork and a clean solid background below it', () => {
    const mobile = css.slice(css.indexOf('@media (max-width: 700px)'))
    expect(mobile).toMatch(/\.landing\s*\{[\s\S]*?background-image: none/)
    expect(mobile).toMatch(
      /\.landing__top\s*\{[\s\S]*?landing-background-cut\.png[\s\S]*?background-repeat: no-repeat/,
    )
    expect(mobile).toMatch(/\.landing__main\s*\{[\s\S]*?background: #fffaf0/)
    expect(mobile).toMatch(/\.landing__reversed::before\s*\{\s*display: none/)
  })

  it('nav pills never wrap onto two lines', () => {
    expect(css).toMatch(/\.landing__pill\s*\{[\s\S]*?white-space: nowrap/)
  })

  it('the nav "Sign in" pill is hidden on phones (hero offers the same link)', () => {
    expect(css).toMatch(
      /\.landing__nav-links \.landing__pill:first-child\s*\{\s*display: none;/,
    )
    expect(landing).toMatch(/to="\/login"[\s\S]{0,80}I already have one/)
  })

  it('keeps the nav sticky through page content and releases it before the footer', () => {
    expect(css).toMatch(
      /\.landing__nav\s*\{[\s\S]*?position: sticky;[\s\S]*?top: 0;/,
    )
    expect(css).toContain('scroll-margin-top: 120px')
    expect(css).toMatch(/\.landing__content\s*\{[\s\S]*?position: relative/)
    expect(landing).toMatch(
      /<div className="landing__content">\s*<header className="landing__nav">/,
    )
    expect(landing).toMatch(
      /<\/main>\s*<\/div>\s*<footer className="site-footer">/,
    )
  })
})
