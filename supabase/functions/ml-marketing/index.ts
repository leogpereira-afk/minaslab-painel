import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { bancoDireto, criarDireto, FONTES } from './marketing-direto.mjs';
import { criarHandler } from './handler.mjs';

// Implantar em heveemylixartyijxewh, onde estão as conexões existentes.
// A autenticação é confirmada no emissor MinasLab a cada chamada.
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const direto = criarDireto({ banco: bancoDireto(sb, 'minaslab'), env: (k: string) => Deno.env.get(k), empresa: 'minaslab' });
const CHAVES = FONTES.map((f: string) => 'leo_marketing_minaslab_direto_' + f);
Deno.serve(criarHandler({
  direto,
  async lerFontes() {
    const { data, error } = await sb.from('painel_cache').select('chave,valor').in('chave', CHAVES);
    if (error) throw new Error('consulta');
    return data;
  },
}));
