'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, ResponsiveDrawer } from '@/components/ui/drawer';
import { AFC_PROVIDER } from '../lib/quota-values';

type Guide = { title: string; site: string; steps: string[]; notes: string[] };

const AFC_GUIDES: Guide[] = [
  {
    title: 'Cartola de movimientos (la que subes a Billedy)',
    site: 'personas.afc.cl',
    steps: [
      'Menú izquierdo: Certificados y Cartolas → Cartolas.',
      'Abre "Movimientos".',
      'Elige el año y el período: 1er cuatrimestre (dic–abr), 2do cuatrimestre (may–ago) o Anual (cuando el año ya terminó).',
      'Toca "Descargar" y súbela aquí con "Importar cartola o certificado".',
    ],
    notes: [
      'Durante el año, sube la última cuatrimestral disponible; al terminar el año, la anual.',
      'Si el botón Descargar no se activa, ese período todavía no está publicado.',
      'AFC también la envía por correo tres veces al año.',
    ],
  },
  {
    title: 'Certificado de cotizaciones (opcional, para tu historial de sueldo)',
    site: 'personas.afc.cl',
    steps: ['Menú izquierdo: Cotizaciones → Mis cotizaciones.', 'Abre "Cotizaciones pagadas", elige "Histórico" y toca "Descargar".'],
    notes: ['Basta con subirlo una vez.'],
  },
];

const AFP_MODELO_GUIDES: Guide[] = [
  {
    title: 'Mis movimientos',
    site: 'nueva.afpmodelo.cl (portal privado)',
    steps: [
      'Menú: Cuentas → Mi Cuenta Obligatoria → Detalle y movimientos de la cuenta.',
      'Al final de la tabla de movimientos, toca "Descargar mis movimientos".',
    ],
    notes: [
      'Billedy aún no lee este archivo: mientras tanto confirma cada cotización con "Llegó".',
      'La "Cartola resumen" (Certificados → Cartola resumen) es un resumen cuatrimestral; para el detalle mes a mes usa "Mis movimientos".',
    ],
  },
];

const OTHER_AFP_GUIDES: Guide[] = [
  {
    title: 'Movimientos de tu cuenta obligatoria',
    site: 'el portal privado de tu AFP',
    steps: ['Busca el detalle o la cartola de movimientos de tu cuenta obligatoria y descárgala.'],
    notes: ['Billedy aún no lee este archivo: mientras tanto confirma cada cotización con "Llegó".'],
  },
];

/** Recordatorio de dónde se descarga cada cartola, según la institución */
export function StatementHelp({ provider }: { provider: string }) {
  const [open, setOpen] = useState(false);
  const guides = provider === AFC_PROVIDER ? AFC_GUIDES : provider === 'MODELO' ? AFP_MODELO_GUIDES : OTHER_AFP_GUIDES;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-9 items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
        <HelpCircle className="h-3.5 w-3.5" />
        ¿Dónde descargo la cartola?
      </button>
      <ResponsiveDrawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg">
            <DrawerHeader>
              <DrawerTitle>Dónde descargar la cartola</DrawerTitle>
              <DrawerDescription>{provider === AFC_PROVIDER ? 'AFC · Seguro de Cesantía' : provider === 'MODELO' ? 'AFP Modelo' : 'Tu AFP'}</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-4 px-4 pb-6">
              {guides.map((g) => (
                <section key={g.title} className="rounded-2xl bg-background p-4">
                  <p className="text-sm font-extrabold">{g.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">En {g.site}</p>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[13px]">
                    {g.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {g.notes.map((n) => (
                      <li key={n}>· {n}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </DrawerContent>
      </ResponsiveDrawer>
    </>
  );
}
