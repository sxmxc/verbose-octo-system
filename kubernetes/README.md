# Kubernetes Manifests

These manifests provide a baseline deployment of the toolbox stack on Kubernetes. They mirror the services defined in `docker-compose.yml` and assume container images have been built and published to a registry that your cluster can pull from.

## Contents

- `namespace.yaml` – creates the `sre-toolbox` namespace used by the other resources.
- `configmap.yaml` – non-sensitive shared configuration values consumed by the API and worker.
- `secrets.yaml` – placeholder secrets for database credentials, application secrets, and Vault tokens/keys.
- `config-files.yaml` – configuration files (such as `auth-providers.json` and Vault HCL/entrypoint) packaged as ConfigMaps.
- `persistentvolumeclaims.yaml` – persistent volumes for shared application data.
- `postgres.yaml` – StatefulSet and Service for PostgreSQL.
- `redis.yaml` – Deployment and Service for Redis.
- `vault.yaml` – StatefulSet and Service for HashiCorp Vault.
- `api.yaml` – Deployment and Service for the FastAPI backend.
- `worker.yaml` – Deployment for the Celery worker process.
- `frontend.yaml` – Deployment and Service for the Vite development server that serves the UI.

## Usage

1. Build and push the backend and frontend images referenced in the manifests to a registry accessible by the cluster. Update the `image` fields in `api.yaml`, `worker.yaml`, and `frontend.yaml` to match your registry paths.
2. Review `secrets.yaml` and replace the placeholder values with credentials appropriate for your environment. For sensitive values, consider using your platform's secret management tool instead of committing them to source control.
3. (Optional) Update `configmap.yaml` to match your Vault deployment requirements or other runtime settings.
4. Apply the manifests in order, starting with the namespace and configuration:

   ```bash
   kubectl apply -f kubernetes/namespace.yaml
   kubectl apply -f kubernetes/configmap.yaml
   kubectl apply -f kubernetes/secrets.yaml
   kubectl apply -f kubernetes/config-files.yaml
   kubectl apply -f kubernetes/persistentvolumeclaims.yaml
   kubectl apply -f kubernetes/postgres.yaml
   kubectl apply -f kubernetes/redis.yaml
   kubectl apply -f kubernetes/vault.yaml
   kubectl apply -f kubernetes/api.yaml
   kubectl apply -f kubernetes/worker.yaml
   kubectl apply -f kubernetes/frontend.yaml
   ```

5. Configure ingress or port-forwarding as needed to expose the frontend and API outside the cluster.

## Notes

- The shared `toolbox-shared-data` PersistentVolumeClaim requires a storage class that supports the `ReadWriteMany` access mode. Adjust the manifests to match your cluster's storage offerings if necessary.
- The Vault StatefulSet references an init script and configuration packaged in `config-files.yaml`. You must still initialize and unseal Vault (or configure auto-unseal) before the rest of the stack can use it.
- The provided `auth-providers.json` configuration is the example bundled with the repository. Update it to match your identity providers before using the stack in production.
- For production workloads you may want to replace the frontend Deployment with a static asset build served by a more production-ready web server.
