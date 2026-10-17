import { describe, expect, it } from 'vitest';
import { isNavActive } from './nav-items';

describe('isNavActive', () => {
  it('el inicio solo se activa en su ruta exacta', () => {
    expect(isNavActive('/dashboard', '/dashboard')).toBe(true);
    expect(isNavActive('/dashboard/accounts', '/dashboard')).toBe(false);
  });

  it('las secciones se activan también en sus subrutas', () => {
    expect(isNavActive('/dashboard/accounts/123', '/dashboard/accounts')).toBe(true);
  });
});
