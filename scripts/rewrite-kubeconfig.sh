#!/usr/bin/env bash
set -euo pipefail

SRC=${1:-$HOME/.kube/config}
DST=${2:-$HOME/.kube/config.docker}

if [ ! -f "$SRC" ]; then
  echo "No kubeconfig at $SRC" >&2
  exit 1
fi

# Replace only the host portion; preserve any port that follows
awk '
  $1=="server:" {
    gsub("https://127.0.0.1","https://host.docker.internal");
    gsub("https://localhost","https://host.docker.internal");
  }
  {print}
' "$SRC" > "$DST"

echo "Wrote $DST"
