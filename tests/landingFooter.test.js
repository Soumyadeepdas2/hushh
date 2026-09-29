import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Landing header (sticky) + footer redesign tests (static pins).
// ---------------------------------------------------------------------------

const root = process.cwd()
const read = (p) => readFileSync(resolve(root, p), 'utf8')
const landing = read('src/pages/Landing.jsx')
const css = read('src/styles/global.css')

describe('landing header is fixed/sticky', () => {
  it('defines the nav as sticky at the top of the viewport', () => {
    const navRule = css.split('.landing__nav')[1].slice(0, 400)
    expect(navRule).toContain('position: sticky')
    expect(navRule).toContain('top: 0')
    expect(navRule).toContain('z-index')
  })
})

describe('footer redesign with social card', () => {
  it('uses the new site-footer structure', () => {
    expect(landing).toContain('<footer className="site-footer">')
    expect(landing).toContain('site-footer__main')
    expect(landing).toContain('site-footer__bottom')
  })

  it('contains a social card with the real platform links', () => {
    expect(landing).toContain('site-footer__social')
    expect(landing).toMatch(/aria-label="hushh on LinkedIn"/)
    expect(landing).toMatch(/aria-label="hushh on Instagram"/)
    expect(landing).toContain('social-btn')
  })

  it('social links point at the real hushh accounts', () => {
    expect(landing).toContain('href="https://www.linkedin.com/company/hushhconnect/"')
    expect(landing).toContain('href="https://www.instagram.com/hushhconnect/"')
  })

  it('every external link opens safely (noopener noreferrer)', () => {
    const external = [...landing.matchAll(/href="https?:\/\/[^"]+"/g)]
    expect(external.length).toBeGreaterThan(0)
    // each external anchor must carry rel="noopener noreferrer"
    const anchors = landing.split('<a')
    for (const a of anchors) {
      if (!/href="https?:\/\//.test(a)) continue
      expect(a.slice(0, a.indexOf('>'))).toContain('rel="noopener noreferrer"')
      expect(a.slice(0, a.indexOf('>'))).toContain('target="_blank"')
    }
  })

  it('has no dead "#" placeholder links left in the footer', () => {
    expect(landing).not.toContain('href="#"')
  })

  it('offers a "Meet Soumyadeep" button linking to the developer site', () => {
    expect(landing).toContain('site-footer__meet-btn')
    expect(landing).toContain('Meet Soumyadeep')
    expect(landing).toContain('href="https://www.soumyadeep.space/"')
    // developer context survives as the button tooltip
    expect(landing).toContain('Soumyadeep Das')
  })

  it('the footer is a SINGLE band — copyright + meet button + links on one line', () => {
    // exactly one <footer> and exactly one copyright in the whole page
    expect(landing.match(/<footer/g)).toHaveLength(1)
    expect(landing.match(/&copy;/g)).toHaveLength(1)
    // there is no separate "meet" band anymore
    expect(landing).not.toContain('site-footer__meet"')
    // all three groups live inside the same base band
    const base = landing.slice(
      landing.indexOf('className="site-footer__bottom"'),
      landing.indexOf('</footer>'),
    )
    expect(base).toContain('site-footer__copy')
    expect(base).toContain('site-footer__meet-btn')
    expect(base).toContain('site-footer__bottom-links')
  })

  it('the base band lays the three groups out in one flex row', () => {
    const rule = css.slice(css.indexOf('.site-footer__bottom {'))
    expect(rule.slice(0, 400)).toContain('justify-content: space-between')
    expect(rule.slice(0, 400)).toContain('flex-wrap: wrap')
    expect(css).toContain('.site-footer__copy')
    expect(css).toContain('.site-footer__meet-btn')
  })

  it('has structured link columns (Product / About)', () => {
    expect(landing).toContain('>Product</h4>')
    expect(landing).toContain('>About</h4>')
    expect(landing).toMatch(/site-footer__col/g)
  })

  it('About links point to sections that exist (working anchors)', () => {
    // the sections carry the anchor ids
    expect(landing).toContain('className="how" id="how-it-works"')
    expect(landing).toContain('className="features" id="quiet-by-design"')
    expect(landing).toContain('id="privacy"')
    // the About links target exactly those ids
    expect(landing).toContain('href="#how-it-works"')
    expect(landing).toContain('href="#quiet-by-design"')
    expect(landing).toContain('href="#privacy"')
  })

  it('has no dead anchor links — every footer #anchor has a matching section id', () => {
    expect(landing).not.toContain('href="#terms"')
    const anchors = [...landing.matchAll(/href="#([a-z-]+)"/g)].map((m) => m[1])
    expect(anchors.length).toBeGreaterThan(0)
    for (const anchor of anchors) {
      expect(landing, `#${anchor} has no target element`).toContain(`id="${anchor}"`)
    }
  })

  it('anchored sections scroll below the sticky header (scroll-margin)', () => {
    expect(css).toContain('scroll-margin-top: 120px')
    expect(css).toContain('scroll-behavior: smooth')
  })

  it('footer layouts are responsive (collapse to 2 then 1 column)', () => {
    expect(css).toMatch(/\.site-footer__main\s*\{[^}]*grid-template-columns:\s*1\.6fr 1fr 1fr 1\.4fr/m)
    expect(css).toContain('grid-template-columns: 1fr 1fr;') // @max-860
    expect(css).toContain('grid-template-columns: 1fr;') // @max-700
  })

  it('no horizontal overflow from footer content', () => {
    expect(css).toContain('overflow-x: clip') // global safety
  })
})
