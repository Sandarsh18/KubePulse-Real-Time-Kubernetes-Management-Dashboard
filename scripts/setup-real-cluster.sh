#!/usr/bin/env bash
set -euo pipefail

# This script prepares the environment to run against a real Kubernetes cluster
# 1) Ensures a current context is set
# 2) Optionally creates a local kind cluster if none exists
# 3) Installs nginx ingress on kind
# 4) Rewrites kubeconfig for Docker to use host.docker.internal when server is localhost/127.0.0.1

CTX=$(kubectl config current-context 2>/dev/null || true)
if [ -z "${CTX:-}" ]; then
  echo "No current kubectl context set. Please run: kubectl config use-context <your-context>" >&2
  exit 1
fi

# If using kind, ensure cluster is ready and ingress installed
if [[ "$CTX" == kind-* ]]; then
  echo "Context $CTX is a kind cluster. Verifying readiness..."
  kubectl wait --for=condition=Ready nodes --all --timeout=300s || true
  if ! kubectl -n ingress-nginx get deploy ingress-nginx-controller >/dev/null 2>&1; then
    echo "Installing ingress-nginx for kind..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.1/deploy/static/provider/kind/deploy.yaml
    kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller --timeout=300s || true
  fi
fi

# Prepare docker-friendly kubeconfig
scripts/rewrite-kubeconfig.sh "$HOME/.kube/config" "$HOME/.kube/config.docker"

echo "Real cluster setup complete. Current context: $CTX"
