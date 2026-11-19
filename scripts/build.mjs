#!/usr/bin/env node
/* StackPilot — static page builder (no dependencies)

   Generates a plain-HTML page for every tool that has a content file:
     content/tools/<slug>.json  →  tools/<slug>/index.html

   Tool basics (name, category, pricing, link, logo) come from js/data.js;
   long-form page content comes from the content file. The header, footer and
   icon sprite are copied from index.html so every page matches the homepage.

   Also writes js/pages.js (the list of tools that have pages) so the homepage
   can link to them.

   Run:  node scripts/build.mjs   (Netlify runs this on every deploy) */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const SITE_URL = (process.env.URL || '').replace(/\/$/, ''); // set by Netlify during builds

/* Data ------------------------------------------------------------------- */
const sandbox = { window: {} };
vm.runInNewContext(read('js/data.js'), sandbox);
const { CATEGORIES, TOOLS, COMPARISONS, LOGOS } = sandbox.window.StackPilot;
const toolBySlug = Object.fromEntries(TOOLS.map(t => [t.slug, t]));
const catColor = Object.fromEntries(CATEGORIES.map(c => [c.id, c.color]));

/* Shared parts from index.html ------------------------------------------- */
const home = read('index.html');
const between = (start, end) => {
  const i = home.indexOf(start);
  const j = home.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error(`index.html: could not find ${start}`);
  return home.slice(i, j + end.length);
};
// In-page anchor links (<a href="#tools">) become homepage links (/#tools) on other
// pages. Only <a> tags are changed: SVG <use href="#icon"> references must stay local.
const toHomeLinks = html => html.replace(/(<a\b[^>]*?\shref=")#/g, '$1/#');
const SPRITE = between('<svg width="0" height="0"', '</svg>\n');
const HEADER = toHomeLinks(between('<header class="site-header"', '</header>'));
const FOOTER = toHomeLinks(between('<footer class="site-footer"', '</footer>'));
const FAVICON = (home.match(/<link rel="icon"[^>]*>/) || [''])[0];

/* Helpers ---------------------------------------------------------------- */
const esc = v => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const present = v => v !== null && v !== undefined && !(typeof v === 'string' && !v.trim()) && !(Array.isArray(v) && !v.length);
const list = v => (Array.isArray(v) ? v.filter(present) : []);
const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#${name}"/></svg>`;
const priceTag = p => present(p) ? `<span class="tag tag--${esc(String(p).toLowerCase().replace(/\s+/g, '-'))}">${esc(p)}</span>` : '';
const catLabel = c => present(c) ? `<span class="cat" style="--cat-color:${esc(catColor[c] || '#A1A1AA')}">${esc(c)}</span>` : '';
const fmtDate = iso => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const section = (id, title, body) => present(body) ? `
        <section class="tp-section" id="${id}" aria-labelledby="${id}-title">
          <h2 id="${id}-title">${esc(title)}</h2>
          ${body}
        </section>` : '';

function mark(t, size = '') {
  if (LOGOS[t.slug]) {
    return `<span class="mark mark--logo ${size}" aria-hidden="true"><img src="/${esc(LOGOS[t.slug])}" alt="" width="28" height="28"></span>`;
  }
  const glyph = present(t.mark) ? t.mark : String(t.name || '?').charAt(0).toUpperCase();
  const line = t.line ? `;--mark-line:${esc(t.line)}` : '';
  return `<span class="mark ${size}" aria-hidden="true" style="--mark-bg:${esc(t.bg)};--mark-fg:${esc(t.fg)}${line}">${esc(glyph)}</span>`;
}

/* Page template ---------------------------------------------------------- */
function renderToolPage(t, c, pageSlugs) {
  const url = `/tools/${t.slug}/`;
  const verified = c.verified || t.verified;
  const comparisons = COMPARISONS.filter(x => (x.a === t.slug || x.b === t.slug) && toolBySlug[x.a] && toolBySlug[x.b]);
  const alternatives = list(c.alternatives).map(s => toolBySlug[s]).filter(Boolean);
  const plans = list(c.pricing?.plans);
  const toolHref = s => (pageSlugs.has(s) ? `/tools/${s}/` : `/#tool-${s}`);

  const toc = [
    ['overview', 'Overview', c.overview], ['features', 'Key features', c.features], ['use-cases', 'Best for', c.useCases],
    ['pros-cons', 'Strengths & limitations', list(c.strengths).length || list(c.limitations).length ? 1 : null],
    ['pricing', 'Pricing', plans], ['alternatives', 'Alternatives', alternatives], ['comparisons', 'Comparisons', comparisons],
    ['sources', 'Sources', c.sources]
  ].filter(([, , v]) => present(v));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: t.name,
    applicationCategory: t.category === 'Development' ? 'DeveloperApplication' : t.category === 'Design' ? 'DesignApplication' : 'BusinessApplication',
    operatingSystem: list(c.platforms).join(', ') || undefined,
    url: t.url,
    description: c.metaDescription,
    ...(['Free', 'Freemium', 'Open Source'].includes(t.pricing) ? { offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } : {})
  };

  const body = [
    section('overview', 'Overview', list(c.overview).map(p => `<p>${esc(p)}</p>`).join('\n          ')),
    section('features', 'Key features', list(c.features).length ? `<ul class="tp-features">${list(c.features).map(f => `
            <li><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></li>`).join('')}
          </ul>` : ''),
    section('use-cases', 'Best for', list(c.useCases).length ? `<ul class="tp-checks">${list(c.useCases).map(u => `
            <li>${icon('i-check')}<span>${esc(u)}</span></li>`).join('')}
          </ul>` : ''),
    section('pros-cons', 'Strengths & limitations', (list(c.strengths).length || list(c.limitations).length) ? `<div class="tp-proscons">
            ${list(c.strengths).length ? `<div class="tp-pc tp-pc--pro"><h3>Strengths</h3><ul>${list(c.strengths).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
            ${list(c.limitations).length ? `<div class="tp-pc tp-pc--con"><h3>Limitations</h3><ul>${list(c.limitations).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
          </div>` : ''),
    section('pricing', 'Pricing', plans.length ? `${present(c.pricing.summary) ? `<p>${esc(c.pricing.summary)}</p>` : ''}
          <div class="tp-table-wrap"><table class="tp-table">
            <thead><tr><th scope="col">Plan</th><th scope="col">Price</th><th scope="col">Details</th></tr></thead>
            <tbody>${plans.map(p => `
              <tr><th scope="row">${esc(p.name)}</th><td>${esc(p.price)}</td><td>${esc(p.note || '')}</td></tr>`).join('')}
            </tbody>
          </table></div>
          <p class="tp-fineprint">Prices in USD, before tax. Plans change often, so check the <a href="${esc(c.pricing.source || t.url)}" target="_blank" rel="noopener noreferrer">official pricing page</a> before buying.${verified ? ` Last checked ${esc(fmtDate(verified))}.` : ''}</p>` : ''),
    section('alternatives', `Alternatives to ${t.name}`, alternatives.length ? `<ul class="tp-cards">${alternatives.map(a => `
            <li><a class="mini-item" href="${toolHref(a.slug)}">${mark(a, 'mark--sm')}<span class="grow"><strong>${esc(a.name)}</strong><span class="mini-sub">${esc(a.description)}</span></span>${icon('i-chev-r')}</a></li>`).join('')}
          </ul>` : ''),
    section('comparisons', 'Comparisons', comparisons.length ? `<ul class="mini-list">${comparisons.map(x => `
            <li><a class="mini-item" href="/#compare-${esc(x.slug)}"><span class="grow"><strong>${esc(x.title)}</strong><span class="mini-sub">${esc(x.subtitle)}</span></span>${icon('i-chev-r')}</a></li>`).join('')}
          </ul>` : ''),
    section('sources', 'Sources & verification', list(c.sources).length ? `<p>StackPilot writes its own descriptions and checks product details against official sources. We are not affiliated with ${esc(t.name)}, and links go to its official website.</p>
          <ul class="tp-sources">${list(c.sources).map(s => `
            <li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a></li>`).join('')}
          </ul>` : '')
  ].join('');

  const firstCompare = comparisons[0];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.seoTitle || `${t.name}: Features, Pricing & Alternatives`)} | StackPilot</title>
<meta name="description" content="${esc(c.metaDescription)}">
${SITE_URL ? `<link rel="canonical" href="${SITE_URL}${url}">\n<meta property="og:url" content="${SITE_URL}${url}">\n` : ''}<meta property="og:type" content="website">
<meta property="og:title" content="${esc(t.name)} | StackPilot">
<meta property="og:description" content="${esc(c.metaDescription)}">
<meta name="theme-color" content="#FAFAF9">
${FAVICON}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>

<body>
<!-- Generated by scripts/build.mjs from js/data.js and content/tools/${t.slug}.json. Edit those files, not this one. -->
<a class="skip-link" href="#main">Skip to content</a>

${SPRITE}
${HEADER}

<main id="main" class="container tool-page">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Home</a></li>
      <li><a href="/#tools">Tools</a></li>
      <li><span aria-current="page">${esc(t.name)}</span></li>
    </ol>
  </nav>

  <header class="tp-hero">
    ${mark(t, 'mark--xl')}
    <div class="tp-hero-text">
      <h1>${esc(t.name)}</h1>
      <p class="tp-tagline">${esc(t.description)}</p>
      <div class="panel-sub">${catLabel(t.category)}${present(t.subcategory) ? `<span class="meta-note">${esc(t.subcategory)}</span>` : ''}${priceTag(t.pricing)}</div>
    </div>
    <div class="tp-hero-actions">
      <a class="btn btn-primary" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Visit ${esc(t.name)} ${icon('i-arrow-ur', 'icon-arrow')}<span class="sr-only">(opens official site in a new tab)</span></a>
      ${firstCompare ? `<a class="btn btn-secondary" href="/#compare-${esc(firstCompare.slug)}">${esc(firstCompare.title)}</a>` : ''}
    </div>
  </header>

  <div class="tp-layout">
    <div class="tp-content">${body}
    </div>

    <aside class="tp-aside" aria-label="${esc(t.name)} at a glance">
      <div class="tp-glance">
        <h2>At a glance</h2>
        <dl>
          <div><dt>Pricing</dt><dd>${priceTag(t.pricing)}${present(t.startingPrice) ? `<span class="tp-from">Paid from ${esc(t.startingPrice)}</span>` : ''}</dd></div>
          ${list(c.platforms).length ? `<div><dt>Platforms</dt><dd>${esc(list(c.platforms).join(', '))}</dd></div>` : ''}
          <div><dt>Category</dt><dd>${esc(t.category)}${present(t.subcategory) ? ` · ${esc(t.subcategory)}` : ''}</dd></div>
          ${verified ? `<div><dt>Last checked</dt><dd>${esc(fmtDate(verified))}</dd></div>` : ''}
        </dl>
        <a class="btn btn-primary tp-glance-btn" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Visit official site ${icon('i-arrow-ur', 'icon-arrow')}</a>
      </div>
      ${toc.length > 2 ? `<nav class="tp-toc" aria-label="On this page">
        <h2>On this page</h2>
        <ol>${toc.map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('')}</ol>
      </nav>` : ''}
    </aside>
  </div>
</main>

${FOOTER}

<div class="toast" id="toast" role="status" aria-live="polite">
  ${icon('i-info')}
  <span id="toastText"></span>
</div>
<script src="/js/page.js" defer></script>
</body>
</html>
`;
}

/* Build ------------------------------------------------------------------ */
const contentDir = join(root, 'content/tools');
const files = existsSync(contentDir) ? readdirSync(contentDir).filter(f => f.endsWith('.json')).sort() : [];
const errors = [];
const pages = [];

for (const file of files) {
  const c = JSON.parse(readFileSync(join(contentDir, file), 'utf8'));
  const slug = file.replace(/\.json$/, '');
  const t = toolBySlug[slug];
  if (!t) { errors.push(`${file}: no tool with slug "${slug}" in js/data.js`); continue; }
  if (c.slug && c.slug !== slug) errors.push(`${file}: slug "${c.slug}" does not match file name`);
  for (const f of ['metaDescription', 'overview', 'features', 'sources']) if (!present(c[f])) errors.push(`${file}: missing "${f}"`);
  list(c.alternatives).forEach(s => { if (!toolBySlug[s]) errors.push(`${file}: alternative "${s}" does not exist`); });
  pages.push({ t, c });
}
if (errors.length) {
  console.error(`✗ Build failed:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}

// Remove pages whose content file was deleted, then write the current set.
const outDir = join(root, 'tools');
if (existsSync(outDir)) {
  for (const dir of readdirSync(outDir)) if (!pages.some(p => p.t.slug === dir)) rmSync(join(outDir, dir), { recursive: true, force: true });
}
const pageSlugs = new Set(pages.map(p => p.t.slug));
for (const { t, c } of pages) {
  mkdirSync(join(outDir, t.slug), { recursive: true });
  writeFileSync(join(outDir, t.slug, 'index.html'), renderToolPage(t, c, pageSlugs));
}
writeFileSync(join(root, 'js/pages.js'),
  `/* Generated by scripts/build.mjs — tools that have their own page. Do not edit. */\nwindow.StackPilotPages = ${JSON.stringify([...pageSlugs])};\n`);

console.log(`✓ Built ${pages.length} tool page(s): ${[...pageSlugs].map(s => `/tools/${s}/`).join(', ') || 'none'}`);
