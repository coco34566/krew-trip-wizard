revoke execute on function public.get_trip_member_avatars(uuid) from anon;
revoke execute on function public.get_trip_member_avatars(uuid) from public;
revoke execute on function public.get_trip_member_avatars(uuid) from authenticated;
grant execute on function public.get_trip_member_avatars(uuid) to authenticated;
