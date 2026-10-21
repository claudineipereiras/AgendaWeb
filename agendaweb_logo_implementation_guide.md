# AgendaWeb Web Asset Pack & Integration Guide

All logo variants are saved as transparent, production-ready vector assets in your project storage and published to your workspace.

---

## 1. Available Saved Assets & Placeholders

| Asset Name | Placeholder / Reference | Recommended Use Cases |
| :--- | :--- | :--- |
| **Primary Full Logo (Geometric Sans)** | `{{DATA:IMAGE:IMAGE_1}}` | Desktop & mobile website navigation header, sticky headers, invoices, footer branding |
| **Original Reference Recreation** | `{{DATA:IMAGE:IMAGE_2}}` | 1:1 match of original photo reference (8 calendar grid cells) |
| **Editorial Serif Logo** | `{{DATA:IMAGE:IMAGE_4}}` | Editorial articles, print, high-end cultural publications |
| **Standalone Icon / Mark (Square/Favicon)** | `{{DATA:IMAGE:IMAGE_6}}` | Favicon (`32x32`), PWA App Icon (`192x192`, `512x512`), avatar badges, social media profiles |

---

## 2. Direct HTML / CSS Implementation Snippets

### A. Website Header (Navigation Bar)
```html
<header class="site-header">
  <a href="/" class="brand-link" aria-label="AgendaWeb Home">
    <img 
      src="{{DATA:IMAGE:IMAGE_1}}" 
      alt="AGENDAWEB - Your Cultural Web Feed" 
      width="220" 
      height="100" 
      style="height: 48px; width: auto; display: block;"
    />
  </a>
</header>
```

### B. Favicon & Mobile Touch Icons
```html
<link rel="icon" type="image/svg+xml" href="{{DATA:IMAGE:IMAGE_6}}" />
<link rel="apple-touch-icon" href="{{DATA:IMAGE:IMAGE_6}}" />
```

### C. Inline SVG Embedding
You can also embed the SVG source code directly inside your HTML or React / Vue components for zero network latency and CSS styling.

---

## 3. Brand Color Tokens
- **Amber Rust:** `#C85A32` (Bookmark ribbon, CTA buttons)
- **Sage Green:** `#4A5D4E` (RSS signal arcs, live feed badges)
- **Nightfall:** `#1B3B2B` (Typography, calendar rings & grid, dark backgrounds)
- **Chalk:** `#F7F5F0` (Calendar faceplate, primary page canvas background)
- **Oat:** `#E6E2D8` (Subtle borders and dividers)
