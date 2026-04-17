DROP POLICY IF EXISTS "Usuarios podem deletar seus proprios anexos" ON storage.objects;
DROP POLICY IF EXISTS "Internos e proprio colaborador podem deletar anexos de chamados" ON storage.objects;

CREATE POLICY "Internos e proprio colaborador podem deletar anexos de chamados"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chamados-anexos'
  AND (
    (
      public.current_internal_access_level() IS NOT NULL
      AND public.current_internal_access_level() <> 'cliente_view'::public.internal_access_level
    )
    OR EXISTS (
      SELECT 1
      FROM public.chamado_anexos ca
      JOIN public.usuarios u ON u.id = auth.uid()
      WHERE ca.caminho_storage = storage.objects.name
        AND ca.uploaded_by = auth.uid()
        AND u.role = 'colaborador'::public.user_type
    )
  )
);
