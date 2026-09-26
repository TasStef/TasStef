# Portfolio

Personal portfolio site. Astro, static output, deployed to GitHub Pages.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build      # -> dist/
npx serve dist     # check it works as flat files, which is what Pages serves
```

## Editing content

No component changes needed for any of this.

| What | Where |
|---|---|
| Name, pitch, intro, social links | `src/data/profile.ts` |
| Tech stack groups | `src/data/skills.ts` |
| Work history | `src/data/experience/*.yaml`, one file per role |
| Projects | `src/content/projects/*.md`, one file per project |

Projects and experience are schema-validated at build time, so a malformed
entry fails the build instead of rendering broken.

### Adding a project

Create `src/content/projects/my-thing.md`:

```markdown
---
title: My Thing
blurb: One sentence, under 180 characters.
tech: ['TypeScript', 'Postgres']
repo: https://github.com/user/my-thing
live: https://example.com
status: live   # live | wip | archived
featured: true
order: 1
---

Longer write-up goes here.
```

`repo` and `live` are both optional; the card handles their absence.

## Design

All colour, type, spacing and motion values live in `src/styles/tokens.css`.
That is the single file to edit to change the look.

One thing to know: the lime accent is defined **twice**, once for dark mode
and once (darkened) for light mode. Bright lime fails contrast on white, so
the two schemes cannot share a value.

## Before first deploy

1. Set `SITE` and `BASE` in `astro.config.mjs`.
2. Replace the `YOUR-USERNAME` placeholders in `src/data/profile.ts` and
   `public/robots.txt`.
3. Push to `main`.
4. Repo Settings → Pages → Source: **GitHub Actions**.
