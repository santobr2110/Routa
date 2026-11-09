-- Routa · fotos: o organizador consegue "ver" os próprios arquivos pela API do Storage.
-- Necessário porque o remove() do Supabase Storage exige permissão de SELECT além de DELETE.
-- (A leitura pública das fotos continua pela URL pública do bucket, sem depender desta policy.)
-- Como aplicar: Supabase > SQL Editor > New query > cole este arquivo > Run.

create policy "trip-photos: owner reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'trip-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
