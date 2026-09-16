-- O DANFSe oficial já contém o cabeçalho, QR Code e todas as seções fiscais.
-- A pós-edição por coordenadas deixou de ser segura quando o Portal Nacional
-- atualizou o modelo e podia desalinhar ou encobrir o documento.
drop trigger if exists trg_notas_nfse_logo_oficial on public.notas_fiscais;

comment on function public.aplicar_logo_oficial_nfse() is
  'Legado desativado: o PDF oficial do Portal Nacional não deve ser sobrescrito.';
