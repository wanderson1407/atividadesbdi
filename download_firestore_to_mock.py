"""
Script para baixar dados do Google Cloud Firestore e salvar no arquivo mock JSON local
"""
import json
from google.cloud import firestore
import os
from datetime import date

# Configurar credenciais
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'atividades-intel-5c6eda847742.json'

def download_collection(db, collection_name):
    """Download de uma coleção completa"""
    docs = db.collection(collection_name).stream()
    data = {}
    count = 0
    for doc in docs:
        data[doc.id] = doc.to_dict()
        count += 1
    print(f"✅ {collection_name}: {count} documentos baixados")
    return data

def download_atividades_ano(db, ano: int):
    """Download apenas atividades de um ano específico"""
    inicio = f"{ano}-01-01"
    fim = f"{ano}-12-31"
    docs = (db.collection('atividades')
              .where('data', '>=', inicio)
              .where('data', '<=', fim)
              .stream())
    data = {}
    count = 0
    for doc in docs:
        data[doc.id] = doc.to_dict()
        count += 1
    print(f"✅ atividades ({ano}): {count} documentos baixados")
    return data

def default_serializer(obj):
    if isinstance(obj, (date,)):
        return obj.isoformat()
    raise TypeError(f'Object of type {obj.__class__.__name__} is not JSON serializable')

def main():
    print("🔄 Conectando ao Google Cloud Firestore...")
    db = firestore.Client()
    
    print("\n📥 Baixando dados do Firestore...\n")
    
    ano_atual = date.today().year
    data = {
        'equipes':       download_collection(db, 'equipes'),
        'categorias':    download_collection(db, 'categorias'),
        'produtos':      download_collection(db, 'produtos'),
        'tipificacoes':  download_collection(db, 'tipificacoes'),
        'usuarios':      download_collection(db, 'usuarios'),
        'atividades':    download_collection(db, 'atividades'),
    }
    
    # Salvar no arquivo JSON
    output_file = 'mock_firestore_atividades-bdi.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=default_serializer)
    
    print(f"\n✅ Dados salvos em: {output_file}")
    print("\n📊 Resumo:")
    for k, v in data.items():
        print(f"  - {k}: {len(v)}")

if __name__ == '__main__':
    main()
