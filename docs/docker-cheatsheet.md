# Docker cheat sheet (Project 03)

Every command used in this project, with what each part does.

## Build and inspect images

| Command | What it does |
|---|---|
| `docker build -t brewcart-api:before ./api` | Build an image from `./api/Dockerfile`. `-t name:tag` names it; `./api` is the *build context* (the files Docker can `COPY`). |
| `time docker build ...` | Same, and prints how long the build took (cold build vs cached rebuild). |
| `docker build --no-cache ...` | Ignore cached layers and rebuild every step. |
| `docker image ls brewcart-*` | List images and sizes. Docker Desktop shows *disk usage* (unpacked) and *content size* (compressed, what gets pulled). |
| `docker history brewcart-api:before` | Show each layer and how big it is: finds what is making an image heavy. |
| `docker run --rm brewcart-web:after sh -c "ls node_modules \| wc -l"` | Start a throwaway container (`--rm` deletes it after), run one command, print the result. |

## Run and check containers

| Command | What it does |
|---|---|
| `docker network create brewcart` | A private network. Containers on it reach each other **by name** (`http://api:5000`). |
| `docker run -d --name api --network brewcart brewcart-api:after` | Run in the background (`-d`), named `api`, on that network. No `-p`, so it is not reachable from the host. |
| `docker run -d --name web --network brewcart -e API_URL=http://api:5000 -p 3000:3000 brewcart-web:after` | `-e` sets an environment variable; `-p host:container` publishes a port. |
| `docker run -d -p 5050:5000 ...` | On macOS, port 5000 is used by AirPlay Receiver, so map a different host port. |
| `docker ps` | Running containers. The STATUS column shows `(healthy)` / `(unhealthy)` once a `HEALTHCHECK` exists. |
| `docker exec api whoami` / `docker exec api id` | Run a command inside a running container: proves which user the app runs as. |
| `docker inspect --format '{{.State.Health.Status}}' api` | Just the health status. |
| `docker logs api` | The app's output (works because of `PYTHONUNBUFFERED=1`). |
| `docker rm -f api web` | Stop and delete containers (fixes `container name already in use`). |

## Dockerfile building blocks

| Instruction | Why it's used here |
|---|---|
| `FROM python:3.12-slim-trixie AS builder` | Named first stage. `slim` drops compilers and docs; `trixie` pins Debian 13. |
| `RUN python -m venv /opt/venv` + `ENV PATH=...` | Install packages into one folder that can be copied whole into the final stage. |
| `COPY requirements.txt .` before `COPY app.py .` | Layer caching: dependencies are reinstalled only when the requirements change. |
| `pip install --no-cache-dir` / `npm ci --omit=dev && npm cache clean --force` | No download caches in the image; `npm ci` installs exactly what the lockfile says; `--omit=dev` skips eslint/nodemon. |
| `COPY --from=builder /opt/venv /opt/venv` | Take only the result of the builder stage. |
| `COPY --chown=app:app app.py .` | Files owned by the app user, not root. |
| `RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --no-create-home app` | A system user with a fixed number. |
| `USER 10001:10001` | Run as that user. Numeric so Kubernetes `runAsNonRoot` can verify it (hadolint DL3066). |
| `HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD ["python", "-c", "..."]` | Docker probes `/health` every 30 s; 3 failures in a row = unhealthy. JSON form, no `curl` needed. |
| `CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]` | Exec (JSON) form: the app is PID 1 and receives `SIGTERM` on `docker stop`. |
| `.dockerignore` | Keeps `__pycache__`, `node_modules`, `.env` and venvs out of the build context. |

## Lint: hadolint

| Command | What it does |
|---|---|
| `docker run --rm -i hadolint/hadolint < api/Dockerfile` | Lint one Dockerfile; `-i` + `<` feeds the file in on stdin. |
| `pre-commit install` | Run the hooks in `.pre-commit-config.yaml` on every `git commit`. |
| `pre-commit run --all-files` | Run all hooks on every file now. |

Local hook, pinned so results don't change on their own:

```yaml
  - repo: local
    hooks:
      - id: hadolint
        name: Lint Dockerfiles (hadolint, pinned)
        language: docker_image
        entry: ghcr.io/hadolint/hadolint:v2.15.1 hadolint
        types: [dockerfile]
```

Rules met in this project: DL3008 (pin apt versions), DL3009 (delete apt lists), DL3015 (`--no-install-recommends`), DL3042 (`pip --no-cache-dir`), DL3025 (JSON form for CMD/HEALTHCHECK), DL3066 (numeric `USER`).

## Scan: Trivy

```bash
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$HOME/.cache/trivy:/root/.cache/" \
  -v "$PWD":/src \
  aquasec/trivy:0.76.1 image \
  --scanners vuln --severity HIGH,CRITICAL \
  --ignore-unfixed --ignorefile /src/.trivyignore \
  --exit-code 1 --quiet \
  brewcart-api:after; echo "exit code: $?"
```

| Part | What it does |
|---|---|
| `-v /var/run/docker.sock:...` | Lets Trivy (inside a container) read images from your local Docker. |
| `-v "$HOME/.cache/trivy:/root/.cache/"` | Keeps the vulnerability database between runs, so it isn't downloaded every time. |
| `-v "$PWD":/src` | Makes the repo, and its `.trivyignore`, visible inside the container. |
| `--scanners vuln` | Only vulnerabilities (skip secret scanning, which is slow on images). |
| `--severity HIGH,CRITICAL` | Ignore LOW/MEDIUM for the gate. |
| `--ignore-unfixed` | Skip CVEs with no fixed version yet: nothing to act on today. |
| `--ignorefile /src/.trivyignore` | Accepted CVEs, each with `exp:YYYY-MM-DD`; after that date they count again. |
| `--exit-code 1` | Exit 1 if anything is left: this is what makes it a *gate* in CI. |
| `echo "exit code: $?"` | Print the result: `0` = pass, `1` = fail. |

`.trivyignore` format:

```
# gunicorn 21.2.0 - owner: Neha - ticket OPS-104
CVE-2024-1135 exp:2026-11-22
CVE-2024-6827 exp:2026-11-22
```

## Cleanup

| Command | What it does |
|---|---|
| `docker rm -f api web && docker network rm brewcart` | Remove the test containers and network. |
| `docker image prune` | Delete dangling (untagged) images left by rebuilds. |
| `docker system df` | How much disk Docker is using. |
