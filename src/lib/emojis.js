// Emojis do Messenger: categorias, busca por palavra (em português), recentes e inserção no texto. Sem tela, sem rede.

export const RAPIDAS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// [emoji, "palavras de busca"]
export const CATEGORIAS = [
  { id: "carinhas", rotulo: "Carinhas", icone: "😀", itens: [
    ["😀", "feliz sorriso alegre"], ["😃", "feliz sorriso alegre"], ["😄", "feliz sorriso riso"], ["😁", "sorriso dentes"], ["😆", "rindo gargalhada"], ["😅", "suor alivio rindo"], ["🤣", "rolando rindo gargalhada"], ["😂", "lagrimas rindo chorando de rir"], ["🙂", "sorriso leve"], ["🙃", "invertido ironia"], ["😉", "piscada"], ["😊", "feliz corado sorriso"], ["😇", "anjo santo"], ["🥰", "apaixonado amor coracoes"], ["😍", "apaixonado olhos coracao"], ["🤩", "estrela deslumbrado uau"], ["😘", "beijo"], ["😋", "delicia gostoso saboroso"], ["😛", "lingua"], ["😜", "lingua piscada brincadeira"], ["🤪", "maluco doido"], ["🤗", "abraco"], ["🤭", "oops boca mao segredo"], ["🤫", "silencio segredo"], ["🤔", "pensando duvida"], ["🫡", "continencia saudacao"], ["😐", "neutro sem graca"], ["😑", "sem expressao"], ["😶", "sem boca calado"], ["🙄", "revirando olhos"], ["😏", "malicioso sorriso de lado"], ["😒", "desanimado desconfiado"], ["😬", "tenso constrangido"], ["😮‍💨", "suspiro alivio"], ["😌", "aliviado tranquilo"], ["😔", "triste pensativo"], ["😪", "sono"], ["😴", "dormindo sono"], ["😷", "mascara doente"], ["🤒", "febre doente termometro"], ["🤕", "machucado curativo"], ["🤢", "enjoado nojo"], ["🤮", "vomito"], ["🥵", "calor quente"], ["🥶", "frio gelado"], ["🥴", "tonto"], ["😵", "tontura"], ["🤯", "explodindo cabeca surpreso"], ["🥳", "festa comemorando parabens"], ["😎", "oculos escuros legal"], ["🤓", "nerd estudioso"], ["😕", "confuso"], ["😟", "preocupado"], ["🙁", "triste"], ["😮", "surpreso espantado"], ["😲", "chocado"], ["😳", "envergonhado vermelho"], ["🥺", "suplica pedindo fofo"], ["😦", "assustado"], ["😧", "angustiado"], ["😨", "medo"], ["😰", "ansioso suor"], ["😥", "triste aliviado"], ["😢", "chorando lagrima triste"], ["😭", "chorando muito"], ["😱", "grito medo susto"], ["😖", "frustrado"], ["😣", "perseverando"], ["😞", "decepcionado"], ["😓", "suor cansado"], ["😩", "exausto cansado"], ["😫", "cansado"], ["🥱", "bocejo sono tedio"], ["😤", "bravo resfolegando"], ["😡", "raiva bravo"], ["😠", "bravo irritado"], ["🤬", "xingando palavrao"], ["😈", "diabinho"], ["💀", "caveira morto"], ["💩", "coco cocô"], ["🤡", "palhaco"], ["👻", "fantasma"], ["🤖", "robo"],
  ] },
  { id: "gestos", rotulo: "Gestos e pessoas", icone: "👍", itens: [
    ["👍", "joinha positivo ok curtir sim"], ["👎", "negativo nao"], ["👏", "palmas aplausos parabens"], ["🙌", "maos para cima comemorar"], ["🤝", "aperto de mao acordo parceria"], ["🙏", "obrigado por favor rezar"], ["💪", "forca braco musculo"], ["👌", "ok perfeito"], ["🤌", "italiano"], ["✌️", "paz vitoria"], ["🤞", "dedos cruzados sorte"], ["🤟", "amo voce"], ["🤘", "rock"], ["👋", "tchau ola aceno"], ["🤚", "mao parada"], ["🖐️", "mao aberta"], ["✋", "pare mao"], ["☝️", "um atencao"], ["👆", "cima"], ["👇", "baixo"], ["👉", "direita"], ["👈", "esquerda"], ["🫶", "coracao maos carinho"], ["✍️", "escrevendo"], ["🤳", "selfie"], ["🧠", "cerebro"], ["👀", "olhos olhando"], ["👁️", "olho"], ["👂", "ouvido"], ["👃", "nariz"], ["👄", "boca"], ["🧑‍💻", "programador computador trabalho"], ["🧑‍🔬", "cientista laboratorio"], ["👩‍🔬", "cientista laboratorio"], ["👨‍🔬", "cientista laboratorio"], ["🧑‍⚕️", "medico saude"], ["🧑‍🏫", "professor treinamento"], ["🧑‍🔧", "mecanico manutencao"], ["🤷", "nao sei"], ["🤦", "facepalm vergonha"], ["🙋", "levantando a mao"], ["💁", "informando"], ["🙇", "reverencia desculpa"], ["🚶", "andando"], ["🏃", "correndo"], ["💃", "danca"], ["🕺", "danca"],
  ] },
  { id: "simbolos", rotulo: "Coração e símbolos", icone: "❤️", itens: [
    ["❤️", "coracao amor vermelho"], ["🧡", "coracao laranja"], ["💛", "coracao amarelo"], ["💚", "coracao verde"], ["💙", "coracao azul"], ["💜", "coracao roxo"], ["🖤", "coracao preto"], ["🤍", "coracao branco"], ["💔", "coracao partido"], ["💕", "coracoes"], ["💖", "coracao brilho"], ["💯", "cem perfeito"], ["✅", "certo feito ok concluido"], ["☑️", "marcado"], ["❌", "errado erro cancelar"], ["❗", "atencao exclamacao"], ["❓", "pergunta duvida"], ["⚠️", "alerta atencao cuidado"], ["🚫", "proibido"], ["⛔", "proibido entrada"], ["🔥", "fogo urgente quente"], ["⭐", "estrela favorito"], ["🌟", "estrela brilhante"], ["✨", "brilho novidade"], ["💥", "explosao"], ["💬", "mensagem conversa balao"], ["💭", "pensamento"], ["🔔", "sino notificacao"], ["🔕", "sem som"], ["🎉", "festa parabens comemorar"], ["🎊", "confete festa"], ["🏆", "trofeu campeao"], ["🥇", "medalha primeiro lugar"], ["🎯", "alvo meta objetivo"], ["📈", "grafico subindo crescimento"], ["📉", "grafico caindo queda"], ["➕", "mais"], ["➖", "menos"], ["➡️", "seta direita"], ["⬅️", "seta esquerda"], ["⬆️", "seta cima"], ["⬇️", "seta baixo"], ["🔁", "repetir"], ["🔄", "atualizar"], ["⏰", "despertador hora alarme"], ["⏳", "ampulheta espera prazo"], ["🕐", "relogio hora"], ["📌", "alfinete fixado"], ["📍", "local lugar"], ["🔒", "trancado seguro"], ["🔓", "destrancado"], ["🔑", "chave senha"],
  ] },
  { id: "trabalho", rotulo: "Trabalho e objetos", icone: "💼", itens: [
    ["💼", "maleta trabalho"], ["📁", "pasta"], ["📂", "pasta aberta arquivo"], ["📄", "documento pagina"], ["📃", "documento"], ["📝", "anotacao nota escrever"], ["📋", "prancheta lista"], ["📊", "grafico relatorio"], ["📅", "calendario data"], ["🗓️", "calendario agenda"], ["📎", "clipe anexo"], ["🖇️", "clipes"], ["✂️", "tesoura"], ["🖊️", "caneta"], ["✏️", "lapis"], ["📧", "email"], ["📨", "mensagem recebida"], ["📞", "telefone"], ["📱", "celular"], ["💻", "notebook computador"], ["🖥️", "computador"], ["🖨️", "impressora"], ["⌨️", "teclado"], ["🖱️", "mouse"], ["💡", "ideia lampada"], ["🔦", "lanterna"], ["🔧", "ferramenta chave manutencao"], ["🛠️", "ferramentas manutencao"], ["⚙️", "engrenagem configuracao"], ["🔬", "microscopio laboratorio"], ["🧪", "tubo de ensaio laboratorio"], ["🧫", "placa de petri laboratorio"], ["🧬", "dna"], ["⚗️", "alambique laboratorio"], ["💉", "seringa coleta vacina"], ["💊", "remedio comprimido"], ["🩺", "estetoscopio"], ["🌡️", "termometro temperatura"], ["⚖️", "balanca justica licitacao"], ["📦", "caixa pacote entrega"], ["🚚", "caminhao entrega"], ["🚗", "carro"], ["⛽", "combustivel"], ["🏢", "predio empresa"], ["🏭", "fabrica industria"], ["🏠", "casa"], ["💰", "dinheiro"], ["💵", "dinheiro nota"], ["💳", "cartao"], ["🧾", "recibo nota fiscal"], ["🧮", "calculo"], ["🛒", "carrinho compras"],
  ] },
  { id: "natureza", rotulo: "Natureza e clima", icone: "🌱", itens: [
    ["🌱", "planta muda"], ["🌿", "folha"], ["🍀", "trevo sorte"], ["🌳", "arvore"], ["🌴", "palmeira"], ["🌵", "cacto"], ["🌷", "tulipa flor"], ["🌹", "rosa flor"], ["🌻", "girassol"], ["🌼", "flor"], ["💐", "buque flores"], ["☀️", "sol"], ["🌤️", "sol nuvem"], ["⛅", "nublado"], ["☁️", "nuvem"], ["🌧️", "chuva"], ["⛈️", "tempestade"], ["⚡", "raio energia"], ["❄️", "neve frio"], ["🌈", "arco iris"], ["🌙", "lua noite"], ["🌎", "planeta terra mundo"], ["🔥", "fogo"], ["💧", "gota agua"], ["🌊", "onda mar"], ["🐶", "cachorro"], ["🐱", "gato"], ["🐭", "rato"], ["🐰", "coelho"], ["🦊", "raposa"], ["🐻", "urso"], ["🐼", "panda"], ["🦁", "leao"], ["🐮", "vaca"], ["🐷", "porco"], ["🐸", "sapo"], ["🐵", "macaco"], ["🐔", "galinha"], ["🐧", "pinguim"], ["🦆", "pato"], ["🦉", "coruja"], ["🐝", "abelha"], ["🦋", "borboleta"], ["🐢", "tartaruga"], ["🐍", "cobra"], ["🐟", "peixe"], ["🐬", "golfinho"],
  ] },
  { id: "comida", rotulo: "Comida e bebida", icone: "☕", itens: [
    ["☕", "cafe"], ["🍵", "cha"], ["🥤", "refrigerante copo"], ["🧃", "suco"], ["🍺", "cerveja"], ["🍻", "brinde cerveja"], ["🥂", "brinde taca"], ["🍷", "vinho"], ["💧", "agua"], ["🍕", "pizza"], ["🍔", "hamburguer lanche"], ["🌭", "cachorro quente"], ["🥪", "sanduiche"], ["🌮", "taco"], ["🍟", "batata frita"], ["🍗", "frango coxa"], ["🍖", "carne"], ["🥩", "bife carne"], ["🍝", "macarrao massa"], ["🍚", "arroz"], ["🍲", "panela comida"], ["🥗", "salada"], ["🍞", "pao"], ["🧀", "queijo"], ["🥚", "ovo"], ["🍎", "maca"], ["🍌", "banana"], ["🍇", "uva"], ["🍉", "melancia"], ["🍓", "morango"], ["🍍", "abacaxi"], ["🥑", "abacate"], ["🍰", "bolo fatia"], ["🎂", "bolo aniversario"], ["🍫", "chocolate"], ["🍩", "rosquinha donut"], ["🍪", "biscoito"], ["🍦", "sorvete"],
  ] },
];

