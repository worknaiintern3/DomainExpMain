---
name: Precision Registrar
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464555'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#004598'
  on-tertiary: '#ffffff'
  tertiary-container: '#005cc6'
  on-tertiary-container: '#cedbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a42'
  on-tertiary-fixed-variant: '#004395'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  caption-xs:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit-2xs: 0.125rem
  unit-xs: 0.25rem
  unit-sm: 0.5rem
  unit-md: 0.75rem
  unit-base: 1rem
  unit-lg: 1.5rem
  unit-xl: 2rem
  unit-2xl: 3rem
  gutter-table: 0.75rem
  sidebar-width: 16rem
  header-height: 3.5rem
---

## Brand & Style

This design system embodies high-throughput domain asset intelligence, blending corporate reliability with modern software engineering craftsmanship. The aesthetic references the structured utility of Linear, the technical clarity of Stripe, and the monochrome discipline of Vercel.

### Design Movement
**Engineered Modernism:** Utilitarian, data-dense, and structurally calm. Visual weight is maintained through precision borders, high typographic hierarchy, and purposeful chromatic anchors rather than decorative gradients or heavy elevation.

### Emotional Target
- **Control & Foresight:** DNS records, expiration dates, valuation metrics, and transfer statuses are instantly scannable without visual noise.
- **Institutional Authority:** Grounded in enterprise deep navy and cool slate foundations that evoke security and operational permanence.
- **Velocity:** Crisp micro-interactions and tight spatial rhythm that respect the workflows of portfolio managers, venture operators, and infrastructure teams.

## Colors

The palette leverages a high-contrast foundation balanced against cool slate tones, allowing semantic status indicators (DNS health, transfer locks, auctions) to command immediate attention.

### Palette Architecture
- **Canvas Base:** `#F8FAFC` (Slate-50) creates a clear, glare-reducing workspace across large multi-monitor operations.
- **Structural Chrome:** `#0F172A` (Slate-900) anchors persistent operational surfaces including navigation sidebars and dark terminal drawers.
- **Core Interactive:** `#4F46E5` (Indigo-600) drives primary transactional triggers, domain purchase actions, and selection states. `#3B82F6` (Blue-500) provides active focus rings and informational accents.
- **Typography Matrix:** `#0F172A` for high-impact metric headers, `#1E293B` (Slate-800) for standard data rows, and `#64748B` (Slate-500) for supporting metadata and column headers.
- **Status Accents:**
  - **Healthy / Resolved:** `#10B981` (Emerald-500) with `#ECFDF5` (Emerald-50) backing.
  - **Impending Renewal / Cautionary:** `#F59E0B` (Amber-500) with `#FFFBEB` (Amber-50) backing.
  - **Expired / Transfer Blocked:** `#EF4444` (Red-500) with `#FEF2F2` (Red-50) backing.

## Typography

Typography prioritizes tabular clarity and structural rigor. Inter handles global interface hierarchy, while JetBrains Mono provides unambiguous rendering for Top-Level Domains (TLDs), IP addresses, NS records, and transaction hashes.

### Rules & Guidelines
- **Tabular Figures:** Always apply `font-feature-settings: "tnum"` to numerical columns, domain expiration counts, and valuation figures to ensure aligned data scanning.
- **Monospace Usage:** Restrict `label-mono` strictly to machine-readable values: Apex domains, nameservers, TXT/CNAME records, and verification tokens.
- **Weight Restraint:** Limit headline weights to Semi-Bold (600) to maintain crisp edges at high DPI without bleed. Avoid Ultra-Bold styles.

## Layout & Spacing

The spatial architecture is driven by an uncompromising strict 8px foundational grid, dropping to 4px for fine-grained inline data alignment and badge structures.

### Grid & Density
- **Global Frame:** Fixed sidebar navigation (`16rem` / `256px`) with a full-bleed, responsive main viewpane.
- **Data Densities:** Table rows enforce a strict 44px compact height for standard operations, scaling to 36px for dense audit logs and 56px for discovery auction listings.
- **Breakpoints:**
  - `sm` (640px): Sidebar collapses to bottom sheet or off-canvas drawer; metric cards stack to 1 column.
  - `md` (768px): Filter toolbars wrap to multi-tier controls.
  - `lg` (1024px): 2-to-3 column dashboard layouts; metrics display in a 4-up horizontal strip.
  - `xl` (1280px+): Persistent master-detail inspection drawers occupy the right 420px column.

## Elevation & Depth

