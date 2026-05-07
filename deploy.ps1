# ============================================================
#  deploy.ps1 — Deploy seguro para Cloud Run
#  Uso: .\deploy.ps1
# ============================================================
#
#  Problemas que este script resolve:
#  - Tráfego fixado em revisão antiga (era o bug que ocorreu)
#    O gcloud deploy cria nova revisão mas NÃO redireciona o
#    tráfego se ele estiver pinado manualmente. Este script
#    força --to-latest após o deploy e valida na URL pública.
#  - Cache do navegador: bumpa o ?v= nos scripts estáticos
#    automaticamente para que usuários vejam a nova versão.
#
# ============================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Configurações ────────────────────────────────────────────
$SERVICE      = "atividades-bdi-serra"
$REGION       = "us-central1"
$PROJECT      = "atividades-intel"
$SERVICE_URL  = "https://atividades-bdi-serra-945799576026.us-central1.run.app"

$ENV_VARS = @(
    "GOOGLE_CLOUD_PROJECT=$PROJECT",
    "GOOGLE_CLIENT_ID=945799576026-7dp9aeogap6hmrldi4kpedchitnirci5.apps.googleusercontent.com",
    "SECRET_KEY=2hMUHkqXt-wLa80EykmhMvmSk9DCpv052L-QFVi6yZA",
    "USE_MOCK_FIRESTORE=false",
    "DEV_AUTH=false"
) -join ","

# ── Funções auxiliares ────────────────────────────────────────
function Write-Step($msg) { Write-Host "`n▶  $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   ✅ $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "   ❌ $msg" -ForegroundColor Red }

# ── 1. Bump da versão dos arquivos estáticos ──────────────────
Write-Step "Atualizando versão do cache (index.html)"

$VERSION = Get-Date -Format "yyyyMMddHHmm"
$indexPath = Join-Path $PSScriptRoot "index.html"
$content = Get-Content $indexPath -Raw -Encoding UTF8

# Substitui qualquer ?v=XXXXXXXX(XX) existente pelo timestamp atual
$content = $content -replace '(\?v=)[\w]+', "`${1}$VERSION"
[System.IO.File]::WriteAllText($indexPath, $content, [System.Text.UTF8Encoding]::new($false))

Write-Ok "Versão estática: v=$VERSION"

# ── 2. Bump do LABEL no Dockerfile (quebra cache do Cloud Build) ──
Write-Step "Atualizando LABEL no Dockerfile"

$dockerfilePath = Join-Path $PSScriptRoot "Dockerfile"
$dockerfile = Get-Content $dockerfilePath -Raw -Encoding UTF8
$dockerfile = $dockerfile -replace '(LABEL version=")[^"]*(")', "`${1}$VERSION`${2}"
[System.IO.File]::WriteAllText($dockerfilePath, $dockerfile, [System.Text.UTF8Encoding]::new($false))

Write-Ok "LABEL version=$VERSION"

# ── 3. Deploy ─────────────────────────────────────────────────
Write-Step "Iniciando deploy no Cloud Run ($SERVICE @ $REGION)"

gcloud run deploy $SERVICE `
    --source . `
    --region $REGION `
    --project $PROJECT `
    --allow-unauthenticated `
    --set-env-vars $ENV_VARS

if ($LASTEXITCODE -ne 0) {
    Write-Fail "gcloud deploy falhou (exit $LASTEXITCODE)"
    exit 1
}

# ── 4. Forçar tráfego para LATEST ────────────────────────────
#  Essencial: sem isso, o tráfego pode ficar pinado em revisão
#  anterior se algum deploy anterior usou --revision-suffix.
Write-Step "Redirecionando tráfego para a revisão mais recente"

gcloud run services update-traffic $SERVICE `
    --region $REGION `
    --project $PROJECT `
    --to-latest

if ($LASTEXITCODE -ne 0) {
    Write-Fail "Falha ao atualizar tráfego"
    exit 1
}

# ── 5. Verificar revisão ativa ────────────────────────────────
Write-Step "Verificando revisão ativa"

$activeRevision = gcloud run services describe $SERVICE `
    --region $REGION --project $PROJECT `
    --format="value(status.latestReadyRevisionName)" 2>&1

Write-Ok "Revisão ativa: $activeRevision"

# ── 6. Verificar versão no HTML de produção ───────────────────
Write-Step "Verificando versão servida em produção ($SERVICE_URL)"

Start-Sleep -Seconds 3   # pequena espera para o CDN propagar

try {
    $html = (Invoke-WebRequest -Uri "$SERVICE_URL/" -UseBasicParsing).Content
    if ($html -match 'v=(\d{12})') {
        $remoteVersion = $matches[1]
        if ($remoteVersion -eq $VERSION) {
            Write-Ok "Versao em producao: v=$remoteVersion OK (versao correta)"
        } else {
            Write-Host "   [AVISO] Versao em producao: v=$remoteVersion (esperado: v=$VERSION)" -ForegroundColor Yellow
            Write-Host "          Pode ser propagacao de CDN - aguarde 1-2 min e recarregue." -ForegroundColor Yellow
        }
    } else {
        Write-Host "   [AVISO] Nao foi possivel identificar versao no HTML retornado." -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [AVISO] Nao foi possivel verificar URL: $_" -ForegroundColor Yellow
}

# ── Resumo ────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Deploy concluido!" -ForegroundColor Green
Write-Host "  Revisao : $activeRevision" -ForegroundColor Green
Write-Host "  Versao  : v=$VERSION" -ForegroundColor Green
Write-Host "  URL     : $SERVICE_URL" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
