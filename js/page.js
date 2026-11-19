/* StackPilot — shared behaviour for generated pages (tool pages etc.)
   Header border on scroll, mobile menu, search shortcut and "coming soon" notices.
   The homepage uses js/app.js instead. */

(() => {
  'use strict';
  const $ = sel => document.querySelector(sel);
  const header = $('#siteHeader');
  const menuBtn = $('#menuToggle');
  const mobileNav = $('#mobileNav');
  const toastEl = $('#toast');
  const toastText = $('#toastText');

  // Keyboard shortcut label: ⌘ K on Apple devices, Ctrl K elsewhere.
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || '');
  document.querySelectorAll('[data-shortcut]').forEach(k => { k.textContent = isMac ? '⌘ K' : 'Ctrl K'; });

  // Search lives on the homepage: go there and focus it.
  const goToSearch = () => { window.location.href = '/#search'; };
  ['#searchTrigger', '#searchTriggerMobile'].forEach(sel => $(sel)?.addEventListener('click', goToSearch));
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); goToSearch(); }
    if (e.key === 'Escape' && mobileNav?.classList.contains('is-open')) closeMenu(true);
  });

  // Mobile menu
  function openMenu() {
    mobileNav.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.setAttribute('aria-label', 'Close menu');
  }
  function closeMenu(returnFocus = false) {
    if (!mobileNav?.classList.contains('is-open')) return;
    mobileNav.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'Open menu');
    if (returnFocus) menuBtn.focus();
  }
  menuBtn?.addEventListener('click', () => (mobileNav.classList.contains('is-open') ? closeMenu() : openMenu()));
  mobileNav?.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('click', e => {
    if (mobileNav?.classList.contains('is-open') && !e.target.closest('#mobileNav') && !e.target.closest('#menuToggle')) closeMenu();
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', ev => { if (ev.matches) closeMenu(); });

  // Header border once the page scrolls
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // "Coming soon" notices for footer items without pages yet
  let toastTimer;
  document.querySelectorAll('[data-soon]').forEach(btn => btn.addEventListener('click', () => {
    if (!toastEl || !toastText) return;
    toastText.textContent = btn.dataset.soon;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 3200);
  }));

  // Compare buttons and alternatives without their own page open the shared
  // popup right here instead of leaving the page. If js/panel.js didn't load,
  // the click falls through to the normal link (the homepage panel).
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-open-compare], [data-open-tool]');
    const ui = window.StackPilotUI;
    if (!link || !ui || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (link.dataset.openCompare) ui.openComparison(link.dataset.openCompare);
    else ui.openTool(link.dataset.openTool);
  });

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