const normalizar = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Emojis que combinam com o texto digitado (palavra em qualquer ponto), sem repetir, no máximo `limite`. */
export function buscarEmojis(termo, limite = 80) {
  const q = normalizar(termo);
  if (!q) return [];
  const vistos = new Set(), out = [];
  for (const cat of CATEGORIAS) for (const [emoji, palavras] of cat.itens) {
    if (vistos.has(emoji) || !normalizar(palavras).includes(q)) continue;
    vistos.add(emoji); out.push(emoji);
    if (out.length >= limite) return out;
  }
  return out;
}

/** Põe o emoji no lugar do cursor (ou no lugar da seleção) e diz onde o cursor fica depois. */
export function inserirNoTexto(texto, inicio, fim, emoji) {
  const t = String(texto ?? "");
  const a = Math.min(Math.max(0, inicio ?? t.length), t.length), b = Math.min(Math.max(a, fim ?? a), t.length);
  return { texto: t.slice(0, a) + emoji + t.slice(b), cursor: a + emoji.length };
}

const CHAVE_RECENTES = "ml_emojis_recentes";
/** Atualiza a lista de recentes (o último usado vai para o começo; sem repetir; até 24). */
export const comRecente = (lista, emoji) => [emoji, ...(lista || []).filter((e) => e !== emoji)].slice(0, 24);
export function lerRecentes() { try { const v = JSON.parse(localStorage.getItem(CHAVE_RECENTES) || "[]"); return Array.isArray(v) ? v.filter((e) => typeof e === "string").slice(0, 24) : []; } catch { return []; } }
export function gravarRecentes(lista) { try { localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista)); } catch { /* sem armazenamento local, só vale agora */ } }
