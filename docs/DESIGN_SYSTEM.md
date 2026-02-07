# Billedy - Sistema de Diseño

Este documento define las decisiones de diseño establecidas en la landing page para replicar en el resto del sistema.

## Tipografía

### Fuente Principal
- **Familia**: Google Sans
- **Ubicación**: `/public/fonts/`
- **Pesos disponibles**:
  - Regular (400) - Texto normal
  - Medium (500) - Énfasis suave
  - Bold (700) - Títulos y destacados

### Configuración
```css
/* En globals.css */
@font-face {
  font-family: 'Google Sans';
  src: url('/fonts/GoogleSans-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```

### Jerarquía de Texto
| Elemento | Clase | Uso |
|----------|-------|-----|
| H1 | `text-4xl md:text-5xl lg:text-6xl font-bold` | Título hero |
| H2 | `text-2xl md:text-3xl font-bold` | Títulos de sección |
| H3 | `text-lg font-bold` | Títulos de cards |
| Párrafo | `text-base` o `text-lg` | Texto descriptivo |
| Párrafo pequeño | `text-sm` | Texto secundario |

---

## Paleta de Colores

### Colores Primarios (Gradiente de marca)
```
Blue:    from-blue-500 to-blue-600 (#3B82F6 → #2563EB)
Emerald: from-emerald-500 to-emerald-600 (#10B981 → #059669)
```

### Gradiente Principal
```css
bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600
```

### Fondos
| Contexto | Light | Dark |
|----------|-------|------|
| Página | `bg-white` | `bg-slate-950` |
| Card principal | `bg-white` | `bg-slate-900` |
| Card secundaria | `bg-slate-50` | `bg-slate-800` |
| Navbar | `bg-white/90` | `bg-slate-950/90` |

### Texto
| Contexto | Light | Dark |
|----------|-------|------|
| Principal | `text-slate-900` | `text-white` |
| Secundario | `text-slate-600` | `text-slate-300` |
| Muted | `text-slate-500` | `text-slate-400` |

### Bordes
| Contexto | Light | Dark |
|----------|-------|------|
| Sutil | `border-slate-200` | `border-slate-700` |
| Muy sutil | `border-slate-200/50` | `border-slate-800/50` |

---

## Componentes

### Botón Primario (GradientButton)
```tsx
// Características:
// - Gradiente animado de fondo
// - Efecto glow en hover
// - Escala en hover/active
// - Bordes redondeados xl

className="
  px-8 py-4
  text-base font-semibold text-white
  rounded-xl
  transition-all duration-300
  hover:scale-[1.02] active:scale-[0.98]
"
```

### Botón Secundario (Pill)
```tsx
// Usado en navbar
className="
  text-sm font-medium
  text-slate-700 dark:text-slate-200
  bg-white dark:bg-slate-800
  px-4 py-2
  rounded-full
  border border-slate-200 dark:border-slate-700
  hover:bg-slate-50 dark:hover:bg-slate-700
  transition-colors
"
```

### Botón de Google Login
```tsx
className="
  w-full max-w-xs
  flex items-center justify-center gap-3
  py-3 px-4
  font-medium
  text-slate-700 dark:text-slate-200
  bg-white dark:bg-slate-800
  border border-slate-300 dark:border-slate-600
  rounded-lg
  hover:bg-slate-50 dark:hover:bg-slate-700
  transition-colors
"
```

### Cards

#### Card con Borde Gradiente
```tsx
// Contenedor exterior
className="rounded-3xl p-[3px] animated-gradient-border"

// Contenido interior
className="h-full bg-slate-900 rounded-[22px] p-6"
```

#### Card de Color Sólido
```tsx
// Card azul
className="
  rounded-3xl
  bg-gradient-to-br from-blue-600 to-blue-700
  p-5
  overflow-hidden
"

// Card verde
className="
  rounded-3xl
  bg-gradient-to-br from-emerald-600 to-emerald-700
  p-5
  overflow-hidden
"
```

