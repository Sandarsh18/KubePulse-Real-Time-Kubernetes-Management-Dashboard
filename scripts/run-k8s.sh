#!/usr/bin/env bash
set -euo pipefail

# Deploy to the real cluster (current kubectl context)
./deploy.sh

# Optionally port-forward backend if no ingress controller is ready
if ! kubectl -n devops-demo get ingress demo-ingress >/dev/null 2>&1; then
  echo 'No ingress found; you can port-forward to test locally:'
  echo 'kubectl -n devops-demo port-forward svc/backend 8080:8080'
fi
