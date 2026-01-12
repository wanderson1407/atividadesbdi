#!/usr/bin/env python3
"""
Script para importar dados dos CSVs para o Firestore.
"""

import csv
import os
from datetime import datetime
from app.firestore_repo import FirestoreRepository, Equipe, Categoria, Produto, Atividade, ProdutoAtividade

def import_equipes():
    repo = FirestoreRepository()
    with open('planilhas/Atividades BDI Serra - equipes_lista.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            equipe = Equipe(
                id_equipe=int(row['id_equipe']),
                equipe=row['equipe'],
                interno_prf=row['interno_prf'] == 'sim'
            )
            try:
                repo.create_equipe(equipe)
                print(f"Equipe criada: {equipe.equipe}")
            except Exception as e:
                print(f"Erro ao criar equipe {equipe.equipe}: {e}")

def import_categorias():
    repo = FirestoreRepository()
    with open('planilhas/Atividades BDI Serra - categorias_lista.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            categoria = Categoria(
                id_categoria_atividade=int(row['id_categoria_atividade']),
                categoria_atividade=row['categoria_atividade']
            )
            try:
                repo.create_categoria(categoria)
                print(f"Categoria criada: {categoria.categoria_atividade}")
            except Exception as e:
                print(f"Erro ao criar categoria {categoria.categoria_atividade}: {e}")

def import_produtos():
    repo = FirestoreRepository()
    with open('planilhas/Atividades BDI Serra - produtos_lista.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            produto = Produto(
                id_produto_atividade=int(row['id_produto_atividade']),
                id_categoria_atividade=int(row['id_categoria_atividade']),
                produto_atividade=row['produto_atividade'],
                medida=row['medida'],
                tipo_numero=row['tipo_numero']
            )
            try:
                repo.create_produto(produto)
                print(f"Produto criado: {produto.produto_atividade}")
            except Exception as e:
                print(f"Erro ao criar produto {produto.produto_atividade}: {e}")

def import_atividades():
    repo = FirestoreRepository()
    
    # Load equipes per atividade
    equipes_dict = {}
    with open('planilhas/Atividades BDI Serra - equipe.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            id_atividade = int(row['id_atividade'])
            id_equipe = int(row['id_equipe'])
            if id_atividade not in equipes_dict:
                equipes_dict[id_atividade] = []
            equipes_dict[id_atividade].append(id_equipe)
    
    # Load produtos per atividade
    produtos_dict = {}
    with open('planilhas/Atividades BDI Serra - produto.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            id_atividade = int(row['id_atividade'])
            id_produto = int(row['id_produto_atividade'])
            quantidade = float(row['quantidade'])
            if id_atividade not in produtos_dict:
                produtos_dict[id_atividade] = []
            produtos_dict[id_atividade].append(ProdutoAtividade(id_produto=id_produto, quantidade=quantidade))
    
    with open('planilhas/Atividades BDI Serra - atividade.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                id_atividade = int(row['id_atividade'])
            except ValueError:
                print(f"ID inválido: {row['id_atividade']}, pulando...")
                continue
            data_str = row['data']
            try:
                # Parse date dd/mm/yyyy
                data = datetime.strptime(data_str, '%d/%m/%Y').date()
            except ValueError:
                print(f"Data inválida para atividade {id_atividade}: {data_str}, pulando...")
                continue
            descricao = row['descricao']
            cai = row['cai'].upper() == 'TRUE'
            
            equipes = equipes_dict.get(id_atividade, [])
            produtos = produtos_dict.get(id_atividade, [])
            categorias = []  # Assuming no categorias per atividade, or set to empty
            
            atividade = Atividade(
                id_atividade=id_atividade,
                data=data,
                descricao=descricao,
                cai=cai,
                equipes=equipes,
                categorias=categorias,
                produtos=produtos
            )
            try:
                repo.create_atividade(atividade)
                print(f"Atividade criada: {id_atividade}")
            except Exception as e:
                print(f"Erro ao criar atividade {id_atividade}: {e}")

if __name__ == "__main__":
    print("Importando equipes...")
    import_equipes()
    print("Importando categorias...")
    import_categorias()
    print("Importando produtos...")
    import_produtos()
    print("Importando atividades...")
    import_atividades()
    print("Importação concluída!")