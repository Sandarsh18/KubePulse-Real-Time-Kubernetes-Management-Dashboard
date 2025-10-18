#!/usr/bin/env bash
# Pre-deployment verification script

set -euo pipefail

echo "🔍 KubePulse Deployment Pre-Flight Check"
echo "========================================"
echo ""

ISSUES=0

# Check 1: Docker
echo "✓ Checking Docker..."
if command -v docker >/dev/null 2>&1; then
    DOCKER_VERSION=$(docker --version)
    echo "  ✅ Docker found: $DOCKER_VERSION"
else
    echo "  ❌ Docker not found. Please install Docker."
    ISSUES=$((ISSUES + 1))
fi

# Check 2: kubectl
echo ""
echo "✓ Checking kubectl..."
if command -v kubectl >/dev/null 2>&1; then
    KUBECTL_VERSION=$(kubectl version --client --short 2>/dev/null || kubectl version --client 2>&1 | head -1)
    echo "  ✅ kubectl found: $KUBECTL_VERSION"
else
    echo "  ❌ kubectl not found. Please install kubectl."
    ISSUES=$((ISSUES + 1))
fi

# Check 3: kind
echo ""
echo "✓ Checking kind..."
if command -v kind >/dev/null 2>&1; then
    KIND_VERSION=$(kind version)
    echo "  ✅ kind found: $KIND_VERSION"
else
    echo "  ❌ kind not found. Please install kind."
    ISSUES=$((ISSUES + 1))
fi

# Check 4: Kind cluster
echo ""
echo "✓ Checking Kind cluster..."
if kind get clusters 2>/dev/null | grep -q "devops"; then
    echo "  ✅ Kind cluster 'devops' exists"
    
    # Check if cluster is accessible
    if kubectl config current-context 2>/dev/null | grep -q "kind-devops"; then
        echo "  ✅ Context set to kind-devops"
    else
        echo "  ⚠️  Context not set to kind-devops"
        echo "     Run: kubectl config use-context kind-devops"
    fi
else
    echo "  ⚠️  Kind cluster 'devops' not found"
    echo "     It will be created during deployment"
fi

# Check 5: Required files
echo ""
echo "✓ Checking required files..."
REQUIRED_FILES=(
    "backend/Dockerfile"
    "backend/package.json"
    "backend/src/server.js"
    "frontend/Dockerfile"
    "frontend/package.json"
    "k8s/namespace.yaml"
    "k8s/rbac.yaml"
    "k8s/backend-deployment.yaml"
    "k8s/frontend-deployment.yaml"
    "k8s/redis-deployment.yaml"
    "k8s/ingress.yaml"
    "deploy.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file NOT FOUND"
        ISSUES=$((ISSUES + 1))
    fi
done

# Check 6: Ingress Controller
echo ""
echo "✓ Checking Ingress Controller..."
if kubectl -n ingress-nginx get deployment ingress-nginx-controller >/dev/null 2>&1; then
    STATUS=$(kubectl -n ingress-nginx get deployment ingress-nginx-controller -o jsonpath='{.status.conditions[?(@.type=="Available")].status}')
    if [ "$STATUS" = "True" ]; then
        echo "  ✅ Ingress controller is running"
    else
        echo "  ⚠️  Ingress controller exists but not ready"
    fi
else
    echo "  ⚠️  Ingress controller not found"
    echo "     It will be installed during deployment"
fi

# Check 7: /etc/hosts
echo ""
echo "✓ Checking /etc/hosts..."
if grep -q "devops.local" /etc/hosts; then
    echo "  ✅ devops.local found in /etc/hosts"
else
    echo "  ⚠️  devops.local not in /etc/hosts"
    echo "     Add: 127.0.0.1 devops.local"
    echo "     Run: echo '127.0.0.1 devops.local' | sudo tee -a /etc/hosts"
fi

# Check 8: Current deployment
echo ""
echo "✓ Checking current deployment..."
if kubectl -n devops-demo get pods >/dev/null 2>&1; then
    PODS=$(kubectl -n devops-demo get pods --no-headers 2>/dev/null | wc -l)
    RUNNING=$(kubectl -n devops-demo get pods --no-headers 2>/dev/null | grep -c "Running" || echo 0)
    echo "  ℹ️  Current pods in devops-demo: $PODS (Running: $RUNNING)"
    kubectl -n devops-demo get pods 2>/dev/null | sed 's/^/     /'
else
    echo "  ℹ️  No current deployment (namespace doesn't exist)"
fi

# Summary
echo ""
echo "========================================"
if [ $ISSUES -eq 0 ]; then
    echo "✅ All critical checks passed!"
    echo ""
    echo "You can now run: ./deploy.sh"
    echo ""
    echo "Expected behavior:"
    echo "  1. Build Docker images (~2-3 minutes)"
    echo "  2. Load images into Kind cluster"
    echo "  3. Apply Kubernetes manifests"
    echo "  4. Wait for pods to be ready"
    echo "  5. Access at: http://devops.local"
    exit 0
else
    echo "❌ Found $ISSUES critical issue(s)"
    echo ""
    echo "Please fix the issues above before running deploy.sh"
    exit 1
fi
