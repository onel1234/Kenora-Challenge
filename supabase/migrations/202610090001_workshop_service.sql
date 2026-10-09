-- All mutations use checked RPCs. Clients never receive direct write privileges.
create type public.staff_role as enum ('admin','manager','staff');
create type public.workshop_status as enum ('scheduled','completed','cancelled');
create table public.profiles (
 id uuid primary key references auth.users(id), name text not null check(length(trim(name)) between 2 and 100),
 email text not null, role public.staff_role not null, created_at timestamptz not null default now()
);
create table public.workshops (
 id uuid primary key default gen_random_uuid(), code text not null unique check(length(trim(code)) between 2 and 30),
 title text not null check(length(trim(title)) between 2 and 120), instructor text not null check(length(trim(instructor)) between 2 and 100),
 starts_at timestamptz not null, duration_minutes integer not null check(duration_minutes between 15 and 720),
 capacity integer not null check(capacity between 1 and 1000), active_count integer not null default 0 check(active_count>=0 and active_count<=capacity),
 status public.workshop_status not null default 'scheduled', location text not null, category text not null, description text not null default '',
 created_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
create table public.registrations (
 id uuid primary key default gen_random_uuid(), workshop_id uuid not null references public.workshops(id),
 attendee_name text not null check(length(trim(attendee_name)) between 2 and 100), attendee_email text not null check(length(attendee_email)<=254 and attendee_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 status text not null default 'active' check(status in ('active','cancelled')),
 registered_at timestamptz not null default now(), registered_by uuid not null references public.profiles(id), registered_by_name text not null,
 cancelled_at timestamptz, cancelled_by uuid references public.profiles(id), cancelled_by_name text,
 constraint cancellation_fields check((status='active' and cancelled_at is null and cancelled_by is null and cancelled_by_name is null) or (status='cancelled' and cancelled_at is not null and cancelled_by is not null and cancelled_by_name is not null))
);
create unique index one_active_email_per_workshop on public.registrations(workshop_id,lower(attendee_email)) where status='active';
create index workshop_date_status on public.workshops(starts_at,status);
create index registration_workshop on public.registrations(workshop_id);
create table public.audit_log (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id), actor_name text not null,
 action text not null, entity_id uuid not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);

create function public.current_staff_role() returns public.staff_role language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=auth.uid();
$$;
create function public.require_role(p_roles public.staff_role[]) returns public.profiles language plpgsql security definer set search_path='' as $$
declare actor public.profiles;
begin
 select * into actor from public.profiles where id=auth.uid();
 if actor.id is null or not (actor.role=any(p_roles)) then raise exception 'You do not have permission to do this.' using errcode='42501'; end if;
 return actor;
end; $$;

alter table public.profiles enable row level security;
alter table public.workshops enable row level security;
alter table public.registrations enable row level security;
alter table public.audit_log enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.current_staff_role()='admin');
create policy workshops_read on public.workshops for select to authenticated using(public.current_staff_role() in ('manager','staff'));
create policy registrations_read on public.registrations for select to authenticated using(public.current_staff_role() in ('manager','staff'));
create policy audit_read on public.audit_log for select to authenticated using(
 (public.current_staff_role()='admin' and action in ('account_created','role_changed')) or
 (public.current_staff_role() in ('manager','staff') and action in ('workshop_created','workshop_updated','attendee_registered','registration_cancelled'))
);
revoke all on public.profiles,public.workshops,public.registrations,public.audit_log from anon,authenticated;
grant select on public.profiles,public.workshops,public.registrations,public.audit_log to authenticated;
grant all on public.profiles,public.workshops,public.registrations,public.audit_log to service_role;

create function public.save_workshop(p_input jsonb) returns public.workshops language plpgsql security definer set search_path='' as $$
declare actor public.profiles; w public.workshops; old_value jsonb; wid uuid; seats integer; new_status public.workshop_status;
begin
 actor:=public.require_role(array['manager']::public.staff_role[]);
 seats:=(p_input->>'capacity')::integer;
 new_status:=(p_input->>'status')::public.workshop_status;
 if length(trim(p_input->>'location')) not between 2 and 100 or length(trim(p_input->>'category')) not between 2 and 50 or length(coalesce(p_input->>'description',''))>1000 then raise exception 'Please check the workshop details.'; end if;
 if p_input->>'id' is not null then
  wid:=(p_input->>'id')::uuid;
  select * into w from public.workshops where id=wid for update;
  if not found then raise exception 'Workshop not found.'; end if;
  old_value:=to_jsonb(w);
  if seats<w.active_count then raise exception 'Capacity cannot be lower than the number of active registrations.'; end if;
  if new_status='cancelled' and w.active_count>0 then raise exception 'Cancel active registrations before cancelling this workshop.'; end if;
  update public.workshops set code=upper(trim(p_input->>'code')),title=trim(p_input->>'title'),instructor=trim(p_input->>'instructor'),
   starts_at=(p_input->>'starts_at')::timestamptz,duration_minutes=(p_input->>'duration_minutes')::integer,capacity=seats,status=new_status,
   location=trim(p_input->>'location'),category=trim(p_input->>'category'),description=coalesce(p_input->>'description',''),updated_at=now() where id=wid returning * into w;
 else
  insert into public.workshops(code,title,instructor,starts_at,duration_minutes,capacity,status,location,category,description,created_by)
   values(upper(trim(p_input->>'code')),trim(p_input->>'title'),trim(p_input->>'instructor'),(p_input->>'starts_at')::timestamptz,
   (p_input->>'duration_minutes')::integer,seats,new_status,trim(p_input->>'location'),trim(p_input->>'category'),coalesce(p_input->>'description',''),actor.id) returning * into w;
 end if;
 insert into public.audit_log(actor_id,actor_name,action,entity_id,details) values(actor.id,actor.name,case when old_value is null then 'workshop_created' else 'workshop_updated' end,w.id,jsonb_build_object('before',old_value,'after',to_jsonb(w)));
 return w;
