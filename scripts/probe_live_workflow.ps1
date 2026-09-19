$ProgressPreference = 'SilentlyContinue'
$base = 'https://ortholab.estheticaligner.com.br'
$cookies = Join-Path $PSScriptRoot 'ortholab_live.cookies'
Remove-Item $cookies -ErrorAction SilentlyContinue

$page = curl.exe -sS -L -c $cookies -A 'Mozilla/5.0' "$base/pt-BR/users/sign_in"
$auth = [regex]::Match($page, 'name="authenticity_token"\s+value="([^"]+)"').Groups[1].Value
if (-not $auth) {
  Write-Host 'NO_CSRF'
  exit 1
}

$form = "authenticity_token=$([System.Net.WebUtility]::UrlEncode($auth))&user%5Bemail%5D=marketing%40estheticaligner.com.br&user%5Bpassword%5D=Otavio2805%40&commit=Entrar"
$post = curl.exe -sS -L -b $cookies -c $cookies -A 'Mozilla/5.0' -H "Origin: $base" -H "Referer: $base/pt-BR/users/sign_in" -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' -X POST --data $form "$base/pt-BR/users/sign_in"

if ($post -match 'Email ou senha inválidos|Invalid|sign_in') {
  Write-Host 'LOGIN_FAILED'
  Write-Host $post.Substring(0, [Math]::Min(500, $post.Length))
  exit 2
}

$workflow = curl.exe -sS -L -b $cookies -A 'Mozilla/5.0' "$base/pt-BR/workflow_control/planning_center/list.json"
Write-Host 'WORKFLOW_RAW_PREFIX:'
Write-Host $workflow.Substring(0, [Math]::Min(500, $workflow.Length))

try {
  $json = $workflow | ConvertFrom-Json -Depth 50
  $count = if ($json -is [System.Collections.IEnumerable] -and -not ($json -is [string])) { @($json).Count } else { 1 }
  Write-Host "WORKFLOW_COUNT=$count"
} catch {
  Write-Host 'WORKFLOW_JSON_PARSE_FAILED'
  exit 3
}
