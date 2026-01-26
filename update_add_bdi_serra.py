#!/usr/bin/env python3
"""
Script para atualizar todas as atividades do banco adicionando a equipe BDI SERRA (ID 3)
a todas as atividades que ainda não possuem essa equipe marcada.

Regras:
- Se a atividade NÃO TEM BDI SERRA (ID 3) → ADICIONAR
- Se a atividade JÁ TEM BDI SERRA (ID 3) → NÃO ALTERAR
- PRESERVAR todas as outras equipes já cadastradas
"""

from app.firestore_repo import FirestoreRepository

# ID da equipe BDI SERRA
EQUIPE_BDI_SERRA = 3

def atualizar_atividades_add_bdi_serra():
    """Adiciona equipe BDI SERRA a todas as atividades que não possuem"""
    
    repo = FirestoreRepository()
    
    print("=" * 80)
    print("🔄 ATUALIZAÇÃO EM MASSA - ADICIONAR BDI SERRA ÀS ATIVIDADES")
    print("=" * 80)
    
    print("\n📊 Buscando todas as atividades...")
    
    # Buscar todas as atividades (sem filtros)
    atividades = repo.get_atividades()
    
    total_atividades = len(atividades)
    print(f"  Total de atividades encontradas: {total_atividades}")
    
    # Contadores
    atividades_ja_tem_bdi = 0
    atividades_atualizadas = 0
    atividades_com_erro = 0
    erros = []
    
    print("\n🔍 Processando atividades...")
    
    for atividade in atividades:
        try:
            # Verificar se já tem BDI SERRA
            if EQUIPE_BDI_SERRA in atividade.equipes:
                atividades_ja_tem_bdi += 1
                continue
            
            # Adicionar BDI SERRA às equipes existentes
            equipes_atualizadas = list(atividade.equipes)  # Copiar lista existente
            equipes_atualizadas.append(EQUIPE_BDI_SERRA)   # Adicionar BDI SERRA
            
            # Atualizar atividade
            atividade.equipes = equipes_atualizadas
            repo.update_atividade(atividade.id_atividade, atividade)
            
            atividades_atualizadas += 1
            
            if atividades_atualizadas % 50 == 0:
                print(f"  ✅ {atividades_atualizadas} atividades atualizadas...")
            
        except Exception as e:
            erros.append(f"Atividade ID {atividade.id_atividade}: {str(e)}")
            atividades_com_erro += 1
    
    # Relatório final
    print("\n" + "=" * 80)
    print("📊 RELATÓRIO DE ATUALIZAÇÃO")
    print("=" * 80)
    print(f"📝 Total de atividades no banco: {total_atividades}")
    print(f"✅ Atividades atualizadas (BDI SERRA adicionada): {atividades_atualizadas}")
    print(f"ℹ️  Atividades que já tinham BDI SERRA: {atividades_ja_tem_bdi}")
    print(f"❌ Atividades com erro: {atividades_com_erro}")
    
    if erros:
        print("\n⚠️ ERROS ENCONTRADOS:")
        for erro in erros[:20]:  # Mostrar no máximo 20 erros
            print(f"  - {erro}")
        if len(erros) > 20:
            print(f"  ... e mais {len(erros) - 20} erros")
    
    print("\n✨ Atualização em massa concluída!")
    
    # Verificação final
    if atividades_atualizadas > 0:
        print("\n🔍 Verificação final...")
        atividades_apos = repo.get_atividades()
        total_com_bdi = sum(1 for a in atividades_apos if EQUIPE_BDI_SERRA in a.equipes)
        print(f"  Total de atividades com BDI SERRA após atualização: {total_com_bdi}/{len(atividades_apos)}")

if __name__ == "__main__":
    atualizar_atividades_add_bdi_serra()
