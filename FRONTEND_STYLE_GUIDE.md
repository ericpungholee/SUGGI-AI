# SSUGI Frontend Style Guide

This guide documents the frontend styling system used in the SSUGI application. Use this guide to replicate the same design aesthetic and patterns in other applications.

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Layout & Spacing](#layout--spacing)
5. [Components](#components)
6. [Animations & Transitions](#animations--transitions)
7. [Icons](#icons)
8. [Custom Styles](#custom-styles)
9. [Design Patterns](#design-patterns)

---

## Technology Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Custom CSS**: Module CSS files for specific components

---

## Color System

### Primary Color Palette

The application uses a custom color palette with semantic naming. These colors need to be defined in your Tailwind configuration.

**Note**: The color values provided below are estimates based on the design aesthetic. For exact color values, you can:
1. Check the actual Tailwind config file in the SSUGI codebase
2. Inspect elements in the browser DevTools to extract exact hex values
3. Use the estimated values below and adjust as needed to match the visual design

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Primary colors - warm, paper-like aesthetic
        'paper': '#F5F5F0',        // Light cream/beige background
        'stone-light': '#F0F0EA',  // Very light stone/beige
        'ink': '#000000',          // Primary text color (black)
        
        // Brown palette - warm accents
        'brown-light': '#D4C5B9',  // Light brown for borders
        'brown-medium': '#8B7355', // Medium brown for buttons/accents
        'brown-dark': '#6B5D4F',   // Dark brown for hover states
        
        // Standard grays (used alongside custom colors)
        'gray-50': '#F9FAFB',
        'gray-100': '#F3F4F6',
        'gray-200': '#E5E7EB',
        'gray-300': '#D1D5DB',
        'gray-400': '#9CA3AF',
        'gray-500': '#6B7280',
        'gray-600': '#4B5563',
        'gray-700': '#374151',
        'gray-800': '#1F2937',
        'gray-900': '#111827',
      }
    }
  }
}
```

### Color Usage Patterns

#### Background Colors
- **Page Backgrounds**: `bg-stone-light`, `bg-paper`, `bg-white`
- **Card Backgrounds**: `bg-white`
- **Gradient Backgrounds**: `bg-gradient-to-br from-paper via-white to-stone-light`
- **Hover States**: `hover:bg-stone-light`, `hover:bg-gray-100`

#### Text Colors
- **Primary Text**: `text-ink` (black)
- **Secondary Text**: `text-ink/60`, `text-ink/70` (with opacity)
- **Tertiary Text**: `text-ink/40`, `text-ink/50`
- **Placeholder Text**: `text-ink/40`
- **Accent Text**: `text-brown-medium`

#### Border Colors
- **Subtle Borders**: `border-brown-light/20`, `border-brown-light/30`
- **Standard Borders**: `border-gray-200`, `border-gray-300`
- **Dark Borders**: `border-black`, `border-ink`
- **Hover Borders**: `hover:border-brown-light/40`

#### Button Colors
- **Primary Buttons**: `bg-ink text-paper` (black background, white text)
- **Secondary Buttons**: `bg-white border border-brown-light/20 text-ink`
- **Accent Buttons**: `bg-brown-medium text-white`
- **Hover States**: `hover:bg-ink/90`, `hover:bg-brown-dark`

---

## Typography

### Font Families

```javascript
// tailwind.config.js
fontFamily: {
  'sans': ['Arial', 'sans-serif'],
  'serif': ['Georgia', 'serif'], // Used for headings
}
```

### Font Sizes

- **Display Headings**: `text-4xl md:text-5xl lg:text-6xl` (Hero sections)
- **Page Titles**: `text-2xl`, `text-3xl`, `text-4xl`
- **Section Headings**: `text-xl`, `text-lg`
- **Body Text**: `text-sm`, `text-base`
- **Small Text**: `text-xs`

### Font Weights

- **Bold Headings**: `font-bold`, `font-semibold`
- **Medium Text**: `font-medium`
- **Regular Text**: Default (no class)

### Typography Examples

```tsx
// Hero Heading
<h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-ink mb-8">
  Your Heading
</h1>

// Page Title
<h1 className="text-2xl font-bold text-ink mb-2">
  Page Title
</h1>

// Section Heading
<h2 className="text-lg font-medium text-ink/70">
  Section Title
</h2>

// Body Text
<p className="text-sm text-ink/60">
  Body text content
</p>

// Caption
<span className="text-xs text-ink/40">
  Caption text
</span>
```

---

## Layout & Spacing

### Container Patterns

```tsx
// Max-width container
<div className="max-w-4xl mx-auto">
  {/* Content */}
</div>

// Full-width with padding
<div className="px-6 py-8">
  {/* Content */}
</div>

// Page wrapper
<div className="flex h-screen bg-stone-light">
  {/* Sidebar and main content */}
</div>
```

### Grid Layouts

```tsx
// Responsive grid (cards)
<div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {/* Grid items */}
</div>

// Two-column grid
<div className="grid md:grid-cols-2 gap-8">
  {/* Grid items */}
</div>
```

### Spacing Scale

- **Tight Spacing**: `gap-1`, `gap-2`, `p-1`, `p-2`
- **Standard Spacing**: `gap-4`, `p-4`, `px-3 py-2`
- **Comfortable Spacing**: `gap-6`, `gap-8`, `p-6`, `p-8`
- **Section Spacing**: `mb-6`, `mb-8`, `mb-12`, `py-16`

---

## Components

### Buttons

#### Primary Button
```tsx
<button className="w-full py-3 bg-ink text-paper rounded-lg hover:bg-ink/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
  Button Text
</button>
```

#### Secondary Button
```tsx
<button className="px-4 py-2 bg-white border border-brown-light/20 rounded-lg hover:bg-stone-light transition-colors text-ink">
  Button Text
</button>
```

#### Accent Button
```tsx
<button className="inline-flex items-center gap-2 bg-brown-medium text-white px-6 py-3 rounded-lg hover:bg-brown-dark transition-colors font-medium">
  Button Text
</button>
```

#### Icon Button
```tsx
<button className="p-2 hover:bg-stone-light rounded-lg transition-colors">
  <Icon className="w-4 h-4 text-ink/60" />
</button>
```

### Cards

#### Document Card
```tsx
<div className="group bg-white border border-brown-light/20 rounded-xl p-4 hover:bg-stone-light/80 transition-all hover:-translate-y-0.5 hover:shadow-md">
  <div className="flex items-start justify-between mb-3">
    <Icon className="w-5 h-5 text-brown-medium" />
    {/* Action buttons - shown on hover */}
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Actions */}
    </div>
  </div>
  <h3 className="font-medium text-ink mb-2 line-clamp-1 hover:text-brown-medium transition-colors">
    Card Title
  </h3>
  <p className="text-sm text-ink/60 mb-3 line-clamp-2">
    Card description
  </p>
  <div className="flex items-center justify-between text-xs text-ink/40">
    {/* Metadata */}
  </div>
</div>
```

#### Feature Card
```tsx
<div className="group p-8 bg-white rounded-2xl border-4 border-black hover:shadow-2xl transition-all duration-700 hover:-translate-y-2">
  <div className="w-14 h-14 bg-white border-4 border-black rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
    <Icon className="w-7 h-7 text-black" strokeWidth={2.5} />
  </div>
  <h3 className="text-xl font-semibold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">
    Feature Title
  </h3>
  <p className="text-black/70 leading-relaxed group-hover:text-black/80 transition-colors duration-300">
    Feature description
  </p>
</div>
```

### Input Fields

#### Text Input
```tsx
<input
  type="text"
  className="w-full px-3 py-2 border border-brown-light/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-medium focus:border-transparent"
  placeholder="Enter text..."
/>
```

#### Input with Icon
```tsx
<div className="relative">
  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
  <input
    type="text"
    className="w-full pl-10 pr-4 py-3 border border-brown-light/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brown-medium/50 transition-all"
    placeholder="Enter text..."
  />
</div>
```

#### Search Input
```tsx
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
  <input
    type="text"
    className="w-full pl-12 pr-12 py-3 bg-white border border-brown-light/20 rounded-xl text-sm focus:outline-none focus:ring-0 focus:border-brown-light/40 transition-all duration-200 hover:border-brown-light/30"
    placeholder="Search..."
  />
  {query && (
    <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-light rounded-lg transition-colors">
      <X className="w-4 h-4 text-ink/40" />
    </button>
  )}
</div>
```

### Modals

#### Modal Overlay
```tsx
<div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
  <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
    {/* Modal content */}
  </div>
</div>
```

#### Modal Header
```tsx
<div className="flex items-center justify-between mb-6">
  <h2 className="text-xl font-semibold text-ink">
    Modal Title
  </h2>
  <button
    onClick={onClose}
    className="p-2 hover:bg-stone-light rounded-lg transition-colors"
  >
    <X className="w-5 h-5 text-ink/60" />
  </button>
</div>
```

### Toolbars

#### Editor Toolbar
```tsx
<div className="h-14 editor-toolbar flex items-center px-4 gap-2 overflow-x-auto min-w-0">
  {/* Toolbar items with dividers */}
  <div className="w-px h-6 bg-gray-300"></div>
  {/* Buttons and controls */}
</div>
```

### Sidebar

#### Sidebar Container
```tsx
<aside className="w-64 bg-white border-r border-brown-light/20 flex flex-col">
  <div className="h-16 border-b border-brown-light/20">
    {/* Header */}
  </div>
  <div className="p-4">
    {/* Sidebar content */}
  </div>
</aside>
```

### Loading States

#### Skeleton Loading
```tsx
<div className="animate-pulse">
  <div className="h-5 bg-gray-200 rounded mb-3"></div>
  <div className="h-4 bg-gray-200 rounded mb-2"></div>
  <div className="h-3 bg-gray-200 rounded"></div>
</div>
```

#### Spinner
```tsx
<Loader2 className="w-5 h-5 animate-spin" />
```

---

## Animations & Transitions

### Transition Patterns

```tsx
// Standard transition
className="transition-all duration-200"

// Color transition
className="transition-colors"

// Transform transition
className="transition-transform duration-300"

// Combined transitions
className="transition-all duration-700 hover:-translate-y-2"
```

### Hover Effects

```tsx
// Card hover
className="hover:-translate-y-0.5 hover:shadow-md transition-all"

// Button hover
className="hover:bg-ink/90 transition-all"

// Scale on hover
className="group-hover:scale-110 transition-transform duration-300"

// Opacity on hover (for groups)
className="opacity-0 group-hover:opacity-100 transition-opacity"
```

### Animations

```tsx
// Fade in
className="animate-in slide-in-from-bottom-2 duration-300"

// Pulse
className="animate-pulse"

// Spin
className="animate-spin"
```

---

## Icons

### Icon Library

The application uses **Lucide React** for all icons.

### Installation

```bash
npm install lucide-react
```

### Icon Usage Patterns

```tsx
import { Search, X, FileText, Folder, Bookmark } from 'lucide-react'

// Standard icon
<Search className="w-5 h-5 text-ink/40" />

// Icon in button
<button className="p-2 hover:bg-stone-light rounded-lg">
  <X className="w-4 h-4 text-ink/60" />
</button>

// Colored icon
<FileText className="w-5 h-5 text-brown-medium" />

// Icon with custom stroke
<Icon className="w-7 h-7 text-black" strokeWidth={2.5} />
```

### Common Icon Sizes

- **Small**: `w-3 h-3`, `w-4 h-4`
- **Medium**: `w-5 h-5`
- **Large**: `w-6 h-6`, `w-7 h-7`, `w-8 h-8`

---

## Custom Styles

### Table Styles

The application includes custom CSS for tables. Create a file `table-styles.css`:

```css
/* Table Styles */
.editor-table {
  border-collapse: separate;
  border-spacing: 0;
  margin: 20px 0;
  border-radius: 8px;
  overflow: hidden;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 2px solid #000000;
}

.editor-table td,
.editor-table th {
  border-right: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
  padding: 12px 16px;
  min-width: 100px;
  min-height: 44px;
  position: relative;
  vertical-align: top;
  background: white;
  color: #000000;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.editor-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #000000;
  border-bottom: 2px solid #000000;
}

.editor-table td:hover,
.editor-table th:hover {
  background: #f5f5f5;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.editor-table td:focus,
.editor-table th:focus {
  outline: 2px solid #000000;
  outline-offset: -2px;
  background: #fafafa;
  box-shadow: inset 0 0 0 2px #000000;
}
```

### Agent Text Styles

For AI-generated text highlighting, create `agent-text-styles.css`:

```css
/* Agent Text Styling */
.agent-text-block {
  position: relative;
  transition: all 0.3s ease;
}

.agent-text-block[data-is-approved="false"] {
  color: #6b7280;
  background: rgba(107, 114, 128, 0.1);
  border-bottom: 1px solid #d1d5db;
  padding: 2px 4px;
  border-radius: 3px;
}

.agent-text-block[data-is-approved="false"]:hover {
  background: rgba(107, 114, 128, 0.15);
  transform: scale(1.02);
}

.agent-text-block[data-is-approved="true"] {
  color: #000000;
  background: transparent;
  border: none;
  padding: 0;
}

.agent-text-block.typing {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

.agent-text-overlay {
  position: absolute;
  pointer-events: auto;
  z-index: 15;
  border-radius: 6px;
  padding: 8px 12px;
  margin: 4px;
  font-size: inherit;
  line-height: inherit;
  font-family: inherit;
  transition: all 0.3s ease;
  cursor: pointer;
  user-select: none;
  max-width: 80%;
  word-wrap: break-word;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.agent-text-overlay.pending {
  background: rgba(107, 114, 128, 0.1);
  border: 1px solid #d1d5db;
  color: #6b7280;
}

.agent-text-overlay.approved {
  background: rgba(0, 0, 0, 0.02);
  border: 2px solid rgba(0, 0, 0, 0.1);
  color: #000000;
}
```

---

## Design Patterns

### Border Radius

- **Small**: `rounded`, `rounded-md` (4px)
- **Medium**: `rounded-lg` (8px)
- **Large**: `rounded-xl` (12px)
- **Extra Large**: `rounded-2xl` (16px)
- **Full**: `rounded-full` (9999px)

### Shadows

- **Subtle**: `shadow-sm`
- **Standard**: `shadow-md`
- **Large**: `shadow-lg`, `shadow-xl`
- **Extra Large**: `shadow-2xl`
- **Hover**: `hover:shadow-md`, `hover:shadow-2xl`

### Opacity Usage

- **Full**: No opacity class (100%)
- **High**: `/90` (90%)
- **Medium**: `/70`, `/60` (70%, 60%)
- **Low**: `/50`, `/40` (50%, 40%)
- **Very Low**: `/30`, `/20` (30%, 20%)

### Border Patterns

```tsx
// Subtle border
className="border border-brown-light/20"

// Standard border
className="border border-gray-200"

// Thick border
className="border-2 border-black"

// Colored border
className="border-4 border-black"

// No border on last item
className="border-b border-gray-200 last:border-b-0"
```

### Focus States

```tsx
// Standard focus
className="focus:outline-none focus:ring-2 focus:ring-brown-medium focus:border-transparent"

// Blue focus (for inputs)
className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
```

### Responsive Design

```tsx
// Mobile-first approach
className="text-sm md:text-base lg:text-lg"

// Hide on mobile
className="hidden md:block"

// Show on mobile only
className="block md:hidden"

// Responsive grid
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
```

### Empty States

```tsx
<div className="text-center py-12">
  <div className="w-16 h-16 mx-auto mb-4 bg-stone-light rounded-full flex items-center justify-center">
    <Icon className="w-8 h-8 text-ink/40" />
  </div>
  <h3 className="text-lg font-medium text-ink/70 mb-2">
    No items found
  </h3>
  <p className="text-ink/50 mb-6">
    Start by creating your first item
  </p>
  <button className="inline-flex items-center gap-2 bg-brown-medium text-white px-4 py-2 rounded-lg hover:bg-brown-dark transition-colors">
    Create Item
  </button>
</div>
```

### Loading States

```tsx
// Skeleton cards
<div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {[...Array(4)].map((_, i) => (
    <div key={i} className="bg-white border border-brown-light/20 rounded-xl p-5 animate-pulse">
      <div className="h-5 bg-gray-200 rounded mb-3"></div>
      <div className="h-4 bg-gray-200 rounded mb-2"></div>
      <div className="h-3 bg-gray-200 rounded"></div>
    </div>
  ))}
</div>
```

---

## Complete Tailwind Configuration

Create a `tailwind.config.js` file with the following configuration:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'paper': '#F5F5F0',
        'stone-light': '#F0F0EA',
        'ink': '#000000',
        'brown-light': '#D4C5B9',
        'brown-medium': '#8B7355',
        'brown-dark': '#6B5D4F',
      },
      fontFamily: {
        'sans': ['Arial', 'sans-serif'],
        'serif': ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
```

---

## Implementation Checklist

When implementing this design system in a new application:

- [ ] Install and configure Tailwind CSS
- [ ] Add custom color palette to Tailwind config
- [ ] Install Lucide React icons
- [ ] Create custom CSS files for tables and agent text (if needed)
- [ ] Set up font families (serif for headings)
- [ ] Create reusable component patterns (buttons, cards, inputs)
- [ ] Implement responsive grid layouts
- [ ] Add transition and animation utilities
- [ ] Test hover states and interactions
- [ ] Verify color contrast for accessibility
- [ ] Test on multiple screen sizes

---

## Examples

### Complete Page Example

```tsx
export default function ExamplePage() {
  return (
    <div className="flex h-screen bg-stone-light">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-brown-light/20 flex flex-col">
        <div className="h-16 border-b border-brown-light/20 p-4">
          <h1 className="text-xl font-serif text-ink">App Name</h1>
        </div>
        <div className="p-4">
          {/* Sidebar content */}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-brown-light/20 px-8 flex items-center">
          <h2 className="text-2xl font-bold text-ink">Page Title</h2>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-4xl mx-auto">
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" />
                <input
                  type="text"
                  className="w-full pl-12 pr-4 py-3 bg-white border border-brown-light/20 rounded-xl text-sm focus:outline-none focus:ring-0 focus:border-brown-light/40 transition-all duration-200"
                  placeholder="Search..."
                />
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group bg-white border border-brown-light/20 rounded-xl p-4 hover:bg-stone-light/80 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <h3 className="font-medium text-ink mb-2 line-clamp-1 hover:text-brown-medium transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-ink/60 mb-3 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
```

---

## Notes

- The design system emphasizes a warm, paper-like aesthetic with subtle brown accents
- Black (`ink`) is used as the primary text color for high contrast
- Opacity variations create visual hierarchy without using multiple colors
- Hover effects are subtle but provide clear feedback
- The system is designed to be clean, minimal, and professional
- All interactive elements have proper hover and focus states
- The design is fully responsive with mobile-first approach

---

## Support

For questions or clarifications about this style guide, refer to the source components in the SSUGI codebase or update this guide as the design system evolves.

