# Deploy Yogi's Depot

Pushes to `main` that change `frontend/` or `backend/` run GitHub Actions:

1. Typecheck, test, and build both apps.
2. Copy the API build and the storefront build to the machine.
3. Install production API dependencies, restart the API, and reload nginx.

Pull requests run the checks and do not deploy. You can also start a deploy from the Actions tab with **Run workflow**.

The storefront is static files. Nginx serves them and proxies `/api`, `/uploads`, and `/health` to the API on port 5000, so the frontend can keep using `VITE_API_URL=/api/v1`.

## One-time machine setup

On the Linux machine:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin deploy || true
sudo mkdir -p /opt/yogisdepot/backend/uploads /opt/yogisdepot/frontend/dist
sudo chown -R deploy:deploy /opt/yogisdepot
```

Install Node.js 20+ and nginx. Create `/opt/yogisdepot/backend/.env` from `backend/.env.example` with production values:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=...
JWT_SECRET=...
CLIENT_URL=https://your-domain
COOKIE_SECURE=true
STORAGE_DRIVER=local
UPLOAD_DIR=uploads
```

Install the service and site config. Change `User=`, `Group=`, and paths in the unit file if you do not use `/opt/yogisdepot` or the `deploy` user. Point `ExecStart` at the real `node` binary (`command -v node`).

```bash
sudo cp deploy/systemd/yogisdepot-api.service /etc/systemd/system/yogisdepot-api.service
sudo systemctl daemon-reload
sudo systemctl enable yogisdepot-api

sudo cp deploy/nginx/yogisdepot.conf /etc/nginx/sites-available/yogisdepot.conf
sudo ln -sfn /etc/nginx/sites-available/yogisdepot.conf /etc/nginx/sites-enabled/yogisdepot.conf
sudo nginx -t && sudo systemctl reload nginx
```

Allow the GitHub Actions SSH user to restart the app without a password. Replace `deploy` if the SSH user is different:

```text
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart yogisdepot-api, /usr/bin/systemctl cat yogisdepot-api, /usr/sbin/nginx -t, /usr/bin/systemctl reload nginx
```

Confirm the paths with `command -v systemctl` and `command -v nginx`.

Create an SSH key for Actions, install the public key in that user's `authorized_keys`, and keep the private key for the secret below.

## GitHub settings

Repository secrets:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | Machine hostname or IP |
| `DEPLOY_USER` | SSH user that owns `/opt/yogisdepot` |
| `DEPLOY_SSH_KEY` | Private key, including the `BEGIN` / `END` lines |
| `DEPLOY_PORT` | Optional. SSH port, default `22` |
| `DEPLOY_KNOWN_HOSTS` | Optional. Output of `ssh-keyscan -H your-host` |

Repository variables (optional):

| Variable | Value |
|---|---|
| `DEPLOY_PATH` | Defaults to `/opt/yogisdepot` |
| `VITE_API_URL` | Defaults to `/api/v1` when unset |
| `APP_URL` | Public site URL, shown on the production environment |

Put the secrets on a GitHub Environment named `production` if you want a manual approval before each deploy. The workflow uses that environment.

The deploy does not overwrite `backend/.env` or `backend/uploads/`.
