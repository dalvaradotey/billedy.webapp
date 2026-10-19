-- Cuenta bloqueada: plata que de momento no se puede usar (p. ej. un seguro con
-- ahorro). Sigue contando en el patrimonio, pero el simulador no la ofrece. Solo aditiva.
alter table n1n4_accounts add column is_locked boolean not null default false;
