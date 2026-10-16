-- Un ingreso también puede ser "De otra persona" (plata de terceros que entra a
-- una cuenta, o la entrada de un traspaso de terceros). Solo cambia la regla.
alter table n1n4_transactions drop constraint n1n4_transactions_nature_type_check;

alter table n1n4_transactions
  add constraint n1n4_transactions_nature_type_check check (
    (type = 'income' and nature in ('own', 'reimbursement', 'external'))
    or (type = 'expense' and nature in ('own', 'external', 'reimbursable', 'fund'))
  );
