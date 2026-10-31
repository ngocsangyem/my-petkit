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

Pages are MDX in `content/docs/`; each folder's `meta.json` sets the sidebar order. The theme lives in `app/global.css` and follows `docs/design/DESIGN.md`. Writing rules are on the site itself, under Contributing → This docs site.
