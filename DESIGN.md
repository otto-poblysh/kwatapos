---
name: Kwata POS
description: Modern Point of Sale for dual-business setup
colors:
  primary: "#000000"
  surface-primary: "#FFFFFF"
  surface-secondary: "#F2F2F7"
  text-primary: "#111111"
  text-secondary: "#8E8E93"
  success: "#34C759"
  danger: "#FF3B30"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 700
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "16px"
  lg: "24px"
  pill: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-primary}"
    rounded: "{rounded.pill}"
    padding: "16px 24px"
  card-default:
    backgroundColor: "{colors.surface-primary}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: Kwata POS

## Overview

**Creative North Star: "High-Contrast Native Utility"**

The Kwata POS interface draws heavy inspiration from modern iOS paradigms: it is stark, highly legible, and relies on contrast rather than color floods to establish hierarchy. The aesthetic is clean and surgical, using deep blacks and stark whites to guide the user's eye instantly to key actions—perfect for a fast-paced bar environment. It embraces generous corner radii, pill-shaped buttons, and floating navigation to feel undeniably native to iOS.

**Key Characteristics:**
- Stark monochromatic foundation (black and white) with sparse semantic color accents.
- Large, highly legible typographic hierarchy utilizing system fonts.
- Exaggerated corner radii (24px for cards, pills for buttons).
- Flat surface layering relying on borders and contrast rather than heavy drop shadows.

## Colors

The palette is intentionally monochromatic, ensuring that when color is used (for success or alerts), it commands immediate attention.

### Primary
- **Pitch Black** (#000000): Used for primary action buttons, selected toggle states, and hero value cards (e.g., total balance/sales). It grounds the interface.

### Neutral
- **Surface White** (#FFFFFF): The primary card and container background in light mode.
- **Off-White Backdrop** (#F2F2F7): The app's root background color in light mode, providing contrast for the white cards.
- **Primary Ink** (#111111): Used for all primary body text and headers.
- **Secondary Ink** (#8E8E93): Used for timestamps, muted labels, and secondary information.

### Semantic
- **System Green** (#34C759): Positive trends, completed orders, and stock arrivals.
- **System Red** (#FF3B30): Fragile alerts, cancelled orders, and low stock warnings.

**The One Voice Rule.** The primary accent (Black in light mode, White in dark mode) is used on ≤10% of any given screen. Its rarity and high contrast are the point.

## Typography

**Display Font:** System UI / SF Pro Display (with Inter fallback)
**Body Font:** System UI / SF Pro Text (with Inter fallback)

**Character:** Utilitarian, highly legible, and unmistakably iOS. Numbers are prominent and tabular where necessary for quick scanning of prices and totals.

### Hierarchy
- **Display** (700, 2rem+, 1.1): Hero numbers (e.g., balances) and major screen titles.
- **Headline** (600, 1.5rem, 1.2): Card titles and section headers.
- **Body** (400, 1rem, 1.5): Standard list items, customer names, and standard descriptions.
- **Label** (500, 0.875rem, normal): Small tags, status indicators, and micro-copy.

**The Number Prominence Rule.** Financial figures (balances, totals) are always treated as Display text and set at least two steps larger than surrounding text.

## Layout

The spatial model uses a mobile-first, edge-to-edge container strategy. Elements breathe with generous padding.
- **Rhythm:** Base-8 scale (8px, 16px, 24px, 32px).
- **Density:** Loose. Touch targets are large (minimum 44x44pt) to accommodate fast, imprecise taps by bar staff.

## Elevation & Depth

The system uses a **Flat-By-Default** strategy. Depth is conveyed through tonal layering (white cards on an off-white background) and subtle strokes.

### Shadow Vocabulary
- **Floating Ambient** (`box-shadow: 0 8px 32px rgba(0,0,0,0.08)`): Reserved *exclusively* for floating elements like the bottom navigation pill or popover tooltips.

**The Flat-By-Default Rule.** Surfaces are flat at rest. Drop shadows are banished from standard cards and buttons to maintain a clean, modern look.

## Shapes

Forms are highly rounded, friendly, and tactile.
- **Cards:** 24px radius (`{rounded.lg}`).
- **Buttons & Chips:** Fully rounded / Pill shape (`9999px` / `{rounded.pill}`).
- **Icons & Avatars:** Circular.

## Components

For each component, lead with a short character line, then specify shape, color assignment, states, and any distinctive behavior.

### Buttons
- **Shape:** Pill-shaped (`9999px`)
- **Primary:** Pitch Black background, Surface White text. Generous padding (16px vertical, 24px horizontal).
- **Secondary:** Surface White background, Pitch Black text, with a subtle 1px Pitch Black border.
- **Hover/Active:** Slight scale down (`transform: scale(0.96)`) to mimic iOS touch responsiveness.

### Cards / Containers
- **Corner Style:** 24px radius
- **Background:** Surface White (or Pitch Black for emphasized hero cards)
- **Border:** None, or a subtle 1px border (`#E5E5EA`) for separation if needed on same-color backgrounds.
- **Internal Padding:** 20px - 24px

### Inputs / Fields
- **Style:** None stroke, Surface secondary background (`#F2F2F7`), 12px radius.
- **Focus:** Subtle inner glow or border shift.

### Navigation
- **Floating Pill Bottom Nav:** A detached, floating pill at the bottom of the screen housing icon navigation. Active state uses a contrasting black pill background with white icons.

## Do's and Don'ts

### Do:
- **Do** use Pitch Black as the highest-emphasis background for the single most important card on a screen.
- **Do** use large, bold typography for numerical data and prices.
- **Do** ensure all interactive areas are at least 44x44px for fast, error-free tapping.

### Don't:
- **Don't** use drop shadows on standard content cards. Rely on background contrast (white on off-white).
- **Don't** use sharp corners (`< 12px` radius) on primary layout containers. 
- **Don't** flood the screen with color. Keep the background monochromatic and use green/red only for semantic meaning.