This design system avoids theatrical drop shadows, using structured borders and hairline separations to define layout boundaries.

### Separation Principles
- **Hairline Boundaries:** Surface planes are primarily distinguished by `1px solid #E2E8F0` (Slate-200) borders in light mode and `1px solid #1E293B` (Slate-800) in dark sidebar contexts.
- **Card Depth:** Elevation 0 (Flat). Cards use pure `#FFFFFF` fill bounded by Slate-200 borders, supplemented with a calibrated micro-shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.04)`.
- **Floating Overlays (Flyouts, Menus, Selects):**
  - Dropdown Menus: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
  - DNS Configuration Drawers & Modals: `0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.
- **Tonal Stacking:** Main application background `#F8FAFC` -> Card/Table Surface `#FFFFFF` -> Input/Nested Row Hover `#F1F5F9`.

## Shapes

The design uses a restrained, technical shape language (`roundedness: 1` / Soft). This keeps geometry compact and aligns with dense tabular information.

### Token Applications
- **Base Inputs & Buttons:** `4px` (`0.25rem`) border radius creates an intentional, tool-grade feel.
- **Cards, Panels & Modals:** `8px` (`0.5rem`) border radius softens macro view boundaries while maintaining horizontal and vertical alignment lines.
- **Badges & Status Tags:** Pill-radius (`9999px`) is reserved exclusively for semantic domain status pills (e.g., "Active", "Expiring", "Auto-Renew On") to immediately differentiate status tokens from interactive square-corner buttons.

## Components

### Buttons
- **Primary:** Background `#4F46E5`, text `#FFFFFF`, border `1px solid #4338CA`. Subtle inset top highlight `inset 0 1px 0 0 rgba(255,255,255,0.15)`. Hover: `#4338CA`.
- **Secondary:** Background `#FFFFFF`, text `#0F172A`, border `1px solid #CBD5E1`. Hover: `#F8FAFC`.
- **Tertiary/Ghost:** Background transparent, text `#64748B`. Hover: background `#F1F5F9`, text `#0F172A`.
- **Destructive:** Background `#FEF2F2`, text `#DC2626`, border `1px solid #FECACA`. Hover: `#DC2626`, text `#FFFFFF`.
- **Height & Padding:** Standard height 36px (padding 0 12px); Small height 28px (padding 0 8px).

### Data Tables
- **Header:** Height 32px, background `#F8FAFC`, border-bottom `1px solid #E2E8F0`. Text formatted with `caption-xs`, uppercase, tracking `0.05em`, color `#64748B`.
- **Rows:** Alternating transparent to `#FFFFFF` background. Border-bottom `1px solid #F1F5F9`. Hover state shifts row to `#F8FAFC` across all pinned columns.
- **Cells:** Vertical alignment centered, inline padding 12px. Tabular monospace applied to domain names and numeric counters.

### Status Badges
- Constructed with `height: 20px`, inline padding `6px`, font `caption-xs`, pill-shaped (`9999px`).
- Include an internal 6px solid dot indicator:
  - **Healthy / Live:** Dot `#10B981`, background `#ECFDF5`, text `#065F46`, border `1px solid #A7F3D0`.
  - **Expiring Soon:** Dot `#F59E0B`, background `#FFFBEB`, text `#92400E`, border `1px solid #FDE68A`.
  - **Action Required:** Dot `#EF4444`, background `#FEF2F2`, text `#991B1B`, border `1px solid #FECACA`.

### Form Inputs & Search Fields
- Standard height 36px, background `#FFFFFF`, border `1px solid #CBD5E1`, radius `4px`.
- Text style `body-md`. Placeholder color `#94A3B8`.
- Focus ring: `box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #3B82F6`, border-color `#3B82F6`.
- Integrated search inputs must embed an explicit keyboard shortcut affordance on the right edge (`⌘K` tag using `caption-xs`, background `#F1F5F9`, border `1px solid #E2E8F0`).

### Checkboxes & Selection Controls
- Checkbox dimensions: 16x16px, border `1px solid #CBD5E1`, radius `3px`.
- Checked state: Background `#4F46E5`, border-color `#4F46E5`, icon white checkmark.
- Indeterminate state supported for bulk domain selection.

### Domain Metric Cards
- Background `#FFFFFF`, border `1px solid #E2E8F0`, padding 16px, radius `8px`.
- Micro-layout: Title `caption-xs` in uppercase `#64748B`, metric value `headline-md` `#0F172A`, trend indicator `label-md` with directional icon (`#10B981` positive, `#EF4444` negative).