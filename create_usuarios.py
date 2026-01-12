#!/usr/bin/env python3
"""
Script para criar usuários no Firestore.
"""

from app.firestore_repo import FirestoreRepository, Usuario

def create_usuarios():
    repo = FirestoreRepository()
    
    usuarios = [
        Usuario(email="wanderson1407@gmail.com", nome="Wanderson", nivel="administrador"),
        Usuario(email="operador@exemplo.com", nome="Operador Exemplo", nivel="operador")
    ]
    
    for usuario in usuarios:
        try:
            repo.create_usuario(usuario)
            print(f"Usuário criado: {usuario.email}")
        except Exception as e:
            print(f"Erro ao criar usuário {usuario.email}: {e}")

if __name__ == "__main__":
    create_usuarios()