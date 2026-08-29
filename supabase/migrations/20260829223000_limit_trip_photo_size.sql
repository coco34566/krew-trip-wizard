-- Keep oversized files from reaching the private trip photo bucket.
-- The Memories UI enforces the same limit before hashing/uploading.
update storage.buckets
set file_size_limit = 20971520
where id = 'trip-photos';
