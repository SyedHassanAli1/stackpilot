/* StackPilot — homepage behaviour
   Search, category filters, sorting, show more, mobile menu, keyboard
   shortcuts and scroll-spy. Data comes from js/data.js; shared helpers and
   the tool/comparison/guide popups come from js/panel.js. */

(() => {
  'use strict';


  const { CATEGORIES, TOOLS, COMPARISONS, GUIDES } = window.StackPilot;
  // Shared helpers and popups from js/panel.js.
  const {
    $, h, icon, isPresent, setChildren, when, mark, priceTag, catLabel, plural,
    toolBySlug, COMPARE_PAGES, openTool, openComparison, openGuide, closePanel
  } = window.StackPilotUI;

  const PAGE_SIZE = 6;
  const MORE_STEP = 12;


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
    catLink: $('#categoryLink'),
    browseAll: $('#browseAll'),
    sort: $('#sortSelect'),
    form: $('#searchForm'),
    input: $('#searchInput'),
    clear: $('#searchClear'),
    help: $('#searchHelp'),
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

    // Links out to the full listing pages: the selected category's page, and All Tools.
    const cat = CATEGORIES.find(c => c.id === state.category);
    els.catLink.hidden = !cat?.slug;
    if (cat?.slug) {
      els.catLink.href = `/categories/${cat.slug}/`;
      els.catLink.firstElementChild.textContent = `View all ${cat.label} tools`;
    }
    els.browseAll.firstChild.textContent = `Browse all ${TOOLS.length} tools `;

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
        h('div', { class: 'tool-meta' }, catLabel(c.category), h('span', { class: 'meta-note' }, COMPARE_PAGES.has(c.slug) ? 'Full comparison' : 'Overview'))
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
      closePanel();
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

  /* Deep links from other pages:
       /#tool-<slug>     opens that tool's panel
       /#compare-<slug>  opens that comparison
       /#search          focuses the search box
     Unknown hashes are ignored, so normal section anchors (#tools) still work. */
  function openFromHash() {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash === 'search') { closePanel(); focusSearch(); return; }
    if (hash.startsWith('tool-') && toolBySlug[hash.slice(5)]) openTool(hash.slice(5));
    else if (hash.startsWith('compare-') && COMPARISONS.some(c => c.slug === hash.slice(8))) openComparison(hash.slice(8));
    else return;
    // Clear the hash so closing the panel and reloading doesn't reopen it.
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
})();
