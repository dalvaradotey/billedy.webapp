-- Provisiones: fondos para gastos que ya sabes que vienen (viajes, contribuciones,
-- mantenciones). Apartar a una provisión baja la plata libre del ciclo igual que
-- el ahorro, pero no suma a la meta de ahorro. Solo aditiva.
alter table n1n4_account_funds add column is_provision boolean not null default false;
