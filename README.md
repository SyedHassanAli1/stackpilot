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
│   └── app.js          # Search, filters, sort, detail panels, menu, shortcuts
├── logos/              # Official tool logos, named <tool-slug>.svg
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

## Logos

Logo files follow one naming rule: `logos/<tool-slug>.svg`, for example
`logos/figma.svg` or `logos/github-copilot.svg`. Tools without a logo show a
letter tile. Use logos from each vendor's official brand or press page and
follow their usage guidelines.

## Deploy

The site deploys to Netlify from the repository root. There is no build command.
