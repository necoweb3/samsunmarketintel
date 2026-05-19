param(
  [ValidateSet("inspect", "estimate", "pay")]
  [string] $Mode = "estimate",

  [ValidateSet("tavily", "sonar")]
  [string] $Provider = "tavily",

  [string] $Query = "Turkiye enflasyon beklentisi TCMB TUIK Mayis 2026",

  [string] $Address = "",

  [string] $Chain = "",

  [string] $MaxAmount = "",

  [string] $OutFile = ".cache/x402/latest-research-search.json"
)

$ErrorActionPreference = "Stop"

if (Test-Path ".env") {
  Get-Content ".env" | ForEach-Object {
    if ($_ -match "^\s*#" -or $_ -notmatch "=") {
      return
    }

    $key, $value = $_ -split "=", 2
    if ($key -and -not [Environment]::GetEnvironmentVariable($key, "Process")) {
      [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
  }
}

function Save-JsonOutput {
  param(
    [string] $Path,
    [object[]] $Value
  )

  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, ($Value -join [Environment]::NewLine), $utf8NoBom)
}

if (-not $Address) {
  $Address = $env:CIRCLE_MAINNET_AGENT_WALLET_ADDRESS
}

if (-not $Chain) {
  $Chain = if ($env:CIRCLE_GATEWAY_CHAIN) { $env:CIRCLE_GATEWAY_CHAIN } else { "MATIC" }
}

$circle = if ($env:CIRCLE_CLI_PATH) {
  $env:CIRCLE_CLI_PATH
} elseif ([System.IO.File]::Exists("C:\Users\pc\AppData\Roaming\npm\circle.cmd")) {
  "C:\Users\pc\AppData\Roaming\npm\circle.cmd"
} else {
  "circle"
}

if ($Provider -eq "sonar") {
  $url = "https://api.aisa.one/apis/v2/perplexity/sonar"
  $priceLimit = if ($MaxAmount) { $MaxAmount } else { "0.012" }
  $body = @{
    model = "sonar"
    temperature = 0.1
    max_tokens = 600
    return_citations = $true
    search_context = "low"
    messages = @(
      @{
        role = "system"
        content = "You are a prediction-market research analyst. Return concise evidence with citations."
      },
      @{
        role = "user"
        content = $Query
      }
    )
  } | ConvertTo-Json -Depth 8 -Compress
} else {
  $url = "https://api.aisa.one/apis/v2/tavily/search"
  $priceLimit = if ($MaxAmount) { $MaxAmount } else { "0.0096" }
  $body = @{
    query = $Query
    topic = "news"
    country = "turkey"
    time_range = "week"
    max_results = 8
    search_depth = "basic"
    include_answer = $false
    include_usage = $true
    include_raw_content = $false
  } | ConvertTo-Json -Depth 6 -Compress
}

if ($Mode -eq "inspect") {
  $result = & $circle services inspect $url --output json
  $exitCode = $LASTEXITCODE
  $result | Write-Output
  exit $exitCode
}

if (-not $Address) {
  throw "Missing CIRCLE_MAINNET_AGENT_WALLET_ADDRESS. Add it to local .env or pass -Address."
}

$args = @(
  "services", "pay", $url,
  "--address", $Address,
  "--chain", $Chain,
  "--method", "POST",
  "--header", "Content-Type: application/json",
  "--data", $body,
  "--max-amount", $priceLimit,
  "--timeout", "60",
  "--output", "json"
)

if ($Mode -eq "estimate") {
  $args += "--estimate"
}

if ($Mode -eq "pay") {
  Write-Host "About to run a real paid x402 research request. Max amount: $priceLimit USDC" -ForegroundColor Yellow
}

$result = & $circle @args
$exitCode = $LASTEXITCODE

if ($OutFile -and $exitCode -eq 0 -and $Mode -eq "pay") {
  Save-JsonOutput -Path $OutFile -Value $result
}

$result | Write-Output
exit $exitCode
