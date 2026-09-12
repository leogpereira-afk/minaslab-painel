import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarPdfPonto } from './pdfPonto.js';
const linha={nome:'João Gonçalves',data:'08/09/2026',entrada:'08:00',saida:'18:02',intervalo:60,pago:0,efetivo:542,folha:542,original:482,diferenca:60,situacao:'Registrado'};
test('PDF guarda recorte, regra, totais e valor de origem',()=>{
 const pdf=gerarPdfPonto({titulo:'08/09/2026',subtitulo:'Equipe atual · 1 pessoa',registros:[linha],jornada:'segunda a quinta 9h; sexta 8h; 44h semanais',emitidoEm:new Date('2026-09-12T10:00:00Z')}).output();
 assert.ok(pdf.startsWith('%PDF-'));for(const texto of ['08/09/2026','9h02','8h02','44h','1h00','João Gonçalves'])assert.ok(pdf.includes(texto),texto);
});
test('PDF pagina registros e mantém aviso de intervalo ausente',()=>{
 const doc=gerarPdfPonto({titulo:'Setembro de 2026',subtitulo:'Todas as pessoas',jornada:'44h semanais',registros:Array.from({length:65},(_,i)=>({...linha,nome:`Pessoa ${i+1}`,intervalo:'',efetivo:'',folha:'',situacao:'Intervalo não registrado'}))});
 assert.ok(doc.getNumberOfPages()>1);const pdf=doc.output();assert.ok(pdf.includes('Pessoa 65'));assert.ok(pdf.includes('Intervalo não registrado'));
});