#### Card Neutral
```tsx
className="rounded-2xl bg-slate-800 p-4 md:p-5"
```

---

## Iconos

### Contenedor de Icono Grande
```tsx
className="
  w-10 h-10
  rounded-xl
  bg-gradient-to-br from-blue-500 to-emerald-500
  flex items-center justify-center
"
// Icono: w-5 h-5 text-white
```

### Contenedor de Icono Pequeño
```tsx
className="
  w-8 h-8
  rounded-lg
  bg-white/20
  flex items-center justify-center
"
// Icono: w-4 h-4 text-white
```

---

## Efectos y Animaciones

### Glow de Fondo
```tsx
// Glow grande difuso
className="
  absolute
  w-96 h-96
  bg-blue-500/20
  rounded-full
  blur-[128px]
"
```

### Partículas Flotantes
```tsx
className="
  absolute
  w-24 h-24
  rounded-full
  bg-blue-500/25
  blur-xl
"
```

### Animaciones CSS
```css
/* Float suave */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}

/* Gradiente animado */
@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

### Transiciones Comunes
```tsx
// Hover scale
transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]

// Color suave
transition-colors

// Transform de iconos
group-hover:translate-x-0.5 transition-transform
```

---

## Layout

### Contenedor Principal
```tsx
className="max-w-6xl mx-auto px-6"
```

### Contenedor Mediano (para forms, CTAs)
```tsx
className="max-w-5xl mx-auto"
// o
className="max-w-2xl mx-auto"
```

### Espaciado de Secciones
```tsx
// Sección estándar
className="py-20 px-6"

// Hero
className="pt-32 pb-16 px-6"
```

### Grid Bento
```tsx
className="grid grid-cols-2 md:grid-cols-4 gap-4"

// Card grande (2x2)
className="col-span-2 row-span-2"

// Card mediana (2x1)
className="col-span-2"

// Barra horizontal
className="col-span-2 md:col-span-4"
```

---

## Navbar

### Estructura
```tsx
<nav className="
  fixed top-0 left-0 right-0 z-50
  px-6
  bg-white/90 dark:bg-slate-950/90
  backdrop-blur-md
  border-b border-slate-200/50 dark:border-slate-800/50
">
  <div className="max-w-6xl mx-auto py-4 flex items-center justify-between">
    {/* Logo + Nombre */}
    {/* Acciones */}
  </div>
</nav>
```

### Logo con Gradiente
```tsx
<div className="p-1.5 rounded-lg bg-gradient-to-tl from-emerald-500 to-blue-600">
  <Logo className="h-8 w-auto" />
</div>
```

---

## Drawer (Bottom Sheet)

### Estructura
```tsx
<DrawerContent>
  <DrawerHeader>
    <DrawerTitle className="text-center">Título</DrawerTitle>
  </DrawerHeader>
  <div className="p-6 pt-2 pb-10 flex flex-col items-center gap-4">
    {/* Contenido */}
  </div>
</DrawerContent>
```

---

## Principios de Diseño

1. **Mobile-first**: Diseñar primero para móvil, escalar con breakpoints
2. **Dark mode por defecto en landing**: La landing siempre es dark
3. **Gradientes sutiles**: Usar gradientes en elementos de acción, no en todo
4. **Glassmorphism en navbar**: `backdrop-blur-md` con fondos semi-transparentes
5. **Bordes redondeados generosos**: `rounded-xl`, `rounded-2xl`, `rounded-3xl`
6. **Animaciones sutiles**: Movimientos pequeños que no distraen
7. **Espaciado consistente**: Usar sistema de 4px (gap-1, gap-2, gap-4, etc.)

---

## Archivos de Referencia

- **Landing**: `src/app/page.tsx`
- **Componentes Landing**: `src/features/landing/`
- **CSS Global**: `src/app/globals.css`
- **Fuentes**: `public/fonts/`
