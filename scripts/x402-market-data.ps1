param(
  [ValidateSet("inspect", "estimate", "pay")]
  [string] $Mode = "estimate",

  [string] $Url = "https://nano.blockrun.ai/api/v1/pm/polymarket/markets",

  [string] $Address = "",

  [string] $Chain = "",

  [string] $MaxAmount = "0.001",

  [string] $OutFile = ""
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
} else {
  "circle"
}

if ($Mode -eq "inspect") {
  $result = & $circle services inspect $Url --output json
  $exitCode = $LASTEXITCODE
  if ($OutFile -and $exitCode -eq 0) {
    Save-JsonOutput -Path $OutFile -Value $result
  }
  $result | Write-Output
  exit $exitCode
}

if (-not $Address) {
  throw "Missing CIRCLE_MAINNET_AGENT_WALLET_ADDRESS. Add it to local .env or pass -Address."
}

$args = @(
  "services", "pay", $Url,
  "--address", $Address,
  "--chain", $Chain,
  "--max-amount", $MaxAmount,
  "--output", "json"
)

if ($Mode -eq "estimate") {
  $args += "--estimate"
}

if ($Mode -eq "pay") {
  Write-Host "About to run a real paid x402 request. Max amount: $MaxAmount USDC" -ForegroundColor Yellow
}

$result = & $circle @args
$exitCode = $LASTEXITCODE

if ($OutFile -and $exitCode -eq 0) {
  Save-JsonOutput -Path $OutFile -Value $result
}

$result | Write-Output
exit $exitCode
