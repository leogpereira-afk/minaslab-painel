import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Pencil,
  CheckCircle2,
  Trash2,
  Upload,
  Download,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/ui.jsx";
import {
  recebimentosListar,
  recebimentosOpcoes,
  recebimentoSalvar,
  recebimentoLiquidar,
  recebimentoExcluir,
  recebimentosImportar,
} from "../services/dados.js";

const ITENS_POR_PAGINA = 10;

function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataBR(valor) {
  if (!valor) return "—";
  const p = String(valor).slice(0, 10).split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return String(valor);
}

function hojeISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function normalizarStatus(status) {
  const v = String(status || "").trim().toUpperCase();
  if (["PAGO", "RECEBIDO", "LIQUIDADO"].includes(v)) return "PAGO";
  if (["PARCIAL", "PAGTOPARCIAL", "PAGTO_PARCIAL"].includes(v)) return "PARCIAL";
  if (["VENCIDO", "ATRASADO"].includes(v)) return "VENCIDO";
  if (["CANCELADO", "CANCELADA"].includes(v)) return "CANCELADO";
  return "A RECEBER";
}

function StatusBadge({ status }) {
  const s = normalizarStatus(status);
  const estilos = {
    PAGO: "bg-emerald-50 text-emerald-700",
    PARCIAL: "bg-amber-50 text-amber-700",
    "A RECEBER": "bg-sky-50 text-sky-700",
    VENCIDO: "bg-red-50 text-red-700",
    CANCELADO: "bg-slate-100 text-slate-600",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${estilos[s]}`}>{s}</span>;
}

function Modal({ titulo, children, onClose, largura = "max-w-3xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className={`max-h-[92vh] w-full ${largura} overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{titulo}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[calc(92vh-70px)] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input {...props} className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 ${props.className || ""}`} />
    </label>
  );
}

function Select({ label, children, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select {...props} className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-500 ${props.className || ""}`}>
        {children}
      </select>
    </label>
  );
}

const FORM_VAZIO = {
  id: "",
  empresa_id: "",
  cliente: "",
  cnpj_cpf: "",
  descricao: "",
  valor_previsto: "",
  valor_recebido: "0",
  data_vencimento: "",
  data_pagamento: "",
  status: "A RECEBER",
  categoria_id: "",
  categoria_texto: "",
  conta_bancaria_id: "",
  conta_bancaria_texto: "",
  forma_pagamento: "PIX",
  numero_nf: "",
  observacao: "",
};

function carregarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((resolve, reject) => {
    const existente = document.querySelector('script[data-sheetjs="recebimentos"]');
    if (existente) {
      existente.addEventListener("load", () => resolve(window.XLSX), { once: true });
      existente.addEventListener("error", () => reject(new Error("Falha ao carregar o leitor de Excel.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    script.async = true;
    script.dataset.sheetjs = "recebimentos";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Falha ao carregar o leitor de Excel."));
    document.head.appendChild(script);
  });
}

function normalizarCabecalho(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function valorNumero(v) {
  if (typeof v === "number") return v;
  let s = String(v ?? "").trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s) || 0;
}

function dataISO(v) {
  if (!v) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && window.XLSX?.SSF?.parse_date_code) {
    const d = window.XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function mapearLinhaImportacao(obj) {
  const n = {};
  for (const [k, v] of Object.entries(obj || {})) n[normalizarCabecalho(k)] = v;
  const pegar = (...nomes) => {
    for (const nome of nomes) {
      const chave = normalizarCabecalho(nome);
      if (n[chave] !== undefined && n[chave] !== "") return n[chave];
    }
    return "";
  };
  return {
    cnpj_cpf: String(pegar("CNPJ/CPF", "CNPJ CPF", "Documento", "CNPJ", "CPF") || "").trim(),
    cliente: String(pegar("Cliente", "Razão Social", "Razao Social", "Nome") || "").trim(),
    data_vencimento: dataISO(pegar("Vencimento", "Data", "Data Vencimento")),
    categoria_texto: String(pegar("Categoria") || "").trim(),
    forma_pagamento: String(pegar("Forma de Pagamento", "Forma Pagamento", "Forma") || "PIX").trim(),
    valor_previsto: valorNumero(pegar("Valor", "Valor Previsto", "Previsto")),
    valor_recebido: valorNumero(pegar("Valor Recebido", "Recebido")),
    status: String(pegar("Status") || "A RECEBER").trim().toUpperCase(),
    numero_nf: String(pegar("Nº NF", "No NF", "Numero NF", "NF", "Nota Fiscal") || "").trim(),
    descricao: String(pegar("Descrição", "Descricao", "Histórico", "Historico") || "").trim(),
    conta_bancaria_texto: String(pegar("Conta", "Conta Bancária", "Conta Bancaria") || "").trim(),
    data_pagamento: dataISO(pegar("Data Pagamento", "Pagamento", "Data Recebimento")),
    observacao: String(pegar("Observação", "Observacao") || "").trim(),
  };
}

export default function Recebimentos() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [dados, setDados] = useState([]);
  const [opcoes, setOpcoes] = useState({ empresas: [], categorias: [], contas: [] });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [busca, setBusca] = useState("");
  const [empresa, setEmpresa] = useState("Todas");
  const [ano, setAno] = useState("Todos");
  const [mes, setMes] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [pagina, setPagina] = useState(1);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [baixa, setBaixa] = useState({ id: "", cliente: "", dataPagamento: hojeISO() });
  const [importacao, setImportacao] = useState({ empresaId: "", arquivo: null, itens: [], nome: "", tipo: "" });

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const [lista, opts] = await Promise.all([recebimentosListar(), recebimentosOpcoes()]);
      setDados(Array.isArray(lista) ? lista : []);
      setOpcoes(opts || { empresas: [], categorias: [], contas: [] });
    } catch (e) {
      setErro(e?.message || "Não foi possível carregar os recebimentos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);
  useEffect(() => { setPagina(1); }, [busca, empresa, ano, mes, status]);

  const anos = useMemo(() => {
    const set = new Set();
    for (const item of dados) {
      const a = String(item.data_vencimento || "").slice(0, 4);
      if (/^\d{4}$/.test(a)) set.add(a);
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [dados]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return dados.filter((item) => {
      const empresaNome = item.empresa?.nome || "";
      const texto = `${item.cliente || ""} ${item.cnpj_cpf || ""} ${item.descricao || ""} ${item.numero_nf || ""}`.toLowerCase();
      const dt = String(item.data_vencimento || "").slice(0, 10);
      const a = dt.slice(0, 4);
      const m = dt.slice(5, 7);
      return (
        (!termo || texto.includes(termo)) &&
        (empresa === "Todas" || empresaNome === empresa) &&
        (ano === "Todos" || a === ano) &&
        (mes === "Todos" || m === mes) &&
        (status === "Todos" || normalizarStatus(item.status) === status)
      );
    });
  }, [dados, busca, empresa, ano, mes, status]);

  const totais = useMemo(() => filtrados.reduce((acc, item) => {
    acc.previsto += Number(item.valor_previsto || 0);
    acc.recebido += Number(item.valor_recebido || 0);
    acc.pendente += Number(item.valor_pendente || 0);
    return acc;
  }, { previsto: 0, recebido: 0, pendente: 0 }), [filtrados]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA));
  const itensPagina = filtrados.slice((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA);

  function abrirNovo() {
    setForm({ ...FORM_VAZIO, empresa_id: opcoes.empresas?.[0]?.id || "" });
    setModal("form");
  }

  function abrirEditar(item) {
    setForm({
      id: item.id,
      empresa_id: item.empresa_id || item.empresa?.id || "",
      cliente: item.cliente || "",
      cnpj_cpf: item.cnpj_cpf || "",
      descricao: item.descricao || "",
      valor_previsto: String(item.valor_previsto ?? ""),
      valor_recebido: String(item.valor_recebido ?? 0),
      data_vencimento: item.data_vencimento || "",
      data_pagamento: item.data_pagamento || "",
      status: normalizarStatus(item.status),
      categoria_id: item.categoria_id || item.categoria?.id || "",
      categoria_texto: item.categoria_texto || item.categoria?.nome || "",
      conta_bancaria_id: item.conta_bancaria_id || item.conta_bancaria?.id || "",
      conta_bancaria_texto: item.conta_bancaria_texto || item.conta_bancaria?.nome || "",
      forma_pagamento: item.forma_pagamento || "PIX",
      numero_nf: item.numero_nf || "",
      observacao: item.observacao || "",
    });
    setModal("form");
  }

  async function salvarForm(e) {
    e.preventDefault();
    try {
      setSalvando(true);
      setErro("");
      const categoria = opcoes.categorias.find((x) => String(x.id) === String(form.categoria_id));
      const conta = opcoes.contas.find((x) => String(x.id) === String(form.conta_bancaria_id));
      await recebimentoSalvar({
        ...form,
        valor_previsto: Number(form.valor_previsto || 0),
        valor_recebido: Number(form.valor_recebido || 0),
        categoria_texto: categoria?.nome || form.categoria_texto || null,
        conta_bancaria_texto: conta?.nome || form.conta_bancaria_texto || null,
      });
      setModal(null);
      setSucesso(form.id ? "Recebimento atualizado com sucesso." : "Recebimento cadastrado com sucesso.");
      await carregar();
    } catch (e2) {
      setErro(e2?.message || "Falha ao salvar recebimento.");
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarBaixa(e) {
    e.preventDefault();
    try {
      setSalvando(true);
      setErro("");
      await recebimentoLiquidar(baixa.id, baixa.dataPagamento);
      setModal(null);
      setSucesso("Baixa registrada com sucesso.");
      await carregar();
    } catch (e2) {
      setErro(e2?.message || "Falha ao dar baixa.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(item) {
    if (!window.confirm(`Excluir o recebimento de ${item.cliente}?\n\nA exclusão será lógica e o histórico de auditoria será preservado.`)) return;
    try {
      setErro("");
      await recebimentoExcluir(item.id);
      setSucesso("Recebimento excluído com sucesso.");
      await carregar();
    } catch (e) {
      setErro(e?.message || "Falha ao excluir recebimento.");
    }
  }

  async function lerArquivo(file) {
    setErro("");
    if (!file) return;
    const nome = file.name || "arquivo";
    const ext = nome.toLowerCase().split(".").pop();
    let linhas = [];

    if (ext === "csv") {
      const XLSX = await carregarSheetJS();
      const texto = await file.text();
      const wb = XLSX.read(texto, { type: "string", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      linhas = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
    } else if (["xlsx", "xls"].includes(ext)) {
      const XLSX = await carregarSheetJS();
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      linhas = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
    } else {
      throw new Error("Use um arquivo CSV, XLSX ou XLS.");
    }

    const itens = linhas.map(mapearLinhaImportacao).filter((x) => x.cliente || x.valor_previsto);
    setImportacao((a) => ({ ...a, arquivo: file, itens, nome, tipo: ext.toUpperCase() }));
  }

  async function executarImportacao() {
    try {
      if (!importacao.empresaId) throw new Error("Selecione a empresa da importação.");
      if (!importacao.itens.length) throw new Error("O arquivo não possui linhas válidas para importar.");
      setSalvando(true);
      const r = await recebimentosImportar(importacao.empresaId, importacao.itens, importacao.tipo || "ARQUIVO");
      setModal(null);
      setImportacao({ empresaId: "", arquivo: null, itens: [], nome: "", tipo: "" });
      setSucesso(`${r.inseridos || 0} recebimentos importados com sucesso.`);
      await carregar();
    } catch (e) {
      setErro(e?.message || "Falha na importação.");
    } finally {
      setSalvando(false);
    }
  }

  async function baixarModelo() {
    try {
      const XLSX = await carregarSheetJS();
      const exemplo = [{
        "CNPJ/CPF": "00.000.000/0001-00",
        Cliente: "Cliente Exemplo",
        Vencimento: "2026-09-05",
        Categoria: "SERVIÇOS REALIZADOS",
        "Forma de Pagamento": "PIX",
        Valor: 2500,
        "Valor Recebido": 0,
        Status: "A RECEBER",
        "Nº NF": "12345",
        Descrição: "Análises laboratoriais",
        Conta: "C6 BANK",
        "Data Pagamento": "",
        Observação: "",
      }];
      const ws = XLSX.utils.json_to_sheet(exemplo);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Recebimentos");
      XLSX.writeFile(wb, "Modelo_Importacao_Recebimentos.xlsx");
    } catch (e) {
      setErro(e?.message || "Não foi possível gerar o modelo Excel.");
    }
  }

  const meses = [
    ["01", "Janeiro"], ["02", "Fevereiro"], ["03", "Março"], ["04", "Abril"],
    ["05", "Maio"], ["06", "Junho"], ["07", "Julho"], ["08", "Agosto"],
    ["09", "Setembro"], ["10", "Outubro"], ["11", "Novembro"], ["12", "Dezembro"],
  ];

  return (
    <div>
      <button type="button" onClick={() => navigate("/financas")} className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-teal-700">
        <ArrowLeft size={16} /> Voltar para Finanças
      </button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageTitle titulo="Recebimentos" descricao="Controle de contas a receber da MinasLab e M Lab." />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={baixarModelo} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Download size={17} /> Baixar modelo
          </button>
          <button type="button" onClick={() => { setImportacao({ empresaId: opcoes.empresas?.[0]?.id || "", arquivo: null, itens: [], nome: "", tipo: "" }); setModal("importar"); }} className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-100">
            <Upload size={17} /> Importar
          </button>
          <button type="button" onClick={abrirNovo} className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700">
            <Plus size={18} /> Novo recebimento
          </button>
        </div>
      </div>

      {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{sucesso}</div>}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Valor previsto</p><p className="mt-2 text-2xl font-bold text-slate-900">{moeda(totais.previsto)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Recebido</p><p className="mt-2 text-2xl font-bold text-emerald-700">{moeda(totais.recebido)}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">A receber</p><p className="mt-2 text-2xl font-bold text-amber-700">{moeda(totais.pendente)}</p></div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(260px,1fr)_160px_130px_150px_160px_44px]">
          <div className="relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, CNPJ/CPF, descrição ou NF..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-teal-500" /></div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><Filter size={16} className="text-slate-400" /><select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="w-full bg-transparent py-2.5 text-sm outline-none"><option>Todas</option><option>MinasLab</option><option>M Lab</option></select></div>
          <select value={ano} onChange={(e) => setAno(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"><option>Todos</option>{anos.map((a) => <option key={a}>{a}</option>)}</select>
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"><option value="Todos">Todos meses</option>{meses.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"><option>Todos</option><option>A RECEBER</option><option>PARCIAL</option><option>PAGO</option><option>VENCIDO</option><option>CANCELADO</option></select>
          <button type="button" onClick={carregar} title="Atualizar" className="flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><RefreshCw size={17} /></button>
        </div>
      </div>

      {carregando ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Carregando recebimentos...</div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1750px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500"><tr>
                <th className="px-4 py-3">Empresa</th><th className="px-4 py-3">CNPJ/CPF</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">NF</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Previsto</th><th className="px-4 py-3">Recebido</th><th className="px-4 py-3">A receber</th><th className="px-4 py-3">Pagamento</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Forma</th><th className="px-4 py-3">Conta</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3 text-right">Ações</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {itensPagina.map((item) => {
                  const ehOmie = String(item.origem || "").toUpperCase() === "OMIE";
                  const st = normalizarStatus(item.status);
                  return <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">{item.empresa?.nome || "—"}</td><td className="px-4 py-4">{item.cnpj_cpf || "—"}</td><td className="px-4 py-4 font-medium text-slate-900">{item.cliente || "—"}</td><td className="px-4 py-4">{item.descricao || "—"}</td><td className="px-4 py-4">{item.numero_nf || "—"}</td><td className="px-4 py-4">{dataBR(item.data_vencimento)}</td><td className="px-4 py-4">{moeda(item.valor_previsto)}</td><td className="px-4 py-4 text-emerald-700">{moeda(item.valor_recebido)}</td><td className="px-4 py-4 text-amber-700">{moeda(item.valor_pendente)}</td><td className="px-4 py-4">{dataBR(item.data_pagamento)}</td><td className="px-4 py-4"><StatusBadge status={item.status} /></td><td className="px-4 py-4">{item.categoria?.nome || item.categoria_texto || "—"}</td><td className="px-4 py-4">{item.forma_pagamento || "—"}</td><td className="px-4 py-4">{item.conta_bancaria?.nome || item.conta_bancaria_texto || "—"}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ehOmie ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"}`}>{ehOmie ? "OMIE" : "MANUAL"}</span></td>
                    <td className="px-4 py-4"><div className="flex justify-end gap-1.5">
                      <button type="button" disabled={ehOmie} onClick={() => abrirEditar(item)} title={ehOmie ? "Controlado pela Omie" : "Editar"} className={`rounded-lg p-2 ${ehOmie ? "cursor-not-allowed text-slate-300" : "text-slate-500 hover:bg-slate-100"}`}><Pencil size={16} /></button>
                      <button type="button" disabled={ehOmie || st === "PAGO" || st === "CANCELADO"} onClick={() => { setBaixa({ id: item.id, cliente: item.cliente || "", dataPagamento: hojeISO() }); setModal("baixa"); }} title={ehOmie ? "Controlado pela Omie" : "Dar baixa"} className={`rounded-lg p-2 ${ehOmie || st === "PAGO" || st === "CANCELADO" ? "cursor-not-allowed text-slate-300" : "text-emerald-600 hover:bg-emerald-50"}`}><CheckCircle2 size={16} /></button>
                      <button type="button" disabled={ehOmie} onClick={() => excluir(item)} title={ehOmie ? "Controlado pela Omie" : "Excluir"} className={`rounded-lg p-2 ${ehOmie ? "cursor-not-allowed text-slate-300" : "text-red-500 hover:bg-red-50"}`}><Trash2 size={16} /></button>
                    </div></td>
                  </tr>;
                })}
                {!itensPagina.length && <tr><td colSpan="16" className="px-4 py-12 text-center text-slate-500">Nenhum recebimento encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-500">Mostrando {itensPagina.length} de {filtrados.length} registros</span>
            <div className="flex items-center gap-2"><button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40"><ChevronLeft size={15} /> Ant.</button><span className="px-2 text-slate-600">{pagina} / {totalPaginas}</span><button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40">Próx. <ChevronRight size={15} /></button></div>
          </div>
        </div>
      )}

      {modal === "form" && <Modal titulo={form.id ? "Editar recebimento" : "Novo recebimento"} onClose={() => setModal(null)}>
        <form onSubmit={salvarForm} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select label="Empresa *" value={form.empresa_id} onChange={(e) => setForm((f) => ({ ...f, empresa_id: e.target.value }))} required><option value="">Selecione</option>{opcoes.empresas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>
            <Input label="CNPJ / CPF" value={form.cnpj_cpf} onChange={(e) => setForm((f) => ({ ...f, cnpj_cpf: e.target.value }))} />
            <Input label="Cliente *" value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} required />
            <Input label="Nº NF" value={form.numero_nf} onChange={(e) => setForm((f) => ({ ...f, numero_nf: e.target.value }))} />
            <Input label="Descrição" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
            <Input label="Vencimento" type="date" value={form.data_vencimento} onChange={(e) => setForm((f) => ({ ...f, data_vencimento: e.target.value }))} />
            <Input label="Valor previsto *" type="number" min="0" step="0.01" value={form.valor_previsto} onChange={(e) => setForm((f) => ({ ...f, valor_previsto: e.target.value }))} required />
            <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}><option>A RECEBER</option><option>PARCIAL</option><option>PAGO</option><option>VENCIDO</option><option>CANCELADO</option></Select>
            {form.status === "PARCIAL" && <Input label="Valor recebido" type="number" min="0" step="0.01" value={form.valor_recebido} onChange={(e) => setForm((f) => ({ ...f, valor_recebido: e.target.value }))} />}
            {form.status === "PAGO" && <Input label="Data do pagamento" type="date" value={form.data_pagamento} onChange={(e) => setForm((f) => ({ ...f, data_pagamento: e.target.value }))} />}
            <Select label="Categoria" value={form.categoria_id} onChange={(e) => setForm((f) => ({ ...f, categoria_id: e.target.value }))}><option value="">Sem categoria</option>{opcoes.categorias.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>
            <Select label="Conta bancária" value={form.conta_bancaria_id} onChange={(e) => setForm((f) => ({ ...f, conta_bancaria_id: e.target.value }))}><option value="">Sem conta</option>{opcoes.contas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>
            <Select label="Forma de pagamento" value={form.forma_pagamento} onChange={(e) => setForm((f) => ({ ...f, forma_pagamento: e.target.value }))}><option>PIX</option><option>BOLETO</option><option>TRANSFERÊNCIA</option><option>DINHEIRO</option><option>CARTÃO</option><option>OUTRO</option></Select>
          </div>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Observação</span><textarea value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} rows="3" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500" /></label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setModal(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Cancelar</button><button type="submit" disabled={salvando} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{salvando ? "Salvando..." : "Salvar recebimento"}</button></div>
        </form>
      </Modal>}

      {modal === "baixa" && <Modal titulo="Dar baixa no recebimento" onClose={() => setModal(null)} largura="max-w-lg">
        <form onSubmit={confirmarBaixa} className="space-y-4"><p className="text-sm text-slate-600">Cliente: <strong>{baixa.cliente}</strong></p><Input label="Data de recebimento efetivo *" type="date" required value={baixa.dataPagamento} onChange={(e) => setBaixa((b) => ({ ...b, dataPagamento: e.target.value }))} /><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setModal(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Cancelar</button><button type="submit" disabled={salvando} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Confirmar baixa</button></div></form>
      </Modal>}

      {modal === "importar" && <Modal titulo="Importar recebimentos" onClose={() => setModal(null)}>
        <div className="space-y-5">
          <Select label="Empresa dos registros *" value={importacao.empresaId} onChange={(e) => setImportacao((a) => ({ ...a, empresaId: e.target.value }))}><option value="">Selecione</option>{opcoes.empresas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>
          <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-slate-600 hover:border-teal-300 hover:bg-teal-50"><FileSpreadsheet size={34} /><span className="font-semibold">Selecionar CSV, XLSX ou XLS</span><span className="text-xs text-slate-400">Use o botão “Baixar modelo” para obter as colunas recomendadas.</span></button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={async (e) => { try { await lerArquivo(e.target.files?.[0]); } catch (err) { setErro(err?.message || "Falha ao ler arquivo."); } }} />
          {importacao.nome && <div className="rounded-xl bg-slate-50 p-4 text-sm"><div><strong>Arquivo:</strong> {importacao.nome}</div><div><strong>Linhas reconhecidas:</strong> {importacao.itens.length}</div>{importacao.itens.length > 0 && <div className="mt-3 overflow-x-auto"><table className="min-w-[700px] text-xs"><thead><tr className="text-left text-slate-500"><th className="p-2">Cliente</th><th className="p-2">Vencimento</th><th className="p-2">Valor</th><th className="p-2">Status</th><th className="p-2">NF</th></tr></thead><tbody>{importacao.itens.slice(0, 5).map((x, i) => <tr key={i} className="border-t border-slate-200"><td className="p-2">{x.cliente || "—"}</td><td className="p-2">{x.data_vencimento || "—"}</td><td className="p-2">{moeda(x.valor_previsto)}</td><td className="p-2">{x.status}</td><td className="p-2">{x.numero_nf || "—"}</td></tr>)}</tbody></table></div>}</div>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setModal(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Cancelar</button><button type="button" disabled={salvando || !importacao.itens.length || !importacao.empresaId} onClick={executarImportacao} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{salvando ? "Importando..." : `Importar ${importacao.itens.length || ""}`}</button></div>
        </div>
      </Modal>}
    </div>
  );
}
