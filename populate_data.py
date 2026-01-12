#!/usr/bin/env python3
"""
Script para popular dados iniciais no Firestore para o projeto Atividades BDI Serra.
Execute este script uma vez para criar usuários, equipes, categorias e produtos iniciais.
"""

import os
from app.firestore_repo import FirestoreRepository, Usuario, Equipe, Categoria, Produto

def populate_initial_data():
    repo = FirestoreRepository()
    
    # Usuários iniciais
    usuarios = [
        Usuario(email="wanderson1407@gmail.com", nome="Wanderson", nivel="administrador"),
        Usuario(email="operador@exemplo.com", nome="Operador Exemplo", nivel="operador"),
    ]
    
    for usuario in usuarios:
        try:
            repo.create_usuario(usuario)
            print(f"Usuário criado: {usuario.email}")
        except Exception as e:
            print(f"Erro ao criar usuário {usuario.email}: {e}")
    
    # Equipes iniciais
    equipes = [
        Equipe(id_equipe=1, equipe="BDI Serra", interno_prf=True),
        Equipe(id_equipe=2, equipe="Polícia Militar", interno_prf=False),
        Equipe(id_equipe=3, equipe="Polícia Civil", interno_prf=False),
    ]
    
    for equipe in equipes:
        try:
            repo.create_equipe(equipe)
            print(f"Equipe criada: {equipe.equipe}")
        except Exception as e:
            print(f"Erro ao criar equipe {equipe.equipe}: {e}")
    
    # Categorias iniciais
    categorias = [
        Categoria(id_categoria_atividade=1, categoria_atividade="Drogas"),
        Categoria(id_categoria_atividade=2, categoria_atividade="Armas"),
        Categoria(id_categoria_atividade=3, categoria_atividade="Veículos"),
    ]
    
    for categoria in categorias:
        try:
            repo.create_categoria(categoria)
            print(f"Categoria criada: {categoria.categoria_atividade}")
        except Exception as e:
            print(f"Erro ao criar categoria {categoria.categoria_atividade}: {e}")
    
    # Produtos iniciais
    produtos = [
        Produto(id_produto_atividade=1, id_categoria_atividade=1, produto_atividade="Maconha", medida="kg", tipo_numero="decimal"),
        Produto(id_produto_atividade=2, id_categoria_atividade=1, produto_atividade="Cocaína", medida="kg", tipo_numero="decimal"),
        Produto(id_produto_atividade=3, id_categoria_atividade=2, produto_atividade="Pistola", medida="unidade", tipo_numero="inteiro"),
        Produto(id_produto_atividade=4, id_categoria_atividade=3, produto_atividade="Carro", medida="unidade", tipo_numero="inteiro"),
    ]
    
    for produto in produtos:
        try:
            repo.create_produto(produto)
            print(f"Produto criado: {produto.produto_atividade}")
        except Exception as e:
            print(f"Erro ao criar produto {produto.produto_atividade}: {e}")

if __name__ == "__main__":
    populate_initial_data()
    print("Dados iniciais populados com sucesso!")