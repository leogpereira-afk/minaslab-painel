// Endereços do backend no Supabase "Projetos Léo". São públicos por design:
// quem autoriza é o crachá conferido no servidor, em toda chamada.
export const API = "https://reoghclxripktzpdwhiy.supabase.co/functions/v1";

// Porta de dados do painel MinasLab: login, contas e coleções (ml_registros).
// O Comercial usa a mesma porta para entrar e para guardar os próprios dados
// nas coleções rh_comercial_* (o servidor restringe rh_* à direção).
export const SYNC = `${API}/ml-sync`;

// Porta do Comercial: lê o CRM e devolve números já somados. Só direção.
export const COMERCIAL = `${API}/ml-comercial`;
