import os
from dotenv import load_dotenv
import json
from typing import List, Optional, Dict, Any
from datetime import date, datetime

# MOCK IMPLEMENTATION PARA DESENVOLVIMENTO LOCAL
# Devido a problemas de conectividade com Firestore na rede atual

load_dotenv()

class MockFirestoreClient:
    def __init__(self, database: str = "atividades-bdi"):
        self.database = database
        self.data_file = f"mock_firestore_{database}.json"
        self.load_data()

    def load_data(self):
        if os.path.exists(self.data_file):
            with open(self.data_file, 'r', encoding='utf-8') as f:
                self.data = json.load(f)
        else:
            self.data = {
                "usuarios": {},
                "equipes": {},
                "categorias": {},
                "produtos": {},
                "atividades": {}
            }
            self.save_data()

    def save_data(self):
        def default_serializer(obj):
            if isinstance(obj, (date, datetime)):
                return obj.isoformat()
            raise TypeError(f'Object of type {obj.__class__.__name__} is not JSON serializable')
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, indent=2, ensure_ascii=False, default=default_serializer)

    def collection(self, name: str):
        return MockCollection(self, name)

class MockCollection:
    def __init__(self, client: MockFirestoreClient, name: str):
        self.client = client
        self.name = name

    def document(self, doc_id: str):
        return MockDocument(self, doc_id)

    def stream(self):
        for doc_id, data in self.client.data.get(self.name, {}).items():
            yield MockDocumentSnapshot(doc_id, data)

class MockDocument:
    def __init__(self, collection: MockCollection, doc_id: str):
        self.collection = collection
        self.id = doc_id

    def set(self, data: dict):
        if self.collection.name not in self.collection.client.data:
            self.collection.client.data[self.collection.name] = {}
        self.collection.client.data[self.collection.name][self.id] = data
        self.collection.client.save_data()
    
    def update(self, data: dict):
        """Atualiza campos do documento existente"""
        if self.collection.name not in self.collection.client.data:
            self.collection.client.data[self.collection.name] = {}
        if self.id not in self.collection.client.data[self.collection.name]:
            raise Exception(f"Document {self.id} not found in {self.collection.name}")
        # Merge data into existing document
        self.collection.client.data[self.collection.name][self.id].update(data)
        self.collection.client.save_data()
    
    def delete(self):
        """Remove o documento"""
        if self.collection.name in self.collection.client.data:
            if self.id in self.collection.client.data[self.collection.name]:
                del self.collection.client.data[self.collection.name][self.id]
                self.collection.client.save_data()

    def get(self):
        data = self.collection.client.data.get(self.collection.name, {}).get(self.id)
        if data:
            return MockDocumentSnapshot(self.id, data)
        return MockDocumentSnapshot(self.id, None)

class MockDocumentSnapshot:
    def __init__(self, doc_id: str, data: Optional[dict]):
        self.id = doc_id
        self._data = data

    def exists(self):
        return self._data is not None

    def to_dict(self):
        return self._data or {}

# Configurar credenciais do Google Cloud Firestore
if os.path.exists("atividades-intel-5c6eda847742.json"):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "atividades-intel-5c6eda847742.json"
elif os.path.exists("atividades-intel-9cdabf39cef6.json"):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "atividades-intel-9cdabf39cef6.json"

def get_db():
    """Retorna mock local ou Google Cloud Firestore conforme USE_MOCK_FIRESTORE"""
    if os.environ.get("USE_MOCK_FIRESTORE", "false").lower() == "true":
        print("🗂️ Usando Mock Firestore (local)")
        return MockFirestoreClient("atividades-bdi")
    print("☁️ Usando Google Cloud Firestore")
    from google.cloud import firestore
    return firestore.Client()

from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class Equipe(BaseModel):
    id_equipe: Optional[int] = None
    equipe: str
    interno_prf: bool
    id_equipe_pai: Optional[int] = None

class Categoria(BaseModel):
    id_categoria_atividade: Optional[int] = None
    categoria_atividade: str

class Produto(BaseModel):
    id_produto_atividade: Optional[int] = None
    id_categoria_atividade: int
    produto_atividade: str
    medida: str
    tipo_numero: str  # inteiro, decimal, moeda

class TipificacaoPenal(BaseModel):
    id_tipificacao: Optional[int] = None
    lei: str
    artigo: str
    paragrafo: Optional[str] = None
    inciso: Optional[str] = None
    descricao: str

