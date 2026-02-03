import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileQuestion className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold">Página no encontrada</h1>
      <p className="mt-2 text-muted-foreground">
        La página que buscas no existe o fue movida
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Volver al inicio</Link>
      </Button>
    </div>
  );
}
