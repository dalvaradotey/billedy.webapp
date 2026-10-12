# Diseño Pulso

Guía corta del sistema de diseño de Billedy. Cualquier pantalla nueva debe seguir estas reglas.

## Principios

- **Solo modo oscuro.** El fondo es ciruela tinta (`bg-background`, #15121A).
- **El color tiene significado.** No se usa para decorar.
- **Sin gradientes, sin sombras de color y sin brillos.** La profundidad viene de superficies planas.
- **Texto oscuro sobre color pleno**, nunca blanco sobre color (`bg-jade text-jade-ink`).
- **Mobile-first:** áreas de toque de 40 a 44 px como mínimo y sin scroll horizontal de la página.

## Tokens (Tailwind)

| Uso | Clases |
|-----|--------|
| Fondo, superficies | `bg-background`, `bg-surface`, `bg-surface-2`, `bg-surface-3` |
| Bordes | `border-line`, `border-line-strong` |
| Texto | `text-foreground`, `text-muted-foreground`, `text-faint` |
| Jade: libre, ingresos, acción principal | `bg-jade`, `bg-jade-soft`, `text-jade`, `text-jade-text`, `text-jade-ink` |
| Coral: gastos, deuda, exceso | `coral`, `coral-soft`, `coral-text`, `coral-ink` |
| Ámbar: tarjeta, techo, pendiente | `amber`, `amber-soft`, `amber-text`, `amber-ink` |
| Celeste: terceros, abonos, conciliado | `sky`, `sky-soft`, `sky-text`, `sky-ink` |
| Violeta: ahorro, fondos | `violet`, `violet-soft`, `violet-text`, `violet-ink` |
| Rosa: color extra de categorías | `rose`, `rose-soft`, `rose-ink` |
| Crema: selección, burbujas | `bg-cream text-cream-ink` |

Los colores de categoría se eligen de `PULSE_PALETTE`. Los que ya están guardados se muestran con `pulseColor()`, y `toneForName()` da un tono estable por nombre (`src/lib/pulse-tone.ts`).

## Tipografía

- Manrope en toda la app.
- Las cifras llevan `num` (números tabulares) y `font-extrabold`.
- Los títulos de página van en `text-[28px] font-extrabold tracking-[-0.035em]`.

## Formas

- Tarjetas: `rounded-[22px]` a `rounded-[28px]` con `border border-line bg-surface`.
- Íconos en bloque: `h-10 w-10 rounded-[13px]` con el tono suave y el ícono en el tono pleno.
- Botones y selectores segmentados en pastilla (`rounded-full`). La opción activa va en crema o en `bg-surface-3`.

## Piezas propias

- `PulseChart` (`src/components/pulse-chart.tsx`) tiene tres variantes:
  - `cap`: gasto contra el techo;
  - `target`: ahorro contra la meta;
  - `balance`: saldo que sube y baja.
- Esqueletos de carga: `Skeleton` con `tone` (`amber`, `jade`, etc.) y la misma forma del contenido final (`src/components/pulse-skeletons.tsx`).
- Navegación:
  - en móvil, la cápsula (`mobile-bottom-nav.tsx`), con el nombre solo en la pestaña activa;
  - en desktop, la barra lateral (`app-sidebar.tsx`) con todas las secciones.
- Listas largas agrupadas por día, con el encabezado del día sticky (`sticky top-16 md:top-0`).
