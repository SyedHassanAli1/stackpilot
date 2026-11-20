# StackPilot

A curated directory of AI, design, development, productivity and marketing tools.

> **StackPilot** is a working name only. It is not a finalised or registered brand.

Plain HTML, CSS and vanilla JavaScript. No framework, no build step.

## Project structure

```
.
├── index.html          # Homepage (7 sections)
├── css/
│   └── styles.css      # All styles; design tokens in :root
├── js/
│   ├── data.js         # Tools, categories, comparisons, guides (single source of truth)
│   ├── app.js          # Homepage: search, filters, sort, detail panels, menu, shortcuts
│   ├── page.js         # Header behaviour on generated pages
│   └── pages.js        # Generated list of tools that have a page
├── logos/              # Official tool logos, named <tool-slug>.svg
├── tests/
│   ├── validate-data.mjs  # Checks every record in js/data.js (Node, no dependencies)
│   └── render-check.html  # Opens every card and panel; fails on raw/empty values
├── content/tools/      # Full page content per tool: <tool-slug>.json
├── content/categories.json  # Intro and SEO text for each category page
├── scripts/build.mjs   # Builds the tool, All Tools and category pages from data + content
├── tools/              # Generated tool pages and the All Tools page (don't edit by hand)
├── categories/         # Generated category pages (don't edit by hand)
├── netlify.toml        # Netlify deploy config
└── README.md
```

## Run locally

Open `index.html` in a browser. Or, for a local server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Editing content

All content lives in `js/data.js`:

- **Add a tool**: add an entry to `TOOLS` with a unique `slug`.
- **Add a comparison**: add an entry to `COMPARISONS` referencing two tool slugs.
- **Add a guide**: add an entry to `GUIDES`.

## Testing

Run both checks before pushing changes to tools, comparisons or guides:

```bash
node tests/validate-data.mjs          # data: required fields, valid links, prices, dates, references
python3 -m http.server 8000           # then open http://localhost:8000/tests/render-check.html
```

`validate-data.mjs` exits with an error and lists each problem if a record is incomplete or
inconsistent. `render-check.html` opens every tool card, tool panel, comparison and guide and
fails if any shows `null`, `undefined`, `NaN`, `[object Object]`, `Invalid Date`, an empty element
or a link without a destination. Test pages are not served on the live site.

## Tool pages

Each tool with a content file gets its own page at `/tools/<slug>/`.

1. Add `content/tools/<slug>.json` (see `content/tools/figma.json` for the format).
2. Run `node scripts/build.mjs`.
3. Open `http://localhost:8000/tools/<slug>/` with a local server running.

Netlify runs the build on every deploy, so pages always match the data. The header, footer and
icons are copied from `index.html`, so edit them there. Pages use root-relative links (`/css/...`),
so open them through a local server rather than by double-clicking the file.

## All Tools and category pages

The build also writes:

- `/tools/`: every tool, grouped by category, with a filter box.
- `/categories/`: one card per category.
- `/categories/<slug>/`: the tools in that category, grouped by subcategory, plus its comparisons.

Tools and categories come from `js/data.js`; each category's `slug` there sets its URL
(`/categories/<slug>/`). Its intro, page title and meta description come from
`content/categories.json`.

Visitors reach these pages from the header: "Categories" opens a dropdown on desktop and lists
the categories in the mobile menu. The homepage links to the selected category's page and to
All Tools. The header links are written by hand in `index.html`, so a new category needs:

1. an entry in `CATEGORIES` in `js/data.js`, with a `slug`;
2. an entry in `content/categories.json`;
3. a link in the header dropdown and the mobile menu in `index.html`.

If any of these is missing, the build stops with an error.

In the mobile menu, a chevron (›) marks links that open a page of their own. It comes from the
`data-page` attribute, so when a page such as `/comparisons/` exists, change that link's `href`
and add `data-page` to show its chevron.

Categories in the mobile menu is a section that expands and collapses: the word "Categories" opens
`/categories/`, and the arrow button beside it shows or hides the category list (collapsed by
default; the arrow points down when collapsed and up when expanded). Another section can use the
same markup: a `.mobile-group` row with a `.mobile-group-toggle` button whose `aria-controls`
names a `.mobile-collapse` panel.

## Logos

Logo files follow one naming rule: `logos/<tool-slug>.svg`, for example
`logos/figma.svg` or `logos/github-copilot.svg`. Tools without a logo show a
letter tile. Use logos from each vendor's official brand or press page and
follow their usage guidelines.

## Deploy

The site deploys to Netlify from the repository root. The build command (`node scripts/build.mjs`) needs
only Node — no packages to install.
