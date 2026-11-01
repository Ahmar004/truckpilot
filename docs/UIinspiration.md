# UI Inspiration - a playbook for a playful, image-led, scroll-animated web UI

This file holds the complete UI system of one production web app: its design tokens, themes, colors, type, background hues, component primitives, illustrations, micro-interactions and seven big scroll scenes. It also records the measured performance and accessibility lessons behind them. Use it to give a new project the same polish.

Names are generic on purpose. Where you see `ent-a`, `ent-b` and `ent-c`, read "the product's three core concepts, characters or tools" (three products being compared, three plans, three steps). Swap in the new project's own words.

---

## 0. How Claude Code should use this file

1. Read sections 1 to 3 before writing any UI. They are the foundation, and every other section depends on them.
2. Copy the token block (section 2) into the new project's global CSS first. Then rename the three entity colors and adjust the hues to the brand. Keep the roles (bg, surface, text, accent, and so on) and the contrast rules.
3. Build the primitives (section 6) before building pages. Pages are made of primitives, not one-off markup.
4. Add the scroll scenes (section 9) only where they serve the content. Each one is a full recipe: markup, CSS, keyframes, timing and pitfalls. Adapt the counts (number of scenes, faces, cards) and keep the mechanics.
5. Treat section 12 (performance) and section 11 (accessibility) as hard rules, not suggestions. The scenes below were measured with Lighthouse at every step, and none of them may make a page slower.
6. Ask the user before you add a dependency. This whole system needs only: Tailwind v4, `class-variance-authority` (cva), Radix primitives, Motion (motion.dev, for data-driven animations only), `next-themes`, `canvas-confetti`, an icon set (Phosphor) wrapped in one file, and `next/font`. There is no smooth-scroll library, no WebGL, no video, no chart library and no animation library for scroll.

Stack this was built on: Next.js App Router (React 19, React Compiler), Tailwind v4, TypeScript. The CSS is plain modern CSS and ports to any stack. The scroll scenes need Chromium's scroll-driven animations (`animation-timeline`), and every one degrades to a plain static layout elsewhere.

---

## 1. Design philosophy (the "why" behind every choice)

- **A landing page, not a dashboard.** Home is a story told while you scroll: hero, what the product is, how it works, real numbers, the catalogue, where to go next, FAQ, closing call to action. Every section has one job.
- **Image-led, not container-led.** Make options bigger and boxes fewer. Lists and navigation are open rows with thin dividers and a round arrow. Boxes (cards with border and shadow) stay only around data: results, scoreboards, forms, settings panels and progress.
- **Huge type, few words.** Headlines are big, heavy and slightly tight. A section is a bracketed eyebrow label, one big heading and one muted sentence. Prefer a picture or a diagram to a paragraph.
- **Full width.** Pages span the whole window with only an edge margin (16 px phones, 24 px tablets, 32 px desktop). There is no centred max-width column. Long text keeps its own readable width (`max-w-xl` on the paragraph, not on the page).
- **Every effect is CSS first.** Scroll effects are CSS scroll-driven animations, so they cost no JavaScript, run on the compositor, and **play backwards when the user scrolls up**. JavaScript is used only where scroll can't do it: a timed trigger, a drag, a physics loop.
- **Motion never hides content.** Text never starts invisible on load (a fade-in delays Largest Contentful Paint). Things rise, wipe, clip, draw and scale into place. Without scroll-timeline support (Firefox today) or under reduced motion, every section sits in place, fully visible.
- **Playful, but calm.** There are soft glowing hues behind the page, gentle idle floats, squash-and-stretch landings and confetti on wins. Nothing loops loudly behind text.
- **Recognition over recall.** Section headings lock under the top bar while their section scrolls, so the user always knows where they are.
- **Honest, strict style bans:** no italics anywhere, no gradient-filled text, no rainbow bars, no emojis. Text is a solid color. A gradient may fill a bar or a button background, never glyphs.
- **Color is never the only signal.** Every colored state also has an icon and a word.
- **Both themes are first-class.** Each theme is designed on its own (warm cream light, deep near-black dark), never auto-inverted.

---

## 2. Design tokens (copy this first)

Tokens are named by **role**, never by value. Components use only tokens: no hex colors, pixel radii or arbitrary values in component code. If a value is missing, add a token.

### 2.1 Color tokens

| Role                                           | Light                       | Dark                        | Use                                                                                   |
| ---------------------------------------------- | --------------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| `--bg` / `--surface` / `--surface-hover`       | #F3E5C8 / #FFFBF3 / #F8EEDB | #0F1216 / #181C22 / #222830 | Page, cards, hovered cards                                                            |
| `--border` / `--border-strong`                 | #E3D1AD / #857A66           | #2C333C / #68737F           | Hairlines; strong borders, outlines and dotted roads (3:1)                            |
| `--text` / `--text-muted` / `--text-faint`     | #1F2328 / #56503F / #655E4C | #E1E8EF / #A5B1BD / #94A0AD | Body; secondary; placeholders only                                                    |
| `--accent` / `--accent-hover` / `--accent-ink` | #A84B06 / #8F3F04 / #FFFFFF | #F0883E / #F59E4A / #0F1216 | Brand: buttons, links, label brackets, focus rings, active tab                        |
| `--highlight` / `--highlight-ink`              | #F2A33A / #1F2328           | #F0883E / #0F1216           | Emphasis fill only, always with its ink                                               |
| `--success` / `--warning` / `--danger`         | #A84B06 / #8A5200 / #B42318 | #F0883E / #DAAA3F / #F78A82 | States (success uses the accent here; use a real green if the brand has no green ban) |
| `--ent-a` / `--ent-b` / `--ent-c`              | #0A706B / #7A3FD1 / #46566A | #39C5BB / #B69CFF / #9FB0C3 | The three core entities: teal, violet, slate                                          |

Why these values:

