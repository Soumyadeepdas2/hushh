import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Landing nav + hero redesign (playful / hand-drawn) — static pins.
//
// The redesign is deliberately landing-scoped: it must never leak into the
// auth pages or chat (the previous landing/chat mismatch is exactly what these
// pins prevent from happening again).
// ---------------------------------------------------------------------------

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

describe('landing hero uses the artwork background', () => {
  it('the nav + hero band carries the background artwork', () => {
    expect(css).toMatch(/\.landing__top\s*\{[\s\S]*?url\('\/background\.png'\)/)
  })

  it('the artwork dissolves into the page wash (masked, no hard edge)', () => {
    // the artwork lives on a pseudo-element that masks itself out
    expect(css).toMatch(/\.landing__top::before\s*\{[\s\S]*?url\('\/background\.png'\)/)
    expect(css).toMatch(/\.landing__top::before\s*\{[\s\S]*?mask-image: linear-gradient/)
    // and there is no hard white fade band left over
    expect(css).not.toContain('.landing__top::after')
  })

  it('the artwork asset exists and the auth pages keep their own artwork', () => {
    expect(has('public/background.png')).toBe(true)
    // auth/chat still use background.jpg — the landing art must not replace it
    expect(css).toContain("url('/background.jpg')")
  })

  it('removes the old CSS blob + doodle decorations from the hero', () => {
    expect(css).not.toContain('.blob--tl')
    expect(css).not.toContain('.hero-deco')
    expect(css).not.toContain('.stamp')
    expect(css).not.toContain('.hero__sun')
    expect(landing).not.toContain('hero-deco')
    expect(landing).not.toContain('stamp')
  })
})

describe('the whole page carries a background (no stark white sections)', () => {
  it('.landing paints a genuinely warm wash, not near-white', () => {
    const rule = css.slice(css.indexOf('.landing {'), css.indexOf('.landing__top {'))
    expect(rule).toContain('background-color: #fbf0dc')
    expect(rule).toMatch(/linear-gradient\(180deg, #ffffff 0, #fff8ea 340px/)
    expect(rule).not.toMatch(/background:\s*#fff;/)
    // the bottom of the page must be clearly cream, not a 2% tint of white
    expect(rule).toMatch(/#fbe9cf 100%/)
  })

  it('echoes the artwork orange as glows down the page', () => {
    const rule = css.slice(css.indexOf('.landing {'), css.indexOf('.landing__top {'))
    const glows = rule.match(/rgba\(253, 174, 86/g) || []
    expect(glows.length).toBeGreaterThanOrEqual(4)
  })

  it('carries visible decorative shapes through the sections', () => {
    expect(landing).toContain('landing__deco')
    expect(landing.match(/<span \/>/g).length).toBeGreaterThanOrEqual(4)
    expect(css).toMatch(/\.landing__deco \{[\s\S]*?position: absolute/)
    // shapes are orange, faint, and non-interactive
    const deco = css.slice(css.indexOf('.landing__deco {'))
    expect(deco.slice(0, 1200)).toContain('background: #fdae56')
    expect(deco.slice(0, 1200)).toContain('pointer-events: none')
    // and the real content is lifted above them
    expect(css).toMatch(/\.how,\n\.features,\n\.privacy \{[\s\S]*?z-index: 1/)
  })

  it('section + footer surfaces are warm, not near-white', () => {
    expect(css).toContain('--surface-warm: #fffdf7;')
    expect(css).toContain('--paper-warm: #fffaf0;')
    expect(css).toContain('--line-warm:')

    // all five landing separators use the warm hairline
    // (.how, .features, .privacy, .site-footer, .site-footer__bottom)
    const warm = css.match(/var\(--line-warm\)/g) || []
    expect(warm.length).toBeGreaterThanOrEqual(5)

    expect(css).toMatch(/\.how \{[\s\S]*?border-top: 1px solid var\(--line-warm\)/)
    expect(css).toMatch(/\.features \{[\s\S]*?border-top: 1px solid var\(--line-warm\)/)
    expect(css).toMatch(/\.privacy \{[\s\S]*?border-top: 1px solid var\(--line-warm\)/)
    expect(css).toMatch(/\.site-footer \{[\s\S]*?background: var\(--paper-warm\)/)
  })

  it('app chrome keeps the cool hairlines (redesign stays landing-scoped)', () => {
    // the real chat composer must NOT be warmed
    expect(css).toMatch(/\.composer \{[\s\S]*?border-top: 1px solid var\(--line\)/)
    expect(css).toMatch(/\.settings__logout \{[\s\S]*?border-top: 1px solid var\(--line\)/)
  })
})

describe('headline: hand-drawn display face with a swoosh', () => {
  it('the hero title uses the display font at a strong weight', () => {
    expect(css).toMatch(
      /\.hero__title\s*\{[\s\S]*?font-family: var\(--font-display\)[\s\S]*?font-size: clamp\(3rem, 5\.6vw, 4\.6rem\)/,
    )
  })

  it('the headline stays dominant on phones (no tiny override)', () => {
    // the old laptop-era 2.3rem phone override must be gone
    expect(css).not.toContain('font-size: 2.3rem')
    expect(css).toMatch(/\.hero__title\s*\{\s*font-size: clamp\(3rem, 13vw, 3\.6rem\)/)
  })

  it('the accent word is set in yellow with a hand-drawn underline', () => {
    expect(landing).toContain('hero__line--accent')
    expect(landing).toContain('hero__swoosh')
    expect(css).toMatch(/\.hero__line--accent\s*\{[\s\S]*?color: var\(--yellow\)/)
    expect(css).toContain('.hero__swoosh')
  })
})

describe('hero chat card mirrors the REAL chat screen', () => {
  it('has no read receipts (hushh has none)', () => {
    expect(landing).not.toMatch(/double.?tick/i)
    // no second tick glyph in the preview
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
    expect(css).toMatch(/\.pv-bubble--in\s*\{[\s\S]*?border-bottom-left-radius: 5px/)
    expect(css).toMatch(/\.pv-bubble--out\s*\{[\s\S]*?border-bottom-right-radius: 5px/)
  })

  it('the own-message timestamp uses --yellow-soft like the real chat', () => {
    expect(css).toMatch(/\.pv-bubble--out time\s*\{[\s\S]*?var\(--yellow-soft\)/)
  })
})

describe('the redesign is landing-scoped', () => {
  it('pill CTAs are landing-only classes, not global .btn overrides', () => {
    expect(css).toContain('.btn--accent-pill')
    expect(css).toContain('.btn--ghost-pill')
    // the shared .btn--accent rule is untouched (auth + chat still use it)
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
  it('nav pills never wrap onto two lines', () => {
    expect(css).toMatch(/\.landing__pill\s*\{[\s\S]*?white-space: nowrap/)
  })

  it('the nav "Sign in" pill is hidden on phones (hero offers the same link)', () => {
    expect(css).toMatch(
      /\.landing__nav-links \.landing__pill:first-child\s*\{\s*display: none;/,
    )
    expect(landing).toMatch(/to="\/login"[\s\S]{0,80}I already have one/)
  })

  it('the sticky nav is still pinned and anchors still clear it', () => {
    expect(css).toMatch(/\.landing__nav\s*\{[\s\S]*?position: sticky;[\s\S]*?top: 0;/)
    expect(css).toContain('scroll-margin-top: 120px')
  })
})
