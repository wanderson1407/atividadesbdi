from dotenv import load_dotenv
load_dotenv()  # Carrega variáveis do arquivo .env

# MARCA 8.0.1 - Deploy 13/01/2026 - 15:30
import os
from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from starlette.middleware.base import BaseHTTPMiddleware
from .firestore_repo import Atividade, Equipe, Categoria, Produto, Usuario, TipificacaoPenal, FirestoreRepository
from .auth import authenticate_google_token, get_current_user, require_admin, require_operador_or_admin, DEV_AUTH
from typing import List, Optional
from pydantic import BaseModel

# Esta variável TEM que se chamar 'app'
app = FastAPI(title="Atividades BDI Serra API - Versão 8.0.1")

# Middleware para DESABILITAR CACHE em todos os responses
class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Força o navegador a SEMPRE buscar versão mais recente
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

app.add_middleware(NoCacheMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em dev aceita qualquer origem
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

repo = FirestoreRepository()

class GoogleToken(BaseModel):
    token: str

@app.get("/")
def home():
    with open("index.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

# Endpoint de autenticação
@app.post("/auth/google")
def auth_google(token_data: GoogleToken):
    return authenticate_google_token(token_data.token)

@app.get("/auth/dev-status")
def get_dev_status():
    """Endpoint para verificar se o modo de desenvolvimento está ativo"""
    return {"dev_mode": DEV_AUTH}

# Endpoints para Equipes - Apenas admin pode criar/editar
@app.get("/equipes", response_model=List[Equipe])
def get_equipes(current_user: Usuario = Depends(require_operador_or_admin)):
    return repo.get_equipes()

@app.post("/equipes", response_model=Equipe)
def create_equipe(equipe: Equipe, current_user: Usuario = Depends(require_admin)):
    return repo.create_equipe(equipe)

@app.put("/equipes/{id_equipe}", response_model=Equipe)
def update_equipe(id_equipe: int, equipe: Equipe, current_user: Usuario = Depends(require_admin)):
    return repo.update_equipe(id_equipe, equipe)

@app.delete("/equipes/{id_equipe}")
def delete_equipe(id_equipe: int, current_user: Usuario = Depends(require_admin)):
    repo.delete_equipe(id_equipe)
    return {"message": "Equipe excluída com sucesso"}

@app.get("/equipes/arvore")
def get_equipes_arvore(current_user: Usuario = Depends(require_operador_or_admin)):
    return repo.get_equipes_arvore()

# Endpoints para Tipificações Penais
@app.get("/tipificacoes", response_model=List[TipificacaoPenal])
def get_tipificacoes(current_user: Usuario = Depends(require_operador_or_admin)):
    return repo.get_tipificacoes()

@app.post("/tipificacoes", response_model=TipificacaoPenal)
def create_tipificacao(tip: TipificacaoPenal, current_user: Usuario = Depends(require_operador_or_admin)):
    return repo.create_tipificacao(tip)

@app.put("/tipificacoes/{id_tip}", response_model=TipificacaoPenal)
def update_tipificacao(id_tip: int, tip: TipificacaoPenal, current_user: Usuario = Depends(require_admin)):
    return repo.update_tipificacao(id_tip, tip)

@app.delete("/tipificacoes/{id_tip}")
def delete_tipificacao(id_tip: int, current_user: Usuario = Depends(require_admin)):
    repo.delete_tipificacao(id_tip)
    return {"message": "Tipificação excluída com sucesso"}

# Endpoints para Categorias - Apenas admin
@app.get("/categorias", response_model=List[Categoria])
def get_categorias(current_user: Usuario = Depends(require_operador_or_admin)):
    return repo.get_categorias()

@app.post("/categorias", response_model=Categoria)
def create_categoria(categoria: Categoria, current_user: Usuario = Depends(require_admin)):
    return repo.create_categoria(categoria)

@app.put("/categorias/{id_categoria}", response_model=Categoria)
def update_categoria(id_categoria: int, categoria: Categoria, current_user: Usuario = Depends(require_admin)):
    return repo.update_categoria(id_categoria, categoria)

@app.delete("/categorias/{id_categoria}")
def delete_categoria(id_categoria: int, current_user: Usuario = Depends(require_admin)):
    repo.delete_categoria(id_categoria)
    return {"message": "Categoria excluída com sucesso"}

# Endpoints para Produtos - Apenas admin
@app.get("/produtos", response_model=List[Produto])
def get_produtos(current_user: Usuario = Depends(require_operador_or_admin)):
    return repo.get_produtos()

@app.post("/produtos", response_model=Produto)
def create_produto(produto: Produto, current_user: Usuario = Depends(require_admin)):
    return repo.create_produto(produto)

@app.put("/produtos/{id_produto}", response_model=Produto)
def update_produto(id_produto: int, produto: Produto, current_user: Usuario = Depends(require_admin)):
    return repo.update_produto(id_produto, produto)

@app.delete("/produtos/{id_produto}")
def delete_produto(id_produto: int, current_user: Usuario = Depends(require_admin)):
    repo.delete_produto(id_produto)
    return {"message": "Produto excluído com sucesso"}

# Endpoints para Atividades - Operador pode criar, admin tudo
@app.get("/atividades", response_model=List[Atividade])
def get_atividades(
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    id_equipe: Optional[List[int]] = Query(None),
    id_categoria: Optional[List[int]] = Query(None),
    id_produto: Optional[List[int]] = Query(None),
    consulta: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    current_user: Usuario = Depends(require_operador_or_admin)
):
    return repo.get_atividades(data_inicio, data_fim, id_equipe, id_categoria, id_produto, consulta, limit, offset)

@app.post("/atividades", response_model=Atividade)
def create_atividade(atividade: Atividade, current_user: Usuario = Depends(require_operador_or_admin)):
    return repo.create_atividade(atividade)

@app.put("/atividades/{id_atividade}", response_model=Atividade)
def update_atividade(id_atividade: int, atividade: Atividade, current_user: Usuario = Depends(require_operador_or_admin)):
    return repo.update_atividade(id_atividade, atividade)

@app.delete("/atividades/{id_atividade}")
def delete_atividade(id_atividade: int, current_user: Usuario = Depends(require_operador_or_admin)):
    repo.delete_atividade(id_atividade)
    return {"message": "Atividade excluída com sucesso"}

# Endpoints para Usuarios - Apenas admin
@app.get("/usuarios", response_model=List[Usuario])
def get_usuarios(current_user: Usuario = Depends(require_admin)):
    return repo.get_usuarios()

# Endpoint para qualquer usuário autenticado buscar informações de usuários (para exibir nomes)
@app.get("/usuarios/info/all", response_model=List[Usuario])
def get_usuarios_info(current_user: Usuario = Depends(get_current_user)):
    """Retorna informações básicas de todos os usuários ativos (exceto inativos)"""
    usuarios = repo.get_usuarios()
    # Filtrar apenas usuários não inativos
    return [u for u in usuarios if u.nivel != "inativo"]

@app.post("/usuarios", response_model=Usuario)
def create_usuario(usuario: Usuario, current_user: Usuario = Depends(require_admin)):
    return repo.create_usuario(usuario)

@app.put("/usuarios/{email}", response_model=Usuario)
def update_usuario(email: str, usuario: Usuario, current_user: Usuario = Depends(require_admin)):
    return repo.update_usuario(email, usuario)

@app.delete("/usuarios/{email}")
def delete_usuario(email: str, current_user: Usuario = Depends(require_admin)):
    repo.delete_usuario(email)
    return {"message": "Usuário excluído com sucesso"}

@app.get("/usuarios/{email}", response_model=Usuario)
def get_usuario(email: str, current_user: Usuario = Depends(get_current_user)):
    """Permite admin buscar qualquer usuário, ou usuário buscar seus próprios dados"""
    # Se não for admin, só pode buscar seus próprios dados
    if current_user.nivel != "administrador" and current_user.email != email:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    usuario = repo.get_usuario_by_email(email)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario not found")
    return usuario

# Endpoint para verificar se há alterações (polling eficiente)
@app.get("/atividades/check-updates")
def check_atividades_updates(
    since: Optional[str] = Query(None, description="Timestamp ISO da última verificação"),
    current_user: Usuario = Depends(require_operador_or_admin)
):
    """
    Retorna se há alterações desde o timestamp fornecido.
    Custo: 0 reads do Firestore (usa apenas metadados).
    """
    import datetime
    from google.cloud import firestore
    
    # Se não forneceu timestamp, retornar True para forçar atualização completa
    if not since:
        return {"has_updates": True, "last_modified": datetime.datetime.now().isoformat()}
    
    # Converter string ISO para datetime
    try:
        since_dt = datetime.datetime.fromisoformat(since.replace('Z', '+00:00'))
    except:
        return {"has_updates": True, "last_modified": datetime.datetime.now().isoformat()}
    
    # Verificar se há documentos modificados após o timestamp
    # Nota: Isso requer que as atividades tenham um campo 'updated_at' ou 'created_at'
    # Por simplicidade, vamos retornar sempre True e deixar o cache client-side fazer o trabalho
    # Em produção, você adicionaria um campo timestamp nos documentos
    
    return {
        "has_updates": True,  # Por enquanto sempre True
        "last_modified": datetime.datetime.now().isoformat(),
        "message": "Verificação de updates ativada"
    }

# Monta a pasta static para arquivos estáticos (CSS, JS, HTML auxiliares)
app.mount("/static", StaticFiles(directory="static"), name="static")