#!/usr/bin/env python3
"""
Script para importar documentos de inteligência do CSV DOCUMENTOS INTEL.csv
Converte datas de DD/MM/YYYY para YYYY-MM-DD
Mapeia produtos pelo nome e cria atividades no Firestore
"""

import csv
from datetime import datetime
from app.firestore_repo import FirestoreRepository, Atividade, ProdutoAtividade

# Mapeamento de produtos do CSV para IDs do banco
PRODUTOS_MAP = {
    "DOC DE INTELIGÊNCIA- MENSAGEM": 33,
    "DOC DE INTELIGÊNCIA - RELINT": 34,
    "DOC DE INTELIGÊNCIA - REMI": 35,
    "DOC DE INTELIGÊNCIA - POI": 36,
    "DOC DE INTELIGÊNCIA - PI": 37,
    "DOC DE INTELIGÊNCIA - PESQUISA SOCIAL": 38,
    "DOC DE INTELIGÊNCIA - CDR": 48,
}

# ID da equipe BDI SERRA
EQUIPE_BDI_SERRA = 3

def converter_data(data_str):
    """Converte data de DD/MM/YYYY para YYYY-MM-DD"""
    try:
        # Parse DD/MM/YYYY
        dt = datetime.strptime(data_str.strip(), "%d/%m/%Y")
        # Retorna no formato YYYY-MM-DD
        return dt.date()
    except Exception as e:
        print(f"⚠️ Erro ao converter data '{data_str}': {e}")
        return None

def converter_cai(cai_str):
    """Converte campo CAI de 'sim/não' para boolean"""
    return cai_str.strip().lower() in ['sim', 'yes', 'true', 's', 'y']

def import_documentos_intel():
    """Importa documentos de inteligência do CSV"""
    
    repo = FirestoreRepository()
    csv_file = "DOCUMENTOS INTEL.csv"
    
    print("=" * 80)
    print("📥 IMPORTAÇÃO DE DOCUMENTOS DE INTELIGÊNCIA")
    print("=" * 80)
    
    # Validar produtos
    print("\n🔍 Validando produtos...")
    produtos_nao_encontrados = []
    for produto_nome, produto_id in PRODUTOS_MAP.items():
        if produto_id is None:
            produtos_nao_encontrados.append(produto_nome)
            print(f"  ❌ PRODUTO NÃO ENCONTRADO: {produto_nome}")
        else:
            print(f"  ✅ {produto_nome} → ID {produto_id}")
    
    if produtos_nao_encontrados:
        print("\n⚠️ ATENÇÃO: Produtos não encontrados no banco:")
        for p in produtos_nao_encontrados:
            print(f"  - {p}")
        resposta = input("\nDeseja continuar mesmo assim? (s/n): ")
        if resposta.lower() != 's':
            print("❌ Importação cancelada.")
            return
    
    # Ler CSV
    print(f"\n📖 Lendo arquivo {csv_file}...")
    
    atividades_criadas = 0
    atividades_com_erro = 0
    erros = []
    
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for i, row in enumerate(reader, start=2):  # linha 2 porque linha 1 é cabeçalho
            try:
                # Converter data
                data = converter_data(row['data'])
                if data is None:
                    erros.append(f"Linha {i}: Data inválida '{row['data']}'")
                    atividades_com_erro += 1
                    continue
                
                # Converter CAI
                cai = converter_cai(row['cai'])
                
                # Descrição
                descricao = row['descricao'].strip()
                
                # Mapear produto
                produto_nome = row['produto'].strip()
                produto_id = PRODUTOS_MAP.get(produto_nome)
                
                if produto_id is None:
                    erros.append(f"Linha {i}: Produto '{produto_nome}' não mapeado")
                    atividades_com_erro += 1
                    continue
                
                # Quantidade
                try:
                    quantidade = float(row['quantidade'])
                except:
                    quantidade = 1.0
                
                # Criar atividade
                atividade = Atividade(
                    data=data,
                    descricao=descricao,
                    cai=cai,
                    equipes=[EQUIPE_BDI_SERRA],  # BDI SERRA
                    categorias=[],  # Sem categorias diretas
                    produtos=[
                        ProdutoAtividade(id_produto=produto_id, quantidade=quantidade)
                    ]
                )
                
                # Salvar no banco
                repo.create_atividade(atividade)
                atividades_criadas += 1
                
                if atividades_criadas % 10 == 0:
                    print(f"  ✅ {atividades_criadas} atividades importadas...")
                
            except Exception as e:
                erros.append(f"Linha {i}: {str(e)}")
                atividades_com_erro += 1
    
    # Relatório final
    print("\n" + "=" * 80)
    print("📊 RELATÓRIO DE IMPORTAÇÃO")
    print("=" * 80)
    print(f"✅ Atividades criadas com sucesso: {atividades_criadas}")
    print(f"❌ Atividades com erro: {atividades_com_erro}")
    
    if erros:
        print("\n⚠️ ERROS ENCONTRADOS:")
        for erro in erros[:20]:  # Mostrar no máximo 20 erros
            print(f"  - {erro}")
        if len(erros) > 20:
            print(f"  ... e mais {len(erros) - 20} erros")
    
    print("\n✨ Importação concluída!")

if __name__ == "__main__":
    import_documentos_intel()
