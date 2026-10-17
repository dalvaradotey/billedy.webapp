import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // La lógica de negocio se prueba sin base de datos: las consultas viven aparte
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text'],
      include: ['src/lib/**/*.ts', 'src/features/**/lib/**/*.ts', 'src/features/**/schemas.ts', 'src/features/telegram/parser.ts'],
      exclude: ['src/lib/db/**', '**/*.test.ts'],
    },
  },
});
