import os
from pathlib import Path
from dotenv import load_dotenv

# Carrega .env do diretório do projeto
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from .firestore_repo import FirestoreRepository, Usuario

# Configurações JWT
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 horas (jornada de trabalho)

# Google OAuth
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
DEV_AUTH = os.getenv("DEV_AUTH", "false").lower() in ("1", "true", "yes")
DEV_USER_EMAIL = os.getenv("DEV_USER_EMAIL", "wanderson1407@gmail.com")

security = HTTPBearer()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    # Aceitar dummy_token em modo de desenvolvimento
    if token == "dummy_token" and DEV_AUTH:
        return DEV_USER_EMAIL
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return email
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    email = verify_token(token)
    repo = FirestoreRepository()
    user = repo.get_usuario_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não autorizado")
    return user

def require_admin(current_user: Usuario = Depends(get_current_user)):
    if current_user.nivel != "administrador":
        raise HTTPException(status_code=403, detail="Acesso negado: apenas administradores")
    return current_user

def require_operador_or_admin(current_user: Usuario = Depends(get_current_user)):
    if current_user.nivel not in ["operador", "administrador"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return current_user

# Função para verificar token do Google e criar JWT
def authenticate_google_token(google_token: str):
    print(f"🔐 DEBUG auth - Token recebido: {google_token[:50]}...")
    try:
        # Aceitar token dummy apenas em desenvolvimento controlado
        if google_token == "dummy_token":
            print(f"🔐 DEBUG auth - Dummy token detectado. DEV_AUTH={DEV_AUTH}")
            if not DEV_AUTH:
                raise HTTPException(status_code=401, detail="Dummy token não permitido em produção. Ative DEV_AUTH=true para desenvolvimento.")
            email = DEV_USER_EMAIL
        else:
            # Verificar token com Google
            if not GOOGLE_CLIENT_ID:
                print("🔐 DEBUG auth - GOOGLE_CLIENT_ID NÃO CONFIGURADO!")
                raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID não configurado. Defina a variável de ambiente GOOGLE_CLIENT_ID.")
            print(f"🔐 DEBUG auth - Verificando token com Google. CLIENT_ID: {GOOGLE_CLIENT_ID[:30]}...")
            idinfo = id_token.verify_oauth2_token(google_token, google_requests.Request(), GOOGLE_CLIENT_ID)
            email = idinfo.get('email')
            print(f"🔐 DEBUG auth - Email validado pelo Google: {email}")

        # Verificar se usuário está autorizado no Firestore
        print(f"🔐 DEBUG auth - Buscando usuário no Firestore: {email}")
        repo = FirestoreRepository()
        user = repo.get_usuario_by_email(email)
        if not user:
            print(f"🔐 DEBUG auth - Usuário {email} NÃO ENCONTRADO no Firestore!")
            raise HTTPException(status_code=401, detail="Usuário não autorizado")
        
        print(f"🔐 DEBUG auth - Usuário encontrado: {user.email} ({user.nivel})")
        
        # Verificar se usuário está inativo
        if user.nivel == "inativo":
            raise HTTPException(status_code=403, detail="Usuário sem permissão de acesso")

        # Criar JWT
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": email}, expires_delta=access_token_expires
        )

        # Serializar usuário compatível com Pydantic v1/v2
        if hasattr(user, 'model_dump'):
            user_serial = user.model_dump()
        else:
            user_serial = user.dict()

        print(f"🔐 DEBUG auth - Token JWT criado com sucesso para {email}")
        return {"access_token": access_token, "token_type": "bearer", "user": user_serial}
    except ValueError as ve:
        print(f"❌ ValueError em auth: {str(ve)}")
        raise HTTPException(status_code=401, detail=f"Token Google inválido: {str(ve)}")
    except HTTPException as he:
        print(f"❌ HTTPException em auth: {he.detail}")
        raise
    except Exception as e:
        print(f"❌ EXCEÇÃO GERAL em auth: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro de autenticação: {type(e).__name__}: {str(e)}")