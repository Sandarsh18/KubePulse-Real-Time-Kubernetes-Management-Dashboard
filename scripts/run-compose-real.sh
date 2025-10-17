#!/usr/bin/env bash
set -euo pipefail

# Ensure real cluster env is prepared
scripts/setup-real-cluster.sh

# Build and start only the backend (uses KUBECONFIG pointing to rewritten config)
docker compose up -d --build backend

# Wait for health
for i in {1..30}; do
  if curl -sfS http://localhost:8080/api/health >/dev/null; then
    echo 'Backend healthy.'
    break
  fi
  echo 'Waiting for backend...'
  sleep 1
  if [ $i -eq 30 ]; then
    echo 'Backend did not become healthy in time.' >&2
    exit 1
  fi
done

# Smoke test namespaces
curl -sfS http://localhost:8080/api/k8s/namespaces | jq . || curl -sfS http://localhost:8080/api/k8s/namespaces || true
