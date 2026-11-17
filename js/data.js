/* StackPilot — content data
   Single source of truth for tools, categories, comparisons and guides.
   Loaded before js/app.js; exposes everything on window.StackPilot. */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     Data — single source of truth. Descriptions are independently written;
     pricing reflects each vendor's general model (Free / Freemium / Paid),
     not specific prices.
     ------------------------------------------------------------------------ */
  const CATEGORIES = [
    { id: 'All',          label: 'All Tools',    color: '#A1A1AA' },
    { id: 'AI Tools',     label: 'AI Tools',     color: '#7C3AED' },
    { id: 'Design',       label: 'Design',       color: '#4F46E5' },
    { id: 'Development',  label: 'Development',  color: '#0E9384' },
    { id: 'Productivity', label: 'Productivity', color: '#DC6803' },
    { id: 'Marketing',    label: 'Marketing',    color: '#DD2590' }
  ];

  const TOOLS = [
    { slug: 'figma', name: 'Figma', category: 'Design', pricing: 'Freemium', mark: 'F', bg: '#F2F0FF', fg: '#4F46E5',
      description: 'Collaborative interface design and prototyping in the browser.',
      about: 'Figma is a browser-based design tool for interfaces, with real-time multiplayer editing, interactive prototyping, shared component libraries and Dev Mode for developer handoff. Desktop apps are also available.',
      tags: ['UI design', 'Prototyping', 'Design systems', 'Collaboration'], url: 'https://www.figma.com/' },
    { slug: 'framer', name: 'Framer', category: 'Design', pricing: 'Freemium', mark: 'F', bg: '#EDF2FC', fg: '#374C9B',
      description: 'Design and publish interactive, responsive websites.',
      about: 'Framer is a website builder with a design-tool canvas. You lay out pages visually, add animations and a built-in CMS, and publish to Framer hosting without writing code.',
      tags: ['Websites', 'No-code', 'Animation', 'Hosting'], url: 'https://www.framer.com/' },
    { slug: 'cursor', name: 'Cursor', category: 'Development', pricing: 'Freemium', mark: '⌘', bg: '#F4F4F5', fg: '#18181B',
      description: 'AI-first code editor for writing, editing and understanding code.',
      about: 'Cursor is a code editor built on the VS Code codebase, adding AI chat, multi-line autocomplete and agent features that can read and edit across a project. Most VS Code extensions and settings carry over.',
      tags: ['Code editor', 'AI coding', 'Refactoring'], url: 'https://cursor.com/' },
    { slug: 'notion', name: 'Notion', category: 'Productivity', pricing: 'Freemium', mark: 'N', bg: '#FFFFFF', fg: '#18181B', line: '#E4E4E7',
      description: 'Connected workspace for docs, wikis, projects and notes.',
      about: 'Notion combines documents, wikis and flexible databases in one workspace, so teams can write, plan projects and organise knowledge in the same place, with real-time collaboration.',
      tags: ['Docs', 'Wikis', 'Databases', 'Project planning'], url: 'https://www.notion.so/' },
    { slug: 'claude', name: 'Claude', category: 'AI Tools', pricing: 'Freemium', mark: '✳', bg: '#FBEFE9', fg: '#B4583A',
      description: 'AI assistant for writing, analysis, research and coding.',
      about: 'Claude is an AI assistant made by Anthropic. It helps with writing, summarising long documents, analysis, research and programming, and is available on the web, desktop and mobile apps and through an API.',
      tags: ['AI assistant', 'Writing', 'Analysis', 'Coding'], url: 'https://claude.ai/' },
    { slug: 'ahrefs', name: 'Ahrefs', category: 'Marketing', pricing: 'Paid', mark: 'A', bg: '#E9EEFC', fg: '#3355BF',
      description: 'SEO toolkit for keyword research, backlinks and site audits.',
      about: 'Ahrefs is an SEO platform covering backlink analysis, keyword research, competitor research, rank tracking and technical site audits.',
      tags: ['SEO', 'Keyword research', 'Backlinks', 'Site audits'], url: 'https://ahrefs.com/' },
    { slug: 'penpot', name: 'Penpot', category: 'Design', pricing: 'Freemium', mark: 'P', bg: '#ECF8EE', fg: '#22804F',
      description: 'Open-source design and prototyping platform.',
      about: 'Penpot is an open-source design and prototyping tool that runs in the browser and can be self-hosted. It is built on open standards such as SVG, and its layouts map to CSS Flexbox and Grid.',
      tags: ['Open source', 'UI design', 'Self-hosting', 'Prototyping'], url: 'https://penpot.app/' },
    { slug: 'webflow', name: 'Webflow', category: 'Design', pricing: 'Freemium', mark: 'W', bg: '#EAF4FF', fg: '#1A68DC',
      description: 'Visual website development with CMS and hosting.',
      about: 'Webflow is a visual web development platform. It gives precise control over HTML and CSS layout through a visual interface, with a built-in CMS, interactions and managed hosting.',
      tags: ['Websites', 'CMS', 'Visual development', 'Hosting'], url: 'https://webflow.com/' },
    { slug: 'vercel', name: 'Vercel', category: 'Development', pricing: 'Freemium', mark: '▲', bg: '#F4F4F5', fg: '#18181B',
      description: 'Deploy and scale modern web applications.',
      about: 'Vercel is a cloud platform for deploying frontend frameworks and web apps, with Git-based deploys, preview URLs for every branch, serverless functions and a global edge network. Vercel also maintains Next.js.',
      tags: ['Hosting', 'Deployment', 'Serverless', 'Next.js'], url: 'https://vercel.com/' },
    { slug: 'linear', name: 'Linear', category: 'Productivity', pricing: 'Freemium', mark: 'L', bg: '#F0F1FF', fg: '#5B59AD',
      description: 'Issue tracking and product planning for software teams.',
      about: 'Linear is an issue tracker and project planning tool for product and engineering teams, with cycles, roadmaps, keyboard-first navigation and integrations with GitHub and Slack.',
      tags: ['Issue tracking', 'Roadmaps', 'Product planning'], url: 'https://linear.app/' },
    { slug: 'make', name: 'Make', category: 'Productivity', pricing: 'Freemium', mark: 'M', bg: '#F0EAFF', fg: '#7C3AED',
      description: 'Visual automation for apps and workflows.',
      about: 'Make (formerly Integromat) is a visual automation platform. You connect apps and build multi-step workflows on a drag-and-drop canvas, with routing, filters and data transformation.',
      tags: ['Automation', 'Integrations', 'No-code'], url: 'https://www.make.com/' },
    { slug: 'perplexity', name: 'Perplexity', category: 'AI Tools', pricing: 'Freemium', mark: 'P', bg: '#E7F5F3', fg: '#147C78',
      description: 'AI-powered answer engine with cited sources.',
      about: 'Perplexity is an AI answer engine. It searches the web, writes an answer and cites the sources it used, and supports follow-up questions for research.',
      tags: ['Search', 'Research', 'Citations'], url: 'https://www.perplexity.ai/' },
    { slug: 'github-copilot', name: 'GitHub Copilot', category: 'Development', pricing: 'Freemium', mark: 'GC', bg: '#F4F4F5', fg: '#24292F',
      description: 'AI pair programmer that works inside your existing editor.',
      about: 'GitHub Copilot is an AI coding assistant from GitHub. It runs as an extension in VS Code, Visual Studio, JetBrains IDEs and other editors, offering completions, chat and agent features tied into GitHub.',
      tags: ['AI coding', 'IDE extension', 'Code completion'], url: 'https://github.com/features/copilot' },
    { slug: 'obsidian', name: 'Obsidian', category: 'Productivity', pricing: 'Freemium', mark: 'O', bg: '#F3EEFF', fg: '#6D3FD6',
      description: 'Private, local-first notes in plain Markdown files.',
      about: 'Obsidian is a note-taking app that stores your notes as plain Markdown files on your own device. It offers linked notes, a graph view and a large community plugin ecosystem; Sync and Publish are optional paid add-ons.',
      tags: ['Notes', 'Markdown', 'Local-first', 'Knowledge base'], url: 'https://obsidian.md/' },
    { slug: 'supabase', name: 'Supabase', category: 'Development', pricing: 'Freemium', mark: 'S', bg: '#EAF7F0', fg: '#1F8A52',
      description: 'Open-source Postgres backend with auth and storage.',
      about: 'Supabase is an open-source backend platform built on Postgres. It provides a database, authentication, file storage, realtime subscriptions and edge functions, available hosted or self-hosted.',
      tags: ['Database', 'Postgres', 'Auth', 'Backend'], url: 'https://supabase.com/' },
    { slug: 'chatgpt', name: 'ChatGPT', category: 'AI Tools', pricing: 'Freemium', mark: 'C', bg: '#EAF5F1', fg: '#10735A',
      description: 'Conversational AI assistant for everyday tasks.',
      about: 'ChatGPT is OpenAI’s conversational AI assistant for writing, brainstorming, research, analysis and coding, available on the web and in desktop and mobile apps.',
      tags: ['AI assistant', 'Writing', 'Brainstorming'], url: 'https://chatgpt.com/' },
    { slug: 'semrush', name: 'Semrush', category: 'Marketing', pricing: 'Freemium', mark: 'S', bg: '#FFF0EA', fg: '#D4471B',
      description: 'Online visibility platform for SEO, content and ads research.',
      about: 'Semrush is a marketing platform for SEO, content marketing, competitor research and paid search analysis. A free account gives limited access; full features need a subscription.',
      tags: ['SEO', 'Competitor research', 'Content marketing', 'PPC'], url: 'https://www.semrush.com/' },
    { slug: 'mailchimp', name: 'Mailchimp', category: 'Marketing', pricing: 'Freemium', mark: 'M', bg: '#FFF8E1', fg: '#946200',
      description: 'Email marketing, automation and audience management.',
      about: 'Mailchimp is an email marketing platform for building campaigns, managing audiences, setting up automated journeys and tracking performance.',
      tags: ['Email marketing', 'Automation', 'Newsletters'], url: 'https://mailchimp.com/' }
  ];

  const COMPARISONS = [
    { slug: 'figma-vs-penpot', a: 'figma', b: 'penpot', category: 'Design', title: 'Figma vs Penpot',
      subtitle: 'Interface design & collaboration',
      fitA: 'Your team wants the most widely adopted tool, a large plugin and community ecosystem, and built-in developer handoff.',
      fitB: 'You value open source, want to self-host for data control, or prefer design layouts that map directly to CSS.',
      differences: [
        'Figma is proprietary SaaS; Penpot is open source and can be self-hosted.',
        'Penpot is built on open standards (SVG, CSS Flexbox and Grid layouts).',
        'Both run in the browser and support real-time collaboration and prototyping.'
      ] },
    { slug: 'framer-vs-webflow', a: 'framer', b: 'webflow', category: 'Design', title: 'Framer vs Webflow',
      subtitle: 'Visual website builders',
      fitA: 'You think like a designer and want to go from canvas to a polished, animated marketing site quickly.',
      fitB: 'You want granular control over HTML/CSS structure and a mature CMS for content-heavy sites.',
      differences: [
        'Framer works like a design tool canvas; Webflow exposes the underlying web box model.',
        'Both include a CMS, hosting and visual interactions.',
        'Webflow’s controls reflect HTML/CSS concepts, which suits people who know web fundamentals.'
      ] },
    { slug: 'cursor-vs-github-copilot', a: 'cursor', b: 'github-copilot', category: 'Development', title: 'Cursor vs GitHub Copilot',
      subtitle: 'AI-powered development tools',
      fitA: 'You’re happy to switch to a dedicated AI-first editor built around project-wide AI editing.',
      fitB: 'You want AI assistance inside the editor you already use, with tight GitHub integration.',
      differences: [
        'Cursor is a standalone editor (built on VS Code); Copilot is an extension for existing editors.',
        'Copilot works across VS Code, Visual Studio, JetBrains IDEs and more.',
        'Both offer completions, chat and agent-style multi-file edits.'
      ] },
    { slug: 'notion-vs-obsidian', a: 'notion', b: 'obsidian', category: 'Productivity', title: 'Notion vs Obsidian',
      subtitle: 'Notes & knowledge management',
      fitA: 'You need a shared team workspace with databases, real-time collaboration and project tracking.',
      fitB: 'You want private, offline-first notes stored as Markdown files you fully own.',
      differences: [
        'Notion is cloud-based; Obsidian stores notes as local Markdown files.',
        'Notion is built for team collaboration; Obsidian is primarily personal.',
        'Obsidian is extended through community plugins; Notion through databases and integrations.'
      ] }
  ];

  const GUIDES = [
    { slug: 'best-ai-tools-for-designers-2026', category: 'AI Tools', label: '#6D3FD6', cover: 'ai',
      title: 'Best AI tools for designers in 2026',
      description: 'The AI tools that genuinely support modern creative workflows — and where they fit.',
      outline: ['Where AI helps in a design workflow — and where it doesn’t', 'Research and ideation assistants', 'AI inside design tools', 'From design to code', 'How to evaluate a new AI tool'],
      related: ['claude', 'figma', 'framer', 'perplexity'] },
    { slug: 'how-to-build-a-scalable-design-system', category: 'Design', label: '#22804F', cover: 'system',
      title: 'How to build a scalable design system',
      description: 'A practical approach to tokens, components and keeping product UI consistent.',
      outline: ['Start with design tokens', 'Building a component library', 'Documentation people actually read', 'Keeping design and code in sync', 'Governance as the system grows'],
      related: ['figma', 'penpot', 'notion'] },
    { slug: 'choosing-the-right-ai-coding-assistant', category: 'Development', label: '#3D5A8C', cover: 'code',
      title: 'Choosing the right AI coding assistant',
      description: 'Understand capabilities and trade-offs before committing your team to one.',
      outline: ['Editor vs extension: two approaches', 'Completions, chat and agents', 'Privacy and codebase context', 'Rolling out to a team'],
      related: ['cursor', 'github-copilot', 'claude'] }
  ];

  /* ------------------------------------------------------------------------
     Official logos — optional.
     Naming convention: logos/<tool-slug>.svg
       Figma → logos/figma.svg · GitHub Copilot → logos/github-copilot.svg
     To add one: save the SVG under that name, then add the slug below.
     Tools not listed keep their letter tile. Source logos from each
     vendor's official brand/press page and follow their usage guidelines.
     ------------------------------------------------------------------------ */
  const TOOLS_WITH_LOGO = ['figma'];
  const LOGOS = Object.fromEntries(TOOLS_WITH_LOGO.map(slug => [slug, `logos/${slug}.svg`]));

  window.StackPilot = Object.freeze({ CATEGORIES, TOOLS, COMPARISONS, GUIDES, LOGOS });
})();
