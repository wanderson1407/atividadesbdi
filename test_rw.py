#!/usr/bin/env python3
"""
Script de teste: cria e lê um documento de exemplo usando FirestoreRepository
"""

from app.firestore_repo import FirestoreRepository, Equipe


def test_rw():
    repo = FirestoreRepository()
    sample = Equipe(id_equipe=9999, equipe='Teste CI', interno_prf=False)
    print('Criando equipe de teste...')
    repo.create_equipe(sample)
    print('Leitura da equipe criada:')
    read = repo.get_equipe(9999)
    if read:
        print(read.dict())
    else:
        print('Não foi possível ler o documento criado')


if __name__ == '__main__':
    test_rw()
