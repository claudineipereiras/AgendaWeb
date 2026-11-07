# AgendaWeb Web Asset Pack & Integration Guide

All logo variants are saved as transparent, production-ready vector assets in your project storage and published to your workspace.

---

## 1. Available Production Vector Assets

| Asset Name | File Path | Viewport / Canvas | Recommended Use Cases |
| :--- | :--- | :--- | :--- |
| **Primary Full Logo (Concentric Sans)** | `Application/assets/logo.svg` | $1380 \times 480$ (2.875:1) | Website navigation header, admin portal masthead, invoice branding |
| **Standalone Icon / Mark (1:1 Square)** | `Application/assets/icon.svg` | $480 \times 480$ (1:1) | Browser favicon, PWA app launcher, mobile touch icons, avatars |
| **TechSousa Attribution Logo** | `Application/assets/techsousa-logo.png` | PNG | Developer credit in modal footer and settings drawer |

---

## 2. Direct HTML / CSS Implementation Snippets

### A. Website Header (Navigation Bar)
```html
<header class="app-header">
  <a href="#" class="brand" aria-label="AgendaWeb Home">
    <img 
      src="assets/logo.svg" 
      alt="AGENDAWEB - Your Cultural Web Feed" 
      width="207" 
      height="72" 
      style="height: 52px; width: auto; display: block;"
    />
  </a>
</header>
```

### B. Favicon & Mobile Touch Icons
```html
<link rel="icon" type="image/svg+xml" href="assets/icon.svg" />
<link rel="apple-touch-icon" href="assets/icon.svg" />
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
