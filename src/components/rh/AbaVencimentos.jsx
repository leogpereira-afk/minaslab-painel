// Aba Vencimentos do RH: o radar de ASO, NRs, treinamentos e CNH — o alerta
// acende a 60 dias. Estado e gravação moram na casca (pages/RH.jsx).

import { clsx } from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import { dataLonga } from "../../lib/format.js";
import { SectionTitle, Empty, Modal, Card } from "../ui.jsx";

const TIPOS_VENC = ["ASO", "NR-35", "NR-06", "NR-10", "Treinamento", "CNH", "Outro"];

function LinhaVenc({ v, editavel, aoEditar, aoApagar }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3"
      style={{ borderColor: "var(--hairline)" }}
    >
      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate font-display text-sm font-medium text-slate-900">
          {v.tipo}
          {v.descricao && <span className="font-normal text-slate-500"> — {v.descricao}</span>}
        </span>
        <span className="block truncate text-xs text-slate-500">{v.pessoaNome || "pessoa sem registro"}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={clsx(v.cv.chip, "whitespace-nowrap")}>{v.cv.texto}</span>
        <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
          {v.vence ? dataLonga(v.vence) : "sem data"}
        </span>
      </span>
      {editavel && (
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={aoEditar}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={aoApagar}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-bad-50 hover:text-bad-700"
            title="Apagar"
          >
            <Trash2 size={14} />
          </button>
        </span>
      )}
    </div>
  );
}

function FormVenc({ form, setForm, ativos, salvando, aoSalvar, aoFechar }) {
  if (!form) return null;
  const setCampo = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const foraDoQuadro = form.pessoaId && !ativos.some((x) => x.id === form.pessoaId);
  return (
    <Modal titulo={form.id ? "Editar vencimento" : "Novo vencimento"} aberto={!!form} aoFechar={aoFechar}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aoSalvar();
        }}
        className="space-y-4"
      >
        <div>
          <label className="label" htmlFor="v-pessoa">Pessoa</label>
          <select id="v-pessoa" className="select" value={form.pessoaId} onChange={setCampo("pessoaId")} required>
            <option value="" disabled>— escolha —</option>
            {foraDoQuadro && <option value={form.pessoaId}>{form.pessoaNome || "—"} (fora do quadro)</option>}
            {ativos.map((x) => (
              <option key={x.id} value={x.id}>{x.nome}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="v-tipo">Tipo</label>
            <select id="v-tipo" className="select" value={form.tipo} onChange={setCampo("tipo")}>
              {TIPOS_VENC.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="v-vence">Vence em</label>
            <input id="v-vence" type="date" className="input" value={form.vence} onChange={setCampo("vence")} required />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="v-desc">Descrição</label>
          <input id="v-desc" type="text" className="input" placeholder="ex.: reciclagem NR-35" value={form.descricao} onChange={setCampo("descricao")} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando || !form.pessoaId || !form.vence}>
            {salvando ? "Gravando..." : "Gravar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AbaVencimentos({
  vencimentos, pessoasComVenc, ativos, editavel, filtroVenc, setFiltroVenc,
  form, setForm, salvando, aoAbrir, aoGravar, aoFechar, aoApagar,
}) {
  const vencVisiveis = filtroVenc
    ? vencimentos.filter((v) => v.pessoaId === filtroVenc)
    : vencimentos;

  return (
    <>
      <Card>
        <SectionTitle
          titulo="Radar de vencimentos"
          sub="ASO, NRs, treinamentos e CNH — o alerta acende a 60 dias."
          acao={
            <>
              <label className="sr-only" htmlFor="rh-filtro-venc">Filtrar por pessoa</label>
              <select
                id="rh-filtro-venc"
                className="select h-9 w-56"
                value={filtroVenc}
                onChange={(e) => setFiltroVenc(e.target.value)}
              >
                <option value="">Todas as pessoas</option>
                {pessoasComVenc.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </>
          }
        />
        {vencVisiveis.length === 0 && (
          <Empty>
            {filtroVenc
              ? "Nada anotado para esta pessoa."
              : "Nenhum vencimento anotado. Anote o primeiro no botão lá em cima."}
          </Empty>
        )}
        <div className="space-y-2">
          {vencVisiveis.map((v) => (
            <LinhaVenc key={v.id} v={v} editavel={editavel} aoEditar={() => aoAbrir(v)} aoApagar={() => aoApagar(v)} />
          ))}
        </div>
      </Card>

      <FormVenc
        form={form}
        setForm={setForm}
        ativos={ativos}
        salvando={salvando}
        aoSalvar={aoGravar}
        aoFechar={aoFechar}
      />
    </>
  );
}
