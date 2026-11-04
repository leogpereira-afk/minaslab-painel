// Endereços do backend no Supabase "Projetos Léo". São públicos por design:
// quem autoriza é o crachá conferido no servidor, em toda chamada.
export const API = "https://reoghclxripktzpdwhiy.supabase.co/functions/v1";

// Porta de dados do painel MinasLab: login e contas. O LIMS entra por aqui
// (ação "entrar"), com o mesmo usuário e o mesmo crachá de 12 h do painel.
export const SYNC = `${API}/ml-sync`;
