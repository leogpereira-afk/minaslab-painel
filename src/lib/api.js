// Endereco do backend: a Edge Function ml-sync no projeto Supabase
// "Projetos Léo". O projeto e COMPARTILHADO com outros sistemas do Leonardo
// (bsq_, domo_, pdb_) — por isso o nome leva o prefixo "ml-".
//
// Nenhum segredo aqui: o repositorio e publico. Quem autoriza e o crachá
// (JWT) que o servidor emite no login e confere em toda chamada.
export const API = "https://reoghclxripktzpdwhiy.supabase.co/functions/v1";
export const SYNC = `${API}/ml-sync`;
