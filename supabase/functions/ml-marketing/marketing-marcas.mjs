// Identidades públicas permitidas. Tokens, contas e métricas permanecem no servidor.
const MARCAS=Object.freeze({
 fortemais:Object.freeze({id:'fortemais',nome:'Fortemais',host:'fortemais.net',site:'https://fortemais.net',instagram:'fortemais',state:'fm'}),
 domo:Object.freeze({id:'domo',nome:'Domo',host:'domoconstrutora.com.br',site:'https://www.domoconstrutora.com.br',instagram:'domoconstrutora',state:'dm'}),
 minaslab:Object.freeze({id:'minaslab',nome:'MinasLab',host:'minaslab.net',site:'https://minaslab.net',instagram:'minaslab_',state:'ml'}),
 impresilk:Object.freeze({id:'impresilk',nome:'Impresilk',host:'impresilk.com.br',site:'https://impresilk.com.br',instagram:'impresilk',state:'im'}),
});
export function marcaMarketing(empresa='fortemais'){if(!Object.hasOwn(MARCAS,empresa))throw Error('invalido');return MARCAS[empresa]}
export const empresaDoState=s=>typeof s==='string'&&/^dm\.[a-f0-9]{64}$/.test(s)?'domo':typeof s==='string'&&/^fm\.[a-f0-9]{64}$/.test(s)?'fortemais':typeof s==='string'&&/^ml\.[a-f0-9]{64}$/.test(s)?'minaslab':null;
