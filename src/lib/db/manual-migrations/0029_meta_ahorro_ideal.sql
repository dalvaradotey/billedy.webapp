-- Meta de ahorro ideal: un objetivo sobre la meta mínima (savings_target). La
-- mínima se descuenta del libre; la ideal solo se muestra como objetivo. Solo aditiva.
alter table n1n4_projects add column savings_ideal_target numeric(15, 2);
