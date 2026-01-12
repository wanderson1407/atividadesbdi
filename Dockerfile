FROM python:3.11-slim

# Define o diretório de trabalho
WORKDIR /app

# Instala dependências do sistema necessárias
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copia e instala dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da aplicação
COPY . .

# Garante que o Python encontre o pacote 'app'
ENV PYTHONPATH=/app

# Variáveis de ambiente padrão (serão sobrescritas no Cloud Run)
ENV PORT=8080
ENV ENVIRONMENT=production

# Expõe a porta
EXPOSE 8080

# Comando de execução usando gunicorn para produção
CMD exec gunicorn --bind :$PORT --workers 1 --worker-class uvicorn.workers.UvicornWorker --timeout 0 app.main:app