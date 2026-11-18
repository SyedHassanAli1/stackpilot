#!/usr/bin/env node
/* StackPilot — data validation (no dependencies)
   Checks every tool, comparison and guide in js/data.js for missing,
   invalid or inconsistent fields before they reach the page.

   Run:  node tests/validate-data.mjs
   Exit code 0 = all good, 1 = problems found. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(root, 'js/data.js'), 'utf8'), sandbox);
const { CATEGORIES, TOOLS, COMPARISONS, GUIDES, LOGOS } = sandbox.window.StackPilot;

const PRICING = ['Free', 'Freemium', 'Paid', 'Open Source', 'Custom'];
const CATEGORY_IDS = CATEGORIES.map(c => c.id).filter(id => id !== 'All');
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-f]{6}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RAW = /\b(null|undefined|NaN)\b|\[object Object\]/;

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const isText = v => typeof v === 'string' && v.trim() !== '';
const checkText = (where, field, v, { optional = false } = {}) => {
  if (v === null || v === undefined) { if (!optional) fail(where, `missing "${field}"`); return; }
  if (!isText(v)) return fail(where, `"${field}" must be non-empty text`);
  if (RAW.test(v)) fail(where, `"${field}" contains a raw value: ${v}`);
};

/* Tools ------------------------------------------------------------------ */
const slugs = new Set();
const names = new Set();
for (const [i, t] of TOOLS.entries()) {
  const at = `tool[${i}] ${t.slug || '(no slug)'}`;
  if (!SLUG.test(t.slug || '')) fail(at, 'slug must be lowercase-with-hyphens');
  if (slugs.has(t.slug)) fail(at, 'duplicate slug');
  slugs.add(t.slug);
  if (names.has(t.name)) fail(at, `duplicate name "${t.name}"`);
  names.add(t.name);

  checkText(at, 'name', t.name);
  checkText(at, 'description', t.description);
  checkText(at, 'about', t.about);
  checkText(at, 'subcategory', t.subcategory, { optional: true });
  checkText(at, 'mark', t.mark);
  if (!CATEGORY_IDS.includes(t.category)) fail(at, `unknown category "${t.category}"`);
  if (!PRICING.includes(t.pricing)) fail(at, `pricing must be one of ${PRICING.join(', ')}`);
  if (t.startingPrice !== null && t.startingPrice !== undefined) checkText(at, 'startingPrice', t.startingPrice);
  if (!/^https:\/\/[^\s]+$/.test(t.url || '')) fail(at, 'url must be an https:// link');
  if (!HEX.test(t.bg || '') || !HEX.test(t.fg || '')) fail(at, 'bg and fg must be #RRGGBB colours');
  if (t.line !== undefined && !HEX.test(t.line)) fail(at, 'line must be a #RRGGBB colour');
  if (!Array.isArray(t.tags) || t.tags.length === 0) fail(at, 'tags must be a non-empty list');
  else t.tags.forEach((tag, j) => checkText(at, `tags[${j}]`, tag));
  if (t.verified !== undefined) {
    if (!ISO_DATE.test(t.verified) || Number.isNaN(Date.parse(t.verified))) fail(at, 'verified must be a YYYY-MM-DD date');
  }
  const words = isText(t.description) ? t.description.trim().split(/\s+/).length : 0;
  if (words > 20) fail(at, `description is ${words} words (max 20 for cards)`);
}

/* Comparisons ------------------------------------------------------------ */
const cmpSlugs = new Set();
for (const [i, c] of COMPARISONS.entries()) {
  const at = `comparison[${i}] ${c.slug || '(no slug)'}`;
  if (!SLUG.test(c.slug || '')) fail(at, 'invalid slug');
  if (cmpSlugs.has(c.slug)) fail(at, 'duplicate slug');
  cmpSlugs.add(c.slug);
  if (!slugs.has(c.a)) fail(at, `tool "${c.a}" does not exist`);
  if (!slugs.has(c.b)) fail(at, `tool "${c.b}" does not exist`);
  if (c.a === c.b) fail(at, 'compares a tool with itself');
  ['title', 'subtitle', 'fitA', 'fitB'].forEach(f => checkText(at, f, c[f]));
  if (!CATEGORY_IDS.includes(c.category)) fail(at, `unknown category "${c.category}"`);
  if (!Array.isArray(c.differences) || c.differences.length === 0) fail(at, 'differences must be a non-empty list');
  else c.differences.forEach((d, j) => checkText(at, `differences[${j}]`, d));
}

/* Guides ----------------------------------------------------------------- */
for (const [i, g] of GUIDES.entries()) {
  const at = `guide[${i}] ${g.slug || '(no slug)'}`;
  if (!SLUG.test(g.slug || '')) fail(at, 'invalid slug');
  ['title', 'description', 'category'].forEach(f => checkText(at, f, g[f]));
  if (!Array.isArray(g.outline) || g.outline.length === 0) fail(at, 'outline must be a non-empty list');
  (g.related || []).forEach(s => { if (!slugs.has(s)) fail(at, `related tool "${s}" does not exist`); });
}

/* Logos ------------------------------------------------------------------ */
for (const [slug, path] of Object.entries(LOGOS)) {
  if (!slugs.has(slug)) fail(`logo ${slug}`, 'no tool with this slug');
  if (path !== `logos/${slug}.svg`) fail(`logo ${slug}`, `path should be logos/${slug}.svg`);
  try { readFileSync(join(root, path)); } catch { fail(`logo ${slug}`, `file ${path} not found`); }
}

/* Report ----------------------------------------------------------------- */
const summary = `${TOOLS.length} tools, ${COMPARISONS.length} comparisons, ${GUIDES.length} guides, ${Object.keys(LOGOS).length} logos`;
if (errors.length) {
  console.error(`✗ Data check failed (${summary}) — ${errors.length} problem(s):`);
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`✓ Data check passed: ${summary}.`);
