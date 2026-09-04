create or replace function public.set_destination_photo_proxy_url()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is not null and (
    new.image_url is null
    or btrim(new.image_url) = ''
    or new.image_url like 'https://images.unsplash.com/%'
    or new.image_url like 'http://images.unsplash.com/%'
  ) then
    new.image_url := 'https://krew-trip-wizard.vercel.app/api/destination-photo?id=' || new.id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists destinations_set_photo_proxy_url on public.destinations;

create trigger destinations_set_photo_proxy_url
before insert or update of name, country, image_url
on public.destinations
for each row
execute function public.set_destination_photo_proxy_url();

update public.destinations
set image_url = 'https://krew-trip-wizard.vercel.app/api/destination-photo?id=' || id::text
where image_url is null
   or btrim(image_url) = ''
   or image_url like 'https://images.unsplash.com/%'
   or image_url like 'http://images.unsplash.com/%';
