#!/usr/bin/env node
/* StackPilot — static page builder (no dependencies)

   Generates a plain-HTML page for every tool and comparison that has a content file:
     content/tools/<slug>.json        →  tools/<slug>/index.html
     content/comparisons/<slug>.json  →  comparisons/<slug>/index.html

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
const DIALOG = between('<dialog class="panel"', '</dialog>'); // shared tool/comparison popup

/* Category pages: intro and SEO text per category (content/categories.json) */
const CAT_CONTENT = JSON.parse(read('content/categories.json'));
const LISTED_CATS = CATEGORIES.filter(c => c.id !== 'All' && c.slug && CAT_CONTENT[c.id]);
const catSlug = Object.fromEntries(CATEGORIES.filter(c => c.slug).map(c => [c.id, c.slug]));
const catHref = id => (catSlug[id] ? `/categories/${catSlug[id]}/` : '/tools/');

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

/* Page shell: head, shared header/footer, popup and scripts --------------- */
function shell({ title, description, url, ogTitle, jsonLd, source, main }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | StackPilot</title>
<meta name="description" content="${esc(description)}">
${SITE_URL ? `<link rel="canonical" href="${SITE_URL}${url}">\n<meta property="og:url" content="${SITE_URL}${url}">\n` : ''}<meta property="og:type" content="website">
<meta property="og:title" content="${esc(ogTitle || title)} | StackPilot">
<meta property="og:description" content="${esc(description)}">
<meta name="theme-color" content="#FAFAF9">
${FAVICON}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
</head>

<body>
<!-- Generated by scripts/build.mjs from ${source}. Edit those files, not this one. -->
<a class="skip-link" href="#main">Skip to content</a>

${SPRITE}
${HEADER}

${main}

${FOOTER}

${DIALOG}

<div class="toast" id="toast" role="status" aria-live="polite">
  ${icon('i-info')}
  <span id="toastText"></span>
</div>
<script src="/js/data.js" defer></script>
<script src="/js/pages.js" defer></script>
<script src="/js/panel.js" defer></script>
<script src="/js/page.js" defer></script>
</body>
</html>
`;
}

const breadcrumb = items => `<nav class="breadcrumb" aria-label="Breadcrumb">
    <ol>${items.map(([label, href]) => href
      ? `\n      <li><a href="${esc(href)}">${esc(label)}</a></li>`
      : `\n      <li><span aria-current="page">${esc(label)}</span></li>`).join('')}
    </ol>
  </nav>`;

// A comparison links to its own page when it has one, otherwise to the popup.
const compareLink = (x, comparePages, cls) => comparePages.has(x.slug)
  ? `<a class="${cls}" href="/comparisons/${esc(x.slug)}/">${esc(x.title)}</a>`
  : `<a class="${cls}" href="/#compare-${esc(x.slug)}" data-open-compare="${esc(x.slug)}" aria-haspopup="dialog">${esc(x.title)}</a>`;

/* Tool page -------------------------------------------------------------- */
function renderToolPage(t, c, pageSlugs, comparePages) {
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
    section('alternatives', `Alternatives to ${t.name}`, alternatives.length ? `<ul class="tp-alts">${alternatives.map(a => `
            <li><a class="tp-alt" href="${toolHref(a.slug)}"${pageSlugs.has(a.slug) ? '' : ` data-open-tool="${esc(a.slug)}" aria-haspopup="dialog"`}>
              ${mark(a, 'mark--sm')}
              <span class="tp-alt-text"><strong>${esc(a.name)}</strong><span class="tp-alt-desc">${esc(a.description)}</span></span>
              ${icon('i-chev-r', 'tp-alt-chev')}
            </a></li>`).join('')}
          </ul>` : ''),
    section('comparisons', 'Comparisons', comparisons.length ? `<div class="compare-grid">${comparisons.map(x => `
            <article class="card compare-card">
              <div class="compare-top">
                <div class="pair">${mark(toolBySlug[x.a], 'mark--sm')}<span class="vs" aria-hidden="true">vs</span>${mark(toolBySlug[x.b], 'mark--sm')}</div>
                <span class="card-arrow">${icon('i-arrow-ur')}</span>
              </div>
              <h3>${compareLink(x, comparePages, 'card-link')}</h3>
              ${present(x.subtitle) ? `<p>${esc(x.subtitle)}</p>` : ''}
              <div class="tool-meta">${catLabel(x.category)}<span class="meta-note">${comparePages.has(x.slug) ? 'Full comparison' : 'Overview'}</span></div>
            </article>`).join('')}
          </div>` : ''),
    section('sources', 'Sources & verification', list(c.sources).length ? `<p>StackPilot writes its own descriptions and checks product details against official sources. We are not affiliated with ${esc(t.name)}, and links go to its official website.</p>
          <ul class="tp-sources">${list(c.sources).map(s => `
            <li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a></li>`).join('')}
          </ul>` : '')
  ].join('');

  // Prefer a comparison that has its own page for the hero button.
  const firstCompare = comparisons.find(x => comparePages.has(x.slug)) || comparisons[0];

  return shell({
    title: c.seoTitle || `${t.name}: Features, Pricing & Alternatives`,
    description: c.metaDescription,
    url,
    ogTitle: t.name,
    jsonLd,
    source: `js/data.js and content/tools/${t.slug}.json`,
    main: `<main id="main" class="container tool-page">
  ${breadcrumb([['Home', '/'], ['Tools', '/tools/'], [t.category, catHref(t.category)], [t.name]])}

  <header class="tp-hero">
    ${mark(t, 'mark--xl')}
    <div class="tp-hero-text">
      <h1>${esc(t.name)}</h1>
      <p class="tp-tagline">${esc(t.description)}</p>
      <div class="panel-sub">${catLabel(t.category)}${present(t.subcategory) ? `<span class="meta-note">${esc(t.subcategory)}</span>` : ''}${priceTag(t.pricing)}</div>
    </div>
    <div class="tp-hero-actions">
      <a class="btn btn-primary" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Visit ${esc(t.name)} ${icon('i-arrow-ur', 'icon-arrow')}<span class="sr-only">(opens official site in a new tab)</span></a>
      ${firstCompare ? compareLink(firstCompare, comparePages, 'btn btn-secondary') : ''}
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
</main>`
  });
}

/* Comparison page ------------------------------------------------------- */
// Pricing tables come from each tool's content file, so a price is written once.
function renderComparisonPage(x, c, pageSlugs, toolContent) {
  const A = toolBySlug[x.a], B = toolBySlug[x.b];
  const cA = toolContent[x.a] || {}, cB = toolContent[x.b] || {};
  const url = `/comparisons/${x.slug}/`;
  const toolHref = s => (pageSlugs.has(s) ? `/tools/${s}/` : `/#tool-${s}`);
  const verified = c.verified;
  const glance = list(c.glance);
  const priceBlock = (t, tc) => {
    const plans = list(tc.pricing?.plans);
    if (!plans.length) return '';
    return `<div class="cp-price">
            <h3>${mark(t, 'mark--sm')}<span>${esc(t.name)}</span></h3>
            <div class="tp-table-wrap"><table class="tp-table">
              <thead><tr><th scope="col">Plan</th><th scope="col">Price</th><th scope="col">Details</th></tr></thead>
              <tbody>${plans.map(p => `
                <tr><th scope="row">${esc(p.name)}</th><td>${esc(p.price)}</td><td>${esc(p.note || '')}</td></tr>`).join('')}
              </tbody>
            </table></div>
            <p class="tp-fineprint"><a href="${esc(tc.pricing.source || t.url)}" target="_blank" rel="noopener noreferrer">${esc(t.name)} pricing page</a></p>
          </div>`;
  };
  const choose = (t, items) => list(items).length ? `<div class="cp-choose">
            <h3>${mark(t, 'mark--sm')}<span>Choose ${esc(t.name)} if…</span></h3>
            <ul>${list(items).map(i => `<li>${icon('i-check')}<span>${esc(i)}</span></li>`).join('')}</ul>
            <a class="lp-more" href="${toolHref(t.slug)}"${pageSlugs.has(t.slug) ? '' : ` data-open-tool="${esc(t.slug)}" aria-haspopup="dialog"`}>About ${esc(t.name)} ${icon('i-arrow-r')}</a>
          </div>` : '';
  const sources = [...list(c.sources)];
  for (const [t, tc] of [[A, cA], [B, cB]]) {
    if (tc.pricing?.source && !sources.some(s => s.url === tc.pricing.source)) sources.push({ label: `${t.name} — Pricing`, url: tc.pricing.source });
  }

  const toc = [
    ['overview', 'Overview', c.intro], ['verdict', 'Which to choose', list(c.chooseA).length || list(c.chooseB).length ? 1 : null],
    ['at-a-glance', 'At a glance', glance], ['differences', 'Key differences', c.differences], ['similarities', 'What they share', c.similarities],
    ['pricing', 'Pricing', list(cA.pricing?.plans).length || list(cB.pricing?.plans).length ? 1 : null], ['faq', 'FAQ', c.faq], ['sources', 'Sources', sources]
  ].filter(([, , v]) => present(v));

  const body = [
    section('overview', 'Overview', list(c.intro).map(p => `<p>${esc(p)}</p>`).join('\n          ')),
    section('verdict', 'Which should you choose?', (list(c.chooseA).length || list(c.chooseB).length) ? `<div class="cp-chooser">
          ${choose(A, c.chooseA)}
          ${choose(B, c.chooseB)}
          </div>` : ''),
    section('at-a-glance', 'At a glance', glance.length ? `<div class="tp-table-wrap"><table class="tp-table cp-table">
            <thead><tr><th scope="col"><span class="sr-only">Feature</span></th><th scope="col">${esc(A.name)}</th><th scope="col">${esc(B.name)}</th></tr></thead>
            <tbody>${glance.map(r => `
              <tr><th scope="row">${esc(r.label)}</th><td data-label="${esc(A.name)}">${esc(r.a)}</td><td data-label="${esc(B.name)}">${esc(r.b)}</td></tr>`).join('')}
            </tbody>
          </table></div>` : ''),
    section('differences', 'Key differences', list(c.differences).length ? `<ul class="tp-features">${list(c.differences).map(f => `
            <li><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></li>`).join('')}
          </ul>` : ''),
    section('similarities', 'What they have in common', list(c.similarities).length ? `<ul class="tp-checks">${list(c.similarities).map(u => `
            <li>${icon('i-check')}<span>${esc(u)}</span></li>`).join('')}
          </ul>` : ''),
    section('pricing', 'Pricing side by side', (list(cA.pricing?.plans).length || list(cB.pricing?.plans).length) ? `<div class="cp-prices">
          ${priceBlock(A, cA)}
          ${priceBlock(B, cB)}
          </div>
          <p class="tp-fineprint">Prices in USD, before tax, and may vary by region or app store. Plans change often, so check each official pricing page before buying.${verified ? ` Last checked ${esc(fmtDate(verified))}.` : ''}</p>` : ''),
    section('faq', 'Frequently asked questions', list(c.faq).length ? `<div class="cp-faq">${list(c.faq).map(f => `
            <details><summary>${esc(f.q)}${icon('i-chev-d')}</summary><p>${esc(f.a)}</p></details>`).join('')}
          </div>` : ''),
    section('sources', 'Sources & verification', sources.length ? `<p>StackPilot writes its own comparisons and checks product details against official sources. We are not affiliated with ${esc(A.name)} or ${esc(B.name)}.</p>
          <ul class="tp-sources">${sources.map(s => `
            <li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a></li>`).join('')}
          </ul>` : '')
  ].join('');

  const jsonLd = [{
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: c.seoTitle || x.title,
    description: c.metaDescription,
    ...(verified ? { dateModified: verified } : {}),
    about: [A, B].map(t => ({ '@type': 'SoftwareApplication', name: t.name, url: t.url })),
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [['Home', '/'], ['Comparisons', '/#comparisons'], [x.title, url]].map(([name, item], i) => ({
        '@type': 'ListItem', position: i + 1, name, ...(SITE_URL ? { item: `${SITE_URL}${item}` } : {})
      }))
    }
  }];
  if (list(c.faq).length) jsonLd.push({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: list(c.faq).map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
  });

  const visit = t => `<a class="btn btn-secondary" href="${esc(t.url)}" target="_blank" rel="noopener noreferrer">Visit ${esc(t.name)} ${icon('i-arrow-ur', 'icon-arrow')}<span class="sr-only">(opens official site in a new tab)</span></a>`;

  return shell({
    title: c.seoTitle || x.title,
    description: c.metaDescription,
    url,
    ogTitle: x.title,
    jsonLd,
    source: `js/data.js, content/comparisons/${x.slug}.json and the two tools' content files`,
    main: `<main id="main" class="container tool-page compare-page">
  ${breadcrumb([['Home', '/'], ['Comparisons', '/#comparisons'], [x.title]])}

  <header class="tp-hero cp-hero">
    <div class="pair cp-pair">${mark(A, 'mark--lg')}<span class="vs" aria-hidden="true">vs</span>${mark(B, 'mark--lg')}</div>
    <div class="tp-hero-text">
      <h1>${esc(x.title)}</h1>
      ${present(x.subtitle) ? `<p class="tp-tagline">${esc(x.subtitle)}</p>` : ''}
      <div class="panel-sub">${catLabel(x.category)}${verified ? `<span class="meta-note">Last checked ${esc(fmtDate(verified))}</span>` : ''}</div>
    </div>
  </header>

  <div class="tp-layout">
    <div class="tp-content">${body}
    </div>

    <aside class="tp-aside" aria-label="The two tools">
      <div class="tp-glance cp-tools">
        <h2>Compared here</h2>
        <ul>${[A, B].map(t => `
          <li>
            <a class="tp-alt" href="${toolHref(t.slug)}"${pageSlugs.has(t.slug) ? '' : ` data-open-tool="${esc(t.slug)}" aria-haspopup="dialog"`}>
              ${mark(t, 'mark--sm')}
              <span class="tp-alt-text"><strong>${esc(t.name)}</strong><span class="tp-alt-desc">${esc(t.startingPrice ? `Paid from ${t.startingPrice}` : t.pricing)}</span></span>
              ${icon('i-chev-r', 'tp-alt-chev')}
            </a>
          </li>`).join('')}
        </ul>
        <div class="cp-visit">${visit(A)}${visit(B)}</div>
      </div>
      ${toc.length > 2 ? `<nav class="tp-toc" aria-label="On this page">
        <h2>On this page</h2>
        <ol>${toc.map(([id, label]) => `<li><a href="#${id}">${esc(label)}</a></li>`).join('')}</ol>
      </nav>` : ''}
    </aside>
  </div>
</main>`
  });
}

