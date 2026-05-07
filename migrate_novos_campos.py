"""
Migração cirúrgica: adiciona tipificações penais e id_equipe_pai no Firestore de produção.
NÃO toca em atividades, usuários, categorias ou produtos existentes.

Uso:
    python migrate_novos_campos.py verify
    python migrate_novos_campos.py migrate
"""

import json
import os
import sys
from google.cloud import firestore

MOCK_FILE = "mock_firestore_atividades-bdi.json"


def load_mock():
    with open(MOCK_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def verify(db, data):
    print("🔍 Verificando campos novos no Firestore...\n")

    # Tipificações
    tips = list(db.collection('tipificacoes').stream())
    print(f"⚖️  Tipificações no Firestore : {len(tips)}")
    print(f"⚖️  Tipificações no mock JSON : {len(data.get('tipificacoes', {}))}")
    if len(tips) == 0:
        print("   ❌ Coleção vazia — precisa migrar\n")
    else:
        print("   ✅ Coleção populada\n")

    # Equipes com id_equipe_pai
    print("🏗️  Equipes PRF — id_equipe_pai:")
    equipes_prf = db.collection('equipes').where('interno_prf', '==', True).stream()
    sem_pai = []
    com_pai = []
    for doc in equipes_prf:
        d = doc.to_dict()
        pai = d.get('id_equipe_pai')
        if pai:
            com_pai.append(d.get('equipe'))
        else:
            sem_pai.append((doc.id, d.get('equipe')))

    for nome in com_pai:
        print(f"   ✅ {nome} — pai definido")
    for doc_id, nome in sem_pai:
        print(f"   ❌ {nome} (doc={doc_id}) — pai NÃO definido")

    print(f"\n   Com pai : {len(com_pai)}")
    print(f"   Sem pai : {len(sem_pai)}")


def migrate(db, data):
    print("🚀 Iniciando migração cirúrgica...\n")

    # ── 1. Tipificações (batch write) ─────────────────────────────────────
    print("⚖️  Migrando Tipificações Penais...")
    tipificacoes = data.get('tipificacoes', {})
    batch = db.batch()
    count = 0
    for id_tip, tip in tipificacoes.items():
        ref = db.collection('tipificacoes').document(str(id_tip))
        batch.set(ref, tip)
        count += 1
        if count % 400 == 0:          # Firestore: máx 500 por batch
            batch.commit()
            batch = db.batch()
    batch.commit()
    print(f"   ✅ {count} tipificações inseridas\n")

    # ── 2. id_equipe_pai nas equipes (batch update) ───────────────────────
    print("🏗️  Atualizando id_equipe_pai nas equipes...")
    mock_equipes = data.get('equipes', {})

    pai_map = {}
    for _, eq in mock_equipes.items():
        eid = eq.get('id_equipe')
        pai = eq.get('id_equipe_pai')
        if eid is not None:
            pai_map[str(eid)] = pai

    equipes_docs = list(db.collection('equipes').stream())
    batch = db.batch()
    atualizadas = 0
    for doc in equipes_docs:
        if doc.id in pai_map:
            batch.update(doc.reference, {'id_equipe_pai': pai_map[doc.id]})
            nome = doc.to_dict().get('equipe', doc.id)
            pai_val = pai_map[doc.id]
            print(f"   {'✅' if pai_val else '○ '} {nome} → id_equipe_pai={pai_val}")
            atualizadas += 1
    batch.commit()
    print(f"\n   Equipes atualizadas : {atualizadas}")

    print("\n✨ Migração concluída!\n")


if __name__ == "__main__":
    # Garantir credenciais
    cred_path = os.path.join(os.path.dirname(__file__), "atividades-intel-9cdabf39cef6.json")
    if os.path.exists(cred_path):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = cred_path

    print("=" * 60)
    print("  MIGRAÇÃO CIRÚRGICA — Tipificações + id_equipe_pai")
    print("=" * 60 + "\n")

    if not os.path.exists(MOCK_FILE):
        print(f"❌ Arquivo {MOCK_FILE} não encontrado!")
        sys.exit(1)

    data = load_mock()
    db = firestore.Client()

    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        verify(db, data)
    elif len(sys.argv) > 1 and sys.argv[1] == "migrate":
        verify(db, data)
        print()
        resp = input("⚠️  Confirma a migração acima? (sim/não): ")
        if resp.lower() in ('sim', 's', 'yes', 'y'):
            migrate(db, data)
        else:
            print("❌ Migração cancelada.")
    else:
        print("Uso:")
        print("  python migrate_novos_campos.py verify   — mostra o que será migrado")
        print("  python migrate_novos_campos.py migrate  — executa a migração")
