#!/usr/bin/env python3
"""Gera supabase/importacoes/patrimonio-lce.sql a partir da planilha LCE/LCI.

Uso: python3 scripts/gerar-importacao-patrimonio-lce.py <planilha.xlsx>
O SQL só INSERE (nunca altera nem apaga) e pula código ou setor já existente.
"""
import json, re, sys, datetime, openpyxl

AREAS = {
    'MICROBIOLOGIA': 'Microbiologia', 'AUTOCLAVE MICROBIOLOGIA': 'Microbiologia',
    'BANHO MARIA DE ENSAIOS MICRO': 'Microbiologia',
    'FISICO QUIMICO': 'Físico-Químico', 'FQ AGUA': 'Físico-Químico', 'FQ ÁGUA': 'Físico-Químico',
    'INCUBADORA DE DBO FQ AGUA': 'Físico-Químico',
    'FQ EFLUENTE': 'FQ Efluente', 'FISICO QUIMICO/EFLUENTES': 'FQ Efluente',
    'FISICO QUIMICO/ AMOSTRAGEM': 'Físico-Químico / Amostragem',
    'AMOSTRAGEM': 'Amostragem', 'RECEPÇÃO': 'Recepção', 'COMERCIAL': 'Comercial',
    'ARMAZENAMENTO DE AMOSTRAS': 'Armazenamento de amostras', 'COPA': 'Copa',
    'ALMOXARIFADO': 'Almoxarifado', 'DIRETORIA': 'Diretoria',
    'SALA DE LAVAGEM': 'Sala de lavagem', 'SALA DE REUNIÃO': 'Sala de reunião',
}
nada = lambda v: v is None or str(v).strip().upper() in ('', 'NA', 'N/A')
limpa = lambda v: re.sub(r'\s+', ' ', str(v)).strip()
sn = lambda v: {'SIM': 'sim', 'NÃO': 'nao', 'NAO': 'nao'}.get(limpa(v).upper(), '') if v else ''
def dia(v):
    return v.date().isoformat() if isinstance(v, datetime.datetime) else ''
q = lambda o: "$q$" + json.dumps(o, ensure_ascii=False) + "$q$::jsonb"

wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
vistos, linhas, avisos = set(), [], []
for ws in wb:
    for r in ws.iter_rows(min_row=10, values_only=True):
        if not r[1]:
            continue
        cod = limpa(r[1])
        if cod in vistos:
            avisos.append(f'{ws.title}: código repetido {cod} ({limpa(r[2])}) - ignorado'); continue
        vistos.add(cod)
        setor_orig = limpa(r[4]) if r[4] else ''
        area = AREAS.get(setor_orig.upper(), setor_orig.title())
        obs = []
        if setor_orig and area.upper() != setor_orig.upper():
            obs.append(f'Local na planilha: {setor_orig}')
        cond = limpa(r[5]) if r[5] else ''
        if cond and cond.upper() != 'CONFORME': obs.append(f'Recebimento: {cond}')
        if isinstance(r[7], str) and r[7].strip(): obs.append(f'Funcionamento: {limpa(r[7])}')
        if r[13] and limpa(r[13]).upper() != 'APROVADO': obs.append(f'Status: {limpa(r[13])}')
        if not nada(r[15]): obs.append(limpa(r[15]))
        fora = limpa(r[14]).upper() == 'FORA DE USO'
        dados = {
            'codigo': cod, 'setorSigla': 'LAB', 'areaLab': area,
            'nomeGenerico': limpa(r[2]).capitalize(), 'descricaoTecnica': '',
            'volume': '' if nada(r[3]) else limpa(r[3]),
            'nf': '', 'motivoSemNota': 'Importado da planilha LCE; nota não informada', 'responsavel': 'Importação LCE',
            'dataAquisicao': dia(r[6]), 'dataFuncionamento': dia(r[7]), 'valor': 0,
            'situacao': 'manutencao' if fora else 'uso',
            'reqQualificacao': sn(r[8]), 'reqCalibracao': sn(r[9]), 'reqSoftware': sn(r[10]), 'reqManutencao': sn(r[11]),
            'observacao': ' | '.join(obs),
        }
        i = 'pat-lce-' + re.sub(r'[^a-z0-9]', '', cod.lower())
        linhas.append(
            f"insert into public.ml_patrimonio(tipo,id,dados,atualizado_por) select 'bem','{i}',{q({**dados,'id':i})},'importacao-lce' "
            f"where not exists(select 1 from public.ml_patrimonio where tipo='bem' and (id='{i}' or dados->>'codigo'='{cod}'));")

setor = {'sigla': 'LAB', 'nome': 'Laboratório', 'area': 'Operações', 'id': 'set-lab'}
sql = ["-- Gerado por scripts/gerar-importacao-patrimonio-lce.py. Só insere; repetidos são pulados.",
       "begin;",
       f"insert into public.ml_patrimonio(tipo,id,dados,atualizado_por) select 'setor','set-lab',{q(setor)},'importacao-lce' "
       "where not exists(select 1 from public.ml_patrimonio where tipo='setor' and not apagado and dados->>'sigla'='LAB');",
       *linhas, "commit;"]
import os
os.makedirs('supabase/importacoes', exist_ok=True)
open('supabase/importacoes/patrimonio-lce.sql', 'w').write('\n'.join(sql) + '\n')
print(len(linhas), 'bens;', *avisos, sep='\n')
