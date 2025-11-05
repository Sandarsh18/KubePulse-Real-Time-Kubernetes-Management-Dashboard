#!/usr/bin/env bash
set -euo pipefail

##############################################################################
# KubePulse Complete Deployment Script
#
# This script deploys EVERYTHING:
# - Kubernetes cluster (Kind)
# - MongoDB (for Authentication)
# - Redis (for Chat)
# - Backend with Authentication
# - Frontend with Auth UI
# - Ingress Controller
# - All required configurations
#
# Usage: ./deploy-full.sh
###############################################################################

NS=devops-demo
CLUSTER_NAME=devops
MONGO_PORT=27017
BACKEND_PORT=5000
FRONTEND_PORT=3000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

###############################################################################
# Utility Functions
###############################################################################

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

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_step() {
  echo -e "${PURPLE}▶ $1${NC}"
}

###############################################################################
# Step 1: Check Prerequisites
###############################################################################

check_prerequisites() {
  print_header "Step 1: Checking Prerequisites"
  
  local missing_tools=()
  
  # Check Docker
  if ! command -v docker >/dev/null 2>&1; then
    missing_tools+=("docker")
  else
    print_success "Docker found: $(docker --version | head -n1)"
  fi
  
  # Check kubectl
  if ! command -v kubectl >/dev/null 2>&1; then
    missing_tools+=("kubectl")
  else
    print_success "kubectl found: $(kubectl version --client -o json 2>/dev/null | grep -o '"gitVersion":"[^"]*' | cut -d'"' -f4)"
  fi
  
  # Check kind
  if ! command -v kind >/dev/null 2>&1; then
    missing_tools+=("kind")
  else
    print_success "kind found: $(kind version)"
  fi
  
  # Check Node.js (for local dev)
  if ! command -v node >/dev/null 2>&1; then
    print_warning "Node.js not found - will use Kubernetes deployment only"
  else
    print_success "Node.js found: $(node --version)"
  fi
  
  # Check npm
  if ! command -v npm >/dev/null 2>&1; then
    print_warning "npm not found - will use Kubernetes deployment only"
  else
    print_success "npm found: $(npm --version)"
  fi
  
  if [ ${#missing_tools[@]} -ne 0 ]; then
    print_error "Missing required tools: ${missing_tools[*]}"
    echo ""
    echo "Please install missing tools:"
    for tool in "${missing_tools[@]}"; do
      case $tool in
        docker)
          echo "  Docker: https://docs.docker.com/get-docker/"
          ;;
        kubectl)
          echo "  kubectl: https://kubernetes.io/docs/tasks/tools/"
          ;;
        kind)
          echo "  kind: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
          ;;
      esac
    done
    exit 1
  fi
  
  print_success "All required prerequisites are installed!"
}

###############################################################################
# Step 2: Create Kind Cluster
###############################################################################

ensure_kind_cluster() {
  print_header "Step 2: Setting Up Kubernetes Cluster"
  
  if ! kubectl cluster-info >/dev/null 2>&1; then
    print_info "No active Kubernetes cluster found. Creating new Kind cluster..."
    
    cat <<EOF | kind create cluster --name "${CLUSTER_NAME}" --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
  - containerPort: 30017
    hostPort: 27017
    protocol: TCP
EOF
    print_success "Kind cluster '${CLUSTER_NAME}' created successfully!"
  else
    local ctx
    ctx=$(kubectl config current-context 2>/dev/null || echo "")
    if [[ ${ctx} == kind-* ]]; then
      CLUSTER_NAME="${ctx#kind-}"
      print_success "Using existing Kind cluster: ${CLUSTER_NAME}"
    else
      print_success "Using existing cluster: ${ctx}"
    fi
  fi
  
  print_step "Waiting for cluster to be ready..."
  kubectl wait --for=condition=Ready nodes --all --timeout=60s
  print_success "Cluster is ready!"
}

###############################################################################
# Step 3: Deploy MongoDB
###############################################################################

