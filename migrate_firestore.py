"""
Script para migrar/corrigir dados do MockFirestore para o Firestore real da Google Cloud.
Execute este script antes de ir para produção para garantir que os dados estejam corretos.
"""

import json
import os
from google.cloud import firestore

def migrate_to_firestore():
    """Migra dados do mock_firestore JSON para o Firestore real"""
    
    # Carregar dados do arquivo mock
    mock_file = "mock_firestore_atividades-bdi.json"
    if not os.path.exists(mock_file):
        print(f"❌ Arquivo {mock_file} não encontrado!")
        return
    
    with open(mock_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Conectar ao Firestore real
    db = firestore.Client()
    
    print("🚀 Iniciando migração para Google Cloud Firestore...\n")
    
    # Migrar Usuários
    print("👥 Migrando Usuários...")
    usuarios_col = db.collection('usuarios')
    for email, usuario in data.get('usuarios', {}).items():
        # Verificar se tem todos os campos obrigatórios
        if 'email' not in usuario or 'nome' not in usuario or 'nivel' not in usuario:
            print(f"  ⚠️  Usuário {email} está incompleto, pulando...")
            continue
        
        usuarios_col.document(email).set(usuario)
        print(f"  ✅ {email} ({usuario['nome']}) - {usuario['nivel']}")
    
    # Migrar Equipes
    print("\n🏢 Migrando Equipes...")
    equipes_col = db.collection('equipes')
    for id_equipe, equipe in data.get('equipes', {}).items():
        equipes_col.document(id_equipe).set(equipe)
        print(f"  ✅ {equipe['equipe']}")
    
    # Migrar Categorias
    print("\n📋 Migrando Categorias...")
    categorias_col = db.collection('categorias')
    for id_cat, categoria in data.get('categorias', {}).items():
        categorias_col.document(id_cat).set(categoria)
        print(f"  ✅ {categoria['categoria_atividade']}")
    
    # Migrar Produtos
    print("\n📦 Migrando Produtos...")
    produtos_col = db.collection('produtos')
    for id_prod, produto in data.get('produtos', {}).items():
        produtos_col.document(id_prod).set(produto)
        print(f"  ✅ {produto['produto_atividade']}")
    
    # Migrar Atividades
    print("\n📊 Migrando Atividades...")
    atividades_col = db.collection('atividades')
    atividades = data.get('atividades', {})
    for id_ativ, atividade in atividades.items():
        atividades_col.document(id_ativ).set(atividade)
    print(f"  ✅ {len(atividades)} atividades migradas")

    # Migrar Tipificações Penais
    print("\n⚖️ Migrando Tipificações Penais...")
    tipificacoes_col = db.collection('tipificacoes')
    tipificacoes = data.get('tipificacoes', {})
    for id_tip, tip in tipificacoes.items():
        tipificacoes_col.document(id_tip).set(tip)
    print(f"  ✅ {len(tipificacoes)} tipificações migradas")

    print("\n✨ Migração concluída com sucesso!")
    print("\n💡 Para usar o Firestore real, defina: USE_MOCK_FIRESTORE=false")

def verify_firestore():
    """Verifica a estrutura de dados no Firestore real"""
    
    db = firestore.Client()
    
    print("🔍 Verificando dados no Google Cloud Firestore...\n")
    
    # Verificar Usuários
    print("👥 Usuários:")
    usuarios = db.collection('usuarios').stream()
    usuario_count = 0
    for doc in usuarios:
        usuario_count += 1
        data = doc.to_dict()
        campos = list(data.keys())
        status = "✅" if all(k in data for k in ['email', 'nome', 'nivel']) else "❌ INCOMPLETO"
        print(f"  {status} {doc.id} - Campos: {campos}")
    print(f"  Total: {usuario_count} usuários\n")
    
    # Verificar Equipes
    print("🏢 Equipes:")
    equipes = db.collection('equipes').stream()
    equipe_count = sum(1 for _ in equipes)
    print(f"  Total: {equipe_count} equipes\n")
    
    # Verificar Categorias
    print("📋 Categorias:")
    categorias = db.collection('categorias').stream()
    categoria_count = sum(1 for _ in categorias)
    print(f"  Total: {categoria_count} categorias\n")
    
    # Verificar Produtos
    print("📦 Produtos:")
    produtos = db.collection('produtos').stream()
    produto_count = sum(1 for _ in produtos)
    print(f"  Total: {produto_count} produtos\n")
    
    # Verificar Atividades
    print("📊 Atividades:")
    atividades = db.collection('atividades').stream()
    atividade_count = sum(1 for _ in atividades)
    print(f"  Total: {atividade_count} atividades\n")

    # Verificar Tipificações Penais
    print("⚖️ Tipificações Penais:")
    tipificacoes = db.collection('tipificacoes').stream()
    tip_count = sum(1 for _ in tipificacoes)
    print(f"  Total: {tip_count} tipificações\n")

    # Verificar Equipes com id_equipe_pai
    print("🏗️ Equipes PRF (id_equipe_pai):")
    equipes_prf = db.collection('equipes').where('interno_prf', '==', True).stream()
    for doc in equipes_prf:
        d = doc.to_dict()
        pai = d.get('id_equipe_pai', 'NÃO DEFINIDO')
        print(f"  {'✅' if pai else '❌'} {d.get('equipe')} → pai={pai}")

if __name__ == "__main__":
    import sys
    
    print("=" * 60)
    print("  MIGRAÇÃO DE DADOS - MockFirestore → Google Cloud Firestore")
    print("=" * 60)
    print()
    
    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        verify_firestore()
    elif len(sys.argv) > 1 and sys.argv[1] == "migrate":
        resposta = input("⚠️  Isso vai SOBRESCREVER dados no Firestore real. Continuar? (sim/não): ")
        if resposta.lower() in ['sim', 's', 'yes', 'y']:
            migrate_to_firestore()
        else:
            print("❌ Migração cancelada.")
    else:
        print("Uso:")
        print("  python migrate_firestore.py verify   - Verifica dados no Firestore real")
        print("  python migrate_firestore.py migrate  - Migra dados do mock para o Firestore real")
        print()
        print("Exemplo:")
        print("  python migrate_firestore.py verify")
