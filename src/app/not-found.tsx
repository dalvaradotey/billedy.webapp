import Link from 'next/link';
import { Compass } from 'lucide-react';
import { BrandMark } from '@/components/layout/brand-mark';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <BrandMark />
      <div className="mt-8 w-full max-w-sm rounded-[28px] border border-line bg-surface p-6">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-soft text-sky">
          <Compass className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-[24px] font-extrabold tracking-[-0.03em]">Esta página no existe</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Puede que la hayan movido o que el enlace esté mal escrito.</p>
        <Link
          href="/dashboard"
          className="mt-6 flex min-h-12 items-center justify-center rounded-full bg-jade text-sm font-extrabold text-jade-ink"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