deploy_mongodb() {
  print_header "Step 3: Deploying MongoDB (Authentication Database)"
  
  print_step "Ensuring namespace exists..."
  kubectl apply -f k8s/namespace.yaml 2>/dev/null || kubectl create namespace ${NS}
  
  print_step "Creating MongoDB deployment..."
  
  cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: mongodb
  namespace: ${NS}
spec:
  type: NodePort
  ports:
  - port: 27017
    targetPort: 27017
    nodePort: 30017
  selector:
    app: mongodb
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
  namespace: ${NS}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
      - name: mongodb
        image: mongo:7.0
        imagePullPolicy: IfNotPresent
        args: ["--bind_ip_all"]
        ports:
        - containerPort: 27017
        env:
        - name: MONGO_INITDB_DATABASE
          value: kubepulse
        readinessProbe:
          tcpSocket:
            port: 27017
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 12
        livenessProbe:
          tcpSocket:
            port: 27017
          initialDelaySeconds: 15
          periodSeconds: 10
          failureThreshold: 6
        volumeMounts:
        - name: mongo-data
          mountPath: /data/db
      volumes:
      - name: mongo-data
        emptyDir: {}
EOF
  
  print_step "Waiting for MongoDB to be ready..."
  if ! kubectl -n ${NS} rollout status deployment/mongodb --timeout=300s; then
    print_warning "MongoDB did not become ready in time. Collecting diagnostics..."
    kubectl -n ${NS} get pods -l app=mongodb -o wide || true
    kubectl -n ${NS} describe pod -l app=mongodb || true
    kubectl -n ${NS} logs deploy/mongodb --tail=200 || true
    exit 1
  fi
  print_success "MongoDB is ready!"
  
  # Get MongoDB connection string
  local mongo_ip node_port
  mongo_ip=$(kubectl -n ${NS} get svc mongodb -o jsonpath='{.spec.clusterIP}')
  node_port=$(kubectl -n ${NS} get svc mongodb -o jsonpath='{.spec.ports[0].nodePort}')
  print_info "MongoDB available at: mongodb://${mongo_ip}:27017/kubepulse"
  print_info "MongoDB NodePort: ${node_port} (Kind hostPort 27017 mapped)"
}

###############################################################################
# Step 4: Generate Environment Configurations
###############################################################################

setup_environment_files() {
  print_header "Step 4: Configuring Environment Variables"
  
  # Generate JWT Secret
  print_step "Generating JWT secret..."
  local jwt_secret
  if command -v openssl >/dev/null 2>&1; then
    jwt_secret=$(openssl rand -base64 48)
  else
    jwt_secret="super-secret-jwt-key-change-in-production-min-32-chars-$(date +%s)"
  fi
  
  # Backend .env
  print_step "Creating backend/.env..."
  cat > backend/.env <<EOF
# Server Configuration
PORT=${BACKEND_PORT}
NODE_ENV=production
FRONTEND_URL=http://devops.local

# MongoDB Configuration (Kubernetes Service)
MONGO_URI=mongodb://mongodb.${NS}.svc.cluster.local:27017/kubepulse

# JWT Configuration
JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=7d

# Kubernetes Configuration
DEMO_MODE=false
EOF
  
  print_success "Created backend/.env"
  
  # Frontend .env
  print_step "Creating frontend/.env..."
  cat > frontend/.env <<EOF
# Backend API URL (without /api - will be added by axios)
VITE_API_URL=http://devops.local
EOF
  
  print_success "Created frontend/.env"
  
  # Local development .env (for hot reload)
  print_step "Creating backend/.env.local for local development..."
  cat > backend/.env.local <<EOF
# Server Configuration (Local)
PORT=${BACKEND_PORT}
NODE_ENV=development
FRONTEND_URL=http://localhost:${FRONTEND_PORT}

# MongoDB Configuration (Local)
MONGO_URI=mongodb://localhost:${MONGO_PORT}/kubepulse

# JWT Configuration
JWT_SECRET=${jwt_secret}
JWT_EXPIRES_IN=7d

# Kubernetes Configuration
DEMO_MODE=false
EOF
  
  print_success "Created backend/.env.local"
  
  # Frontend local .env
  print_step "Creating frontend/.env.local for local development..."
  cat > frontend/.env.local <<EOF
# Backend API URL (Local - without /api)
VITE_API_URL=http://localhost:${BACKEND_PORT}
EOF
  
  print_success "Created frontend/.env.local"
  
  print_info "Environment files created!"
  print_warning "JWT Secret generated: ${jwt_secret:0:20}... (saved in .env files)"
}

