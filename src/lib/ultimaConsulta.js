// The caller keeps this controller for the lifetime of the screen.
export function criarControleConsulta() {
 let versao=0;
 return { iniciar(){const atual=++versao;return ()=>atual===versao;}, cancelar(){versao++;} };
}
