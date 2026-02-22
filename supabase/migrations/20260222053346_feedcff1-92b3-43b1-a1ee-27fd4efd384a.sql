-- Criar bucket motoboy_voices para áudios pré-gravados
INSERT INTO storage.buckets (id, name, public)
VALUES ('motoboy_voices', 'motoboy_voices', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
CREATE POLICY "Public read access for motoboy_voices"
ON storage.objects FOR SELECT
USING (bucket_id = 'motoboy_voices');

CREATE POLICY "Authenticated upload to motoboy_voices"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'motoboy_voices');

CREATE POLICY "Authenticated update on motoboy_voices"
ON storage.objects FOR UPDATE
USING (bucket_id = 'motoboy_voices');

CREATE POLICY "Authenticated delete on motoboy_voices"
ON storage.objects FOR DELETE
USING (bucket_id = 'motoboy_voices');