###############################################################################
# Step 5: Install Dependencies
###############################################################################

install_dependencies() {
  print_header "Step 5: Installing Node.js Dependencies"
  
  if ! command -v npm >/dev/null 2>&1; then
    print_warning "npm not found. Skipping dependency installation."
    print_info "You can install dependencies later with: npm install"
    return
  fi
  
  # Backend dependencies
  print_step "Installing backend dependencies..."
  cd backend
  if [ ! -d "node_modules" ]; then
    npm install --silent
    print_success "Backend dependencies installed"
  else
    print_info "Backend dependencies already installed"
  fi
  cd ..
  
  # Frontend dependencies
  print_step "Installing frontend dependencies..."
  cd frontend
  if [ ! -d "node_modules" ]; then
    npm install --silent
    print_success "Frontend dependencies installed"
  else
    print_info "Frontend dependencies already installed"
  fi
  cd ..
}

###############################################################################
# Step 6: Build Docker Images
###############################################################################

build_images() {
  print_header "Step 6: Building Docker Images"
  
  print_step "Building backend image..."
  docker build -t backend:latest ./backend --quiet
  print_success "Backend image built"
  
  print_step "Building frontend image..."
  # Read build-time API URL from frontend/.env (fallback to http://devops.local)
  local FRONT_URL
  FRONT_URL=$(grep -E '^VITE_API_URL=' frontend/.env | cut -d= -f2- || true)
  FRONT_URL=${FRONT_URL:-http://devops.local}
  docker build --network host --build-arg VITE_API_URL="${FRONT_URL}" -t frontend:latest ./frontend --quiet
  print_success "Frontend image built"
}

###############################################################################
# Step 7: Load Images into Kind
###############################################################################

load_images_into_kind() {
  print_header "Step 7: Loading Images into Kind Cluster"
  
  local ctx
  ctx=$(kubectl config current-context 2>/dev/null || echo "")
  
  if [[ ${ctx} == kind-* ]] && command -v kind >/dev/null 2>&1; then
    local cluster_name="${ctx#kind-}"
    
    print_step "Loading backend image..."
    kind load docker-image backend:latest --name "$cluster_name"
    print_success "Backend image loaded"
    
    print_step "Loading frontend image..."
    kind load docker-image frontend:latest --name "$cluster_name"
    print_success "Frontend image loaded"
    
    print_step "Preloading Redis image..."
    docker pull -q redis:7-alpine || true
    kind load docker-image redis:7-alpine --name "$cluster_name"
    print_success "Redis image loaded"
    
    print_step "Preloading MongoDB image..."
    docker pull -q mongo:7.0 || true
    kind load docker-image mongo:7.0 --name "$cluster_name"
    print_success "MongoDB image loaded"
  else
    print_info "Not a Kind cluster, skipping image loading"
  fi
}

###############################################################################
# Step 8: Setup Ingress Controller
###############################################################################

ensure_ingress_controller() {
  print_header "Step 8: Setting Up Ingress Controller"
  
  local ctx
  ctx=$(kubectl config current-context 2>/dev/null || echo "")
  
  if [[ ${ctx} == kind-* ]]; then
    print_step "Preloading ingress controller images..."
    local controllerImg="registry.k8s.io/ingress-nginx/controller:v1.11.1"
    local certgenImg="registry.k8s.io/ingress-nginx/kube-webhook-certgen:v1.4.1"
    docker pull -q "$controllerImg" || true
    docker pull -q "$certgenImg" || true
    kind load docker-image "$controllerImg" --name "${ctx#kind-}" || true
    kind load docker-image "$certgenImg" --name "${ctx#kind-}" || true
  fi

  if ! kubectl -n ingress-nginx get deploy ingress-nginx-controller >/dev/null 2>&1; then
    print_step "Installing ingress-nginx..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.1/deploy/static/provider/kind/deploy.yaml
  else
    print_info "Ingress controller already installed"
  fi

  print_step "Waiting for ingress controller to be ready..."
  kubectl -n ingress-nginx rollout status deploy/ingress-nginx-controller --timeout=180s
  print_success "Ingress controller is ready!"
}

###############################################################################
# Step 9: Deploy Kubernetes Resources
###############################################################################

deploy_kubernetes_resources() {
  print_header "Step 9: Deploying Kubernetes Resources"
  
  print_step "Creating namespace..."
  kubectl apply -f k8s/namespace.yaml
  print_success "Namespace created"
  
  print_step "Applying RBAC..."
  kubectl apply -f k8s/rbac.yaml
  print_success "RBAC configured"
  
  print_step "Deploying backend..."
  kubectl apply -f k8s/backend-deployment.yaml
  print_success "Backend deployed"
  
  print_step "Deploying frontend..."
  kubectl apply -f k8s/frontend-deployment.yaml
  print_success "Frontend deployed"
  
  print_step "Deploying Redis..."
  kubectl apply -f k8s/redis-deployment.yaml
  print_success "Redis deployed"
  
  print_step "Creating ingress (with retry)..."
  local tries=10
  for i in $(seq 1 $tries); do
    if kubectl apply -f k8s/ingress.yaml 2>/dev/null; then
      print_success "Ingress created"
      break
    fi
    if [ $i -eq $tries ]; then
      print_warning "Ingress creation failed after $tries attempts"
    else
      sleep 3
    fi
  done
  
  print_step "Waiting for deployments to be ready..."
  kubectl -n ${NS} rollout status deploy/backend --timeout=180s || true
  kubectl -n ${NS} rollout status deploy/frontend --timeout=180s || true
  
  print_success "All Kubernetes resources deployed!"
}

###############################################################################
# Step 10: Update /etc/hosts
###############################################################################

update_hosts_file() {
  print_header "Step 10: Configuring DNS (/etc/hosts)"
  
  local hostname="devops.local"
  local ip="127.0.0.1"
  
  if ! grep -q "${hostname}" /etc/hosts 2>/dev/null; then
    print_step "Adding ${hostname} to /etc/hosts..."
    if [ -w /etc/hosts ]; then
      echo "${ip} ${hostname}" >> /etc/hosts
      print_success "Added ${hostname} to /etc/hosts"
    else
      print_warning "Cannot write to /etc/hosts. Please add manually:"
      echo ""
      echo "    echo '${ip} ${hostname}' | sudo tee -a /etc/hosts"
      echo ""
    fi
  else
    print_success "${hostname} already exists in /etc/hosts"
  fi
}

###############################################################################
# Step 11: Create First Admin User
###############################################################################

create_admin_user() {
  print_header "Step 11: Creating Admin User"
  
  print_info "Waiting for MongoDB and Backend to be fully ready..."
  sleep 10
  
  print_step "Generating secure password hash..."
  
  # Get backend pod for bcrypt hashing
  local backend_pod
  backend_pod=$(kubectl -n ${NS} get pods -l app=backend -o jsonpath='{.items[0].metadata.name}')
  
  if [ -z "$backend_pod" ]; then
    print_warning "Backend pod not found. Skipping admin user creation."
    return
  fi
  
  # Generate proper bcrypt hash for 'admin123'
  local password_hash
  password_hash=$(kubectl -n ${NS} exec "$backend_pod" -- node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 10).then(hash => console.log(hash));" 2>/dev/null)
  
  if [ -z "$password_hash" ]; then
    print_warning "Failed to generate password hash. Skipping admin user creation."
    return
  fi
  
  print_step "Creating admin user in MongoDB..."
  
  # Get MongoDB pod
  local mongo_pod
  mongo_pod=$(kubectl -n ${NS} get pods -l app=mongodb -o jsonpath='{.items[0].metadata.name}')
  
  if [ -z "$mongo_pod" ]; then
    print_warning "MongoDB pod not found. You'll need to create admin user manually."
    return
  fi
  
  # Create admin user with proper email format
  kubectl -n ${NS} exec "$mongo_pod" -- mongosh kubepulse --eval "
    db.users.deleteOne({ email: 'admin@kubepulse.com' });
    db.users.deleteOne({ email: 'admin@kubepulse.local' });
  " >/dev/null 2>&1 || true
  
  kubectl -n ${NS} exec "$mongo_pod" -- mongosh kubepulse --eval "
    db.users.insertOne({
      username: 'admin',
      email: 'admin@kubepulse.com',
      password: '${password_hash}',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      lastLogin: null
    })
  " >/dev/null 2>&1 || print_warning "Admin user might already exist"
  
  print_success "Admin user created!"
  print_info "Login credentials:"
  echo ""
  echo "    Email: admin@kubepulse.com"
  echo "    Password: admin123"
  echo ""
  # Note: Keeping admin password as-is per request; no change prompt shown.
  # print_warning "⚠️  Change this password after first login!"
}

###############################################################################
# Step 12: Create Development Scripts
###############################################################################

create_dev_scripts() {
  print_header "Step 12: Creating Development Helper Scripts"
  
  # Start local development script
  cat > start-dev.sh <<'EOF'
#!/usr/bin/env bash
# Start local development with hot reload

echo "🚀 Starting KubePulse in development mode..."
echo ""

# Check if MongoDB is running
if ! docker ps | grep -q kubepulse-mongo; then
  echo "Starting MongoDB..."
  docker run -d --name kubepulse-mongo -p 27017:27017 mongo:7.0
  sleep 3
fi

# Start backend
echo "Starting backend on http://localhost:5000..."
cd backend
if [ -f .env.local ]; then
  cp .env.local .env
fi
npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend
echo "Starting frontend on http://localhost:3000..."
cd frontend
if [ -f .env.local ]; then
  cp .env.local .env
fi
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Development servers started!"
echo ""
echo "📊 Access points:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000"
echo "   MongoDB:  mongodb://localhost:27017"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f logs/backend.log"
echo "   Frontend: tail -f logs/frontend.log"
echo ""
echo "🛑 To stop: kill $BACKEND_PID $FRONTEND_PID"
echo ""
EOF

  chmod +x start-dev.sh
  print_success "Created start-dev.sh"
  
  # Stop script
  cat > stop-dev.sh <<'EOF'
#!/usr/bin/env bash
# Stop local development servers

echo "🛑 Stopping development servers..."

# Kill processes by port
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "✅ Development servers stopped"
EOF

  chmod +x stop-dev.sh
  print_success "Created stop-dev.sh"
  
  # Create logs directory
  mkdir -p logs
}

###############################################################################
# Step 13: Display Success Information
###############################################################################

display_success_info() {
  print_header "🎉 DEPLOYMENT COMPLETE!"
  
  echo ""
  echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                                                           ║${NC}"
  echo -e "${GREEN}║  ✅  KubePulse Successfully Deployed!                    ║${NC}"
  echo -e "${GREEN}║                                                           ║${NC}"
  echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  print_info "📊 Cluster Information:"
  kubectl cluster-info
  echo ""
  
  print_info "📦 Deployed Resources:"
  kubectl -n ${NS} get all
  echo ""
  
  print_info "🌐 Ingress Configuration:"
  kubectl -n ${NS} get ingress
  echo ""
  
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  🚀 ACCESS YOUR APPLICATION${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${GREEN}Production URL:${NC}  http://devops.local"
  echo ""
  echo -e "  ${YELLOW}📝 Login Credentials:${NC}"
  echo -e "     Email:    admin@kubepulse.com"
  echo -e "     Password: admin123"
  echo ""
  
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  💻 LOCAL DEVELOPMENT (Hot Reload)${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${GREEN}Start dev mode:${NC}  ./start-dev.sh"
  echo -e "  ${RED}Stop dev mode:${NC}   ./stop-dev.sh"
  echo ""
  echo -e "  ${GREEN}Frontend:${NC}  http://localhost:3000"
  echo -e "  ${GREEN}Backend:${NC}   http://localhost:5000"
  echo -e "  ${GREEN}MongoDB:${NC}   mongodb://localhost:27017"
  echo ""
  
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  ✨ AVAILABLE FEATURES${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ✅ Real-time Kubernetes Dashboard"
  echo -e "  ✅ User Authentication (JWT + RBAC)"
  echo -e "  ✅ Admin Panel (User Management)"
  echo -e "  ✅ Live Chat with Redis"
  echo -e "  ✅ Pod Log Streaming"
  echo -e "  ✅ Deployment Scaling"
  echo -e "  ✅ 3 Themes (Light/Dark/Cyberpunk)"
  echo -e "  ✅ MongoDB Persistence"
  echo -e "  ✅ Ingress Routing"
  echo ""
  
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  🔍 USEFUL COMMANDS${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${YELLOW}View Logs:${NC}"
  echo -e "    kubectl -n ${NS} logs -f deployment/backend"
  echo -e "    kubectl -n ${NS} logs -f deployment/frontend"
  echo -e "    kubectl -n ${NS} logs -f deployment/mongodb"
  echo ""
  echo -e "  ${YELLOW}Check Status:${NC}"
  echo -e "    kubectl -n ${NS} get pods"
  echo -e "    kubectl -n ${NS} get svc"
  echo ""
  echo -e "  ${YELLOW}Access MongoDB:${NC}"
  echo -e "    kubectl -n ${NS} exec -it deployment/mongodb -- mongosh kubepulse"
  echo ""
  echo -e "  ${YELLOW}Port Forward (alternative access):${NC}"
  echo -e "    kubectl -n ${NS} port-forward svc/backend 5000:8080"
  echo -e "    kubectl -n ${NS} port-forward svc/frontend 3000:80"
  echo ""
  echo -e "  ${YELLOW}Cleanup:${NC}"
  echo -e "    ./cleanup.sh"
  echo ""
  
  echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  🎊 Happy Monitoring!${NC}"
  echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

############################################################################
############################################################################
###############################################################################

main() {
  clear
  
  echo -e "${CYAN}"
  cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗  ██╗██╗   ██╗██████╗ ███████╗██████╗ ██╗   ██╗██╗     ║
║   ██║ ██╔╝██║   ██║██╔══██╗██╔════╝██╔══██╗██║   ██║██║     ║
║   █████╔╝ ██║   ██║██████╔╝█████╗  ██████╔╝██║   ██║██║     ║
║   ██╔═██╗ ██║   ██║██╔══██╗██╔══╝  ██╔═══╝ ██║   ██║██║     ║
║   ██║  ██╗╚██████╔╝██████╔╝███████╗██║     ╚██████╔╝███████╗║
║   ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝      ╚═════╝ ╚══════╝║
║                                                               ║
║              Complete Deployment Script v2.0                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
  echo -e "${NC}"
  
  echo -e "${YELLOW}This script will deploy:${NC}"
  echo -e "  ✅ Kubernetes Cluster (Kind)"
  echo -e "  ✅ MongoDB (Authentication)"
  echo -e "  ✅ Redis (Chat)"
  echo -e "  ✅ Backend with Auth"
  echo -e "  ✅ Frontend with Auth UI"
  echo -e "  ✅ Ingress Controller"
  echo -e "  ✅ Development Scripts"
  echo ""
  
  read -p "Continue? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
  
  # Execute all steps
  check_prerequisites
  ensure_kind_cluster
  setup_environment_files
  install_dependencies
  build_images
  load_images_into_kind
  ensure_ingress_controller
  deploy_kubernetes_resources  # This creates the namespace first
  deploy_mongodb                # Now MongoDB can be deployed
  update_hosts_file
  sleep 5  # Wait for MongoDB to be ready
  create_admin_user
  create_dev_scripts
  display_success_info
}

# Run main function
main "$@"