/* Listing pages: /tools/, /categories/ and /categories/<slug>/ ------------ */
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Same card as the homepage grid; links to the tool's page when it has one,
// otherwise opens the shared popup (falls back to the homepage without JS).
function toolCard(t, pageSlugs) {
  const hasPage = pageSlugs.has(t.slug);
  const search = [t.name, t.category, t.subcategory, t.description, t.pricing, ...list(t.tags)].join(' ').toLowerCase();
  return `
        <article class="card tool-card" data-search="${esc(search)}">
          <div class="tool-top">${mark(t)}<span class="card-arrow">${icon('i-arrow-ur')}</span></div>
          <h3><a class="card-link" href="${hasPage ? `/tools/${t.slug}/` : `/#tool-${t.slug}`}"${hasPage ? '' : ` data-open-tool="${esc(t.slug)}" aria-haspopup="dialog"`}>${esc(t.name)}</a></h3>
          ${present(t.description) ? `<p class="tool-desc">${esc(t.description)}</p>` : ''}
          <div class="tool-meta">${catLabel(t.category)}${priceTag(t.pricing)}</div>
        </article>`;
}

// Category links styled like the homepage filter chips; the current page is highlighted.
function categoryNav(activeId) {
  const items = [['All', 'All Tools', '/tools/', TOOLS.length],
    ...LISTED_CATS.map(c => [c.id, c.label, catHref(c.id), TOOLS.filter(t => t.category === c.id).length])];
  return `<nav class="chips-wrap lp-chips" aria-label="Browse by category">
    <div class="chips">${items.map(([id, label, href, n]) => `
      <a class="chip" href="${href}"${id === activeId ? ' aria-current="page"' : ''}><span class="chip-label">${esc(label)}</span><span class="chip-count">${n}</span></a>`).join('')}
    </div>
  </nav>`;
}

const itemListLd = (name, url, tools, pageSlugs) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name,
  ...(SITE_URL ? { url: `${SITE_URL}${url}` } : {}),
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: tools.length,
    itemListElement: tools.map((t, i) => ({
      '@type': 'ListItem', position: i + 1, name: t.name,
      ...(pageSlugs.has(t.slug) ? { url: `${SITE_URL}/tools/${t.slug}/` } : {})
    }))
  }
});

function renderAllToolsPage(pageSlugs) {
  const url = '/tools/';
  const groups = LISTED_CATS.map(c => [c, TOOLS.filter(t => t.category === c.id).sort(byName)]).filter(([, ts]) => ts.length);
  const description = `Browse all ${TOOLS.length} tools on StackPilot across AI, design, development, productivity and marketing, with sourced pages covering features, pricing and alternatives.`;
  return shell({
    title: 'All Tools', description, url, jsonLd: itemListLd('All Tools', url, TOOLS, pageSlugs),
    source: 'js/data.js and content/categories.json',
    main: `<main id="main" class="container listing-page">
  ${breadcrumb([['Home', '/'], ['All Tools']])}

  <header class="lp-head">
    <h1>All tools</h1>
    <p class="lp-intro">Every tool in the StackPilot directory, grouped by category. Each one has its own page with features, current pricing from the official site, and alternatives.</p>
  </header>

  ${categoryNav('All')}

  <div class="lp-toolbar">
    <div class="search-field lp-search">
      ${icon('i-search')}
      <label for="listSearch" class="sr-only">Filter tools on this page</label>
      <input id="listSearch" class="search-input" type="search" placeholder="Filter by name, category or use case…" autocomplete="off" spellcheck="false" aria-describedby="listCount">
    </div>
    <p class="result-count" id="listCount" aria-live="polite">${plural(TOOLS.length, 'tool')}</p>
  </div>
${groups.map(([c, ts]) => `
  <section class="lp-group" aria-labelledby="group-${c.slug}">
    <div class="lp-group-head">
      <h2 id="group-${c.slug}">${esc(c.label)}</h2>
      <a class="lp-more" href="${catHref(c.id)}">View ${esc(c.label)} ${icon('i-arrow-r')}</a>
    </div>
    <div class="tool-grid">${ts.map(t => toolCard(t, pageSlugs)).join('')}
    </div>
  </section>`).join('')}

  <div class="empty lp-empty" id="listEmpty" role="status" hidden>
    <div class="empty-icon">${icon('i-search')}</div>
    <h3>No tools found</h3>
    <p>No tools match your filter. Try a different keyword.</p>
  </div>
</main>`
  });
}

function renderCategoriesPage() {
  const url = '/categories/';
  const description = `Browse StackPilot's tools by category: ${LISTED_CATS.map(c => c.label).join(', ')}.`;
  return shell({
    title: 'Tool Categories', description, url,
    jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Tool Categories', ...(SITE_URL ? { url: `${SITE_URL}${url}` } : {}) },
    source: 'js/data.js and content/categories.json',
    main: `<main id="main" class="container listing-page">
  ${breadcrumb([['Home', '/'], ['Categories']])}

  <header class="lp-head">
    <h1>Categories</h1>
    <p class="lp-intro">Browse the directory by the kind of work you do.</p>
  </header>

  <ul class="cat-grid">${LISTED_CATS.map(c => {
    const ts = TOOLS.filter(t => t.category === c.id);
    const subs = [...new Set(ts.map(t => t.subcategory).filter(present))];
    return `
    <li><article class="card cat-card" style="--cat-color:${esc(c.color)}">
      <div class="cat-card-top"><span class="cat-dot" aria-hidden="true"></span><span class="card-arrow">${icon('i-arrow-ur')}</span></div>
      <h2><a class="card-link" href="${catHref(c.id)}">${esc(c.label)}</a></h2>
      <p>${esc(CAT_CONTENT[c.id].intro.split('. ')[0])}.</p>
      <p class="cat-subs">${subs.map(esc).join(' · ')}</p>
      <div class="tool-meta"><span class="meta-note">${plural(ts.length, 'tool')}</span></div>
    </article></li>`;
  }).join('')}
  </ul>
</main>`
  });
}

