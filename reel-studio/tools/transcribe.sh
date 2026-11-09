#!/usr/bin/env bash
# Kept for muscle memory — the logic lives in tools/transcribe.py.
exec python3 "$(dirname "$0")/transcribe.py" "$@"