- **Light theme:** a clearly cream background (not white) with near-white cards. It feels warm and paper-like, and cards lift off it.
- **Dark theme:** a deep near-black inspired by GitHub dark, with cooler, brighter entity colors so they keep contrast on black.
- **Accent:** one warm orange. In light it is darkened to a burnt orange (#A84B06), because the bright orange (#F2A33A) reads at only 1.7:1 on cream. The bright one becomes `--highlight`, a fill. In dark the bright orange reads fine, so accent equals highlight.
- **Entity colors** are each the identity of one concept across the whole site (charts, tags, pictures, big words), always paired with an icon and a label.

### 2.2 Full token CSS (Tailwind v4)

```css
@import 'tailwindcss';

/* Class-based dark mode: next-themes puts `.dark` on <html>. */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
	--font-sans: var(--font-body), ui-sans-serif, system-ui, sans-serif;
	--font-display: var(--font-heading), var(--font-body), ui-sans-serif, system-ui, sans-serif;
	--radius-sm: 6px;
	--radius: 10px;
	--radius-lg: 16px;

	/* One step up from Tailwind's defaults (12/14/16 px): those read too small on dense screens. */
	--text-xs: 0.8125rem;
	--text-sm: 0.9375rem;
	--text-base: 1.0625rem;

	/* One shared ease: a fast start that settles softly ("expo out"). */
	--animate-rise: rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
	--animate-fade-in: fade-in 0.2s ease-out;
	--animate-fade-out: fade-out 0.15s ease-in;
	--animate-pop-in: pop-in 0.18s cubic-bezier(0.22, 1, 0.36, 1);
	--animate-pop-out: pop-out 0.12s ease-in;
	--animate-slide-in-left: slide-in-left 0.32s cubic-bezier(0.22, 1, 0.36, 1);
	--animate-slide-out-left: slide-out-left 0.2s ease-in;
	--animate-slide-in-right: slide-in-right 0.32s cubic-bezier(0.22, 1, 0.36, 1);
	--animate-slide-out-right: slide-out-right 0.2s ease-in;
	--animate-grow-x: grow-x 0.9s cubic-bezier(0.22, 1, 0.36, 1);
	--animate-shimmer: shimmer 1.6s linear infinite;

	/* Rise WITHOUT fade: text at opacity 0 is not painted, so a fade delays LCP. */
	@keyframes rise { from { transform: translateY(14px); } }
	@keyframes fade-in { from { opacity: 0; } }
	@keyframes fade-out { to { opacity: 0; } }
	@keyframes pop-in { from { opacity: 0; transform: scale(0.95) translateY(-4px); } }
	@keyframes pop-out { to { opacity: 0; transform: scale(0.96); } }
	@keyframes slide-in-left { from { transform: translateX(-100%); } }
	@keyframes slide-out-left { to { transform: translateX(-100%); } }
	@keyframes slide-in-right { from { transform: translateX(100%); } }
	@keyframes slide-out-right { to { transform: translateX(100%); } }
	@keyframes grow-x { from { transform: scaleX(0); } }
	@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
}

:root {
	--bg: #f3e5c8;
	--surface: #fffbf3;
	--surface-hover: #f8eedb;
	--border: #e3d1ad;
	--border-strong: #857a66;
	--text: #1f2328;
	--text-muted: #56503f;
	--text-faint: #655e4c;
	--accent: #a84b06;
	--accent-hover: #8f3f04;
	--accent-ink: #ffffff;
	--highlight: #f2a33a;
	--highlight-ink: #1f2328;
	--success: #a84b06;
	--warning: #8a5200;
	--danger: #b42318;
	--ent-a: #0a706b;
	--ent-b: #7a3fd1;
	--ent-c: #46566a;
	/* Shadows tinted with the cream's own brown, so cards lift instead of looking grey. */
	--elev-1: 0 1px 2px rgb(110 80 30 / 0.1), 0 4px 14px -4px rgb(110 80 30 / 0.18);
	--elev-2: 0 2px 4px rgb(110 80 30 / 0.1), 0 16px 32px -10px rgb(110 80 30 / 0.3);
	/* The three decorative hues behind every page. */
	--hue-1: var(--ent-a);
	--hue-2: var(--highlight);
	--hue-3: var(--ent-b);
	--glow-strength: 16%;
	/* The page's side margin; full-bleed scenes cancel it exactly with negative margins. */
	--edge: 1rem;
	/* Locked section strip (section 9.7): sits under the floating header. */
	--lock-top: 4.25rem;
	--lock-h: 3.5rem;
	--lock-line: calc(var(--lock-top) + var(--lock-h));
}
@media (min-width: 40rem) { :root { --edge: 1.5rem; --lock-top: 4.5rem; --lock-h: 3rem; } }
@media (min-width: 64rem) { :root { --edge: 2rem; } }

.dark {
	--bg: #0f1216;
	--surface: #181c22;
	--surface-hover: #222830;
	--border: #2c333c;
	--border-strong: #68737f;
	--text: #e1e8ef;
	--text-muted: #a5b1bd;
	--text-faint: #94a0ad;
	--accent: #f0883e;
	--accent-hover: #f59e4a;
	--accent-ink: #0f1216;
	--highlight: #f0883e;
	--highlight-ink: #0f1216;
	--success: #f0883e;
	--warning: #daaa3f;
	--danger: #f78a82;
	--ent-a: #39c5bb;
	--ent-b: #b69cff;
	--ent-c: #9fb0c3;
	/* Dark shadows: a faint top inner highlight plus deep black drops. */
	--elev-1: inset 0 1px 0 rgb(255 255 255 / 0.04), 0 1px 2px rgb(0 0 0 / 0.5), 0 6px 18px -6px rgb(0 0 0 / 0.7);
	--elev-2: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 2px 4px rgb(0 0 0 / 0.5), 0 18px 36px -10px rgb(0 0 0 / 0.8);
	/* Calmer, cooler hues at lower strength: bright colors glow too loudly on near-black.
	   Warm gold at the bottom stands off dark blue crisply where cyan or green would blur. */
	--hue-1: #2a9d94;
	--hue-2: #4a64b8;
	--hue-3: #ecc56a;
	--glow-strength: 14%;
}

@theme inline {
	--color-bg: var(--bg);
	--color-surface: var(--surface);
	--color-surface-hover: var(--surface-hover);
	--color-border: var(--border);
	--color-border-strong: var(--border-strong);
	--color-text: var(--text);
	--color-text-muted: var(--text-muted);
	--color-text-faint: var(--text-faint);
	--color-accent: var(--accent);
	--color-accent-hover: var(--accent-hover);
	--color-accent-ink: var(--accent-ink);
	--color-highlight: var(--highlight);
	--color-highlight-ink: var(--highlight-ink);
	--color-success: var(--success);
	--color-warning: var(--warning);
	--color-danger: var(--danger);
	--color-ent-a: var(--ent-a);
	--color-ent-b: var(--ent-b);
	--color-ent-c: var(--ent-c);
	--color-hue-1: var(--hue-1);
	--color-hue-2: var(--hue-2);
	--color-hue-3: var(--hue-3);
	--shadow-card: var(--elev-1);
	--shadow-card-hover: var(--elev-2);
}

::selection { background-color: color-mix(in oklab, var(--accent) 30%, transparent); }
summary::-webkit-details-marker { display: none; } /* disclosures draw their own plus icon */
```

### 2.3 Contrast rules (enforced by a unit test)

Write a test that parses the `:root` and `.dark` blocks of the CSS and computes WCAG contrast, so a token change that breaks AA fails CI:

- Every text token (`text`, `text-muted`, `text-faint`, `accent`, `success`, `warning`, `danger`, the entity colors) is at least **4.5:1** on `--bg` and on `--surface`, in each theme.
- `--border-strong` and the entity colors are at least **3:1** (non-text).
- `--accent-ink` on `--accent` and `--highlight-ink` on `--highlight` are at least 4.5:1.
- Optionally assert hue families (for example accent in the orange range of 15-40 degrees), so a rebrand can't drift by accident.

```ts
function luminance(hex: string) {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
	return (hi + 0.05) / (lo + 0.05)
}
```

Also add a **style guard test** that scans every source file and fails on `italic`, `font-style: oblique`, `<em>`, `<i>`, `background-clip: text` or `bg-clip-text`, and on any gradient in the link-preview (Open Graph) image file.

### 2.4 Colors that break on dark (never use them for giant words or big fills)

**What went wrong in the source app.** In dark theme, the first entity's giant word in the arc-flight scene (section 9.1, about 22vw tall) was drawn in `--ent-a` **#39C5BB**, a bright turquoise (OKLCH L 0.75, C 0.12, hue 188). It sat on the **#0F1216** near-black page, with blurred background glows of deep teal **#2A9D94** and warm gold **#ECC56A** drifting behind it at 14-22% strength. The word "exploded": its edges bloomed and a yellowish rim showed around the letters, so it looked broken. It passed the contrast test easily (8.8:1). Contrast proves a color is readable. It says nothing about how the color behaves at 300 px on black.

Why it happens:

- **Halation.** A light, saturated color on near-black glows and smears at its edges, and the bigger the area, the worse it gets. Very high contrast makes it worse, not better. Cyan, teal, green and yellow are the worst, because the eye is most sensitive to them.
- **A different hue behind the edges.** The anti-aliased edge pixels mix the word's color with whatever is behind it. Cyan over a gold-tinted patch (about #373225) mixes into a yellow-green rim. A glow of the same hue (teal behind teal) blurs the edge instead.
- **Fading and scaling.** While the word fades and scales in flight, its edge pixels blend even more with the glow, so the rim grows during the motion.

Rules:

1. **Two strengths per entity color in dark.** The bright color stays for small text, icons and tags, where it reads crisply. Giant words (above about 4rem) and large fills use a calmer `--ent-*-display` token with lower lightness and chroma. As a starting point, aim for OKLCH lightness 0.62-0.70 and chroma at or below 0.10 for cyan, teal and green, and at or below 0.12 for violet and orange. In light theme the display token is the normal entity color.
2. **No neon on dark.** Never use a near-pure cyan, lime, yellow or magenta (OKLCH chroma above about 0.12 at lightness above about 0.70) for any large area, glow or giant word.
3. **Keep the path behind a giant word plain.** Don't let a warm glow (gold, orange) pass behind a cool word (teal, blue), or the reverse. Keep the backdrop glows weak (at most about 14% in dark) wherever giant words fly.
4. **Check by eye, not only by test.** In dark, screenshot each giant word at rest and mid-motion at 100% browser zoom, then zoom the image to 300-400% and look at the letter edges. A rim in any color other than the word's own means the color or the backdrop has to change.
5. **Optional upper-bound test.** Next to the contrast floor (2.3), assert that every `--ent-*-display` token in `.dark` has OKLCH chroma at or below 0.12 and lightness at or below 0.72.

```css
:root {
	--ent-a-display: var(--ent-a);
	--ent-b-display: var(--ent-b);
	--ent-c-display: var(--ent-c);
}
.dark {
	/* Calmer than the small-text colors; untested starting points, confirm with rule 4. */
	--ent-a-display: #3ba89f; /* OKLCH 0.67 / 0.10, 6.5:1 on --bg */
	--ent-b-display: #9c88dc; /* OKLCH 0.68 / 0.12, 6.2:1 on --bg */
	--ent-c-display: var(--ent-c); /* the slate is already calm (chroma 0.03) */
}
@theme inline {
	--color-ent-a-display: var(--ent-a-display);
	--color-ent-b-display: var(--ent-b-display);
	--color-ent-c-display: var(--ent-c-display);
}
```

Giant words then use `text-ent-a-display` (and so on) instead of `text-ent-a`.

### 2.5 Theme switching

- `next-themes` with `attribute="class"` and `disableTransitionOnChange`. Pick a default theme (light was used here). The user's choice is remembered in local storage, which is fine because a theme is not a secret.
- The toggle button swaps its sun and moon icons through the `dark:` variant (`hidden dark:block` / `block dark:hidden`), not through JavaScript state, so the server render matches the first client render and nothing flashes.
- Add `suppressHydrationWarning` on `<html>`.
- The Open Graph image cannot read CSS variables, so hard-code the light-theme values there and keep them in step with the tokens. Use a solid background, no gradient.

---

## 3. Typography

- **Two faces through `next/font` (self-hosted at build, no runtime request to Google):**
  - Body: **Nunito** (rounded and friendly), `display: 'swap'`.
  - Headings and wordmark: **Plus Jakarta Sans**, in **one weight only (800)** to keep the download small. A heading set in bold 700 uses that 800.
- **Headings** (`h1`-`h3`, in the base layer so utilities can override them): display face, `letter-spacing: -0.02em`. Never tighter: this face's narrow word spaces vanish below that.
  ```css
  @layer base { h1, h2, h3 { font-family: var(--font-display); letter-spacing: -0.02em; } }
  ```
- **Sizes** (Tailwind classes):
  - Hero h1: `text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight`.
  - Section h2: `text-3xl sm:text-5xl font-extrabold tracking-tight`.
  - Page h1 (list pages): `text-4xl sm:text-5xl font-extrabold`.
  - Closing call-to-action h2: `text-4xl sm:text-6xl`.
  - Eyebrow label: `text-sm sm:text-base font-extrabold tracking-widest uppercase`, muted, with accent brackets.
  - Lead sentence under a heading: `text-xl sm:text-2xl`, muted. It was made big on purpose, because small leads were not read.
  - Card meta line ("16 items"): `text-xs font-extrabold tracking-widest uppercase`, muted.
- **Big numbers:** a two-digit "01", "02" in the display face, each number in the next brand color of a fixed cycle (ent-a, ent-b, accent, ent-c, warning). It is decorative (`aria-hidden`), and the text beside it names the step.
- **Giant outlined words:** for word bands and the footer wordmark, transparent fill with `-webkit-text-stroke: 2px var(--border-strong)` (or an SVG `<text>` with stroke). Draw decorative outlined words as generated content (`content: attr(data-word)`), because axe checks color contrast even on `aria-hidden` text, and outlined text always fails it.
- `tabular-nums` on every changing number (timers, scores, costs, progress counts).
- The page has exactly one `h1`.

---

## 4. The living background: hue glows and bouncing hue balls

There are two layers behind every page. Both are decoration only: no text ever sits on a hue alone.

### 4.1 Static radial glows on `body`

```css
body {
	background-color: var(--bg);
	background-image:
		radial-gradient(60rem 36rem at -10% -10%, color-mix(in oklab, var(--hue-1) var(--glow-strength), transparent), transparent 70%),
		radial-gradient(50rem 32rem at 110% 0%, color-mix(in oklab, var(--hue-2) var(--glow-strength), transparent), transparent 70%),
		radial-gradient(60rem 40rem at 50% 120%, color-mix(in oklab, var(--hue-3) var(--glow-strength), transparent), transparent 70%);
	background-attachment: fixed;
	color: var(--text);
	font-family: var(--font-sans);
}
```

### 4.2 Three blurred hue balls that drift, bounce off the edges and off each other

These are slow "billiard balls": they move in straight lines, bounce elastically, and **never overlap**, so the colors stay distinct.

Markup (a server component, fixed behind the app layout):

```tsx
<div data-hue-backdrop aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
	<div className="hue-ball hue-ball-1 bg-hue-1/22 blur-3xl" />
	<div className="hue-ball hue-ball-2 bg-hue-2/22 blur-3xl" />
	<div className="hue-ball hue-ball-3 bg-hue-3/18 blur-3xl" />
	<HueMotion /> {/* client, renders nothing, starts the physics when idle */}
</div>
```

CSS: each diameter follows the screen's shorter side, so three always fit. The start points are chosen so they never overlap at any aspect ratio, which means the page is correct before any JavaScript runs and under reduced motion.

```css
.hue-ball {
	position: absolute;
	width: var(--d);
	height: var(--d);
	left: clamp(0px, calc(var(--fx) - var(--d) / 2), calc(100% - var(--d)));
	top: clamp(0px, calc(var(--fy) - var(--d) / 2), calc(100% - var(--d)));
	border-radius: 9999px;
}
.hue-ball-1 { --d: min(28rem, 40vmin); --fx: 20%; --fy: 20%; }
.hue-ball-2 { --d: min(30rem, 43vmin); --fx: 80%; --fy: 42%; }
.hue-ball-3 { --d: min(26rem, 37vmin); --fx: 35%; --fy: 80%; }
```

Physics (pure TypeScript, unit-tested, no DOM):

```ts
export type Ball = { x: number; y: number; vx: number; vy: number; r: number }
export type Bounds = { width: number; height: number }
const SPEED_PER_DIAMETER = 0.12 // calm: 12% of its diameter per second
const MIN_SPEED_PX = 18
export const MAX_STEP_S = 0.05   // a long frame (tab coming back) never tunnels
export const ballSpeed = (r: number) => Math.max(MIN_SPEED_PX, SPEED_PER_DIAMETER * 2 * r)
const clamp = (v: number, min: number, max: number) => (min > max ? (min + max) / 2 : Math.min(Math.max(v, min), max))
export function clampToBounds(b: Ball, s: Bounds) { b.x = clamp(b.x, b.r, s.width - b.r); b.y = clamp(b.y, b.r, s.height - b.r) }
function walls(b: Ball, s: Bounds) {
	if (b.x - b.r < 0 && b.vx < 0) b.vx = -b.vx
	if (b.x + b.r > s.width && b.vx > 0) b.vx = -b.vx
	if (b.y - b.r < 0 && b.vy < 0) b.vy = -b.vy
	if (b.y + b.r > s.height && b.vy > 0) b.vy = -b.vy
	clampToBounds(b, s)
}
export function collide(a: Ball, b: Ball) {
	const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r
	if (d >= min) return
	const nx = d === 0 ? 1 : dx / d, ny = d === 0 ? 0 : dy / d
	const ma = a.r * a.r, mb = b.r * b.r, total = ma + mb   // mass = disc area
	const overlap = min - d
	a.x -= nx * overlap * (mb / total); a.y -= ny * overlap * (mb / total)
	b.x += nx * overlap * (ma / total); b.y += ny * overlap * (ma / total)
	const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
	if (closing <= 0) return
	const impulse = (2 * closing) / total
	a.vx -= impulse * mb * nx; a.vy -= impulse * mb * ny
	b.vx += impulse * ma * nx; b.vy += impulse * ma * ny
}
export function stepBalls(balls: Ball[], seconds: number, s: Bounds) {
	const dt = Math.min(Math.max(seconds, 0), MAX_STEP_S)
	for (const b of balls) { b.x += b.vx * dt; b.y += b.vy * dt; walls(b, s) }
	for (let pass = 0; pass < 3; pass++) {   // a ball pushed into a third settles too
		balls.forEach((a, i) => { for (const b of balls.slice(i + 1)) collide(a, b) })
		for (const b of balls) clampToBounds(b, s)
	}
	for (const b of balls) {                 // hits only turn a ball; speed stays calm
		const v = Math.hypot(b.vx, b.vy); if (v === 0) continue
		const k = ballSpeed(b.r) / v; b.vx *= k; b.vy *= k
	}
}
```

Driver: read each ball's rendered size and offset, switch it to `left: 0; top: 0`, set `will-change: translate`, then write `element.style.translate = "${x - r}px ${y - r}px"` from a `requestAnimationFrame` loop. Give each ball a random start angle. On resize, re-read the radii (they follow `vmin`) and clamp.

Loading, so it is never on the load path:

- `useHueMotion` does nothing under `prefers-reduced-motion: reduce`.
- Otherwise it waits for `requestIdleCallback` (2 s timeout, with a `setTimeout` fallback), then dynamically `import()`s the physics module.
- Put that `import()` in a plain module the hook calls, not in the hook itself, because the React Compiler fails on a dynamic import inside a hook.
- Measured: a client component with the physics bundled in the layout cost about 0.15 s of LCP. Loading it on idle cost nothing.

Bonus: the backdrop takes part in one scroll scene. It zooms with the camera during the drum transition (section 9.2), through `timeline-scope` on `body`.

---

## 5. Page shell and layout

### 5.1 App layout

```tsx
<div className="relative isolate flex min-h-screen flex-col">
	<HueBackdrop />
	<SiteHeader />
	{/* At least a screen tall, so the footer starts below the first screen and streamed content never pushes it (no layout shift). */}
	<div className="flex min-h-svh w-full flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8">{children}</div>
	<SiteFooter />
</div>
```

The edge padding `px-4 sm:px-6 lg:px-8` mirrors `--edge` (1 / 1.5 / 2 rem). A full-bleed scene cancels it with `margin-inline: calc(var(--edge) * -1); padding-inline: var(--edge)`.

### 5.2 Page enter (every navigation)

A route `template` remounts on every navigation and wraps the page in `.page-enter`, so each top-level block rises in turn:

```css
.page-enter > * > * { animation: var(--animate-rise); }
.page-enter > * > :nth-child(2) { animation-delay: 50ms; }
.page-enter > * > :nth-child(3) { animation-delay: 100ms; }
.page-enter > * > :nth-child(4) { animation-delay: 150ms; }
.page-enter > * > :nth-child(5) { animation-delay: 200ms; }
.page-enter > * > :nth-child(n + 6) { animation-delay: 250ms; }
```

Use `backwards` fill only: it leaves no transform behind once the animation ends. A leftover transform would break `position: sticky` and `fixed` children.

### 5.3 Floating pill header

The header is a rounded, translucent, blurred pill a few pixels below the top. It sticks on scroll and stays one row at every width.

```tsx
<header className="sticky top-0 z-30 px-2 pt-2 sm:px-6 sm:pt-3 lg:px-8">
	<div className="bg-surface/75 border-border/70 shadow-card flex h-14 flex-nowrap items-center justify-between gap-2 rounded-full border px-2 backdrop-blur-md sm:px-3">
		{/* left: sidebar button + wordmark (display face, text-lg, extrabold), nav links from xl */}
		{/* right: progress pill, switches, theme toggle, round account button */}
	</div>
</header>
```

- Nav links are small pills: `rounded-full px-2.5 py-1.5 text-sm font-semibold`. Active: `bg-accent/12 text-accent` plus `aria-current="page"`. Idle: `text-text-muted hover:bg-surface-hover hover:text-text`.
- **Sidebar (every width):** a Radix Dialog that slides in from the left (`animate-slide-in-left` / `animate-slide-out-left`). The overlay is `bg-black/40 backdrop-blur-sm` and fades. Each item rises with a 30 ms stagger (`animationDelay: index * 30ms`). Each item has a colored icon tile that scales 110% on hover, and the item nudges right `hover:translate-x-1`.
- The header's per-user parts (progress, account) stream in `<Suspense>` with skeleton fallbacks of the same size.

### 5.4 Footer

The footer is open, with no box. It has a top hairline, link columns (a muted uppercase tracking-widest title over `font-semibold` links that turn accent and underline on hover) and then a **giant outlined wordmark** stretched to the full width in SVG:

```tsx
<svg aria-hidden viewBox="0 0 1000 140" width={1000} height={140} className="block h-auto w-full">
	<text x="0" y="104" textLength={1000} lengthAdjust="spacingAndGlyphs" fontSize={124}
		className="font-display stroke-border-strong fill-none font-extrabold" strokeWidth="1.5">
		Product Name
	</text>
</svg>
```

The height leaves room below the baseline for descenders. Keep the footer lean: a line of small print there read as noise and was removed.

### 5.5 Phone layout

There is one fluid, desktop-first layout with no separate mobile component trees. It scales down to 360 px. Every pinned scene has a phone fallback (a swipe row, a plain list, a straight road). Check every screen at 1280 px and 390 px in both themes.

---

## 6. Component primitives

Build these first, using `cva` for variants composed through a `cn()` helper (clsx plus tailwind-merge). Every interactive element has `focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`, and `active:scale-[0.97]` on pressables.

### 6.1 SectionLabel: the bracketed eyebrow

`[ HOW IT WORKS ]` has accent-colored brackets (aria-hidden) around muted, uppercase, very widely tracked text.

```tsx
<p className="text-text-muted text-sm font-extrabold tracking-widest uppercase sm:text-base">
	<span aria-hidden className="text-accent">[ </span>{children}<span aria-hidden className="text-accent"> ]</span>
</p>
```

### 6.2 SectionLead

`<p className="text-text-muted text-xl sm:text-2xl">`. It is the one sentence under a heading.

### 6.3 SectionHeading (label + h2 + lead)

```tsx
<div className="lock-head flex max-w-3xl flex-col gap-3">
	<SectionLabel>{label}</SectionLabel>
	<h2 id={id} className="wipe-in text-text text-3xl font-extrabold tracking-tight sm:text-5xl">{title}</h2>
	{lead && <SectionLead>{lead}</SectionLead>}
</div>
```

### 6.4 PageIntro (top of list pages)

A label, the page's one h1 (`wipe-in`) and one lead. It is left-aligned on phones and centred from `lg` (`lg:items-center lg:text-center`).

### 6.5 BigNumber

`String(n).padStart(2, '0')` in `font-display font-extrabold tracking-tight`, colored from a fixed cycle `['text-ent-a','text-ent-b','text-accent','text-ent-c','text-warning']`. Write literal class names so Tailwind sees them at build.

### 6.6 PillLink + RoundArrow: the main call to action

A large rounded link whose text sits on the left and a **round arrow disc** at the right end, inset by 4 px. The arrow slides right on hover and on focus.

```ts
const pillLink = cva('group inline-flex items-center gap-3 rounded-full font-bold transition-all duration-200 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent', {
	variants: {
		variant: {
			primary: 'bg-accent text-accent-ink shadow-card hover:bg-accent-hover hover:shadow-card-hover',
			secondary: 'border border-border bg-surface/70 text-text backdrop-blur-sm hover:border-accent/50 hover:bg-surface'
		},
		size: { default: 'h-12 py-1 pr-1 pl-5 text-base', lg: 'h-14 py-1 pr-1 pl-6 text-lg' }
	}
})
const roundArrow = cva('inline-flex shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:translate-x-1 group-focus-visible:translate-x-1', {
	variants: {
		tone: { inverse: 'bg-accent-ink text-accent', accent: 'bg-accent text-accent-ink' },
		size: { sm: 'size-8', default: 'size-10', lg: 'size-12' }
	}
})
```

The primary pill uses the inverse arrow (an ink disc with an accent arrow). The secondary pill uses the accent arrow.

### 6.7 Button

Variants: primary, secondary, outline, ghost and destructive. The primary uses a subtle **background** gradient between the two accent shades (`bg-gradient-to-br from-accent to-accent-hover`), so the ink keeps AA across the whole fill. Primary and secondary lift on hover: `hover:-translate-y-px hover:shadow-card-hover`, plus `hover:brightness-110` on primary. Sizes are 36 / 40 / 44 px tall.

### 6.8 ImageTile: picture-first cards

The whole tile is one link. The picture sits in a soft frame on top, with the title and a short line under it **outside** the frame, plus a small round arrow.

- Hover and focus: the frame lifts `-translate-y-1` and gets the bigger shadow (300 ms), while **the picture inside scales 105%** (500 ms) within `overflow-hidden`.
- An optional meta line ("16 items") above the title.
- A `large` variant for big tracks (`text-2xl sm:text-3xl` title).
- The picture has fixed dimensions, so the tile never shifts while it loads.

```tsx
<Link href={href} className="group flex h-full flex-col gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
	<span className="border-border bg-surface shadow-card group-hover:shadow-card-hover block overflow-hidden rounded-lg border transition-all duration-300 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 [&>svg]:transition-transform [&>svg]:duration-500 group-hover:[&>svg]:scale-105 group-focus-visible:[&>svg]:scale-105">{art}</span>
	<span className="flex items-start justify-between gap-3 px-1">
		<span className="flex flex-col gap-1">{/* meta, title (font-display extrabold), blurb (muted) */}</span>
		<RoundArrow size="sm" className="mt-1" />
	</span>
</Link>
```

### 6.9 LinkRows: open lists instead of boxes

`<ul className="border-border divide-border divide-y border-y">`. Each row is a link with optional art, a **big title** (`font-display text-2xl sm:text-3xl font-extrabold`) that nudges right on hover, a muted line and a RoundArrow. It gets `hover:bg-surface/60`.

### 6.10 OpenSection: a section without a box

A thin top rule (`border-t pt-6`), an optional BigNumber (`text-4xl`) beside the h2 (`text-2xl font-extrabold`), aligned on the bottom. It is used on reading pages (about, methodology, privacy, profile). Its heading locks while it scrolls (section 9.7).

### 6.11 Card (only for data)

`border-border bg-surface shadow-card rounded-lg border`. A card that is one big link lifts on hover, through `has-[>a]:hover:-translate-y-0.5 has-[>a]:hover:shadow-card-hover has-[>a]:hover:border-accent/40`.

### 6.12 Badge

Status badges use a **tint of their own hue** with the token as text (`bg-success/15 text-success`), never a solid fill with white text. A tint can't fail contrast against its own text by construction, while a bright dark-theme danger fill with white text can.

### 6.13 Inputs

`h-9 rounded border border-border bg-surface px-3 text-sm`, placeholder `text-text-faint`, accent focus outline. Every input has a `<label>`. Forms are real `<form onSubmit>`: Enter submits and Esc cancels. The primary button is `type="submit"` and every other button is `type="button"`.

### 6.14 Dialogs and pop-ups (Radix Dialog)

- Overlay: `fixed inset-0 bg-black/20 backdrop-blur-xs` (a light blur of the page behind, for focus and polish), fading in and out.
- Panel: `bg-surface border-border shadow-card-hover animate-pop-in rounded-lg border p-6 max-w-sm`, centred title `text-2xl font-extrabold`, muted description, round close button top-right (`rounded-full p-1.5 hover:bg-surface-hover`).
- Focus goes to the first field. Esc closes and focus returns to the trigger. Don't put decorative icon tiles above dialog titles: they looked cheap.

### 6.15 Toasts (Radix Toast)

- Placed bottom-right, `max-w-sm`, with a z-index **above every dialog** so a toast's action stays clickable.
- `rounded-lg border border-l-4 border-l-accent bg-surface p-4 shadow-card-hover`, sliding in from the right and fading out.
- Every user action gets a confirming toast. Writes are optimistic and roll back on failure.

### 6.16 Skeletons

```css
.skeleton {
	background-image: linear-gradient(90deg, var(--surface-hover) 0%, color-mix(in oklab, var(--surface-hover), var(--surface) 70%) 50%, var(--surface-hover) 100%);
	background-size: 200% 100%;
	animation: var(--animate-shimmer);
}
```

Make every skeleton the same size as the content it stands for (CLS 0).

### 6.17 Progress pill

A `h-2 rounded-full bg-border/60` track with a fill that is a **bar gradient** from accent to an entity color (allowed: it is a fill, not text). The fill animates `animate-grow-x` from its left and transitions `width` over 700 ms. Next to it sits a `tabular-nums` "3/8". Give the track `role="progressbar"` with `aria-valuenow`, `aria-valuemax` and `aria-valuetext`.

### 6.18 Icons

Import every icon from one wrapper file (`@/components/ui/icons`), never from the provider package directly. An ESLint `no-restricted-imports` rule enforces this, so swapping providers is a one-file change. Icons render `aria-hidden`, and icon-only buttons carry the `aria-label`. With Phosphor in a server-rendered React app, import from its `/ssr` entry.

### 6.19 Entity identity

Each core entity has one color and one icon everywhere, always rendered with its name through one component (an `EntityTag`): icon plus name in its color. No screen shows an entity by color alone.

---

## 7. Illustrations: hand-drawn SVG sprites in token colors

There are no raster images, no stock 3D renders and no WebGL. Every illustration is a hand-drawn SVG `<symbol>` in a **sprite file** next to its feature, drawn with `<use>`.

- **Colors are CSS variables** written in each shape's `style` attribute: `style="fill:var(--surface);stroke:var(--border)"`. They are inherited through `<use>`, so **one drawing recolors itself for both themes** and every rebrand.
- **Why sprites rather than inline SVG components:** inline art sat in the HTML twice (markup and React payload) and added about 250 hydrated nodes to the home page, costing about 3 Lighthouse points. A sprite costs two DOM nodes per picture. The sprite gets a hashed URL from the bundler and is cached for good.
- **Fixed dimensions** on the outer `<svg>` (`viewBox`, `width` and `height` from a registry), with `className="block h-auto w-full"`. This reserves the space, so CLS stays 0.
- **Defer** sprites for pictures near the top of a page whose sprite would otherwise race the page's text to first paint. The `<use>` names its file only after hydration (`useSyncExternalStore` returning false on the server). Measured: loading a poster sprite with the page cost about 0.43 s of LCP, and deferring it cut that to about 0.15 s.
- **Registry:** a small TS file per sprite listing `{ id, width, height }`, and a unit test that checks every id against the sprite file.
- **Art style:**
  - Flat shapes on a `--surface` rounded rectangle (`rx` about 32 on a 560x400 board), with `--border` hairlines and dashed lane lines in `--border-strong` at 50% opacity.
  - Accents in the entity colors and the accent orange.
  - Labels in the display font at small size, weight 800, letter-spacing 2, muted.
  - Characters are simple geometric figures. Crop the viewBox to a character's feet line so it stands flush on whatever is under it.
  - Pictures show shapes and generic labels, never invented results or fake numbers.
- **Picture sets used:** a hero scene; one picture per core entity doing **the same task** (so the comparison is visual); one picture per "how it works" step; one poster per catalogue item (16:9); one picture per preset or template; medals per achievement (locked ones faded with a lock icon and "Not earned yet"); 404 and error pictures; the two landing characters; a wheel rim.
- Decorative pictures get `aria-hidden`, and the text beside them says what they show. A meaningful picture gets a `<title>`.

```tsx
export type ArtRef = { sprite: StaticImageData; id: string; width: number; height: number }
export function SpriteArt({ art, className, defer = false }: { art: ArtRef; className?: string; defer?: boolean }) {
	const href = `${art.sprite.src}#${art.id}`
	return (
		<svg aria-hidden viewBox={`0 0 ${art.width} ${art.height}`} width={art.width} height={art.height} className={cn('block h-auto w-full', className)}>
			{defer ? <DeferredUse href={href} /> : <use href={href} />}
		</svg>
	)
}
```

---

## 8. The motion system

### 8.1 Principles

- **One ease** for entrances, `cubic-bezier(0.22, 1, 0.36, 1)`, and `ease-in` for exits. Exits are shorter than entrances (for example pop-in 180 ms, pop-out 120 ms).
- **Transform, clip-path, opacity and scale only.** Never animate layout properties.
- **Prefer the individual transform properties** (`translate`, `scale`, `rotate`) for animations. They compose with a scroll-linked `transform` on the same element, which is how an idle float can run on top of a scroll flight.
- **Registered custom properties** (`@property --x { syntax: '<number>'; inherits: true; initial-value: 0 }`) are the key trick. One scroll-driven animation on an ancestor animates a number, and every descendant derives its own transform and opacity from it with `calc()`, `sin()`, `pow()`, `clamp()` and `max()`.
- **Every scroll effect** lives inside `@media (prefers-reduced-motion: no-preference) { @supports (animation-timeline: view()) { ... } }`. Outside that block the default CSS is the finished static layout.
- **A global reduced-motion kill switch** at the end of the CSS:
  ```css
  @media (prefers-reduced-motion: reduce) {
  	*, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  }
  ```
- Data-driven animations (game scenes, live results, a spotlight that moves between elements) use **Motion** inside `LazyMotion features={domAnimation} strict` and `MotionConfig reducedMotion="user"`, with the `m.` components. Don't use Motion for scroll reveals: CSS is cheaper and reversible.

### 8.2 Scroll-driven building blocks (copy as is)

```css
@media (prefers-reduced-motion: no-preference) {
	@supports (animation-timeline: view()) {
		/* A section slides up as it enters. No fade, so it is painted first. */
		.reveal { animation: reveal-up linear both; animation-timeline: view(); animation-range: entry 0% entry 35%; }

		/* Headings wipe in from the left. */
		.wipe-in { animation: wipe-in linear both; animation-timeline: view(); animation-range: entry 10% entry 90%; }

		/* Hairline dividers draw across. */
		.line-draw::before { animation: draw-x linear both; animation-timeline: view(); animation-range: entry 0% cover 30%; }

		/* Children rise one after another: each one's range starts 8% later. */
		.stagger > * { animation: reveal-up linear both; animation-timeline: view(); animation-range: entry 0% entry 60%; }
		.stagger > :nth-child(2) { animation-range: entry 8% entry 68%; }
		.stagger > :nth-child(3) { animation-range: entry 16% entry 76%; }
		.stagger > :nth-child(4) { animation-range: entry 24% entry 84%; }
		.stagger > :nth-child(n + 5) { animation-range: entry 32% entry 92%; }
	}
}
.line-draw { position: relative; }
.line-draw::before { content: ''; position: absolute; inset: 0 0 auto; height: 1px; background: var(--border); transform-origin: left; }
@keyframes reveal-up { from { translate: 0 32px; } }
@keyframes wipe-in { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 -2% 0 0); } }
@keyframes draw-x { from { scale: 0 1; } }
```

The `-2%` at the end of the wipe keeps the last glyph's overhang from being clipped.

### 8.3 Hero entrance

- **Each headline word rises in turn,** with a small rotate and no fade, because the h1 is the LCP element. Split the headline into `<span><span class="hero-word">word</span></span>`, with a space before each word after the first.
  ```css
  @media (prefers-reduced-motion: no-preference) {
  	.hero-word { display: inline-block; animation: word-rise 0.8s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
  	h1 > :nth-child(2) > .hero-word { animation-delay: 60ms; }
  	/* ...60 ms per word... */
  	h1 > :nth-child(n + 11) > .hero-word { animation-delay: 600ms; }
  	.hero-art-float { animation: float 7s ease-in-out infinite; }
  	@supports (animation-timeline: view()) {
  		.hero-art-parallax { animation: parallax-down linear both; animation-timeline: view(); animation-range: exit 0% exit 100%; }
  	}
  }
  @keyframes word-rise { from { translate: 0 0.45em; rotate: 4deg; } }
  @keyframes float { 50% { translate: 0 -10px; } }
  @keyframes parallax-down { to { translate: 0 12%; } }
  ```
- **The hero picture** floats gently (7 s) inside a wrapper that drifts down 12% as it leaves (parallax). Give the content below it `relative z-10`, so the drifting picture passes behind it.
- Hero layout: two columns from `lg`. The text column has the label, h1, one muted line, two PillLinks (primary plus secondary "optional" action) and a small text link. The picture column holds the illustration.
- **First-screen fit:** on wide screens the hero plus the strip under it fill exactly the first screen, so nothing is cut by the window's bottom edge at 100% zoom.
  - The wrapper is `min-height: calc(100svh - header - padding)` and the hero is `flex: 1`.
  - The picture column's width follows the height left over at the art's aspect ratio: `min(calc((var(--first-h) - 15rem) * 1.4), calc(50% - 1.5rem))`.
  - On short laptop windows the h1 scales with the window's height: `font-size: clamp(2.25rem, calc(17.5svh - 3.4375rem), 3.75rem)`, never above its usual size.
  - Test the fit at 1024x700, 1152x600, 1280x720, 1366x657, 1536x730 and 1920x947.

### 8.4 Word bands

Full-width bands of **huge outlined words** with accent dots between them. They slide sideways while they pass the screen (one band left, the next right), linked to scroll, so they run backwards on the way up.

```css
.word-band { overflow-x: clip; padding-block: 0.5rem; }            /* clip, not hidden: keeps sticky working */
.word-band-track { display: flex; width: max-content; gap: 2rem; }
.word-band-word { display: inline-flex; align-items: center; gap: 2rem; font-family: var(--font-display);
	font-size: clamp(3.5rem, 11vw, 10rem); font-weight: 800; line-height: 1; letter-spacing: -0.02em;
	color: transparent; -webkit-text-stroke: 2px var(--border-strong); }
.word-band-word::before { content: attr(data-word); }              /* axe-safe decorative text */
.word-band-dot { width: 0.18em; height: 0.18em; border-radius: 9999px; background: var(--accent); }
@media (prefers-reduced-motion: no-preference) { @supports (animation-timeline: view()) {
	.word-band-track { animation: band-left linear both; animation-timeline: view(); animation-range: cover 0% cover 100%; }
	.word-band-track-right { animation-name: band-right; }
} }
@keyframes band-left { from { translate: 0 0; } to { translate: -30% 0; } }
@keyframes band-right { from { translate: -30% 0; } to { translate: 0 0; } }
```

Render 4 copies of the word list, so the track still covers the screen at the end of its slide. The whole band is `aria-hidden`, and it bleeds full width with negative margins.

### 8.5 Hover micro-interactions (consistent everywhere)

- Tiles and cards lift `-translate-y-0.5` to `-1` and get the bigger shadow.
- Pictures zoom 105% inside their frame.
- Round arrows slide right 4 px (on hover **and** keyboard focus).
- Row titles nudge right 4 px.
- Sidebar icon tiles scale 110%.
- Press: `active:scale-[0.97]`.
- Durations: 200 ms for color and lift, 300 ms for arrows and lift, 500 ms for picture zoom.

### 8.6 Celebrations

One confetti burst (`canvas-confetti`, about 6 KB, 120 particles, spread 70, `disableForReducedMotion: true`) when something is won or finished, plus a toast. Import the library dynamically in a plain async function outside the hook, and guard against firing twice when a hidden route shows again.

### 8.7 Spotlight guide tour

A first-visit tour of 6 steps. Each step is a modal Radix Dialog card (`animate-pop-in`, accent "2 of 6" counter in uppercase) next to a **spotlight**: a `ring-2 ring-accent rounded-lg` box that a Motion `m.div` animates to the target's bounding rect. The page is dimmed with `bg-black/55`. Targets are found by a `data-guide="..."` attribute, so the tour never changes the page's layout. Skip and Esc end it, and a menu item replays it.

---

## 9. Signature scroll scenes (the "wow" sections)

Every scene uses the same skeleton: a **tall track** (`height: N svh`, named `view-timeline-name: --scene`) and inside it a **stage** that is `position: sticky; top: 0; height: 100svh; overflow: clip`. The stage pins while the track scrolls past, and keyframes run on `animation-range: contain 0% contain 100%` (the pinned stretch). Clear the floating header with `padding-top: calc(var(--lock-line) + 0.25rem)`. Size the art from the screen's **height** (`svh`), so a scene always fits while pinned.

Use `0%, 14% { ... }` selectors to make rests without extra keyframes, and put `animation-timing-function` inside a keyframe to ease each interval on its own.

### 9.1 Arc flight showcase (one scene per entity)

The section header stays locked and each scene sweeps along an **S curve**: it enters small at the top-right corner moving left, turns down into the centre at full size, rests, then turns out to the bottom-left corner and shrinks. A scene is a **huge word** in the entity's display color (`--ent-*-display`, section 2.4; `font-size: min(22vw, 30svh)`, `line-height: 0.85`, with the picture overlapping the word's foot by `margin-bottom: -0.22em`), plus a picture and a caption. Captions fade out before a scene moves and back in after it settles. The picture tilts in 3D as it flies and floats gently at rest.

```css
@property --roll { syntax: '<number>'; inherits: true; initial-value: 0; }
@media (prefers-reduced-motion: no-preference) { @supports (animation-timeline: view()) {
	.flight { height: 360svh; view-timeline-name: --flight; }      /* 3 scenes: arrival, 2 hand-overs, 3 rests */
	.flight-stage { position: sticky; top: 0; display: grid; height: 100svh; overflow: clip; perspective: 1400px;
		padding-top: calc(var(--lock-line) + 0.25rem); }
	.flight-scene {
		--arc: sin(var(--roll) * 90deg);                            /* -1..1 down the screen */
		--far: max(var(--arc), -1 * var(--arc));                    /* |arc| */
		grid-area: 1 / 1; justify-content: center;
		transform: translate(calc(var(--roll) * -50vw), calc(var(--arc) * 30svh)) scale(calc(1 - var(--far) * 0.75));
		opacity: min(1, calc((1 - max(var(--roll), -1 * var(--roll))) * 4)); /* fades only in the last quarter */
		animation-timing-function: linear; animation-fill-mode: both;
		animation-timeline: --flight; animation-range: contain 0% contain 100%;
	}
	.flight-scene:nth-child(1) { z-index: 3; animation-name: roll-first; }  /* the leaving scene stays in front */
	.flight-scene:nth-child(2) { z-index: 2; animation-name: roll-middle; }
	.flight-scene:nth-child(3) { z-index: 1; animation-name: roll-last; }
	.flight-caption { opacity: calc(1 - max(var(--roll), -1 * var(--roll)) * 4); }
	.flight-art { max-width: min(36rem, calc((100svh - 14.25rem - var(--lock-line)) * 1.37));
		transform: rotateY(calc(var(--roll) * -30deg)); animation: float-soft 6s ease-in-out infinite; }
	.flight-scene:nth-child(2) .flight-art { animation-delay: -2s; }
	.flight-scene:nth-child(3) .flight-art { animation-delay: -4s; }
} }
@keyframes float-soft { 0%, 100% { translate: 0 0; rotate: 0deg; } 50% { translate: 0 -0.6rem; rotate: -1.2deg; } }
/* --roll: -1 at the top-right corner, 0 resting in the centre, 1 at the bottom-left corner. */
@keyframes roll-first { 0% { --roll: -1; } 14%, 33% { --roll: 0; } 47%, 100% { --roll: 1; } }
@keyframes roll-middle { 0%, 33% { --roll: -1; } 47%, 66% { --roll: 0; } 80%, 100% { --roll: 1; } }
@keyframes roll-last { 0%, 66% { --roll: -1; } 80%, 100% { --roll: 0; } }
```

Why the sine-shaped shrink: with a linear shrink and a 50svh rise, the arriving word was cut by the locked header strip. Shrinking on the same sine as the rise keeps the scene's top below the strip. Each move takes about 37svh of scroll and each rest about 48svh. Without support it is a plain vertical list.

### 9.2 Turning drum, then "camera flies into the background"

A pinned **cylinder with five faces** turns as you scroll and shows one step at a time. Its neighbours curve away above and below, faded, and they show only their pictures, not their words. After the last face, the **camera zooms into an empty part of the background**: the drum scales toward the right edge exponentially and fades, **while the fixed hue balls behind the page grow too**. The next section then arrives big and faint and shrinks into place. No box or frame is drawn: a growing white rectangle looked rough and was removed.

```css
@property --spin { syntax: '<number>'; inherits: true; initial-value: 0; }
@property --zoom { syntax: '<number>'; inherits: true; initial-value: 0; }
.drum-face:nth-child(1) { --i: 0; } /* ... --i: 1..4 */
@media (prefers-reduced-motion: no-preference) { @supports (animation-timeline: view()) {
	.drum { height: 700svh; view-timeline-name: --drum; }
	.drum-stage { position: sticky; top: 0; height: 100svh; overflow: clip;
		animation: drum-turn both; animation-timeline: --drum; animation-range: contain 0% contain 100%; }
	.drum-faces { display: grid; height: 100%; perspective: 1600px;     /* perspective reaches direct children only */
		padding-block: calc(var(--lock-line) + 0.25rem) 1.5rem;
		transform-origin: 95% 50%; scale: pow(8, var(--zoom)); }         /* steady camera speed */
	.drum-face { grid-area: 1 / 1; align-self: center;
		transform-origin: 50% 50% -65svh;                               /* the axis sits behind the screen */
		--d: calc(var(--spin) - var(--i));
		transform: rotateX(calc(var(--d) * 60deg)); backface-visibility: hidden;
		opacity: calc((1 - var(--d) * var(--d) * 0.7) * (1 - clamp(0, var(--zoom) * 1.8, 1))); }
	.drum-face-text { opacity: clamp(0, calc(1 - var(--d) * var(--d) * 3.5), 1); }
	.drum-face-art { max-width: min(42rem, calc((100svh - 7.25rem - var(--lock-line)) * 1.4)); }

	/* The fixed backdrop follows the same timeline. */
	body { timeline-scope: --drum; }
	[data-hue-backdrop] { transform-origin: 95% 50%; animation: hue-zoom linear both; animation-timeline: --drum; }
	/* The next section zooms out into place on its own timeline. */
	.next-scene { view-timeline-name: --next; overflow-x: clip; }
	.next-scene-stage { transform-origin: 80% 40%; animation: zoom-out-in linear both;
		animation-timeline: --next; animation-range: entry 0% entry 70%; }
} }
/* Five rests of 6% each, four turns of 11% each (ease-in-out), and a linear zoom over the last 26%. */
@keyframes drum-turn {
	0% { --spin: 0; --zoom: 0; }
	6% { --spin: 0; animation-timing-function: ease-in-out; }  17% { --spin: 1; }
	23% { --spin: 1; animation-timing-function: ease-in-out; } 34% { --spin: 2; }
	40% { --spin: 2; animation-timing-function: ease-in-out; } 51% { --spin: 3; }
	57% { --spin: 3; animation-timing-function: ease-in-out; } 68% { --spin: 4; }
	74% { --spin: 4; --zoom: 0; animation-timing-function: linear; }
	100% { --spin: 4; --zoom: 1; }
}
@keyframes hue-zoom { contain 74% { scale: 1; } contain 100% { scale: 2.4; } exit 70% { scale: 1; } }
@keyframes zoom-out-in { from { scale: 1.6; opacity: 0.3; } to { scale: 1; opacity: 1; } }
```

Each face is a two-column grid on desktop: the picture spans 3 of 5 columns, and the text has a BigNumber (`text-6xl sm:text-8xl`), the step name (`text-3xl sm:text-5xl`) and one line.

### 9.3 Impact landing: characters stomp in and crack the background

This is the most dramatic scene and it shows the **key metric**. The heading appears first. Then the slower entity drops from above with a **squash and stretch** landing, a shock ring and a small crack. Then the faster entity drops harder, the arena **shakes**, and **big cracks spread across the whole background** and then close slowly. Each entity then stands on a plaque with its numbers, and two bars race at the real recorded times.

It is **timed, not scroll-linked**. An IntersectionObserver hook sets `data-stage="playing"` when 70% of the stage is on screen and `idle` when less than 15% is, so it plays again on every visit. All the animation is CSS keyed on that attribute. Without JavaScript or under reduced motion the attribute is never set, so the **final picture** shows: characters on their plaques, full bars, no cracks.

Key CSS:

```css
.impact { height: 250svh; }  /* pinned only under no-preference */
.impact-stage { position: sticky; top: 0; height: 100svh; overflow: clip; isolation: isolate; }
.impact-arena { display: grid; grid-template-columns: 1fr 1fr; align-items: end; } /* both stand on one line */
.impact-body { transform-origin: 50% 100%; width: min(40vw, 16rem, 27svh); }
.impact-ground::after { /* shock ring: an ellipse spreading from the feet in the entity's color */
	content: ''; position: absolute; bottom: 0; left: 50%; width: 70%; height: 22%; translate: -50% 50%;
	border: 3px solid var(--ring); border-radius: 50%; opacity: 0; }
.impact-stage[data-stage='idle'] .impact-body { translate: 0 -130svh; }
.impact-stage[data-stage='idle'] .impact-plaque { opacity: 0; }
.impact-stage[data-stage='playing'] .side-b .impact-body { animation: drop-soft 1.2s 0.6s both; }
.impact-stage[data-stage='playing'] .side-a .impact-body { animation: drop-hard 0.9s 2.3s both; }
.impact-stage[data-stage='playing'] .side-b .impact-ground::after { animation: ring 0.7s 1.2s both; }
.impact-stage[data-stage='playing'] .side-a .impact-ground::after { animation: ring 0.9s 2.65s both; }
.impact-stage[data-stage='playing'] .impact-arena { animation: thud 0.35s 1.2s, shake 0.55s 2.65s; }
.impact-stage[data-stage='playing'] .side-a .crack-path { animation: crack-big 4.1s calc(2.65s + var(--step) * 25ms) both; }
.impact-stage[data-stage='playing'] .impact-fill { animation: bar-run var(--run) linear 3.1s both; }

@keyframes drop-hard {  /* fall, squash flat, overshoot tall, settle */
	0% { translate: 0 -130svh; animation-timing-function: cubic-bezier(0.6, 0, 1, 0.5); }
	40% { translate: 0 0; scale: 1.22 0.74; animation-timing-function: ease-out; }
	62% { scale: 0.96 1.05; animation-timing-function: ease-in-out; }
	100% { translate: 0 0; scale: 1 1; }
}
/* drop-soft: the same with 50% / scale 1.16 0.82 and 70% / 0.97 1.04 */
@keyframes ring { from { scale: 0.3; opacity: 0.9; } to { scale: 2.4; opacity: 0; } }
@keyframes thud { 0%, 100% { translate: 0 0; } 30% { translate: 0 4px; } 60% { translate: 0 -2px; } }
@keyframes shake { 0%, 100% { translate: 0 0; } 12% { translate: -9px 7px; } 26% { translate: 8px -6px; }
	40% { translate: -6px 5px; } 55% { translate: 4px -3px; } 75% { translate: -2px 2px; } }
@keyframes bar-run { from { scale: 0 1; } }
```

**Procedural cracks:**

- Generate the crack paths once from a seeded random walk and keep them as data: `{ d, depth: 0 | 1 | 2, step }`. Main cracks run from the impact point `(0,0)` outward in a `-100..100` box. Branches fork at a `step` along their parent and twigs fork from branches.
- Draw them in an SVG of `width: max(160vw, 160svh)` centred on the character's feet, behind the scene (`z-index: -1`).
- Each path has `pathLength={1}`, `stroke-dasharray: 1`, `stroke-dashoffset: 1`, and stroke width by depth (0.55 / 0.36 / 0.22), in `var(--text)` at 75% opacity.
- The keyframes **draw outward, hold, then retract the same way**:
  ```css
  @keyframes crack-big {
  	0% { stroke-dashoffset: 1; opacity: 1; animation-timing-function: ease-out; }
  	8.5% { stroke-dashoffset: 0; }
  	61% { stroke-dashoffset: 0; opacity: 1; animation-timing-function: ease-in; }  /* set opacity at the hold too */
  	100% { stroke-dashoffset: -1; opacity: 0; }
  }
  ```
- Each branch's delay is `start + step * 25ms`, so branches grow after their parent.
- Render the crack SVG only once the stage has started, so it costs nothing in the page's HTML.

**Scroll hold:** this is optional, but users scrolled past before the landing. When the user scrolls **down** into the stage, glide the page to where the stage pins, then for 3.3 s ignore `wheel` and `touchmove` (non-passive `preventDefault`) and the scroll keys (arrows, Page Up/Down, Home, End, Space, but not while typing in a field). Put the page back if the scrollbar drags it further down, and release early if the stage leaves. Coming back **up** never holds. Scrolling up with the scrollbar always works, so the page is never a trap.

**Short windows:** add `max-height` media queries that shrink characters, numbers and plaques, and drop the racing bars on short phones, because they only repeat the plaques' numbers.

### 9.4 Horizontal pinned catalogue track

Every catalogue item becomes a large poster in **one row** that pins and slides **right to left** as you scroll, with a thin accent progress bar under it. First it **holds still** for a moment, so the first poster is seen whole. Phones, unsupported browsers and reduced motion get a **swipe row with snap**.

```css
.track-row { display: flex; gap: 1.25rem; overflow-x: auto; scroll-snap-type: x mandatory;
	margin-inline: calc(var(--edge) * -1); padding-inline: var(--edge); padding-bottom: 1.5rem; scroll-padding-inline: var(--edge); }
.track-row > li { flex: none; width: min(72vw, 24rem); scroll-snap-align: start; }
.track-progress { display: none; }
@media (prefers-reduced-motion: no-preference) and (min-width: 40rem) { @supports (animation-timeline: view()) {
	.track { --gap: 2rem;
		--w: min(48vw, max(20rem, calc((100svh - 11.25rem - var(--lock-line)) * 1.7778)));  /* about half the screen, 16:9 */
		--travel: calc(var(--count) * var(--w) + (var(--count) - 1) * var(--gap) + 2 * var(--edge) - 100vw);
		--hold: 35svh;
		height: calc(100svh + var(--hold) + var(--travel) * 0.4);    /* the row moves 2.5x faster than the page */
		view-timeline-name: --track; }
	.track-stage { position: sticky; top: 0; display: flex; flex-direction: column; justify-content: center;
		height: 100svh; overflow: clip; container-type: inline-size; margin-inline: calc(var(--edge) * -1);
		padding-top: calc(var(--lock-line) + 0.25rem); }
	.track-row { overflow: visible; scroll-snap-type: none; width: max-content; margin-inline: 0; padding-bottom: 0; gap: var(--gap);
		animation: track-slide linear both; animation-timeline: --track; animation-range: contain var(--hold) contain 100%; }
	.track-row > li { width: var(--w); }
	.track-progress { display: block; position: absolute; inset: auto var(--edge) 2rem; height: 4px; overflow: hidden;
		border-radius: 9999px; background: var(--border); }
	.track-progress > span { display: block; height: 100%; background: var(--accent); transform-origin: left;
		animation: track-progress linear both; animation-timeline: --track; animation-range: contain var(--hold) contain 100%; }
} }
/* -100% + 100cqw: the last poster ends exactly flush with the edge margin, at any width, with no JS. */
@keyframes track-slide { from { translate: 0 0; } to { translate: calc(-100% + 100cqw) 0; } }
@keyframes track-progress { from { scale: 0 1; } }
```

Set `--count` inline. Keyboard support: a pinned row can't scroll itself, so an `onFocusCapture` handler checks whether the focused poster is off screen and scrolls the **page** to the point where the track has slid it into view (a pure function of the item's offset, the row and stage widths, and the track's top, height and hold).

### 9.5 Winding dotted road (journey, steps, "where to go next")

The stops sit far apart, alternating left and right of a **dotted road that swings between their markers** (S-curves with a vertical tangent at every marker). The road **draws itself from the top as you scroll**, each card rises in and its marker pops. On phones it is a straight dotted line down the left with cards beside it, and that line draws itself too.

```ts
// Percent coordinates in a 0-100 box; the SVG stretches to the road (preserveAspectRatio="none").
export function roadPath(count: number) {
	const row = 100 / count
	const pts = Array.from({ length: count }, (_, i) => ({ x: i % 2 === 0 ? 62 : 38, y: (i + 0.5) * row }))
	return pts.map((p, i) => {
		const prev = pts[i - 1]; if (!prev) return `M${p.x} ${p.y}`
		const mid = (prev.y + p.y) / 2
		return `C${prev.x} ${mid} ${p.x} ${mid} ${p.x} ${p.y}`
	}).join(' ')
}
```

```css
.road { position: relative; }
.road-line { display: none; }
.road-trail { position: absolute; top: 0.75rem; bottom: 0.75rem; left: 0.65rem;
	border-left: 4px dotted color-mix(in oklab, var(--border-strong) 60%, transparent); }
.road-stops { display: flex; flex-direction: column; gap: 4rem; }
.road-stop { position: relative; padding-left: 2.5rem; }
.road-marker { position: absolute; top: 0.25rem; left: 0; width: 1.5rem; height: 1.5rem; border-radius: 9999px;
	background: var(--accent); box-shadow: 0 0 0 4px var(--bg); }  /* the ring cuts the road under the marker */
.road-marker[data-tone='open'] { background: var(--surface); border: 2px solid var(--border-strong); }
@media (min-width: 64rem) {
	.road-trail { display: none; }
	.road-line { display: block; position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
	.road-line path { stroke: color-mix(in oklab, var(--border-strong) 70%, transparent); stroke-width: 6;
		stroke-linecap: round; stroke-dasharray: 0 18; }       /* round caps + zero dash = dots */
	.road-stops { display: grid; grid-auto-rows: 1fr; gap: 0; }   /* equal rows, so markers match the path */
	.road-stop { padding: clamp(2rem, 5vw, 5rem) 0; }
	.road-card { width: 44%; }
	.road-stop[data-side='right'] .road-card { margin-left: auto; }
	.road-marker { top: 50%; left: 62%; width: 1.75rem; height: 1.75rem; translate: -50% -50%; }
	.road-stop[data-side='right'] .road-marker { left: 38%; }
}
@media (prefers-reduced-motion: no-preference) { @supports (animation-timeline: view()) {
	.road-line, .road-trail { animation: road-draw linear both; animation-timeline: view(); animation-range: cover 0% cover 90%; }
	.road-card { animation: reveal-up linear both; animation-timeline: view(); animation-range: entry 0% entry 40%; }
	.road-marker { animation: marker-pop linear both; animation-timeline: view(); animation-range: entry 10% entry 50%; }
} }
@keyframes road-draw { from { clip-path: inset(0 0 100% 0); } to { clip-path: inset(0 0 0 0); } }
@keyframes marker-pop { from { scale: 0; } }
```

Add `vector-effect="non-scaling-stroke"` on the path, so the dots stay round when the SVG stretches. Each card is a big framed picture (16:9, zooms on hover), a title and a PillLink. Markers can be colored by status, but the card also says the status in words.

### 9.6 FAQ as a Ferris wheel

The FAQ is a big Ferris wheel seen from the side, with **one cabin per question** hanging upright from the rim.

**The scroll story (pinned, wide screens):**

1. The section scrolls in with only its heading (placed 6rem in from the left) and the **empty stand**.
2. The wheel **rolls in small along the ground from beyond the left edge**. It really rolls, at about one radian of turn per radius travelled, so it does not slide.
3. As the wheel comes near, the heading **leaps up** to just under the header and waits there. It drops back with a small bounce once the wheel has passed under it.
4. The wheel **grows and hops onto the stand** and settles with a little bounce.
5. The answer card fades in at the hub.
6. Further scroll turns the wheel **one full revolution**, and then the page moves on.

**Interaction:**

- A click or Enter opens a cabin's answer in the hub.
- A cabin can be **grabbed and flicked** to spin the wheel. A flick coasts with exponential decay.
- The left and right arrow keys turn the wheel by one cabin with an ease-in-out.

**Elsewhere:** phones and short windows get a smaller unpinned wheel that rolls in on the machine's own view timeline, with the card under it.

The wheel's angle is the sum of three registered angles: the scroll turn, the roll-in, and the user's drag (set by script, a frame at a time, with no React re-render).

```css
@property --wheel-scroll { syntax: '<angle>'; inherits: true; initial-value: 0deg; }
@property --wheel-roll { syntax: '<angle>'; inherits: true; initial-value: 0deg; }
.wheel { position: absolute; top: 0; left: calc(50% - var(--r)); width: calc(var(--r) * 2); height: calc(var(--r) * 2);
	--wheel-user: 0deg;
	--wheel-angle: calc(var(--wheel-scroll) + var(--wheel-roll) + var(--wheel-user));
	rotate: var(--wheel-angle); cursor: grab; touch-action: pan-y; user-select: none; }  /* vertical swipes still scroll */
/* A cabin's top centre is its pivot. Swing it out to the rim, then undo the slot angle AND the wheel's angle, so it hangs straight down. */
.slot { position: absolute; top: 50%; left: calc(50% - var(--cab-w) / 2); width: var(--cab-w); transform-origin: 50% 0;
	transform: rotate(var(--a)) translateY(calc(var(--r) * -0.97)) rotate(calc(var(--a) * -1 - var(--wheel-angle))); }
.slot::before { content: ''; display: block; width: 3px; height: 0.9rem; margin-inline: auto; border-radius: 2px; background: var(--border-strong); } /* hanger rod */
.cabin { /* a surface card with a 2px strong border, rounded-lg, bold 12-13px text, a plus icon that turns 45deg when open */ }
.cabin[aria-expanded='true'] { border-color: var(--accent); background: color-mix(in oklab, var(--accent) 14%, var(--surface)); box-shadow: 0 0 0 2px var(--accent); }

@keyframes wheel-turn { 0%, 34% { --wheel-scroll: 0deg; animation-timing-function: ease-in-out; } 90%, 100% { --wheel-scroll: 360deg; } }
@keyframes wheel-roll-in {
	0%, 3% { translate: -100vw calc(var(--hang) + var(--r) * 0.45); scale: 0.55; --wheel-roll: -450deg; }
	22% { translate: calc(var(--r) * -0.5) calc(var(--hang) + var(--r) * 0.45); scale: 0.55; --wheel-roll: -30deg; animation-timing-function: ease-out; }
	26% { translate: calc(var(--r) * -0.25) calc(var(--r) * -0.1); scale: 0.85; --wheel-roll: -12deg; animation-timing-function: ease-in; }
	30% { translate: 0 0; scale: 1; --wheel-roll: 0deg; }
	32% { translate: 0 -0.75rem; animation-timing-function: ease-in; }
	34%, 100% { translate: 0 0; scale: 1; --wheel-roll: 0deg; }
}
@keyframes heading-leap {
	0%, 5% { translate: 0 0; animation-timing-function: cubic-bezier(0.2, 0.8, 0.4, 1); }
	9%, 15% { translate: 0 var(--leap); animation-timing-function: cubic-bezier(0.5, 0, 0.8, 0.4); }
	18.5% { translate: 0 0; animation-timing-function: ease-out; }
	20% { translate: 0 -1.25rem; animation-timing-function: ease-in; }
	21.5%, 100% { translate: 0 0; }
}
/* Animate visibility too: an invisible card still catches grabs and takes focus. */
@keyframes card-in { 0%, 30% { opacity: 0; visibility: hidden; } 34%, 100% { opacity: 1; visibility: visible; } }
```

Pinned track: `600svh`. The stage is **full-bleed and `overflow: clip` at the window edges**, because a rotated wheel's overflow box is wider than the wheel and otherwise gives the page a sideways scrollbar. Size the radius from both the height and the width: `--r: min((100svh - 7.25rem - hang) / 2, (100vw - 2*edge - 34rem - 11.5rem) / 2, 22rem)`. Draw the stand as an SVG A-frame with round caps in `--border-strong`, and the rim as a sprite.

Flick physics (pure functions):

```ts
export const shortestDelta = (from: number, to: number) => { const w = (((to - from + 180) % 360) + 360) % 360; return w === 0 ? 180 : w - 180 }
export const angleAround = (cx: number, cy: number, x: number, y: number) => (Math.atan2(x - cx, cy - y) * 180) / Math.PI
export const FLICK_WINDOW_MS = 100      // only the last 100 ms before release count; a pause gives zero
export const SPIN_TAU_MS = 650          // decay time constant
export const SPIN_STOP_SPEED = 0.003    // deg/ms
export const SPIN_MAX_SPEED = 0.72      // about two turns a second
export function coastStep(speed: number, dt: number) { const fade = Math.exp(-dt / SPIN_TAU_MS); return { delta: speed * SPIN_TAU_MS * (1 - fade), speed: speed * fade } } // exact, frame-rate independent
```

Drag details:

- A press becomes a drag only after 6 px of travel. Then `setPointerCapture`, so a release over a cabin is not a click on it.
- Ignore the click that ends a drag.
- Cut a slow frame to 50 ms.
- Under reduced motion the wheel follows the pointer but never coasts, and the arrow keys jump straight to the next cabin.
- Keyboard focus that reaches a cabin before the wheel is on its stand scrolls the page to just past the mount point.

Put the FAQ's CSS in a file **imported by its own component**, because only one page uses it (section 12).

### 9.7 Locked section headers (orientation while scrolling)

When a section's heading scrolls up to the header, a **slim see-through strip** (the label and the title on one line, smaller) locks just under the header until the section ends. The section's content is **cut off at the strip's bottom edge** by a scroll-linked `clip-path`, so nothing ever scrolls behind the strip's text. The strip itself has no background: the page and its hues show all around it. It is CSS only.

```tsx
<section aria-labelledby={id} className="lock-section">
	<div aria-hidden className="lock-strip"><div className="lock-strip-text">{/* SectionLabel + truncated title */}</div></div>
	<div className="lock-body">{/* the section, whose heading block has className="lock-head" */}</div>
</section>
```

```css
.lock-strip { display: none; }
@supports (animation-timeline: view()) {
	.lock-section { timeline-scope: --lock-head, --lock-body; }
	.lock-head { view-timeline: --lock-head block; view-timeline-inset: var(--lock-line) 0px; }
	.lock-body { view-timeline: --lock-body block; view-timeline-inset: var(--lock-line) 0px;
		animation: lock-clip linear forwards; animation-timeline: --lock-body; animation-range: exit-crossing 0% exit-crossing 100%; }
	.lock-strip { display: flex; align-items: center; position: sticky; z-index: 20; top: var(--lock-top); height: var(--lock-h);
		margin-bottom: calc(var(--lock-h) * -1);   /* takes no room: it rides over the heading it copies */
		pointer-events: none;
		animation: lock-strip-out linear both; animation-timeline: --lock-body;
		animation-range: exit-crossing calc(100% - var(--lock-h)) exit-crossing 100%; }
	.lock-strip-text { display: flex; flex-direction: column; min-width: 0; max-width: 100%;
		animation: lock-strip-in linear both; animation-timeline: --lock-head; animation-range: exit-crossing 0% exit-crossing 70%; }
	@media (min-width: 40rem) { .lock-strip-text { flex-direction: row; align-items: baseline; gap: 1rem; } }
}
/* exit-crossing moves one pixel per pixel scrolled, so the cut stays exactly on the line.
   The huge negative sides never cut full-bleed rows, lifted tiles or shadows. */
@keyframes lock-clip { from { clip-path: inset(0 -100vw -100vh -100vw); } to { clip-path: inset(100% -100vw -100vh -100vw); } }
@keyframes lock-strip-out { to { opacity: 0; } }
@keyframes lock-strip-in { from { opacity: 0; } }
```

Pinned scenes that keep their own heading on screen turn the strip and the clip off while pinned (`.scene > .lock-strip { display: none } .scene > .lock-body { animation: none }`). Give a tall pinned scene's `.lock-body` `height: 100%`, so its sticky stage can still pin. Use the strip on landing sections and long reading pages, not on pages with a single intro.

---

## 10. Page patterns

- **Landing (home):**
  - Hero (8.3).
  - "Keep your progress" strip or a personal progress card.
  - Word band.
  - Arc flight of the entities (9.1).
  - Drum of how it works (9.2).
  - Impact scene with real numbers (9.3).
  - Catalogue track (9.4).
  - Winding road of "more to explore" (9.5).
  - Word band.
  - FAQ wheel (9.6).
  - Closing call to action: centred h2 `text-4xl sm:text-6xl`, one line, one large PillLink, wrapped in `.reveal`.
- **List pages:** a PageIntro with a count label (`[ 14 ITEMS ]`), then picture tiles in a grid (3 per row on desktop for posters, 4 for presets, 2 on phones), with `.stagger`.
- **Detail pages:** a header in the static shell (bracketed number label like `[ ITEM 05 ]`, the title as h1, a blurb, a poster), then numbered step tabs (BigNumber plus name, with the URL keeping `?step=`), then open sections. At the bottom: "Next item" plus "All items" PillLinks.
- **Reading pages** (about, methodology, privacy): numbered OpenSections with locked headings. Tables stay. "Store / never store" lists sit side by side with a check or cross icon on each line.
- **Profile:** three big open numbers (points, completed, badges), a medal grid (locked medals faded with a lock), a boxed completion card, and open rows for owned items.
- **Empty, loading and error states** on every screen:
  - Empty: an illustration, one sentence and one PillLink.
  - Loading: size-matched skeletons.
  - 404 and error pages: an illustration, a bracketed label, a heading and a way home. Keep the error page's imports minimal, because it ships with every page.
- **Shared and public pages:** a small wordmark, read-only content and one "Try it yourself" pill.

---

## 11. Accessibility (hard rules)

- WCAG 2.1 AA in **both** themes, enforced by the token contrast test and an axe audit of every page in both themes at desktop and phone widths, through Playwright plus `@axe-core/playwright`.
- Visible `:focus-visible` on every control (a 2 px accent outline, with offset on pills and tiles).
- Color is never the only signal: pair it with an icon and a word.
- Every decorative element is `aria-hidden`: pictures, bands, strips, markers, arrows and big numbers. Their meaning is in nearby text.
- Every drag has a keyboard and tap alternative (arrow keys on the wheel, focus handling on the pinned track, tap buttons beside drag-and-drop).
- Every animation respects reduced motion: CSS gates, the global kill switch, Motion's `reducedMotion="user"`, and confetti's `disableForReducedMotion`. Under reduced motion each scene shows its **final** picture.
- Pinned scenes must stay reachable by keyboard: scroll the page to make a focused element visible when the browser can't.
- One h1 per page. Labelled inputs. Icon-only buttons carry `aria-label`. Dialog focus is trapped and returned.

---

## 12. Performance rules (measured, non-negotiable)

Every effect here was measured with Lighthouse mobile (medians of 6-7 alternating runs against a baseline build, after dropping the cold first run) before it shipped. The rules that came out of it:

1. **Never fade in text on load.** Text at opacity 0 isn't painted, so a fade delays LCP by the animation's length. Rise, wipe or clip instead.
2. **Render-blocking CSS costs LCP in steps.** About 1 KB gzipped extra in the global CSS cost 0.15-0.45 s of simulated LCP on pages whose largest element is text. **CSS that only one page uses goes in a file imported by that page's component.** Small rules that every page needs stay global: splitting a 0.5 KB block into its own file added a third render-blocking request and cost more.
3. **No inline SVG art.** Use sprites with `<use>`. Defer sprites that sit near the top of the page.
4. **Fixed dimensions on every picture and size-matched skeletons:** CLS 0.
5. **Server components by default.** Make the client boundary as small as possible. The scroll scenes are CSS, so they need **no** JavaScript. The few scripts (stage trigger, wheel drag, track focus, ball physics) are tiny.
6. **Load decoration on idle** (`requestIdleCallback` plus dynamic import).
7. **Check the request list, not only the bytes,** when adding a client component to a shared layout. A lazy-loaded component once added a 1 KB loader stub to every page's load path, costing 0.3 s. A static import of 6 KB was faster.
8. **One heading font weight** (800). A display font where the h1 is the LCP costs about 0.15 s, which is a conscious trade.
9. **Self-host fonts** with `next/font`.
10. `content-visibility: auto` on sections gave a small gain but made full-page screenshots blank, so it was dropped. Motion's `whileInView` reveals were slower than CSS, so they were dropped too.
11. Keep the error boundary's imports minimal (it ships everywhere). Importing a class-merge helper there once split it into its own chunk on every page.
12. Never ship a change that measures slower than its baseline.

---

## 13. Gotchas that cost real time

- **Sticky needs no `overflow: hidden` ancestor.** Use `overflow: clip` (or `overflow-x: clip`) to hide overflow without creating a scroll container.
- `perspective` reaches only an element's **direct** children.
- `backwards`-fill entrance animations leave no transform behind. A leftover transform (from `forwards` or `both`) breaks sticky and fixed descendants.
- Individual transform properties (`translate`, `rotate`, `scale`) apply **before** `transform`. To keep a rotated child upright, put the whole sequence in one `transform`: `rotate(a) translateY(-R) rotate(-a - parentAngle)`.
- A rotated element's scrollable overflow is its rotated bounding box. Clip its stage at the window's edges, or the page gains a sideways scrollbar.
- A keyframe that sets `opacity` only at 0% and 100% interpolates across the whole animation. Set it at the hold keyframes too.
- An invisible (`opacity: 0`) element still catches pointer events and focus. Animate `visibility` together with opacity.
- A scroll range of `cover 0% cover 100%` puts a drawing front at `viewportHeight * (1 - progress)`. A shorter range runs ahead of what is visible, and a longer one lags.
- Judge "screens of scroll" in pixels on wide, short windows: one screen of height is only about 770 px of scroll.
- `translate: calc(-100% + 100cqw)` needs `container-type: inline-size` on the stage. It gives an exact flush end with no JavaScript.
- Hidden tabs throttle IntersectionObserver and `requestAnimationFrame`, so timed scenes look frozen in a background tab. Verify timing with Playwright frames.
- Headless Chromium can paint 3D-turned SVG text stale after a big scroll jump. Judge 3D scenes in real Chrome and wait about 400 ms after each scroll before a screenshot.
- `getComputedStyle(el).translate` can read `none` right after a scroll. `getBoundingClientRect()` is reliable, and it includes `translate`.
- axe flags outlined (transparent-fill) text on contrast even when `aria-hidden`. Use generated content.
- `pow()`, `sin()` and `clamp()` inside `scale` and `opacity` work in Chromium. An older browser drops the declaration and the effect, and nothing breaks.
- The React Compiler (if used) fails on a dynamic `import()` inside a component or hook. Move it to a plain module.
- next-themes ignores an emulated color scheme in tests. Set its storage key before navigating to get a themed screenshot.
- A bright turquoise (#39C5BB) giant word on near-black bloomed and grew a yellowish rim over the gold background glow, while passing contrast at 8.8:1. Giant words use the calmer display tokens (section 2.4).

---

## 14. Verification checklist for every UI change

- [ ] Screenshots at 1280 px and 390 px, in light and dark.
- [ ] For each pinned scene: screenshots at 5-8 points along its scroll; `document.documentElement.scrollWidth === innerWidth` at every point (no sideways scroll); scrolling back up reverses it; the window sizes 1024x700, 1152x600, 1280x720, 1366x650, 1440x900, 1920x1080, 390x844 and 360x640 all fit.
- [ ] Reduced motion shows the final, complete layout. Firefox (no scroll timelines) shows every section in place.
- [ ] axe passes on every page, in both themes, at both widths.
- [ ] The token contrast test and the style-guard test pass.
- [ ] In dark, every giant word and large fill is checked at 300-400% zoom for blooming or a colored rim (section 2.4).
- [ ] Lighthouse mobile medians are not worse than the baseline: score, LCP, blocking time, request count, and CLS 0.
- [ ] Keyboard only: every control reachable, focus visible, pinned items brought into view, dialogs trap and return focus.
- [ ] e2e probes for scroll scenes read `getBoundingClientRect` and computed `opacity`, `scale` and `clip-path` at set scroll progress. Write them before building the scene.

---

## 15. Adapting this to a new project

1. Rename `ent-a/b/c` to the product's own core concepts (2-4 of them). Pick one hue per concept that reaches 4.5:1 on both backgrounds, plus a calmer dark-theme display variant for giant words (section 2.4), and give each an icon.
2. Pick one accent. Darken it for light-theme text if it is pale, and keep the bright version as `--highlight`.
3. Keep the cream / near-black background pair, or choose another warm light and deep dark. Retune the hue glows (calmer and cooler in dark) and the shadow tint (the light background's own hue).
4. Choose a friendly body face and a heavy display face (one weight). Keep the -0.02em tracking floor.
5. Draw the sprite set: hero, one picture per concept doing the same task, one per step, one poster per catalogue item, empty states, 404 and error.
6. Map the landing story to scenes: concepts to the arc flight, steps to the drum, the key metric to the impact scene, the catalogue to the track, next destinations to the road, FAQ to the wheel. Drop the scenes the content doesn't need, but keep the shared skeleton (tall track, sticky stage, registered property, `contain` range, static fallback).
7. Keep the bans: no italics, no gradient text, no emojis, color never alone, no fade on load, no inline art, no scroll library.

Reference sites worth studying for this style: agency and product landing pages with pinned showcase scenes, giant words, drawn lines and floating pill headers (for example noomoagency.com and karma.business). Read their DOM and stylesheets for timings, rather than copying their WebGL or smooth-scroll libraries.
