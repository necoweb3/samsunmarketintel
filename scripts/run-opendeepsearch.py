import argparse
import contextlib
import json
import os
import sys
import time

from opendeepsearch.ods_agent import OpenDeepSearchAgent


def main():
    parser = argparse.ArgumentParser(description="Run Sentient OpenDeepSearch once.")
    parser.add_argument("--query", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--mode", choices=["default", "pro"], default="pro")
    parser.add_argument("--reranker", choices=["jina", "infinity"], default="jina")
    parser.add_argument("--search-provider", choices=["serper", "searxng"], default="serper")
    parser.add_argument("--max-sources", type=int, default=3)
    args = parser.parse_args()

    started = time.time()

    with contextlib.redirect_stdout(sys.stderr):
        agent = OpenDeepSearchAgent(
            model=args.model,
            reranker=args.reranker,
            search_provider=args.search_provider,
            serper_api_key=os.environ.get("SERPER_API_KEY"),
            searxng_instance_url=os.environ.get("SEARXNG_INSTANCE_URL"),
            searxng_api_key=os.environ.get("SEARXNG_API_KEY"),
        )
        answer = agent.ask_sync(
            args.query,
            max_sources=args.max_sources,
            pro_mode=args.mode == "pro",
        )

    print(
        json.dumps(
            {
                "status": "ok",
                "query": args.query,
                "mode": args.mode,
                "searchProvider": args.search_provider,
                "reranker": args.reranker,
                "model": args.model,
                "maxSources": args.max_sources,
                "answer": answer,
                "durationMs": round((time.time() - started) * 1000),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(
            json.dumps(
                {
                    "status": "error",
                    "error": str(exc),
                },
                ensure_ascii=False,
            )
        )
        sys.exit(1)
