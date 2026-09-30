import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

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

  it('puts the "Meet Soumyadeep" button inside the larger social card', () => {
    expect(landing).toContain('site-footer__meet-btn')
    expect(landing).toContain('Meet Soumyadeep')
    expect(landing).toContain('href="https://www.soumyadeep.space/"')
    expect(landing).toContain('Soumyadeep Das')

    const social = landing.slice(
      landing.indexOf('className="site-footer__social"'),
      landing.indexOf('className="site-footer__bottom"'),
    )
    expect(social).toContain('site-footer__social-actions')
    expect(social).toContain('site-footer__meet-btn')
    expect(social).toContain('btn btn--ghost site-footer__meet-btn')
    expect(social).not.toContain('btn--accent-pill site-footer__meet-btn')
    expect(css).toMatch(
      /\.site-footer__meet-btn:hover\s*\{[\s\S]*?background: var\(--yellow\)[\s\S]*?border-color: var\(--yellow\)/,
    )
  })

  it('improves the copyright line and keeps the base band uncluttered', () => {
    expect(landing.match(/<footer/g)).toHaveLength(1)
    expect(landing.match(/&copy;/g)).toHaveLength(1)
    expect(landing).toContain('Say hello quietly')
    expect(landing).toContain('site-footer__copy-sep')

    const base = landing.slice(
      landing.indexOf('className="site-footer__bottom"'),
      landing.indexOf('</footer>'),
    )
    expect(base).toContain('site-footer__copy')
    expect(base).toContain('site-footer__bottom-links')
    expect(base).not.toContain('site-footer__meet-btn')
  })

  it('the base band lays copyright and links out responsively', () => {
    const rule = css.slice(css.indexOf('.site-footer__bottom {'))
    expect(rule.slice(0, 400)).toContain('justify-content: space-between')
    expect(rule.slice(0, 400)).toContain('flex-wrap: wrap')
    expect(css).toContain('.site-footer__copy')
    expect(css).toContain('.site-footer__copy-sep')
  })

  it('has structured, slightly lowered brand and link columns (Product / About)', () => {
    expect(landing).toContain('>Product</h4>')
    expect(landing).toContain('>About</h4>')
    expect(landing).toMatch(/site-footer__col/g)
    expect(css).toMatch(
      /\.site-footer__brand,\n\.site-footer__col\s*\{[\s\S]*?padding-top: 0\.65rem/,
    )
  })

  it('About links point to sections that exist (working anchors)', () => {

    expect(landing).toContain('className="how" id="how-it-works"')
    expect(landing).toContain('className="features" id="quiet-by-design"')
    expect(landing).toContain('id="privacy"')

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
    expect(css).toMatch(/\.site-footer__main\s*\{[^}]*grid-template-columns:\s*1\.5fr 0\.8fr 0\.8fr 1\.8fr/m)
    expect(css).toContain('grid-template-columns: 1fr 1fr;')
    expect(css).toContain('grid-template-columns: 1fr;')
  })

  it('no horizontal overflow from footer content', () => {
    expect(css).toContain('overflow-x: clip')
  })
})
