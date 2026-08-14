CREATE POLICY "Users can view own property photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can upload own property photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own property photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own property photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] = auth.uid()::text);