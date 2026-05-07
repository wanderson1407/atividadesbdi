FROM python:3.11-slim

# VersÃ£o da build â€” alterar aqui forÃ§a rebuild sem cache
LABEL version="202605061924"

# Define o diretÃ³rio de trabalho
WORKDIR /app

# Instala dependÃªncias do sistema necessÃ¡rias
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copia e instala dependÃªncias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o cÃ³digo da aplicaÃ§Ã£o
COPY . .

# Garante que o Python encontre o pacote 'app'
ENV PYTHONPATH=/app

# VariÃ¡veis de ambiente padrÃ£o (serÃ£o sobrescritas no Cloud Run)
ENV PORT=8080
ENV ENVIRONMENT=production

# ExpÃµe a porta
EXPOSE 8080

# Comando de execuÃ§Ã£o usando gunicorn para produÃ§Ã£o
CMD exec gunicorn --bind :$PORT --workers 1 --worker-class uvicorn.workers.UvicornWorker --timeout 0 app.main:app