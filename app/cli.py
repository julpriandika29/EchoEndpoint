import argparse
import os
from typing import List, Optional

import uvicorn


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="echoendpoint")
    subparsers = parser.add_subparsers(dest="command")

    serve_parser = subparsers.add_parser("serve", help="Run the HTTP server")
    serve_parser.add_argument(
        "--host",
        default=os.getenv("HOST", "0.0.0.0"),
        help="Bind host (default from HOST env or 0.0.0.0)",
    )
    serve_parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("PORT", "8000")),
        help="Bind port (default from PORT env or 8000)",
    )
    return parser


def run_server(host: str, port: int) -> None:
    uvicorn.run("app.main:app", host=host, port=port)


def main(argv: Optional[List[str]] = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command in (None, "serve"):
        host = getattr(args, "host", os.getenv("HOST", "0.0.0.0"))
        port = getattr(args, "port", int(os.getenv("PORT", "8000")))
        run_server(host, port)
        return

    parser.print_help()


if __name__ == "__main__":
    main()
