import type { AccountWithEntity } from './types';

/**
 * Galería de diseños de tarjeta para la billetera.
 * - `photo`: arte real de una tarjeta (sin número), con los datos de la app en una franja.
 * - `art`: dibujado en SVG, inspirado en la marca pero sin usar sus logos.
 * - `plain`: color pleno de Pulso con anillos suaves.
 */
export type CardDesignKind = 'photo' | 'art' | 'plain';

export interface CardDesign {
  id: string;
  label: string;
  group: 'Tus tarjetas' | 'Por banco' | 'Lisos';
  kind: CardDesignKind;
  /** Imagen de fondo (solo `photo`) */
  image?: string;
  /** Color de fondo (clase Tailwind) */
  bg: string;
  /** Color del texto y de los trazos */
  ink: string;
  /** Dibujo del fondo (solo `art`) */
  Art?: () => React.ReactElement;
}

const svgBox = 'absolute inset-0 h-full w-full';

function BandsArt({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 300 189" preserveAspectRatio="xMidYMid slice" className={svgBox}>
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${120 + i * 46} 0 L${220 + i * 46} 0 L${120 + i * 46} 189 L${20 + i * 46} 189 Z`} fill={color} opacity={0.18 + i * 0.12} />
      ))}
    </svg>
  );
}

function WavesArt({ color, colors, opacity }: { color?: string; colors?: string[]; opacity?: number }) {
  const palette = colors ?? [color ?? '#000'];
  return (
    <svg aria-hidden viewBox="0 0 300 189" preserveAspectRatio="xMidYMid slice" className={svgBox}>
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M-10 ${70 + i * 24} C 60 ${40 + i * 24}, 120 ${110 + i * 24}, 190 ${70 + i * 24} S 300 ${40 + i * 24}, 320 ${80 + i * 24}`}
          fill="none"
          stroke={palette[i % palette.length]}
          strokeOpacity={opacity ?? 0.12 + i * 0.05}
          strokeWidth={10}
        />
      ))}
    </svg>
  );
}

