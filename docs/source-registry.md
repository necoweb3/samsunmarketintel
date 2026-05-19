# Source Registry

The source registry stores the credibility map used by the research layer.

Base rules live in code for official, financial, and local press sources.
User-provided sources are stored locally in:

`.cache/sources/registry.json`

This cache is ignored by git.

The live research snapshot reads this registry before scoring sources. That
means custom Turkey macro sources, X accounts, paid feeds, and integrity reports
can influence the agent's source credibility labels without changing code.

## Read

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/sources/registry
```

## Add Source

Starter pack:

```powershell
npm run sources:seed
```

This seeds official Turkey macro domains, local financial press, and a cautious
market-integrity watch input. It does not invent X accounts.

API:

```powershell
$body = @{
  name = "Example Turkey macro desk"
  type = "X account"
  coverage = "Turkey macro, FX, and CPI commentary"
  credibility = "Weighted"
  role = "Early signal before official confirmation"
  domains = @("x.com")
  status = "Needs curation"
  notes = "User-provided source; use only after cross-checking with official data."
} | ConvertTo-Json -Depth 6

Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/sources/registry `
  -Method POST `
  -ContentType 'application/json' `
  -Body $body
```

CLI:

```powershell
npm run sources:add -- --name "Example Turkey macro desk" --type "X account" --coverage "Turkey macro, FX, and CPI commentary" --credibility "Weighted" --role "Early signal before official confirmation" --domains "x.com" --status "Needs curation" --notes "User-provided source; cross-check before use."
```

## Rule

Custom sources do not automatically become trusted. They start as weighted or
watch inputs until they are corroborated by official sources, paid market data,
or repeated historical reliability.

## Check Scoring

```powershell
npm run check:sources
```
