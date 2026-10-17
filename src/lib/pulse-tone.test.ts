import { describe, expect, it } from 'vitest';
import { PULSE_PALETTE, pulseColor, pulseTone, toneForName } from './pulse-tone';

describe('pulseTone', () => {
  it('lleva cada color al tono Pulso de su matiz', () => {
    expect(pulseTone('#ff0000')).toBe('coral');
    expect(pulseTone('#ffaa00')).toBe('amber');
    expect(pulseTone('#00cc66')).toBe('jade');
    expect(pulseTone('#0099ff')).toBe('sky');
    expect(pulseTone('#7a00ff')).toBe('violet');
    expect(pulseTone('#ff00aa')).toBe('rose');
  });

  it('grises, vacíos o inválidos son neutros', () => {
    expect(pulseTone('#777777')).toBe('neutral');
    expect(pulseTone(null)).toBe('neutral');
    expect(pulseTone('rojo')).toBe('neutral');
  });
});

describe('toneForName', () => {
  it('es estable e ignora mayúsculas', () => {
    expect(toneForName('Supermercado')).toBe(toneForName('supermercado'));
    expect(toneForName('')).toBe('neutral');
  });
});

describe('pulseColor', () => {
  it('respeta un color de la paleta y acerca los demás', () => {
    expect(pulseColor('#5cc3a4')).toBe('#5CC3A4');
    expect(PULSE_PALETTE).toContain(pulseColor('#ff0000'));
    expect(pulseColor('#808080')).toBe('#BEB5C7');
    expect(pulseColor(undefined)).toBe('#BEB5C7');
  });
});
