-- Diseño de tarjeta elegido para cada cuenta (galería de la billetera).
-- Solo aditiva: null = diseño automático según el banco.
alter table n1n4_accounts add column card_design varchar(40);
