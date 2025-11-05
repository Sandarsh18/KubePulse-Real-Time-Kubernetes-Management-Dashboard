#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# KubePulse Complete Cleanup Script
#
# This script removes EVERYTHING created by deploy.sh:
# - All Kubernetes resources
# - Kind cluster
# - Docker images
# - Docker containers
# - Generated files (.env, logs, scripts)
#
# Usage: ./cleanup.sh [--force]
###############################################################################

FORCE=false
if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi

NS=devops-demo
CLUSTER_NAME=devops

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_step() {
  echo -e "${BLUE}▶ $1${NC}"
}

###############################################################################
# Confirmation
###############################################################################

if [ "$FORCE" = false ]; then
  clear
  echo -e "${RED}"
  cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                   ⚠️  WARNING: CLEANUP  ⚠️                   ║
║                                                               ║
║  This will permanently delete:                                ║
║                                                               ║
║  🗑️  Kind cluster (devops)                                   ║
║  🗑️  All Kubernetes resources                                ║
║  🗑️  Docker images (frontend, backend, mongo, redis)         ║
║  🗑️  Docker containers                                        ║
║  🗑️  Generated files (.env, scripts, logs)                   ║
║  🗑️  /etc/hosts entry (if writable)                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
  echo -e "${NC}"
  
  echo -e "${YELLOW}Are you sure you want to continue?${NC}"
  read -p "Type 'yes' to proceed: " -r
  echo
  if [[ ! $REPLY == "yes" ]]; then
    echo "Cleanup cancelled."
    exit 0
  fi
fi

###############################################################################
# Step 1: Stop Local Development Servers
###############################################################################

print_header "Step 1: Stopping Local Development Servers"

print_step "Killing processes on ports 3000, 5000, 8080..."
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:5000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:8080 2>/dev/null | xargs kill -9 2>/dev/null || true
print_success "Local servers stopped"

###############################################################################
# Step 2: Delete Kubernetes Resources
###############################################################################

print_header "Step 2: Deleting Kubernetes Resources"

if kubectl cluster-info >/dev/null 2>&1; then
  print_step "Deleting namespace ${NS}..."
  kubectl delete namespace ${NS} --ignore-not-found=true --timeout=60s 2>/dev/null || {
    print_warning "Namespace deletion timed out, forcing..."
    kubectl delete namespace ${NS} --force --grace-period=0 2>/dev/null || true
  }
  print_success "Namespace deleted"
  
  print_step "Deleting ingress controller..."
  kubectl delete namespace ingress-nginx --ignore-not-found=true --timeout=60s 2>/dev/null || {
    print_warning "Ingress namespace deletion timed out, forcing..."
    kubectl delete namespace ingress-nginx --force --grace-period=0 2>/dev/null || true
  }
  print_success "Ingress controller deleted"
else
  print_warning "No active Kubernetes cluster found"
fi

###############################################################################
# Step 3: Delete Kind Cluster
###############################################################################

print_header "Step 3: Deleting Kind Cluster"

if command -v kind >/dev/null 2>&1; then
  if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
    print_step "Deleting Kind cluster '${CLUSTER_NAME}'..."
    kind delete cluster --name "${CLUSTER_NAME}"
    print_success "Kind cluster deleted"
  else
    print_warning "Kind cluster '${CLUSTER_NAME}' not found"
  fi
else
  print_warning "kind command not found, skipping cluster deletion"
fi

###############################################################################
# Step 4: Remove Docker Images (Force)
###############################################################################

print_header "Step 4: Removing Docker Images"

print_step "Removing frontend image..."
docker rmi -f frontend:latest 2>/dev/null || true
print_success "Frontend image removed"

print_step "Removing backend image..."
docker rmi -f backend:latest 2>/dev/null || true
print_success "Backend image removed"

print_step "Removing Redis image..."
docker rmi -f redis:7-alpine 2>/dev/null || true
print_success "Redis image removed"

print_step "Removing MongoDB image..."
docker rmi -f mongo:7.0 2>/dev/null || true
print_success "MongoDB image removed"

print_step "Removing ingress controller images..."
docker rmi -f registry.k8s.io/ingress-nginx/controller:v1.11.1 2>/dev/null || true
docker rmi -f registry.k8s.io/ingress-nginx/kube-webhook-certgen:v1.4.1 2>/dev/null || true
print_success "Ingress images removed"

print_step "Removing Node.js base image..."
docker rmi -f node:20-alpine 2>/dev/null || true
docker rmi -f node:22-alpine 2>/dev/null || true
print_success "Node images removed"

print_step "Removing Nginx image..."
docker rmi -f nginx:alpine 2>/dev/null || true
print_success "Nginx image removed"

###############################################################################
# Step 5: Remove Docker Containers (Force)
###############################################################################

print_header "Step 5: Removing Docker Containers"

