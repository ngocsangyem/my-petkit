# MyPetKit docs

The documentation site, built with [Fumadocs](https://fumadocs.dev) on Next.js and exported as static files.

Node 22 or newer, and pnpm.

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm build    # static site in out/
pnpm lint
pnpm types:check
```

Pages are MDX in `content/docs/`; each folder's `meta.json` sets the sidebar order. The site is English at `/` and `/docs`, Vietnamese at `/vi` and `/vi/docs`: a page's Vietnamese copy is `page.vi.mdx` beside it, a folder's is `meta.vi.json`, and a page without one falls back to English. Landing copy lives in `lib/i18n-dictionaries/{en,vi}.ts`. Translated headings keep the English anchor with `## Tiêu đề [#english-id]`. The theme lives in `app/global.css` and follows `docs/design/DESIGN.md`. Writing rules are on the site itself, under Contributing → This docs site.
