#!/usr/bin/env bash
set -euo pipefail

NS=devops-demo

# Ensure an ingress controller exists and is ready (kind/minikube helpers)
ensure_ingress_controller() {
  local ctx
  ctx=$(kubectl config current-context 2>/dev/null || echo "")

  # Minikube: enable addon
  if command -v minikube >/dev/null 2>&1; then
    # If current context is minikube, enable ingress addon
    if [[ ${ctx} == minikube ]]; then
      echo "Ensuring minikube ingress addon..."
      minikube addons enable ingress >/dev/null 2>&1 || true
      # Wait for controller
      kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller --timeout=300s || true
      return
    fi
  fi

  # kind: install ingress-nginx if missing and ensure node is labeled for scheduling
  if [[ ${ctx} == kind-* ]]; then
    # Figure out kind cluster name (strip "kind-") for image loading
    local clusterName="${ctx#kind-}"

    # Preload ingress controller and certgen images into kind (avoid DNS/pull failures inside cluster)
    local controllerImg="registry.k8s.io/ingress-nginx/controller:v1.11.1"
    local certgenImg="registry.k8s.io/ingress-nginx/kube-webhook-certgen:v1.4.1"
    echo "Preloading ingress images into kind: $controllerImg, $certgenImg"
    docker pull -q "$controllerImg" || true
    docker pull -q "$certgenImg" || true
    kind load docker-image "$controllerImg" --name "$clusterName" || true
    kind load docker-image "$certgenImg" --name "$clusterName" || true

    if ! kubectl -n ingress-nginx get deploy ingress-nginx-controller >/dev/null 2>&1; then
      echo 'Installing ingress-nginx controller for kind...'
      kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.1/deploy/static/provider/kind/deploy.yaml
    else
      echo 'ingress-nginx already present.'
    fi
    # Label the control-plane node with ingress-ready=true so nodeSelector can match
    local node
    node=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
    if [[ -n "$node" ]]; then
      echo "Labeling node $node with ingress-ready=true (idempotent)..."
      kubectl label node "$node" ingress-ready=true --overwrite >/dev/null 2>&1 || true
    fi

    # Patch deployment image to tag (without digest) and set imagePullPolicy IfNotPresent
    echo 'Patching ingress-nginx controller image and pull policy to use preloaded images...'
    kubectl -n ingress-nginx set image deploy/ingress-nginx-controller controller=${controllerImg} --record || true
    kubectl -n ingress-nginx patch deployment ingress-nginx-controller \
      --type='json' \
      -p='[{"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"IfNotPresent"}]' || true

    echo 'Waiting for ingress-nginx controller to become Ready...'
    kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller --timeout=300s || true

    # Wait for validating webhook to be registered (prevents connection refused during apply)
    echo 'Waiting for ingress-nginx admission webhook to be ready...'
    for i in {1..30}; do
      if kubectl get validatingwebhookconfigurations.admissionregistration.k8s.io ingress-nginx-admission >/dev/null 2>&1; then
        break
      fi
      sleep 5
    done
  fi
}

# If using minikube, build against its Docker daemon
if command -v minikube >/dev/null 2>&1; then
  eval $(minikube -p minikube docker-env)
fi

echo "Building images..."
docker build -t backend:latest ./backend
docker build -t frontend:latest ./frontend

# If the current kube context is a kind cluster, load images into it
CTX=$(kubectl config current-context 2>/dev/null || true)
if [[ ${CTX:-} == kind-* ]] && command -v kind >/dev/null 2>&1; then
  CLUSTER_NAME="${CTX#kind-}"
  echo "Detected kind cluster (${CLUSTER_NAME}). Loading images..."
  kind load docker-image backend:latest --name "$CLUSTER_NAME"
  kind load docker-image frontend:latest --name "$CLUSTER_NAME"
  # Preload redis base image to avoid cluster pull issues
  echo "Preloading redis:7-alpine into kind to avoid image pull issues..."
  docker pull -q redis:7-alpine || true
  kind load docker-image redis:7-alpine --name "$CLUSTER_NAME" || true
fi

# Ensure ingress controller exists and is ready (for kind/minikube)
ensure_ingress_controller || true

echo "Applying k8s manifests (sans ingress first)..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/redis-deployment.yaml

# Apply ingress with retry to avoid timing issues with admission webhook
apply_ingress_with_retry() {
  local tries=10 sleep_s=6
  echo "Applying ingress..."
  for i in $(seq 1 $tries); do
    if kubectl apply -f k8s/ingress.yaml; then
      echo "Ingress applied."
      return 0
    fi
    echo "Ingress apply failed (attempt $i/$tries). Waiting ${sleep_s}s and retrying..."
    sleep ${sleep_s}
  done
  echo "Failed to apply ingress after $tries attempts." >&2
  return 1
}

apply_ingress_with_retry || true

echo "Waiting for rollout..."
kubectl -n ${NS} rollout status deploy/backend --timeout=180s || true
kubectl -n ${NS} rollout status deploy/frontend --timeout=180s || true

cat <<EOF
Done.
- Add to /etc/hosts: 127.0.0.1 devops.local
- If using minikube, run: minikube tunnel
- If using kind, ensure ingress controller is installed (this script attempts it) and ports 80/443 are reachable.
Then open http://devops.local
EOF
