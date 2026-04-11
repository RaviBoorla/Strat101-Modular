create policy "tenant access"
on public.tenant_users
for select
using (auth.uid() = auth_user_id);