class ProdutoAtividade(BaseModel):
    id_produto: int
    quantidade: float
    tipificacoes: Optional[List[int]] = None  # ids de tipificações penais

class Atividade(BaseModel):
    id_atividade: Optional[int] = None
    data: date
    descricao: Optional[str] = None
    cai: bool
    equipes: List[int]  # ids das equipes
    categorias: List[int]  # ids das categorias
    produtos: List[ProdutoAtividade]  # produtos com quantidades

class Usuario(BaseModel):
    email: str
    nome: str
    nivel: str  # adm ou operador

class FirestoreRepository:
    def __init__(self):
        self.db = get_db()

    # Equipes
    def get_equipes(self) -> List[Equipe]:
        docs = self.db.collection('equipes').stream()
        return [Equipe(**doc.to_dict()) for doc in docs]

    def get_equipes_arvore(self) -> List[dict]:
        """Retorna equipes em estrutura de árvore (filhos aninhados em 'children')."""
        equipes = self.get_equipes()
        equipes_map = {e.id_equipe: e.dict() for e in equipes}
        # Adicionar lista de filhos a cada nó
        for node in equipes_map.values():
            node['children'] = []
        raizes = []
        for node in equipes_map.values():
            pai_id = node.get('id_equipe_pai')
            if pai_id and pai_id in equipes_map:
                equipes_map[pai_id]['children'].append(node)
            else:
                raizes.append(node)
        return raizes

    def get_equipe(self, id_equipe: int) -> Optional[Equipe]:
        doc = self.db.collection('equipes').document(str(id_equipe)).get()
        if doc.exists:
            return Equipe(**doc.to_dict())
        return None

    def create_equipe(self, equipe: Equipe) -> Equipe:
        # Auto-incrementar ID se não fornecido
        if equipe.id_equipe is None:
            equipe.id_equipe = self._get_next_id('equipes')
        self.db.collection('equipes').document(str(equipe.id_equipe)).set(equipe.dict())
        return equipe
    
    def update_equipe(self, id_equipe: int, equipe: Equipe) -> Equipe:
        doc_ref = self.db.collection('equipes').document(str(id_equipe))
        data = equipe.dict(exclude={'id_equipe'})
        doc_ref.update(data)
        return Equipe(id_equipe=id_equipe, **data)
    
    def delete_equipe(self, id_equipe: int):
        self.db.collection('equipes').document(str(id_equipe)).delete()

    # Tipificações Penais
    def get_tipificacoes(self) -> List[TipificacaoPenal]:
        docs = self.db.collection('tipificacoes').stream()
        return [TipificacaoPenal(**doc.to_dict()) for doc in docs]

    def create_tipificacao(self, tip: TipificacaoPenal) -> TipificacaoPenal:
        if tip.id_tipificacao is None:
            tip.id_tipificacao = self._get_next_id('tipificacoes')
        self.db.collection('tipificacoes').document(str(tip.id_tipificacao)).set(tip.dict())
        return tip

    def update_tipificacao(self, id_tip: int, tip: TipificacaoPenal) -> TipificacaoPenal:
        doc_ref = self.db.collection('tipificacoes').document(str(id_tip))
        data = tip.dict(exclude={'id_tipificacao'})
        doc_ref.update(data)
        return TipificacaoPenal(id_tipificacao=id_tip, **data)

    def delete_tipificacao(self, id_tip: int):
        self.db.collection('tipificacoes').document(str(id_tip)).delete()

    # Categorias
    def get_categorias(self) -> List[Categoria]:
        docs = self.db.collection('categorias').stream()
        return [Categoria(**doc.to_dict()) for doc in docs]

    def create_categoria(self, categoria: Categoria) -> Categoria:
        # Auto-incrementar ID se não fornecido
        if categoria.id_categoria_atividade is None:
            categoria.id_categoria_atividade = self._get_next_id('categorias')
        self.db.collection('categorias').document(str(categoria.id_categoria_atividade)).set(categoria.dict())
        return categoria
    
    def update_categoria(self, id_categoria: int, categoria: Categoria) -> Categoria:
        doc_ref = self.db.collection('categorias').document(str(id_categoria))
        data = categoria.dict(exclude={'id_categoria_atividade'})
        doc_ref.update(data)
        return Categoria(id_categoria_atividade=id_categoria, **data)
    
    def delete_categoria(self, id_categoria: int):
        self.db.collection('categorias').document(str(id_categoria)).delete()

    # Produtos
    def get_produtos(self) -> List[Produto]:
        docs = self.db.collection('produtos').stream()
        return [Produto(**doc.to_dict()) for doc in docs]

    def create_produto(self, produto: Produto) -> Produto:
        # Auto-incrementar ID se não fornecido
        if produto.id_produto_atividade is None:
            produto.id_produto_atividade = self._get_next_id('produtos')
        self.db.collection('produtos').document(str(produto.id_produto_atividade)).set(produto.dict())
        return produto
    
    def update_produto(self, id_produto: int, produto: Produto) -> Produto:
        doc_ref = self.db.collection('produtos').document(str(id_produto))
        data = produto.dict(exclude={'id_produto_atividade'})
        doc_ref.update(data)
        return Produto(id_produto_atividade=id_produto, **data)
    
    def delete_produto(self, id_produto: int):
        self.db.collection('produtos').document(str(id_produto)).delete()

    # Atividades
    def get_atividades(self, data_inicio=None, data_fim=None, id_equipe: Optional[List[int]] = None, id_categoria: Optional[List[int]] = None, id_produto: Optional[List[int]] = None, consulta: Optional[str] = None, limit: Optional[int] = None, offset: Optional[int] = None) -> List[Atividade]:
        docs = self.db.collection('atividades').stream()
        atividades = []
        # Normalize incoming filters
        def norm_list(v):
            if v is None:
                return None
            if isinstance(v, list):
                return [int(x) for x in v if x is not None]
            # comma separated string
            return [int(x) for x in str(v).split(',') if x.strip()]

        id_equipe_list = norm_list(id_equipe)
        id_categoria_list = norm_list(id_categoria)
        id_produto_list = norm_list(id_produto)

        # Prepare maps for textual search (names)
        equipes_map = {e.id_equipe: e.equipe for e in self.get_equipes()}
        categorias_map = {c.id_categoria_atividade: c.categoria_atividade for c in self.get_categorias()}
        
        # Mapa de produto -> categoria (para filtrar por categoria via produtos)
        produtos_lista = self.get_produtos()
        produtos_map = {p.id_produto_atividade: p.produto_atividade for p in produtos_lista}
        produto_categoria_map = {p.id_produto_atividade: p.id_categoria_atividade for p in produtos_lista}

        consulta_norm = consulta.strip().lower() if consulta else None

        for doc in docs:
            data = doc.to_dict()
            # Converter data para string se necessário
            if isinstance(data.get('data'), str):
                data['data'] = date.fromisoformat(data['data'])
            elif hasattr(data.get('data'), 'isoformat'):
                # Se já é um objeto date/datetime
                data['data'] = data['data'] if isinstance(data['data'], date) else data['data'].date()
            else:
                # Se for timestamp ou outro formato
                print(f"⚠️ Formato de data desconhecido: {type(data.get('data'))} = {data.get('data')}")
                continue
            atividade = Atividade(**data)

            if data_inicio and atividade.data < date.fromisoformat(data_inicio):
                continue
            if data_fim and atividade.data > date.fromisoformat(data_fim):
                continue

            # If lists provided, check intersection
            if id_equipe_list:
                if not any(e in id_equipe_list for e in atividade.equipes):
                    continue
            
            # Filtro por categoria: verifica se algum produto da atividade pertence a uma das categorias selecionadas
            if id_categoria_list:
                # Obtem as categorias dos produtos desta atividade
                categorias_da_atividade = set()
                for p in atividade.produtos:
                    cat_do_produto = produto_categoria_map.get(p.id_produto)
                    if cat_do_produto:
                        categorias_da_atividade.add(cat_do_produto)
                # Também considera o campo categorias da atividade (caso exista)
                for c in atividade.categorias:
                    categorias_da_atividade.add(c)
                
                if not any(c in id_categoria_list for c in categorias_da_atividade):
                    continue
            
            if id_produto_list:
                produto_ids = [p.id_produto for p in atividade.produtos]
                if not any(p in id_produto_list for p in produto_ids):
                    continue

            # Textual search across relevant fields
            if consulta_norm:
                hay = []
                if atividade.descricao:
                    hay.append(str(atividade.descricao).lower())
                hay.append(str(atividade.id_atividade).lower() if atividade.id_atividade is not None else '')
                hay.append(atividade.data.isoformat().lower())
                # equipes names
                for eid in atividade.equipes:
                    hay.append(equipes_map.get(eid, str(eid)).lower())
                # categorias names
                for cid in atividade.categorias:
                    hay.append(categorias_map.get(cid, str(cid)).lower())
                # produtos names
                for p in atividade.produtos:
                    hay.append(produtos_map.get(p.id_produto, str(p.id_produto)).lower())

                haystack = ' '.join(hay)
                if consulta_norm not in haystack:
                    continue

            atividades.append(atividade)

        # Apply offset/limit for pagination
        if offset:
            atividades = atividades[offset:]
        if limit:
            atividades = atividades[:limit]
        return atividades

    def create_atividade(self, atividade: Atividade) -> Atividade:
        # Gerar ID se não fornecido
        if atividade.id_atividade is None:
            atividade.id_atividade = self._get_next_id('atividades')
        data = atividade.dict()
        data['data'] = atividade.data.isoformat()
        self.db.collection('atividades').document(str(atividade.id_atividade)).set(data)
        return atividade
    
    def update_atividade(self, id_atividade: int, atividade: Atividade) -> Atividade:
        doc_ref = self.db.collection('atividades').document(str(id_atividade))
        data = atividade.dict(exclude={'id_atividade'})
        data['data'] = atividade.data.isoformat()
        doc_ref.update(data)
        return atividade
    
    def delete_atividade(self, id_atividade: int):
        self.db.collection('atividades').document(str(id_atividade)).delete()

    # Usuarios
    def get_usuarios(self) -> List[Usuario]:
        try:
            print("=== DEBUG get_usuarios ===")
            print(f"DB type: {type(self.db)}")
            print(f"Coleção usuarios existe? {'usuarios' in self.db.data if hasattr(self.db, 'data') else 'N/A'}")
            
            if hasattr(self.db, 'data'):
                print(f"Usuários no data: {list(self.db.data.get('usuarios', {}).keys())}")
            
            docs = self.db.collection('usuarios').stream()
            usuarios = []
            
            for doc in docs:
                print(f"Processando doc: {doc.id}")
                data = doc.to_dict()
                print(f"Data do doc: {data}")
                if data:  # Garantir que há dados
                    # Validar se tem os campos obrigatórios
                    if 'email' in data and 'nivel' in data:
                        usuarios.append(Usuario(**data))
                    else:
                        print(f"⚠️ Documento {doc.id} ignorado - faltam campos obrigatórios")
            
            print(f"Total de usuários encontrados: {len(usuarios)}")
            return usuarios
        except Exception as e:
            print(f"Erro ao buscar usuários: {e}")
            import traceback
            traceback.print_exc()
            return []

    def create_usuario(self, usuario: Usuario) -> Usuario:
        self.db.collection('usuarios').document(usuario.email).set(usuario.dict())
        return usuario
    
    def update_usuario(self, email: str, usuario: Usuario) -> Usuario:
        doc_ref = self.db.collection('usuarios').document(email)
        data = usuario.dict()
        doc_ref.update(data)
        return usuario
    
    def delete_usuario(self, email: str):
        self.db.collection('usuarios').document(email).delete()

    def get_usuario_by_email(self, email: str) -> Optional[Usuario]:
        # Tenta buscar de forma compatível com MockFirestoreClient e com o cliente real do Firestore
        try:
            # Se for mock, a propriedade .data existe
            if hasattr(self.db, 'data'):
                for doc_id, data in self.db.data.get('usuarios', {}).items():
                    if data.get('email') == email:
                        return Usuario(**data)
                return None

            # Cliente real do Firestore: iterar documentos na coleção 'usuarios'
            users_ref = self.db.collection('usuarios').stream()
            for doc in users_ref:
                try:
                    data = doc.to_dict() or {}
                except Exception:
                    # Alguns snapshots podem se comportar diferente; tentar acessar via atributos
                    data = getattr(doc, 'to_dict', lambda: {})()
                if data.get('email') == email:
                    return Usuario(**data)
            return None
        except Exception:
            return None

    def _get_next_id(self, collection: str) -> int:
        # Simples contador, em produção usar auto-increment ou UUID
        docs = self.db.collection(collection).stream()
        ids = [int(doc.id) for doc in docs]
        return max(ids) + 1 if ids else 1