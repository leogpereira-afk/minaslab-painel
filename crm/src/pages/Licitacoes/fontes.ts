// Fontes do Radar de oportunidades públicas.
export type SourceLink={label:string;url:string}
export type OpportunitySource={priority:'ALTA'|'MEDIA';name:string;scope:string;url?:string;links?:SourceLink[]}
export const opportunitySources:OpportunitySource[]=[
 {priority:'ALTA',name:'Prefeitura de Montes Claros',scope:'Água potável, poços, escolas, unidades de saúde, sedimentos e meio ambiente',url:'https://licitacoes.montesclaros.mg.gov.br/licitacoes'},
 {priority:'ALTA',name:'Copasa MG',scope:'Água bruta e tratada, efluentes, ETA/ETE e monitoramento',url:'https://www.copasa.com.br/wps/portal/internet/fornecedores'},
 {priority:'ALTA',name:'SAAEs do Norte de Minas',scope:'Potabilidade, microbiologia, físico-química e efluentes — página de licitações de cada SAAE',links:[
  {label:'SAAE Bocaiúva',url:'https://saaebocaiuva.com.br/licitacoes'},
  {label:'SAAE Buritizeiro',url:'https://saaeburitizeiro.mg.gov.br/licitacoes/'},
  {label:'SAAE Francisco Sá',url:'https://saaefranciscosa.com.br/licitacoes'},
  {label:'SAAE Pirapora',url:'https://www.saaepirapora.com.br/compras'},
  {label:'SAAE São João da Lagoa',url:'https://saaesaojoaodalagoa.com.br/licitacoes/'},
 ]},
 {priority:'ALTA',name:'Prefeituras do Norte de Minas',scope:'Água de escolas, hospitais, UBS, poços e comunidades rurais',url:'https://pncp.gov.br/app/editais'},
 {priority:'ALTA',name:'Consórcios intermunicipais',scope:'Programas ambientais e de saneamento',links:[
  {label:'CODANORTE',url:'https://codanorte.mg.gov.br/licitacoes/'},
  {label:'CIMAMS',url:'https://www.cimams.mg.gov.br/licitacoes/'},
  {label:'Outros (PNCP)',url:'https://pncp.gov.br/app/editais'},
 ]},
 {priority:'ALTA',name:'CODEVASF — 1ª SR Montes Claros',scope:'Saneamento, irrigação, água e projetos ambientais',url:'https://editais2026.codevasf.gov.br/licitacoes/1a-superintendencia-regional-montes-claros-mg/pregao_eletronico/editais-publicados-em-2026'},
 {priority:'ALTA',name:'IFNMG',scope:'Água, efluentes e serviços laboratoriais',url:'https://www.ifnmg.edu.br/compras-e-contratos/licitacoes'},
 {priority:'ALTA',name:'Unimontes e Hospital Universitário Clemente de Faria',scope:'Laboratórios, hospital, água e monitoramento (o HUCF compra pelas licitações da Unimontes)',url:'https://unimontes.br/licitacao/'},
 {priority:'ALTA',name:'Órgãos estaduais — IMA, IGAM, SEMAD, FEAM',scope:'Programas sanitários, recursos hídricos e monitoramento ambiental (Portal de Compras MG)',url:'https://compras.mg.gov.br/'},
 {priority:'ALTA',name:'Escolas estaduais',scope:'Potabilidade quando contratada pela Caixa Escolar',links:[
  {label:'Caixa Escolar (SGD)',url:'https://caixaescolar.educacao.mg.gov.br/selecionar-perfil'},
  {label:'SRE Montes Claros — processos simplificados',url:'https://sremontesclaros.educacao.mg.gov.br/licitacoes/processo-simplificado/'},
 ]},
 {priority:'MEDIA',name:'Cemig',scope:'Água, reservatórios e monitoramento ambiental',url:'https://www.cemig.com.br/fornecedores/portal-de-compras/'},
 {priority:'MEDIA',name:'DNOCS',scope:'Barragens, reservatórios e qualidade da água',url:'https://www.gov.br/dnocs/pt-br/acesso-a-informacao/licitacoes-e-contratos'},
 {priority:'MEDIA',name:'FUNASA',scope:'Saneamento e qualidade da água',url:'https://www.gov.br/funasa/pt-br/acesso-a-informacao/licitacoes-e-contratos'},
 {priority:'MEDIA',name:'Consórcios de saúde',scope:'Controle de qualidade de água',url:'https://pncp.gov.br/app/editais'},
 {priority:'MEDIA',name:'Universidades federais',scope:'Análises laboratoriais e ambientais',links:[
  {label:'UFMG — ICA Montes Claros',url:'https://www.ufmg.br/montesclaros/secao-de-compras-e-licitacoes/'},
  {label:'UFVJM',url:'https://portal.ufvjm.edu.br/proad/licitacoes-e-contratos'},
  {label:'Outras (PNCP)',url:'https://pncp.gov.br/app/editais'},
 ]},
 {priority:'MEDIA',name:'Presídios e unidades públicas estaduais',scope:'Potabilidade e reservatórios',url:'https://compras.mg.gov.br/'},
]

/** Lista plana (uma por link) usada no registro de consultas. */
export const sourceTargets:SourceLink[]=opportunitySources.flatMap(s=>s.links??(s.url?[{label:s.name,url:s.url}]:[]))
