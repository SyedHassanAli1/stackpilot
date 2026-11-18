/* StackPilot — homepage behaviour
   Search, category filters, sorting, show more, detail panels,
   mobile menu, keyboard shortcuts and scroll-spy. Data comes from js/data.js. */

(() => {
  'use strict';


  const { CATEGORIES, TOOLS, COMPARISONS, GUIDES, LOGOS } = window.StackPilot;

  const PAGE_SIZE = 6;
  const MORE_STEP = 12;
  const toolBySlug = Object.fromEntries(TOOLS.map(t => [t.slug, t]));
  const catColor = Object.fromEntries(CATEGORIES.map(c => [c.id, c.color]));

  /* ------------------------------------------------------------------------
     Helpers — safe DOM creation (text is always set via textContent)
     ------------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* Optional-value handling — used by every renderer so that missing data
     never reaches the page as text ("null", "undefined", "[object Object]").
     isPresent: null, undefined, false, NaN, blank strings and empty arrays are
     "missing". 0 is kept. */
  const isPresent = v =>
    v !== null && v !== undefined && v !== false &&
    !(typeof v === 'number' && Number.isNaN(v)) &&
    !(typeof v === 'string' && v.trim() === '') &&
    !(Array.isArray(v) && v.length === 0);

  // Flattens a child list and drops missing values. Only DOM nodes, strings and
  // numbers can be rendered; anything else (e.g. a stray object) is skipped.
  function cleanChildren(list) {
    return list.flat(Infinity).filter(c =>
      isPresent(c) && (c instanceof Node || typeof c === 'string' || typeof c === 'number'));
  }

  function h(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'style') Object.entries(value).forEach(([p, v]) => { if (isPresent(v)) node.style.setProperty(p, v); });
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of cleanChildren(children)) {
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  // Safe wrapper for replaceChildren(): the native method turns null into the
  // text "null", which was the cause of the stray "null" in detail panels.
  function setChildren(parent, ...children) {
    parent.replaceChildren(...cleanChildren(children));
  }

  // Renders a titled panel section only when it has content.
  function section(title, body) {
    return isPresent(body) ? h('div', { class: 'panel-section' }, h('h3', {}, title), body) : null;
  }

  // Renders an element only when its main value is present.
  const when = (value, render) => (isPresent(value) ? render(value) : null);

  const isHttpUrl = v => typeof v === 'string' && /^https?:\/\//i.test(v);

  function icon(name, cls = '') {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', `icon ${cls}`.trim());
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#${name}`);
    svg.append(use);
    return svg;
  }

  function letterMark(tool, size = '') {
    // Falls back to the name's first letter if a tool has no mark defined.
    const glyph = isPresent(tool.mark) ? tool.mark : String(tool.name || '?').trim().charAt(0).toUpperCase();
    return h('span', {
      class: `mark ${size}`.trim(), 'aria-hidden': 'true',
      style: { '--mark-bg': tool.bg, '--mark-fg': tool.fg, '--mark-line': tool.line }
    }, glyph);
  }

  // Uses the tool's official logo file when `logo` is set (see LOGOS below);
  // falls back to the letter tile if no file is set or the file fails to load.
  function mark(tool, size = '') {
    const src = LOGOS[tool.slug];
    if (!src) return letterMark(tool, size);
    const wrap = h('span', { class: `mark mark--logo ${size}`.trim(), 'aria-hidden': 'true' });
    const img = h('img', { src, alt: '', loading: 'lazy', decoding: 'async', width: '28', height: '28' });
    img.addEventListener('error', () => wrap.replaceWith(letterMark(tool, size)), { once: true });
    wrap.append(img);
    return wrap;
  }

  const priceTag = p => when(p, v => h('span', { class: `tag tag--${String(v).toLowerCase().replace(/\s+/g, '-')}` }, v));
  // Returns a readable date, or null for missing/invalid dates (never "Invalid Date").
  const formatDate = iso => {
    if (!isPresent(iso)) return null;
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const catLabel = c => when(c, v => h('span', { class: 'cat', style: { '--cat-color': catColor[v] } }, v));
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */
  const state = { category: 'All', query: '', sort: 'featured', limit: PAGE_SIZE };

  const els = {
    header: $('#siteHeader'),
    chips: $('#chips'),
    grid: $('#toolGrid'),
    count: $('#resultCount'),
    live: $('#liveRegion'),
    more: $('#toggleMore'),
    sort: $('#sortSelect'),
    form: $('#searchForm'),
    input: $('#searchInput'),
    clear: $('#searchClear'),
    help: $('#searchHelp'),
    panel: $('#panel'),
    panelBody: $('#panelBody'),
    panelCrumb: $('#panelCrumb'),
    menuBtn: $('#menuToggle'),
    mobileNav: $('#mobileNav'),
    toast: $('#toast'),
    toastText: $('#toastText')
  };

  /* ------------------------------------------------------------------------
     Filtering
     ------------------------------------------------------------------------ */
  const haystack = t => `${t.name} ${t.category} ${t.subcategory || ''} ${t.description} ${t.tags.join(' ')} ${t.pricing}`.toLowerCase();
  const HAY = new Map(TOOLS.map(t => [t.slug, haystack(t)]));

  function matchesQuery(tool, terms) {
    if (!terms.length) return true;
    const text = HAY.get(tool.slug);
    return terms.every(term => text.includes(term));
  }

  function queryTerms() {
    return state.query.toLowerCase().split(/\s+/).filter(Boolean);
  }

  function getResults() {
    const terms = queryTerms();
    const list = TOOLS.filter(t => (state.category === 'All' || t.category === state.category) && matchesQuery(t, terms));
    if (state.sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name));
    if (state.sort === 'za') list.sort((a, b) => b.name.localeCompare(a.name));
    return list;
  }

  /* ------------------------------------------------------------------------
     Rendering — chips
     ------------------------------------------------------------------------ */
  function renderChips() {
    const terms = queryTerms();
    const counts = { All: 0 };
    TOOLS.forEach(t => {
      if (!matchesQuery(t, terms)) return;
      counts.All++;
      counts[t.category] = (counts[t.category] || 0) + 1;
    });

    if (!els.chips.childElementCount) {
      CATEGORIES.forEach(c => {
        els.chips.append(h('button', { type: 'button', class: 'chip', 'data-category': c.id, 'aria-pressed': 'false' },
          h('span', { class: 'chip-label' }, c.label),
          h('span', { class: 'chip-count' })
        ));
      });
    }

    els.chips.querySelectorAll('.chip').forEach(chip => {
      const id = chip.dataset.category;
      const n = counts[id] || 0;
      const active = id === state.category;
      chip.setAttribute('aria-pressed', String(active));
      chip.classList.toggle('is-empty', n === 0);
      chip.querySelector('.chip-count').textContent = n;
      chip.setAttribute('aria-label', `${chip.querySelector('.chip-label').textContent}, ${plural(n, 'tool')}`);
    });
  }

  /* ------------------------------------------------------------------------
     Rendering — tool grid
     ------------------------------------------------------------------------ */
  function toolCard(tool, index) {
    return h('article', { class: 'card tool-card is-entering', style: { 'animation-delay': `${Math.min(index, 8) * 24}ms` } },
      h('div', { class: 'tool-top' }, mark(tool), h('span', { class: 'card-arrow' }, icon('i-arrow-ur'))),
      h('h3', {},
        h('button', { type: 'button', class: 'card-link', 'aria-haspopup': 'dialog', onclick: () => openTool(tool.slug) }, tool.name)
      ),
      when(tool.description, v => h('p', { class: 'tool-desc' }, v)),
      h('div', { class: 'tool-meta' }, catLabel(tool.category), priceTag(tool.pricing))
    );
  }

  function emptyState() {
    const filtered = state.category !== 'All';
    const where = filtered ? ` in ${CATEGORIES.find(c => c.id === state.category).label}` : '';
    const what = state.query ? `No tools match “${state.query}”${where}.` : `No tools${where} yet.`;
    return h('div', { class: 'empty', role: 'status' },
      h('div', { class: 'empty-icon' }, icon('i-search')),
      h('h3', {}, 'No tools found'),
      h('p', {}, `${what} Try a different keyword or browse all categories.`),
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => resetFilters(true) },
        icon('i-reset'), 'Reset filters')
    );
  }

  let announceTimer;
  function render({ animate = true } = {}) {
    renderChips();
    const results = getResults();
    const total = results.length;
    const visible = results.slice(0, state.limit);

    const frag = document.createDocumentFragment();
    if (total) visible.forEach((t, i) => frag.append(toolCard(t, i)));
    else frag.append(emptyState());
    els.grid.replaceChildren(frag);
    if (!animate) els.grid.querySelectorAll('.is-entering').forEach(n => n.classList.remove('is-entering'));

    els.count.textContent = total > visible.length
      ? `Showing ${visible.length} of ${total} tools`
      : plural(total, 'tool');

    // Step-wise "show more": reveals MORE_STEP cards at a time, then offers "Show fewer".
    const remaining = total - visible.length;
    const allShown = remaining <= 0;
    els.more.hidden = total <= PAGE_SIZE;
    els.more.setAttribute('aria-expanded', String(allShown));
    setChildren(els.more,
      allShown ? 'Show fewer tools' : `Show ${Math.min(MORE_STEP, remaining)} more tools`,
      icon('i-chev-d', 'icon-chev')
    );

    renderSearchHelp(total);

    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      els.live.textContent = total ? `${plural(total, 'tool')} found.` : 'No tools found.';
    }, 450);
  }

  /* ------------------------------------------------------------------------
     Search helper line under the hero search
     ------------------------------------------------------------------------ */
  const SUGGESTIONS = ['Figma', 'AI coding', 'SEO', 'Open source', 'Automation'];

  function renderSearchHelp(total) {
    els.form.classList.toggle('has-value', Boolean(state.query));
    if (state.query) {
      setChildren(els.help,
        h('span', {}, total ? `${plural(total, 'tool')} match your search.` : 'No matches yet.'),
        h('a', { class: 'jump', href: '#toolsTitle', onclick: e => { e.preventDefault(); scrollToResults(); } },
          total ? 'Jump to results' : 'See options', icon('i-arrow-d'))
      );
    } else {
      setChildren(els.help,
        h('span', {}, 'Try:'),
        ...SUGGESTIONS.map(s => h('button', { type: 'button', class: 'suggest', onclick: () => setQuery(s, true) }, s))
      );
    }
  }

  function scrollToResults() {
    document.getElementById('tools').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------------------------
     State changes
     ------------------------------------------------------------------------ */
  function setQuery(value, jump = false) {
    els.input.value = value;
    state.query = value.trim();
    render();
    if (jump) scrollToResults();
  }

  function setCategory(id) {
    if (id === state.category) return;
    state.category = id;
    render();
  }

  function resetFilters(focusSearch = false) {
    state.category = 'All';
    state.query = '';
    state.limit = PAGE_SIZE;
    els.input.value = '';
    render();
    if (focusSearch) els.input.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------------
     Detail panel
     ------------------------------------------------------------------------ */
  function openPanel({ crumb, wide = false, content }) {
    els.panelCrumb.textContent = crumb;
    els.panel.classList.toggle('panel--wide', wide);
    setChildren(els.panelBody, content);
    els.panelBody.scrollTop = 0;
    if (!els.panel.open) {
      els.panel.showModal();
      document.documentElement.classList.add('is-locked');
    }
    $('#panelClose').focus();
  }

  function closePanel() { if (els.panel.open) els.panel.close(); }

  function openTool(slug) {
    const t = toolBySlug[slug];
    if (!t) return;
    const comparisons = COMPARISONS.filter(c => (c.a === slug || c.b === slug) && toolBySlug[c.a] && toolBySlug[c.b]);
    const similar = TOOLS.filter(x => x.category === t.category && x.slug !== slug).slice(0, 4);
    const tags = (Array.isArray(t.tags) ? t.tags : []).filter(isPresent);
    const lastChecked = formatDate(t.verified);

    openPanel({
      crumb: isPresent(t.category) ? `Tool · ${t.category}` : 'Tool',
      content: [
        h('div', { class: 'panel-head' }, mark(t, 'mark--lg'),
          h('div', {},
            h('h2', { id: 'panelTitle' }, t.name),
            h('div', { class: 'panel-sub' }, catLabel(t.category),
              when(t.subcategory, v => h('span', { class: 'meta-note' }, v)),
              priceTag(t.pricing))
          )
        ),
        when(t.about || t.description, v => h('p', { class: 'panel-lede' }, v)),
        section('Good for', when(tags, list => h('ul', { class: 'tag-list' }, list.map(tag => h('li', { class: 'tag' }, tag))))),
        when(isHttpUrl(t.url) ? t.url : null, url => h('div', { class: 'panel-actions' },
          h('a', { class: 'btn btn-primary', href: url, target: '_blank', rel: 'noopener noreferrer' },
            `Visit ${t.name}`, icon('i-arrow-ur', 'icon-arrow'), h('span', { class: 'sr-only' }, '(opens official site in a new tab)'))
        )),
        section('Compared in', when(comparisons, list => h('ul', { class: 'mini-list' }, list.map(c => h('li', {},
          h('button', { type: 'button', class: 'mini-item', onclick: () => openComparison(c.slug) },
            h('span', { class: 'grow' }, h('strong', {}, c.title), when(c.subtitle, v => h('span', { class: 'mini-sub' }, v))),
            icon('i-chev-r'))
        ))))),
        section(`More in ${t.category}`, when(similar, list => h('ul', { class: 'mini-grid', style: { 'list-style': 'none' } }, list.map(s => h('li', {},
          h('button', { type: 'button', class: 'mini-item', onclick: () => openTool(s.slug) },
            mark(s, 'mark--sm'),
            h('span', { class: 'grow' }, h('strong', {}, s.name), when(s.pricing, v => h('span', { class: 'mini-sub' }, v))))
        ))))),
        h('p', { class: 'panel-note' },
          when(t.startingPrice, v => h('strong', {}, `Paid plans from ${v}. `)),
          'Prices are in USD, before tax, and change often. Check the official site for current plans.',
          when(lastChecked, v => ` Last checked ${v}.`))
      ]
    });
  }

  function openComparison(slug) {
    const c = COMPARISONS.find(x => x.slug === slug);
    if (!c) return;
    const A = toolBySlug[c.a], B = toolBySlug[c.b];
    if (!A || !B) return; // a comparison that references a missing tool is not shown
    const col = (t, fit) => h('div', { class: 'versus-col' },
      h('div', { class: 'row' }, mark(t), priceTag(t.pricing)),
      h('h3', {}, t.name),
      when(t.description, v => h('p', {}, v)),
      when(fit, v => h('p', { class: 'fit' }, h('strong', {}, 'Consider it if'), v)),
      h('div', { style: { 'margin-top': '14px' } },
        h('button', { type: 'button', class: 'btn btn-ghost', style: { height: '34px', padding: '0 10px', 'margin-left': '-10px' }, onclick: () => openTool(t.slug) },
          `About ${t.name}`, icon('i-arrow-r', 'icon-arrow')))
    );

    openPanel({
      crumb: isPresent(c.category) ? `Comparison · ${c.category}` : 'Comparison',
      wide: true,
      content: [
        h('h2', { id: 'panelTitle' }, c.title),
        when(c.subtitle, v => h('p', { class: 'panel-sub' }, v)),
        h('div', { class: 'versus' }, col(A, c.fitA), col(B, c.fitB)),
        section('Key differences', when((c.differences || []).filter(isPresent), list =>
          h('ul', { class: 'diff-list' }, list.map(d => h('li', {}, icon('i-check'), h('span', {}, d)))))),
        h('p', { class: 'panel-note' }, 'This is a short overview. A full side-by-side comparison page is planned for a later release.')
      ]
    });
  }

  function openGuide(slug) {
    const g = GUIDES.find(x => x.slug === slug);
    if (!g) return;
    const outline = (g.outline || []).filter(isPresent);
    const related = (g.related || []).map(s => toolBySlug[s]).filter(Boolean);
    openPanel({
      crumb: isPresent(g.category) ? `Guide · ${g.category}` : 'Guide',
      content: [
        h('span', { class: 'sample-badge' }, icon('i-info'), 'Sample preview · Not yet published'),
        h('h2', { id: 'panelTitle', style: { 'margin-top': '16px' } }, g.title),
        when(g.description, v => h('p', { class: 'panel-lede' }, v)),
        section('Planned outline', when(outline, list => h('ol', { class: 'outline' }, list.map(item => h('li', {}, item))))),
        section('Tools mentioned', when(related, list => h('ul', { class: 'mini-grid', style: { 'list-style': 'none' } }, list.map(t => h('li', {},
          h('button', { type: 'button', class: 'mini-item', onclick: () => openTool(t.slug) },
            mark(t, 'mark--sm'),
            h('span', { class: 'grow' }, h('strong', {}, t.name), when(t.category, v => h('span', { class: 'mini-sub' }, v))))
        ))))),
        h('p', { class: 'panel-note' }, 'The full article is still being written. This preview shows the topics it will cover.')
      ]
    });
  }

  /* ------------------------------------------------------------------------
     Static sections — comparisons & guides
     ------------------------------------------------------------------------ */
  function renderComparisons() {
    // Only comparisons whose two tools both exist are shown.
    setChildren($('#compareGrid'), COMPARISONS.filter(c => toolBySlug[c.a] && toolBySlug[c.b]).map(c => {
      const A = toolBySlug[c.a], B = toolBySlug[c.b];
      return h('article', { class: 'card compare-card' },
        h('div', { class: 'compare-top' },
          h('div', { class: 'pair' }, mark(A, 'mark--sm'), h('span', { class: 'vs', 'aria-hidden': 'true' }, 'vs'), mark(B, 'mark--sm')),
          h('span', { class: 'card-arrow' }, icon('i-arrow-ur'))
        ),
        h('h3', {}, h('button', { type: 'button', class: 'card-link', 'aria-haspopup': 'dialog', onclick: () => openComparison(c.slug) }, c.title)),
        when(c.subtitle, v => h('p', {}, v)),
        h('div', { class: 'tool-meta' }, catLabel(c.category), h('span', { class: 'meta-note' }, 'Overview'))
      );
    }));
  }

  const COVERS = {
    ai: `<svg viewBox="0 0 320 190" fill="none" aria-hidden="true">
      <circle cx="160" cy="95" r="62" stroke="#D9D0FB" stroke-width="1.5"/><circle cx="160" cy="95" r="40" stroke="#C8BAF8" stroke-width="1.5" stroke-dasharray="3 5"/>
      <path d="M160 58l8.5 25.5L194 92l-25.5 8.5L160 126l-8.5-25.5L126 92l25.5-8.5z" fill="#6D3FD6"/>
      <path d="M214 50l3.6 10.4L228 64l-10.4 3.6L214 78l-3.6-10.4L200 64l10.4-3.6z" fill="#A78BFA"/>
      <rect x="88" y="120" width="44" height="30" rx="7" fill="#fff" stroke="#DDD3FB"/><rect x="96" y="129" width="22" height="4" rx="2" fill="#C8BAF8"/><rect x="96" y="137" width="14" height="4" rx="2" fill="#E5DDFC"/>
      <circle cx="104" cy="58" r="5" fill="#C8BAF8"/></svg>`,
    system: `<svg viewBox="0 0 320 190" fill="none" aria-hidden="true">
      <rect x="92" y="44" width="62" height="44" rx="9" fill="#fff" stroke="#BFE3CE"/><rect x="166" y="44" width="62" height="44" rx="9" fill="#22804F"/>
      <rect x="92" y="100" width="136" height="46" rx="9" fill="#fff" stroke="#BFE3CE"/>
      <circle cx="112" cy="66" r="8" fill="#BFE3CE"/><rect x="126" y="62" width="18" height="8" rx="4" fill="#DDF0E4"/>
      <rect x="180" y="58" width="34" height="6" rx="3" fill="#fff" opacity=".9"/><rect x="180" y="69" width="22" height="6" rx="3" fill="#fff" opacity=".55"/>
      <rect x="106" y="116" width="54" height="14" rx="7" fill="#22804F"/><rect x="168" y="116" width="46" height="14" rx="7" fill="#fff" stroke="#BFE3CE"/>
      <circle cx="248" cy="58" r="6" fill="#86C9A3"/><circle cx="248" cy="78" r="6" fill="#BFE3CE"/><circle cx="72" cy="122" r="6" fill="#DDF0E4"/></svg>`,
    code: `<svg viewBox="0 0 320 190" fill="none" aria-hidden="true">
      <rect x="82" y="40" width="156" height="110" rx="11" fill="#fff" stroke="#CFD8E8"/>
      <path d="M82 51a11 11 0 0 1 11-11h134a11 11 0 0 1 11 11v9H82z" fill="#F3F6FB"/>
      <circle cx="96" cy="50" r="3" fill="#CFD8E8"/><circle cx="106" cy="50" r="3" fill="#CFD8E8"/><circle cx="116" cy="50" r="3" fill="#CFD8E8"/>
      <path d="M108 84l-10 10 10 10M132 84l10 10-10 10" stroke="#3D5A8C" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="154" y="80" width="62" height="6" rx="3" fill="#3D5A8C" opacity=".85"/><rect x="154" y="92" width="44" height="6" rx="3" fill="#B7C5DE"/><rect x="154" y="104" width="54" height="6" rx="3" fill="#DCE3EF"/>
      <rect x="98" y="124" width="74" height="6" rx="3" fill="#DCE3EF"/>
      <path d="M236 128l2.6 7.4L246 138l-7.4 2.6L236 148l-2.6-7.4L226 138l7.4-2.6z" fill="#6D7FB0"/></svg>`
  };
  const COVER_BG = { ai: '#F3F0FE', system: '#EEF7F1', code: '#EFF3F9' };

  function renderGuides() {
    setChildren($('#guideGrid'), GUIDES.map(g => {
      const cover = h('div', { class: 'guide-cover', style: { '--cover-bg': COVER_BG[g.cover] } });
      cover.innerHTML = COVERS[g.cover] || ''; // static, trusted markup defined above
      return h('article', { class: 'card guide-card' },
        cover,
        h('div', { class: 'guide-body' },
          h('div', { class: 'guide-text' },
            when(g.category, v => h('span', { class: 'eyebrow-label', style: { '--label': g.label } }, v)),
            h('h3', {}, h('button', { type: 'button', class: 'card-link', 'aria-haspopup': 'dialog', onclick: () => openGuide(g.slug) }, g.title)),
            when(g.description, v => h('p', {}, v))
          ),
          h('div', { class: 'tool-meta' }, h('span', { class: 'meta-note' }, 'Sample preview'), h('span', { class: 'card-arrow' }, icon('i-arrow-ur')))
        )
      );
    }));
  }

  /* ------------------------------------------------------------------------
     UI chrome — header, menu, shortcuts, toast, scroll-spy
     ------------------------------------------------------------------------ */
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || '');
  document.querySelectorAll('[data-shortcut]').forEach(k => { k.textContent = isMac ? '⌘ K' : 'Ctrl K'; });

  function focusSearch() {
    closeMenu();
    const reduced = prefersReducedMotion();
    els.input.focus({ preventScroll: true });
    els.input.select();
    els.form.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  }

  function openMenu() {
    els.mobileNav.classList.add('is-open');
    els.menuBtn.setAttribute('aria-expanded', 'true');
    els.menuBtn.setAttribute('aria-label', 'Close menu');
  }
  function closeMenu(returnFocus = false) {
    if (!els.mobileNav.classList.contains('is-open')) return;
    els.mobileNav.classList.remove('is-open');
    els.menuBtn.setAttribute('aria-expanded', 'false');
    els.menuBtn.setAttribute('aria-label', 'Open menu');
    if (returnFocus) els.menuBtn.focus();
  }

  let toastTimer;
  function toast(message) {
    els.toastText.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 3200);
  }

  function initScrollSpy() {
    const links = [...document.querySelectorAll('.nav-links a[data-spy]')];
    const ids = ['tools', 'comparisons', 'guides'];
    const sections = ids.map(id => document.getElementById(id));
    const onScroll = () => {
      els.header.classList.toggle('is-scrolled', window.scrollY > 8);
      const y = window.scrollY + window.innerHeight * 0.35;
      let current = null;
      sections.forEach(s => { if (s.offsetTop <= y) current = s.id; });
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = 'guides';
      links.forEach(a => {
        if (a.dataset.spy === current) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    };
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { onScroll(); ticking = false; });
    }, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------------
     Events
     ------------------------------------------------------------------------ */
  els.chips.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) setCategory(chip.dataset.category);
  });

  // Arrow-key navigation between chips (roving within the group)
  els.chips.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const chips = [...els.chips.querySelectorAll('.chip')];
    const i = chips.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? chips.length - 1
      : (i + (e.key === 'ArrowRight' ? 1 : -1) + chips.length) % chips.length;
    chips[next].focus();
    chips[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  els.input.addEventListener('input', () => { state.query = els.input.value.trim(); render({ animate: false }); });
  els.input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (els.input.value) setQuery('');
      else els.input.blur();
    }
  });
  els.form.addEventListener('submit', e => { e.preventDefault(); scrollToResults(); });
  els.clear.addEventListener('click', () => { setQuery(''); els.input.focus(); });

  els.sort.addEventListener('change', () => { state.sort = els.sort.value; render(); });

  els.more.addEventListener('click', () => {
    const total = getResults().length;
    const collapsing = state.limit >= total;
    const firstNew = state.limit;
    state.limit = collapsing ? PAGE_SIZE : state.limit + MORE_STEP;
    render({ animate: !collapsing });
    if (collapsing) {
      const top = els.grid.getBoundingClientRect().top;
      if (top < 0) els.grid.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } else {
      const first = els.grid.children[firstNew]?.querySelector('.card-link');
      if (first) first.focus({ preventScroll: true });
    }
  });

  $('#searchTrigger').addEventListener('click', focusSearch);
  $('#searchTriggerMobile').addEventListener('click', focusSearch);

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (els.panel.open) closePanel();
      focusSearch();
    }
    if (e.key === 'Escape' && els.mobileNav.classList.contains('is-open')) closeMenu(true);
  });

  els.menuBtn.addEventListener('click', () => {
    els.mobileNav.classList.contains('is-open') ? closeMenu() : openMenu();
  });
  els.mobileNav.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('click', e => {
    if (!els.mobileNav.classList.contains('is-open')) return;
    if (!e.target.closest('#mobileNav') && !e.target.closest('#menuToggle')) closeMenu();
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', ev => { if (ev.matches) closeMenu(); });

  $('#panelClose').addEventListener('click', closePanel);
  els.panel.addEventListener('click', e => { if (e.target === els.panel) closePanel(); });
  els.panel.addEventListener('close', () => document.documentElement.classList.remove('is-locked'));

  document.querySelectorAll('[data-soon]').forEach(btn => btn.addEventListener('click', () => toast(btn.dataset.soon)));
  document.querySelectorAll('[data-reset]').forEach(a => a.addEventListener('click', () => resetFilters()));

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  $('#year').textContent = new Date().getFullYear();
  renderComparisons();
  renderGuides();
  render();
  initScrollSpy();
})();
