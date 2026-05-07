"""
Script de atualização do mock JSON:
1. Adiciona equipes 34-39 que estavam faltando (incluindo PRF=39 como raiz)
2. Adiciona id_equipe_pai=39 em todas as equipes com interno_prf=True (exceto a 39)
3. Importa tipificações penais do CSV base_tipificacao_integral_v4.csv
"""
import json
import csv

MOCK_FILE = "mock_firestore_atividades-bdi.json"
CSV_FILE = "planilhas/base_tipificacao_integral_v4.csv"

# Equipes que devem existir mas podem não estar no mock ainda
NOVAS_EQUIPES = {
    "34": {"id_equipe": 34, "equipe": "EQUIPE EXTRA - IFR", "interno_prf": True, "id_equipe_pai": 39},
    "35": {"id_equipe": 35, "equipe": "SEINT-ES", "interno_prf": True, "id_equipe_pai": 39},
    "36": {"id_equipe": 36, "equipe": "BDI VIANA", "interno_prf": True, "id_equipe_pai": 39},
    "37": {"id_equipe": 37, "equipe": "BDI GUARAPARI", "interno_prf": True, "id_equipe_pai": 39},
    "38": {"id_equipe": 38, "equipe": "BDI LINHARES", "interno_prf": True, "id_equipe_pai": 39},
    "39": {"id_equipe": 39, "equipe": "PRF", "interno_prf": True},  # Raiz, sem pai
}

with open(MOCK_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# ─── 1. Garantir coleção tipificacoes existe ────────────────────────────────
if "tipificacoes" not in data:
    data["tipificacoes"] = {}
    print("✅ Coleção 'tipificacoes' criada")

# ─── 2. Adicionar/atualizar equipes 34-39 ────────────────────────────────────
for key, eq in NOVAS_EQUIPES.items():
    if key not in data["equipes"]:
        data["equipes"][key] = eq
        print(f"✅ Equipe {key} - {eq['equipe']} adicionada")
    else:
        # Atualiza campos sem sobrescrever
        for k, v in eq.items():
            data["equipes"][key][k] = v
        print(f"♻️  Equipe {key} - {eq['equipe']} atualizada")

# ─── 3. Adicionar id_equipe_pai=39 em todas interno_prf=True (exceto 39) ────
for key, eq in data["equipes"].items():
    if eq.get("interno_prf") and eq.get("id_equipe") != 39:
        if eq.get("id_equipe_pai") is None:
            eq["id_equipe_pai"] = 39
            print(f"✅ id_equipe_pai=39 adicionado em {eq['equipe']} (id={eq['id_equipe']})")

# ─── 4. Importar CSV de tipificações penais ──────────────────────────────────
tipificacoes_existentes = {
    f"{v.get('lei','')}-{v.get('artigo','')}-{v.get('paragrafo','')}-{v.get('inciso','')}"
    for v in data["tipificacoes"].values()
}

next_id = max((int(k) for k in data["tipificacoes"].keys()), default=0) + 1
importados = 0
duplicados = 0

with open(CSV_FILE, newline="", encoding="utf-8") as csvf:
    reader = csv.DictReader(csvf, delimiter=";")
    for row in reader:
        lei = row.get("Lei", "").strip()
        artigo = row.get("Artigo", "").strip()
        paragrafo = row.get("Parágrafo", "").strip() or None
        inciso = row.get("Inciso", "").strip() or None
        descricao = row.get("Descrição", "").strip()

        chave = f"{lei}-{artigo}-{paragrafo}-{inciso}"
        if chave in tipificacoes_existentes:
            duplicados += 1
            continue

        data["tipificacoes"][str(next_id)] = {
            "id_tipificacao": next_id,
            "lei": lei,
            "artigo": artigo,
            "paragrafo": paragrafo,
            "inciso": inciso,
            "descricao": descricao,
        }
        tipificacoes_existentes.add(chave)
        next_id += 1
        importados += 1

print(f"\n📋 Tipificações: {importados} importadas, {duplicados} duplicadas ignoradas")
print(f"📋 Total no banco: {len(data['tipificacoes'])}")

# ─── 5. Salvar ───────────────────────────────────────────────────────────────
with open(MOCK_FILE, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("\n✅ mock_firestore_atividades-bdi.json atualizado com sucesso!")
