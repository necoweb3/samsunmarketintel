$ErrorActionPreference = "Stop"

Write-Host "CryptoAnalystBench Python:"
& .\.venvs\sentient-crypto\Scripts\python.exe -c "import pandas, openai, anthropic, fireworks.client; print('ok')"

Write-Host "OpenDeepSearch Python:"
& .\.venvs\sentient-opendeepsearch\Scripts\python.exe -c "import openai, transformers, smolagents, litellm, langchain; from opendeepsearch import OpenDeepSearchTool; print('ok')"

Write-Host "ROMA Python:"
& .\.venvs\sentient-roma\Scripts\python.exe -c "import roma_dspy, dspy, pydantic, fastmcp; print('ok')"

Write-Host "Safe function-calling dataset:"
& .\.venvs\sentient-opendeepsearch\Scripts\python.exe -c "from datasets import load_dataset; path=r'references\sentient-agi\crypto-agent-safe-function-calling\data\crypto-agent-safe-function-calling.parquet'; ds=load_dataset('parquet', data_files=path, split='train'); assert len(ds) == 5199; print('ok')"
