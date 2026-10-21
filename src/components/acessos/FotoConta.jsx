// Foto de perfil de uma conta (tela Acessos). A foto salva aparece em todo o sistema: tarefas, mensagens, menu...
import Avatar from "../tarefas/Avatar.jsx";
import EditorFoto from "./EditorFoto.jsx";
import { contaFoto, contaFotoRemover } from "../../services/contas.js";
import { definirFoto, useFotoDe } from "../../services/perfis.js";

export default function FotoConta({ conta, aoFechar, aoSalvar }) {
  const atual = useFotoDe(conta.usuario);
  return (
    <EditorFoto
      titulo={`Foto de ${conta.nome || conta.usuario}`}
      atual={atual}
      legenda="A foto aparece no sistema inteiro: tarefas, mensagens e menu. Fica em formato redondo."
      aoFechar={aoFechar}
      aoSalvar={async (base64) => { const r = await contaFoto(conta.usuario, base64); definirFoto(conta.usuario, r.foto); aoSalvar?.(); }}
      aoRemover={async () => { await contaFotoRemover(conta.usuario); definirFoto(conta.usuario, ""); aoSalvar?.(); }}
    >
      <Avatar usuario={conta.usuario} nome={conta.nome} tamanho={160} />
    </EditorFoto>
  );
}