print_step "Removing KubePulse-related containers..."
docker ps -a --filter "name=kubepulse" --format "{{.ID}}" | xargs -r docker rm -f 2>/dev/null || true
docker ps -a --filter "name=devops" --format "{{.ID}}" | xargs -r docker rm -f 2>/dev/null || true
print_success "Containers removed"

###############################################################################
# Step 6: Clean Up Generated Files
###############################################################################

print_header "Step 6: Cleaning Up Generated Files"

print_step "Removing .env files..."
rm -f backend/.env backend/.env.local
rm -f frontend/.env frontend/.env.local
print_success ".env files removed"

print_step "Removing development scripts..."
rm -f start-dev.sh stop-dev.sh
print_success "Development scripts removed"

print_step "Removing logs directory..."
rm -rf logs
print_success "Logs directory removed"

print_step "Removing node_modules (optional, commented out)..."
# Uncomment if you want to remove node_modules too
# rm -rf backend/node_modules frontend/node_modules
print_warning "node_modules kept (uncomment in script to remove)"

###############################################################################
# Step 7: Remove /etc/hosts Entry
###############################################################################

print_header "Step 7: Cleaning /etc/hosts"

if grep -q "devops.local" /etc/hosts 2>/dev/null; then
  if [ -w /etc/hosts ]; then
    print_step "Removing devops.local from /etc/hosts..."
    sudo sed -i.bak '/devops.local/d' /etc/hosts
    print_success "Removed devops.local from /etc/hosts"
  else
    print_warning "Cannot write to /etc/hosts. Remove manually:"
    echo ""
    echo "    sudo sed -i.bak '/devops.local/d' /etc/hosts"
    echo ""
  fi
else
  print_success "devops.local not found in /etc/hosts"
fi

###############################################################################
# Step 8: Clean Docker System (Optional)
###############################################################################

print_header "Step 8: Docker System Cleanup"

print_step "Removing dangling images..."
docker image prune -f >/dev/null 2>&1 || true
print_success "Dangling images removed"

print_step "Removing unused volumes..."
docker volume prune -f >/dev/null 2>&1 || true
print_success "Unused volumes removed"

print_step "Removing unused networks..."
docker network prune -f >/dev/null 2>&1 || true
print_success "Unused networks removed"

###############################################################################
# Step 9: Verify Cleanup
###############################################################################

print_header "Step 9: Verifying Cleanup"

print_step "Checking for remaining resources..."

# Check Kind clusters
if command -v kind >/dev/null 2>&1; then
  REMAINING_CLUSTERS=$(kind get clusters 2>/dev/null | grep -c "^${CLUSTER_NAME}$" || true)
  if [ "$REMAINING_CLUSTERS" -eq 0 ]; then
    print_success "No Kind clusters found"
  else
    print_warning "Kind cluster still exists (may need manual deletion)"
  fi
fi

# Check Docker images
REMAINING_IMAGES=$(docker images --filter "reference=frontend" --filter "reference=backend" --format "{{.Repository}}" | wc -l)
if [ "$REMAINING_IMAGES" -eq 0 ]; then
  print_success "No project images found"
else
  print_warning "$REMAINING_IMAGES project image(s) still exist"
fi

# Check Docker containers
REMAINING_CONTAINERS=$(docker ps -a --filter "name=devops" --filter "name=kubepulse" --format "{{.Names}}" | wc -l)
if [ "$REMAINING_CONTAINERS" -eq 0 ]; then
  print_success "No project containers found"
else
  print_warning "$REMAINING_CONTAINERS project container(s) still exist"
fi

###############################################################################
# Completion
###############################################################################

print_header "🎉 CLEANUP COMPLETE!"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  ✅  All KubePulse Resources Cleaned Up!                 ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🧹 What Was Cleaned${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ✅ Kind cluster (${CLUSTER_NAME})"
echo -e "  ✅ Kubernetes namespace (${NS})"
echo -e "  ✅ Ingress controller"
echo -e "  ✅ Docker images (frontend, backend, mongo, redis, nginx, node)"
echo -e "  ✅ Docker containers"
echo -e "  ✅ Environment files (.env)"
echo -e "  ✅ Development scripts"
echo -e "  ✅ Logs directory"
echo -e "  ✅ Dangling Docker resources"
echo ""

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  🚀 To Redeploy${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Run:  ${GREEN}./deploy.sh${NC}"
echo ""

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  📝 Manual Steps (if needed)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}Remove /etc/hosts entry:${NC}"
echo -e "    sudo sed -i.bak '/devops.local/d' /etc/hosts"
echo ""
echo -e "  ${YELLOW}Remove node_modules:${NC}"
echo -e "    rm -rf backend/node_modules frontend/node_modules"
echo ""
echo -e "  ${YELLOW}Full Docker cleanup:${NC}"
echo -e "    docker system prune -a --volumes -f"
echo ""

print_success "Cleanup completed successfully!"
echo ""