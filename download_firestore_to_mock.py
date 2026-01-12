"""
Script para baixar dados do Google Cloud Firestore e salvar no arquivo mock JSON local
"""
import json
from google.cloud import firestore
import os

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

def main():
    print("🔄 Conectando ao Google Cloud Firestore...")
    db = firestore.Client()
    
    print("\n📥 Baixando dados do Firestore...\n")
    
    # Baixar todas as coleções
    data = {
        'equipes': download_collection(db, 'equipes'),
        'categorias': download_collection(db, 'categorias'),
        'produtos': download_collection(db, 'produtos'),
        'atividades': download_collection(db, 'atividades'),
        'usuarios': download_collection(db, 'usuarios')
    }
    
    # Salvar no arquivo JSON
    output_file = 'mock_firestore_atividades-bdi.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Dados salvos em: {output_file}")
    print("\n📊 Resumo:")
    print(f"  - Equipes: {len(data['equipes'])}")
    print(f"  - Categorias: {len(data['categorias'])}")
    print(f"  - Produtos: {len(data['produtos'])}")
    print(f"  - Atividades: {len(data['atividades'])}")
    print(f"  - Usuários: {len(data['usuarios'])}")

if __name__ == '__main__':
    main()
