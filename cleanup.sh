#!/bin/bash

# 🧹 KubePulse Complete Cleanup Script
# Simple and effective - removes everything Docker and Kubernetes

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     🧹 KUBEPULSE COMPLETE CLEANUP                         ║"
echo "║     Removes ALL Docker & Kubernetes Resources             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

echo -e "${YELLOW}⚠️  THIS WILL REMOVE:${NC}"
echo "   • ALL Docker images"
echo "   • ALL Docker containers"
echo "   • ALL Docker volumes"
echo "   • ALL Docker networks"
echo "   • Docker build cache"
echo "   • Kind cluster"
echo ""
echo -e "${GREEN}✅ WILL KEEP:${NC}"
echo "   • Source code (frontend/, backend/, k8s/)"
echo "   • Configuration files"
echo ""
echo -e "${CYAN}After cleanup, rebuild with: ./deploy.sh${NC}"
echo ""

read -p "Type 'YES' or 'yes' to proceed: " -r
echo ""

# Convert to uppercase for comparison
REPLY_UPPER=$(echo "$REPLY" | tr '[:lower:]' '[:upper:]')

if [[ ! $REPLY_UPPER == "YES" ]]; then
    echo "Cancelled."
    exit 0
fi

echo -e "${CYAN}Starting cleanup...${NC}"
echo ""

# 1. Delete Kind cluster
echo "🔧 [1/5] Deleting Kind cluster..."
kind delete cluster --name devops 2>/dev/null && echo "   ✓ Cluster deleted" || echo "   ✓ No cluster found"

# 2. Stop all containers
echo "🔧 [2/5] Stopping containers..."
if [ "$(docker ps -q)" ]; then
    docker stop $(docker ps -q) 2>/dev/null && echo "   ✓ Containers stopped" || true
else
    echo "   ✓ No running containers"
fi

# 3. Remove all containers
echo "🔧 [3/5] Removing containers..."
if [ "$(docker ps -aq)" ]; then
    docker rm -f $(docker ps -aq) 2>/dev/null && echo "   ✓ Containers removed" || true
else
    echo "   ✓ No containers to remove"
fi

# 4. Remove all images with force
echo "🔧 [4/5] Removing ALL images..."
if [ "$(docker images -q)" ]; then
    docker rmi -f $(docker images -q) 2>/dev/null && echo "   ✓ Images removed" || true
else
    echo "   ✓ No images to remove"
fi

# 5. Complete system cleanup
echo "🔧 [5/5] System cleanup..."
docker system prune -af --volumes 2>/dev/null && echo "   ✓ System cleaned" || true

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ CLEANUP COMPLETE!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "📊 Current Docker status:"
docker system df
echo ""

echo -e "${CYAN}🚀 Next step: Run ./deploy.sh to rebuild everything${NC}"
echo ""
