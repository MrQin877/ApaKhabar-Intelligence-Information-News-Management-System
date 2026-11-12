# Run after accepting access to google/embeddinggemma-300m on Hugging Face.
# The token is prompted without echo and is passed only to a disposable container.
$ErrorActionPreference = 'Stop'
$volume = 'apakhabar-docker_ai_model_cache'
$image = 'apakhabar-docker-ai:latest'

$labels = docker volume inspect $volume --format '{{json .Labels}}' | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $labels.'com.docker.compose.project' -ne 'apakhabar-docker' -or $labels.'com.docker.compose.volume' -ne 'ai_model_cache') {
    throw 'The expected ApaKhabar model cache volume is unavailable.'
}

$secureToken = Read-Host 'Hugging Face read token' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try {
    $env:HF_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

try {
    @'
from huggingface_hub import snapshot_download
snapshot_download('google/embeddinggemma-300m')
print('Model snapshot cached')
'@ | docker run --rm -i --volume "${volume}:/app/data/huggingface" --env HF_HOME=/app/data/huggingface --env HF_TOKEN --entrypoint python $image -
    if ($LASTEXITCODE -ne 0) { throw 'Model download failed. Confirm model access and token scope.' }
} finally {
    Remove-Item Env:HF_TOKEN -ErrorAction SilentlyContinue
}

@'
from app.providers.models import _sentence_model
model = _sentence_model('google/embeddinggemma-300m', 'cpu')
vector = model.encode_query(['cache verification'], normalize_embeddings=True, truncate_dim=768)
assert len(vector[0]) == 768
print('Offline EmbeddingGemma load and 768-dimensional query passed')
'@ | docker run --rm -i --network none --volume "${volume}:/app/data/huggingface" --env HF_HOME=/app/data/huggingface --entrypoint python $image -
if ($LASTEXITCODE -ne 0) { throw 'Offline model verification failed.' }
