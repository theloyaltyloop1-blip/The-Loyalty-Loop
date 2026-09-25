-- Fidel spend transaction type, committed before the schema migration uses it.
-- The old stamp transaction type and its trigger remain untouched.
alter type public.transaction_type add value if not exists 'spend';
