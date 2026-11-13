-- Devolver plata usada de un fondo de terceros (p. ej. préstamo de un familiar).
-- Suma al saldo del fondo como "apartar", pero en el ciclo baja lo libre sin contar
-- como ahorro. Solo aditiva.
alter type fund_movement_kind add value if not exists 'repay';
