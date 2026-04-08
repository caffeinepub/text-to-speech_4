# Design Brief

## Direction

Deep Navy Dark — minimalist dark-mode tool UI with indigo/violet accent system

## Tone

Refined brutalist minimalism: every element earns its place, zero decoration, maximum contrast and clarity

## Differentiation

The oversized live letter pop-out with drop-shadow glow is the single unforgettable moment — a utility app that becomes expressive at the moment of recognition

## Color Palette

| Token      | OKLCH          | Role                         |
| ---------- | -------------- | ---------------------------- |
| background | 0.11 0.022 265 | Deep navy page background    |
| foreground | 0.93 0.01 265  | Primary text                 |
| card       | 0.16 0.026 265 | Elevated surface / panels    |
| primary    | 0.62 0.24 262  | Indigo accent / CTAs         |
| accent     | 0.20 0.022 265 | Subtle hover backgrounds     |
| muted      | 0.20 0.022 265 | Subdued backgrounds          |

## Typography

- Display: Plus Jakarta Sans — headings, tab labels, brand name
- Body: Plus Jakarta Sans — all UI copy and labels
- Mono: Geist Mono — letter pop display, recognized text output
- Scale: hero `text-2xl font-extrabold tracking-tight`, label `text-xs font-semibold text-muted-foreground`, body `text-sm`

## Elevation & Depth

Three levels: background (0.11) → card (0.16) → input (0.20); shadow-elevated on panels, shadow-subtle on small elements

## Structural Zones

| Zone    | Background         | Border          | Notes                     |
| ------- | ------------------ | --------------- | ------------------------- |
| Header  | bg-card            | border-b        | Elevated from content     |
| Content | bg-background      | —               | Single operational box    |
| Footer  | none               | —               | No footer by design       |

## Spacing & Rhythm

px-6 py-10 on main content, p-6/p-8 inside panels, gap-4 between tab items, space-y-5 in forms

## Component Patterns

- Buttons: rounded-full, bg-primary for primary, outline/secondary variants; hover:-translate-y-0.5 transition
- Cards: rounded-2xl, bg-card, border-border, shadow-elevated
- Tabs: pill-shaped rounded-full, active state bg-primary text-primary-foreground

## Motion

- Entrance: fade-up 0.45s ease-out on main container
- Hover: -translate-y-0.5 on all interactive elements, 0.3s smooth
- Decorative: spring pop animation on detected letter (scale 0.3→1, spring stiffness 400)

## Constraints

- No footer — per explicit user requirement
- Dark mode only — no light mode toggle
- Semantic tokens only — no raw colors in components

## Signature Detail

The glowing drop-shadow letter pop-out in Sign-to-Text: a 8rem monospace letter that spring-animates into view with `filter: drop-shadow(0 0 20px currentColor)` — color-coded red/amber/green by confidence