function renderCategoryPage(c, pageSlugs) {
  const info = CAT_CONTENT[c.id];
  const url = catHref(c.id);
  const ts = TOOLS.filter(t => t.category === c.id).sort(byName);
  const subs = [...new Set(ts.map(t => t.subcategory).filter(present))].sort((a, b) => a.localeCompare(b));
  const comparisons = COMPARISONS.filter(x => toolBySlug[x.a]?.category === c.id || toolBySlug[x.b]?.category === c.id)
    .filter(x => toolBySlug[x.a] && toolBySlug[x.b]);
  const subId = s => `sub-${s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  return shell({
    title: info.seoTitle, description: info.metaDescription, url, ogTitle: `${c.label} tools`,
    jsonLd: itemListLd(`${c.label} tools`, url, ts, pageSlugs),
    source: 'js/data.js and content/categories.json',
    main: `<main id="main" class="container listing-page">
  ${breadcrumb([['Home', '/'], ['Categories', '/categories/'], [c.label]])}

  <header class="lp-head">
    <span class="cat" style="--cat-color:${esc(c.color)}">${plural(ts.length, 'tool')}</span>
    <h1>${esc(c.label)}</h1>
    <p class="lp-intro">${esc(info.intro)}</p>
  </header>

  ${categoryNav(c.id)}

  ${subs.length > 1 ? `<nav class="lp-jump" aria-label="${esc(c.label)} subcategories">
    <ul>${subs.map(s => `<li><a href="#${subId(s)}">${esc(s)}</a></li>`).join('')}</ul>
  </nav>` : ''}
${subs.map(s => {
    const group = ts.filter(t => t.subcategory === s);
    return `
  <section class="lp-group" id="${subId(s)}" aria-labelledby="${subId(s)}-title">
    <div class="lp-group-head">
      <h2 id="${subId(s)}-title">${esc(s)}</h2>
      <span class="meta-note">${plural(group.length, 'tool')}</span>
    </div>
    <div class="tool-grid">${group.map(t => toolCard(t, pageSlugs)).join('')}
    </div>
  </section>`;
  }).join('')}
${comparisons.length ? `
  <section class="lp-group" aria-labelledby="cat-compare-title">
    <div class="lp-group-head"><h2 id="cat-compare-title">Comparisons</h2></div>
    <div class="compare-grid">${comparisons.map(x => `
      <article class="card compare-card">
        <div class="compare-top">
          <div class="pair">${mark(toolBySlug[x.a], 'mark--sm')}<span class="vs" aria-hidden="true">vs</span>${mark(toolBySlug[x.b], 'mark--sm')}</div>
          <span class="card-arrow">${icon('i-arrow-ur')}</span>
        </div>
        <h3><a class="card-link" href="/#compare-${esc(x.slug)}" data-open-compare="${esc(x.slug)}" aria-haspopup="dialog">${esc(x.title)}</a></h3>
        ${present(x.subtitle) ? `<p>${esc(x.subtitle)}</p>` : ''}
        <div class="tool-meta">${catLabel(x.category)}<span class="meta-note">Overview</span></div>
      </article>`).join('')}
    </div>
  </section>` : ''}
</main>`
  });
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
  for (const dir of readdirSync(outDir)) {
    if (dir === 'index.html') continue; // the All Tools page, rewritten below
    if (!pages.some(p => p.t.slug === dir)) rmSync(join(outDir, dir), { recursive: true, force: true });
  }
}
const pageSlugs = new Set(pages.map(p => p.t.slug));

// Comparison pages: content/comparisons/<slug>.json → comparisons/<slug>/index.html
const cmpDir = join(root, 'content/comparisons');
const cmpFiles = existsSync(cmpDir) ? readdirSync(cmpDir).filter(f => f.endsWith('.json')).sort() : [];
const cmpPages = [];
for (const file of cmpFiles) {
  const c = JSON.parse(readFileSync(join(cmpDir, file), 'utf8'));
  const slug = file.replace(/\.json$/, '');
  const x = COMPARISONS.find(y => y.slug === slug);
  if (!x) { errors.push(`comparisons/${file}: no comparison with slug "${slug}" in js/data.js`); continue; }
  if (!toolBySlug[x.a] || !toolBySlug[x.b]) { errors.push(`comparisons/${file}: both tools must exist in js/data.js`); continue; }
  if (c.slug && c.slug !== slug) errors.push(`comparisons/${file}: slug "${c.slug}" does not match file name`);
  for (const f of ['metaDescription', 'intro', 'differences', 'sources']) if (!present(c[f])) errors.push(`comparisons/${file}: missing "${f}"`);
  list(c.glance).forEach((r, i) => { if (!present(r.label) || !present(r.a) || !present(r.b)) errors.push(`comparisons/${file}: glance[${i}] needs label, a and b`); });
  cmpPages.push({ x, c });
}
if (errors.length) { console.error(`✗ Build failed:\n  - ${errors.join('\n  - ')}`); process.exit(1); }
const comparePages = new Set(cmpPages.map(p => p.x.slug));
const toolContent = Object.fromEntries(pages.map(p => [p.t.slug, p.c]));

for (const { t, c } of pages) {
  mkdirSync(join(outDir, t.slug), { recursive: true });
  writeFileSync(join(outDir, t.slug, 'index.html'), renderToolPage(t, c, pageSlugs, comparePages));
}
const cmpOut = join(root, 'comparisons');
rmSync(cmpOut, { recursive: true, force: true });
for (const { x, c } of cmpPages) {
  mkdirSync(join(cmpOut, x.slug), { recursive: true });
  writeFileSync(join(cmpOut, x.slug, 'index.html'), renderComparisonPage(x, c, pageSlugs, toolContent));
}
// /tools/ (All Tools), /categories/ and one page per category.
for (const c of CATEGORIES) {
  if (c.id === 'All') continue;
  if (c.slug && home.split(`href="/categories/${c.slug}/"`).length < 3) errors.push(`index.html: "${c.label}" needs a link in both the header dropdown and the mobile menu`);
  if (!c.slug) errors.push(`js/data.js: category "${c.id}" has no slug`);
  if (!CAT_CONTENT[c.id]) errors.push(`content/categories.json: missing "${c.id}"`);
}
if (errors.length) { console.error(`✗ Build failed:\n  - ${errors.join('\n  - ')}`); process.exit(1); }
writeFileSync(join(outDir, 'index.html'), renderAllToolsPage(pageSlugs));
const catDir = join(root, 'categories');
rmSync(catDir, { recursive: true, force: true });
mkdirSync(catDir, { recursive: true });
writeFileSync(join(catDir, 'index.html'), renderCategoriesPage());
for (const c of LISTED_CATS) {
  mkdirSync(join(catDir, c.slug), { recursive: true });
  writeFileSync(join(catDir, c.slug, 'index.html'), renderCategoryPage(c, pageSlugs));
}

writeFileSync(join(root, 'js/pages.js'),
  `/* Generated by scripts/build.mjs — tools and comparisons that have their own page. Do not edit. */\nwindow.StackPilotPages = ${JSON.stringify([...pageSlugs])};\nwindow.StackPilotComparePages = ${JSON.stringify([...comparePages])};\n`);

console.log(`✓ Built ${pages.length} tool page(s), ${cmpPages.length} comparison page(s), /tools/, /categories/ and ${LISTED_CATS.length} category page(s)`);
