# Sterling Manufacturing Marketing Site

Standalone one-page marketing site for:
- Sterling Tool & Die
- C & R Machine and Fabrication
- Preferred Kustom Powder

This subproject is intentionally isolated from the main shop app. It has its own `package.json`, build tooling, source files, and runtime entrypoint so it can be developed and deployed independently while still living in the same repository.

## Stack
- Vite
- React
- TypeScript
- Custom CSS (no shared app styles or UI packages)

## Run locally
From the repo root:

```bash
cd sterling-site
npm install
npm run dev
```

Default Vite local URL:
- `http://localhost:5173`

If you want it reachable by direct LAN/dev URL:

```bash
npm run dev -- --host 0.0.0.0 --port 4173
```

## Build

```bash
cd sterling-site
npm run build
```

Production files are emitted to:
- `sterling-site/dist/`

## Preview the production build

```bash
cd sterling-site
npm run preview
```

## Deploy
This project can be deployed independently from the main app because it is a self-contained static frontend.

### Easy options
- Vercel static deployment pointed at `sterling-site`
- Netlify pointed at `sterling-site`
- Any static host that serves the `dist/` directory after `npm run build`
- A subpath deployment inside the main repo's CI/CD later, if desired

### Generic deploy steps
1. Set the project root to `sterling-site`
2. Install dependencies with `npm install`
3. Build with `npm run build`
4. Publish the generated `dist/` directory

## Where to swap media and text
### Content data
Update structured copy and section lists in:
- `src/siteContent.ts`

This includes:
- navigation labels
- capabilities
- differentiators
- supported companies
- materials
- equipment counts
- gallery placeholder metadata
- contact placeholders

### Layout and page structure
Update section markup and page flow in:
- `src/App.tsx`

### Styling, motion, and responsive behavior
Update visuals in:
- `src/styles.css`

This includes:
- sticky nav styling
- animated mesh / ambient background
- reveal animations
- hero visual treatment
- responsive layout rules

### SEO metadata
Update metadata in:
- `index.html`

This includes:
- page title
- description
- keywords
- open graph tags
- theme color

### Stock placeholder imagery
Current placeholder images are external stock URLs defined in:
- `src/siteContent.ts` (gallery)
- `src/styles.css` (hero background image)

To replace them with real shop media later, either:
1. swap the URLs directly, or
2. add files into a future local `public/` folder and point to those paths

## How this can later connect to the main repo without coupling now
Keep the marketing site isolated until you intentionally expose it.

Later options:
- Reverse-proxy `/manufacturing` or another direct path to this built site
- Deploy this folder as its own project/subdomain and link to it from the main app
- Add a single link entry in the main app nav later without sharing layout, auth, or runtime code

Recommended later integration path:
- keep this subproject standalone
- deploy it by direct URL first
- only add a link from the main app once copy, media, and contact endpoints are finalized
