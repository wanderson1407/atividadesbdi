#!/usr/bin/env python3
"""
Teste simples de conexão com Firestore
"""

from app.firestore_repo import get_db

def test_connection():
    try:
        db = get_db()
        print("Conexão com Firestore estabelecida com sucesso!")
        # Teste simples: listar coleções ou algo
        print("Cliente Firestore:", type(db))
    except Exception as e:
        print(f"Erro na conexão: {e}")

if __name__ == "__main__":
    test_connection()