end; $$;

create function public.register_attendee(p_workshop_id uuid,p_name text,p_email text) returns public.registrations language plpgsql security definer set search_path='' as $$
declare actor public.profiles; w public.workshops; r public.registrations;
begin
 actor:=public.require_role(array['manager','staff']::public.staff_role[]);
 -- Serializes every booking, cancellation and capacity change for this workshop.
 select * into w from public.workshops where id=p_workshop_id for update;
 if not found then raise exception 'Workshop not found.'; end if;
 if w.status<>'scheduled' or w.starts_at<=now() then raise exception 'This workshop is not open for registration.'; end if;
 if w.active_count>=w.capacity then raise exception 'This workshop is full. No seat was booked.'; end if;
 insert into public.registrations(workshop_id,attendee_name,attendee_email,registered_by,registered_by_name)
 values(w.id,trim(p_name),lower(trim(p_email)),actor.id,actor.name) returning * into r;
 update public.workshops set active_count=active_count+1 where id=w.id;
 insert into public.audit_log(actor_id,actor_name,action,entity_id,details) values(actor.id,actor.name,'attendee_registered',r.id,jsonb_build_object('workshop_id',w.id,'attendee_name',r.attendee_name));
 return r;
end; $$;

create function public.cancel_registration(p_id uuid) returns public.registrations language plpgsql security definer set search_path='' as $$
declare actor public.profiles; r public.registrations; wid uuid;
begin
 actor:=public.require_role(array['manager','staff']::public.staff_role[]);
 select workshop_id into wid from public.registrations where id=p_id;
 if not found then raise exception 'Registration not found.'; end if;
 -- Always acquire workshop before registration to keep lock ordering consistent.
 perform 1 from public.workshops where id=wid for update;
 select * into r from public.registrations where id=p_id for update;
 if r.status='cancelled' then return r; end if;
 update public.registrations set status='cancelled',cancelled_at=now(),cancelled_by=actor.id,cancelled_by_name=actor.name where id=p_id returning * into r;
 update public.workshops set active_count=active_count-1 where id=wid;
 insert into public.audit_log(actor_id,actor_name,action,entity_id,details) values(actor.id,actor.name,'registration_cancelled',r.id,jsonb_build_object('workshop_id',wid,'attendee_name',r.attendee_name));
 return r;
end; $$;

create function public.provision_profile(p_id uuid,p_name text,p_email text,p_role public.staff_role) returns void language plpgsql security definer set search_path='' as $$
declare actor public.profiles;
begin
 actor:=public.require_role(array['admin']::public.staff_role[]);
 if not exists(select 1 from auth.users where id=p_id and lower(email)=lower(p_email)) then raise exception 'Auth account not found.'; end if;
 insert into public.profiles(id,name,email,role) values(p_id,trim(p_name),lower(trim(p_email)),p_role);
 insert into public.audit_log(actor_id,actor_name,action,entity_id,details) values(actor.id,actor.name,'account_created',p_id,jsonb_build_object('name',trim(p_name),'role',p_role));
end; $$;
create function public.change_role(p_id uuid,p_role public.staff_role) returns void language plpgsql security definer set search_path='' as $$
declare actor public.profiles; previous public.staff_role;
begin
 -- Global advisory transaction lock serializes role changes, including concurrent demotions.
 perform pg_catalog.pg_advisory_xact_lock(749031);
 actor:=public.require_role(array['admin']::public.staff_role[]);
 select role into previous from public.profiles where id=p_id for update;
 if not found then raise exception 'Account not found.'; end if;
 if previous='admin' and p_role<>'admin' and (select count(*) from public.profiles where role='admin')<=1 then raise exception 'Keep at least one administrator.'; end if;
 update public.profiles set role=p_role where id=p_id;
 insert into public.audit_log(actor_id,actor_name,action,entity_id,details) values(actor.id,actor.name,'role_changed',p_id,jsonb_build_object('before',previous,'after',p_role));
end; $$;

revoke execute on function public.current_staff_role(),public.require_role(public.staff_role[]),public.save_workshop(jsonb),public.register_attendee(uuid,text,text),public.cancel_registration(uuid),public.provision_profile(uuid,text,text,public.staff_role),public.change_role(uuid,public.staff_role) from public,anon;
grant execute on function public.current_staff_role(),public.require_role(public.staff_role[]),public.save_workshop(jsonb),public.register_attendee(uuid,text,text),public.cancel_registration(uuid),public.provision_profile(uuid,text,text,public.staff_role),public.change_role(uuid,public.staff_role) to authenticated;