function LeavesArt({ color }: { color: string }) {
  const leaves = [
    [210, 40, -30, 1],
    [250, 95, 20, 1.2],
    [175, 120, -60, 0.9],
    [265, 20, 50, 0.8],
    [215, 165, 10, 1.1],
  ];
  return (
    <svg aria-hidden viewBox="0 0 300 189" preserveAspectRatio="xMidYMid slice" className={svgBox}>
      {leaves.map(([x, y, r, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
          <path d="M0 -38 C 22 -20, 22 20, 0 38 C -22 20, -22 -20, 0 -38 Z" fill={color} opacity={0.16 + (i % 3) * 0.06} />
          <path d="M0 -34 L0 34" stroke={color} strokeOpacity={0.3} strokeWidth={2} />
        </g>
      ))}
    </svg>
  );
}

function LinesArt({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 300 189" preserveAspectRatio="xMidYMid slice" className={svgBox}>
      {Array.from({ length: 14 }).map((_, i) => (
        <line key={i} x1={130 + i * 14} y1={0} x2={60 + i * 14} y2={189} stroke={color} strokeOpacity={0.14} strokeWidth={2} />
      ))}
    </svg>
  );
}

function FeathersArt({ base, accent }: { base: string; accent: string }) {
  const f = [
    [170, 30, 35, base],
    [215, 70, 25, accent],
    [150, 110, 40, base],
    [250, 130, 15, accent],
    [195, 165, 30, base],
    [275, 40, 10, base],
  ] as const;
  return (
    <svg aria-hidden viewBox="0 0 300 189" preserveAspectRatio="xMidYMid slice" className={svgBox}>
      {f.map(([x, y, r, c], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse cx={0} cy={0} rx={62} ry={20} fill={c} opacity={0.55} />
          <path d="M-58 0 L58 0" stroke="#000" strokeOpacity={0.25} strokeWidth={1.5} />
        </g>
      ))}
    </svg>
  );
}

function RingsArt({ color }: { color: string }) {
  return (
    <svg aria-hidden viewBox="0 0 300 189" preserveAspectRatio="xMaxYMin slice" className={svgBox}>
      <circle cx="300" cy="0" r="90" fill="none" stroke={color} strokeOpacity=".10" strokeWidth="22" />
      <circle cx="300" cy="0" r="150" fill="none" stroke={color} strokeOpacity=".07" strokeWidth="22" />
      <circle cx="300" cy="0" r="210" fill="none" stroke={color} strokeOpacity=".05" strokeWidth="22" />
    </svg>
  );
}

const plain = (id: string, label: string, bg: string, ink: string, stroke: string): CardDesign => ({
  id,
  label,
  group: 'Lisos',
  kind: 'plain',
  bg,
  ink,
  Art: () => <RingsArt color={stroke} />,
});

export const CARD_DESIGNS: CardDesign[] = [
  { id: 'santander-plumas', label: 'Santander · plumas rojas', group: 'Tus tarjetas', kind: 'photo', image: '/cards/santander-debito.jpg', bg: 'bg-[#D3271D]', ink: 'text-cream' },
  { id: 'worldmember-plumas', label: 'WorldMember · plumas violeta', group: 'Tus tarjetas', kind: 'photo', image: '/cards/worldmember.jpg', bg: 'bg-[#0B0710]', ink: 'text-cream' },

  { id: 'santander-rojo', label: 'Santander', group: 'Por banco', kind: 'art', bg: 'bg-[#E3342A]', ink: 'text-[#2E0806]', Art: () => <RingsArt color="#2E0806" /> },
  { id: 'bancoestado', label: 'BancoEstado', group: 'Por banco', kind: 'art', bg: 'bg-[#1C1512]', ink: 'text-[#FFB067]', Art: () => <BandsArt color="#F07F1E" /> },
  { id: 'fintual', label: 'Fintual', group: 'Por banco', kind: 'art', bg: 'bg-[#F7F8FC]', ink: 'text-[#14245C]', Art: () => <WavesArt color="#1E50E6" /> },
  { id: 'mercadopago', label: 'Mercado Pago', group: 'Por banco', kind: 'art', bg: 'bg-[#58C8EE]', ink: 'text-[#0A2A55]', Art: () => <WavesArt color="#0A2A55" /> },
  { id: 'afp-modelo', label: 'AFP', group: 'Por banco', kind: 'art', bg: 'bg-[#8FD08A]', ink: 'text-[#14301A]', Art: () => <LeavesArt color="#14301A" /> },
  { id: 'afc', label: 'AFC · cesantía', group: 'Por banco', kind: 'art', bg: 'bg-[#2F5BD8]', ink: 'text-[#EEF3FF]', Art: () => <LinesArt color="#BFD3FF" /> },
  { id: 'latam-gold', label: 'LATAM · plumas', group: 'Por banco', kind: 'art', bg: 'bg-[#1C1530]', ink: 'text-[#F2D9A6]', Art: () => <FeathersArt base="#5B3FD0" accent="#C94FA3" /> },

  plain('liso-jade', 'Jade', 'bg-jade', 'text-jade-ink', '#0E2A22'),
  plain('liso-coral', 'Coral', 'bg-coral', 'text-coral-ink', '#3A1510'),
  plain('liso-ambar', 'Ámbar', 'bg-amber', 'text-amber-ink', '#33240C'),
  plain('liso-celeste', 'Celeste', 'bg-sky', 'text-sky-ink', '#0F2235'),
  plain('liso-violeta', 'Violeta', 'bg-violet', 'text-violet-ink', '#1C1530'),
  plain('liso-rosa', 'Rosa', 'bg-rose', 'text-rose-ink', '#3A1028'),
  plain('liso-arena', 'Arena', 'bg-[#D9C4A0]', 'text-[#33281A]', '#33281A'),
  plain('liso-tinta', 'Tinta', 'bg-surface-3', 'text-foreground', '#5CC3A4'),
];

const BY_ID = new Map(CARD_DESIGNS.map((d) => [d.id, d]));
const PLAIN_IDS = CARD_DESIGNS.filter((d) => d.kind === 'plain').map((d) => d.id);

/** Diseño automático según banco, nombre y tipo de la cuenta. */
export function autoCardDesignId(account: Pick<AccountWithEntity, 'name' | 'type' | 'bankName' | 'entity'>): string {
  const bank = `${account.entity?.name ?? ''} ${account.bankName ?? ''}`.toLowerCase();
  const name = account.name.toLowerCase();
  const all = `${bank} ${name}`;
  if (/world ?member/.test(all)) return 'worldmember-plumas';
  if (/santander/.test(all)) return account.type === 'checking' ? 'santander-plumas' : 'santander-rojo';
  if (/estado|cuenta rut/.test(all)) return 'bancoestado';
  if (/fintual/.test(all)) return 'fintual';
  if (/mercado ?pago/.test(all)) return 'mercadopago';
  if (/latam/.test(all)) return 'latam-gold';
  if (account.type === 'unemployment' || /\bafc\b|cesant/.test(all)) return 'afc';
  if (account.type === 'pension' || /\bafp\b|modelo|habitat|provida|cuprum|planvital/.test(all)) return 'afp-modelo';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PLAIN_IDS[h % PLAIN_IDS.length];
}

/** Diseño de una cuenta: el elegido o, si no hay, el automático. */
export function cardDesignFor(account: Pick<AccountWithEntity, 'name' | 'type' | 'bankName' | 'entity' | 'cardDesign'>): CardDesign {
  return (account.cardDesign && BY_ID.get(account.cardDesign)) || BY_ID.get(autoCardDesignId(account))!;
}

export function getCardDesign(id: string | null | undefined): CardDesign | undefined {
  return id ? BY_ID.get(id) : undefined;
}
