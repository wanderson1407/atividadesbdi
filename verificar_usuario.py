"""
Script para verificar se o usuário existe no Firestore
"""
from app.firestore_repo import FirestoreRepository

def verificar_usuario(email):
    print(f"\n🔍 Verificando usuário: {email}")
    print("-" * 50)
    
    repo = FirestoreRepository()
    usuario = repo.get_usuario_by_email(email)
    
    if usuario:
        print("✅ Usuário ENCONTRADO no Firestore!")
        print(f"   Nome: {usuario.nome}")
        print(f"   Email: {usuario.email}")
        print(f"   Nível: {usuario.nivel}")
        print(f"   Ativo: {usuario.ativo if hasattr(usuario, 'ativo') else 'N/A'}")
        
        if hasattr(usuario, 'ativo') and not usuario.ativo:
            print("\n⚠️ ATENÇÃO: Usuário está INATIVO!")
        else:
            print("\n✅ Usuário pode fazer login!")
    else:
        print("❌ Usuário NÃO encontrado no Firestore!")
        print("\n💡 Para adicionar este usuário:")
        print("   1. Execute: python create_usuarios.py")
        print("   2. Ou adicione manualmente no console do Firestore")
    
    print("-" * 50)

if __name__ == "__main__":
    # Email do usuário para verificar
    email = "wanderson1407@gmail.com"
    verificar_usuario(email)
