#!/usr/bin/env bash
set -euo pipefail

# Create a local kind cluster named 'devops' with ports 80/443 mapped to the host and install ingress-nginx

if ! command -v kubectl >/dev/null 2>&1; then
  echo 'kubectl is required. Please install kubectl and retry.' >&2
  exit 1
fi

if ! command -v kind >/dev/null 2>&1; then
  echo 'kind not found, installing to ~/.local/bin/kind...'
  mkdir -p "$HOME/.local/bin"
  curl -fsSL -o "$HOME/.local/bin/kind" https://kind.sigs.k8s.io/dl/v0.23.0/kind-linux-amd64
  chmod +x "$HOME/.local/bin/kind"
  export PATH="$HOME/.local/bin:$PATH"
fi

if ! kind get clusters | grep -q '^devops$'; then
  cat > /tmp/kind-devops.yaml <<'EOF'
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
EOF
  kind create cluster --name devops --config /tmp/kind-devops.yaml
else
  echo 'kind cluster devops already exists.'
fi

kubectl config use-context kind-devops

# Wait for nodes
kubectl wait --for=condition=Ready nodes --all --timeout=300s || true

# Install ingress-nginx if missing
if ! kubectl -n ingress-nginx get deploy ingress-nginx-controller >/dev/null 2>&1; then
  echo 'Installing ingress-nginx controller for kind...'
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.1/deploy/static/provider/kind/deploy.yaml
fi
kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller --timeout=300s || true

echo 'kind devops cluster is ready with ingress mapped to host ports 80/443.'
