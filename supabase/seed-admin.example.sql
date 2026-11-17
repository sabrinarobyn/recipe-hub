-- Run once in the SQL editor to make yourself the first admin (use your own email).
insert into public.members (email, role) values ('you@example.com', 'admin')
on conflict (email) do update set role = 'admin';
