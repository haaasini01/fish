# Kubernetes Deployment for FishChain

This folder contains Kubernetes manifests for deploying the FishChain backend and frontend.

## Files

- `namespace.yaml` — creates the `fishchain` namespace
- `backend-configmap.yaml` — backend configuration values for contract addresses and RPC URL
- `backend-secret.yaml` — backend secret for `PRIVATE_KEY`
- `backend-deployment.yaml` — backend deployment manifest
- `backend-service.yaml` — backend service manifest
- `frontend-deployment.yaml` — frontend deployment manifest
- `frontend-service.yaml` — frontend service manifest
- `ingress.yaml` — optional ingress routing for frontend and backend

## Prerequisites

- Kubernetes cluster (Minikube, kind, AKS, EKS, GKE, etc.)
- `kubectl` configured to target the cluster
- Optional ingress controller installed for `ingress.yaml` (for example, NGINX Ingress)

## Build and push images

Replace these example image names with your registry values if needed.

```bash
docker build -t fish-backend:latest ./backend
docker build -t fish-frontend:latest ./Frontend
```

If you use a remote registry:

```bash
docker tag fish-backend:latest my-registry.example.com/fish-backend:latest
docker tag fish-frontend:latest my-registry.example.com/fish-frontend:latest
docker push my-registry.example.com/fish-backend:latest
docker push my-registry.example.com/fish-frontend:latest
```

Update image names in `backend-deployment.yaml` and `frontend-deployment.yaml` if you publish to a registry.

## Apply manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/backend-configmap.yaml
kubectl apply -f k8s/backend-secret.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/ingress.yaml
```

## Accessing the services

- Backend: `http://<cluster-ip>:8080` or via ingress path `/api`
- Frontend: `http://<cluster-ip>` or via ingress host

### Ingress host example

If you use `ingress.yaml` with `fishchain.local`, add this entry to your local `/etc/hosts` file (or Windows `C:\Windows\System32\drivers\etc\hosts`):

```text
127.0.0.1 fishchain.local
```

Then visit:

- `http://fishchain.local/` for the frontend
- `http://fishchain.local/api/test` to verify backend connectivity