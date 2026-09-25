-- A banner with just a title is a reasonable announcement; the body was
-- previously required only because the very first admin composer always
-- sent an empty string rather than actually allowing it to be optional.
alter table public.platform_announcements alter column body drop not null;
;
