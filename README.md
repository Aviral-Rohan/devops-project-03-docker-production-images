# Project 03: Production-Ready Docker Images

**Real-World DevOps Projects** · Part 3 of 20 · Rohan Aviral

> **Ticket OPS-103 from Arjun (Senior DevOps).** Neha's Dockerfiles work, but the images are huge, run as root, have no health check and ship the Flask dev server. Make both BrewCart images production-ready: small, non-root, health-checked, linted and scanned. Show before/after numbers.

This repo is **BrewCart**, a small coffee-ordering app (Flask menu API + Express frontend). Neha's original Dockerfiles are in the first commit. Everything after that is the hardening work: multi-stage builds on slim pinned bases, non-root users, health checks, a real WSGI server, Dockerfile linting in a pre-commit hook, and a Trivy vulnerability gate with a documented accepted risk.

📄 Full step-by-step write-up with screenshots: **[Project_03_Docker_Production_Images.pdf](https://github.com/Aviral-Rohan/devops-project-03-docker-production-images/releases/download/v1.0.0/Project_03_Docker_Production_Images.pdf)** (attached to the v1.0.0 release)
🏷️ Release: [v1.0.0: Production-ready images](https://github.com/Aviral-Rohan/devops-project-03-docker-production-images/releases/tag/v1.0.0)
⬅️ Previous: [Project 02, Git Team Workflow](https://github.com/Aviral-Rohan/devops-project-02-git-team-workflow) · ➡️ Next: Project 04

---

## In plain words

A Docker image is a **shipping box** that holds the app and everything it needs to run. Neha's boxes worked, but:

- **They were packed with the whole workshop.** Compilers, `git`, `vim` and the full operating system went into the box, so each one weighed about 1.7 GB. I now build in one box and ship only the finished product in a second, small box (a *multi-stage build*). The API box went from **1.73 GB to 204 MB**.
- **The app ran as the building's owner** (*root*). If someone broke in, they had the master key. Now it runs as an ordinary user with no special rights.
- **Nobody checked whether the app was alive.** Each box now has a *health check*: Docker asks the app "are you OK?" every 30 seconds.
- **The API used a practice engine** (the Flask development server). It now uses **gunicorn**, a server built for real traffic.
- **A spell-checker reads every Dockerfile** (*hadolint*) before I can commit it.
- **A security scanner inspects every finished box** (*Trivy*) and refuses to pass it if it finds a serious, fixable problem. One problem belonged to the developer's code, not to the box, so I recorded it with an owner and an expiry date instead of silently ignoring it.

## Results: before and after

| | API before | API after | Frontend before | Frontend after |
|---|---|---|---|---|
| Base image | `python:3.12` (full) | `python:3.12-slim-trixie` | `node:22` (full) | `node:22-trixie-slim` |
| Image size on disk | 1.73 GB | **204 MB** (−88%) | 1.66 GB | **337 MB** (−80%) |
| Content size (compressed layers) | 450 MB | **49.3 MB** (−89%) | 416 MB | **82.3 MB** (−80%) |
| Cold build | 2 min 39 s | **43 s** | 2 min 12 s | **31 s** |
| Rebuild after a code change | full reinstall | **4.2 s** (dependency layer cached) | full reinstall | dependency layer cached |
| Runs as | root | **uid 10001** (`app`) | root | **uid 1000** (`node`) |
| Health check | none | **healthy** (`/health`) | none | **healthy** (`/health`) |
| Server / packages | Flask dev server | **gunicorn, 2 workers** | 157 packages (dev deps included) | **71 packages** (`--omit=dev`) |
| hadolint findings | 5 | **0** | 1 | **0** |
| Trivy HIGH/CRITICAL | 511 OS + 2 app | 44 OS (all unfixed upstream) + 2 app (accepted, see below) | 647 OS | 43 OS (all unfixed upstream) |
| Trivy gate (`--ignore-unfixed --exit-code 1`) | — | **exit 0** | — | **exit 0** |

Two size columns because Docker Desktop shows both: *disk usage* is the unpacked image on disk, *content size* is what is pulled over the network.

## What's inside

```
devops-project-03-docker-production-images/
├── api/
│   ├── Dockerfile            # multi-stage: venv builder → slim runtime, uid 10001, gunicorn, healthcheck
│   ├── .dockerignore
│   ├── app.py                # Flask menu API (port 5000)
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile            # multi-stage: npm ci --omit=dev → slim runtime, no npm, uid 1000, healthcheck
│   ├── .dockerignore
│   ├── package.json / package-lock.json
│   └── server.js             # Express frontend (port 3000)
├── .pre-commit-config.yaml   # whitespace, YAML, large files, private keys + pinned hadolint
├── .trivyignore              # 2 accepted CVEs, each with an expiry date
└── docs/
    ├── accepted-risks.md     # owner, ticket, reason and expiry for each accepted CVE
    ├── docker-cheatsheet.md  # every command used in this project, explained
    └── screenshots/          # evidence, in order
```

## What changed in the API Dockerfile

| Neha's version | Problem | New version |
|---|---|---|
| `FROM python:3.12` | Full Debian image with compilers: ~1 GB before the app is added | `python:3.12-slim-trixie`, pinned to Debian 13 |
| `COPY . .` then `pip install` | Any code change invalidates the cache and reinstalls every package | Copy `requirements.txt` first, install, then copy `app.py` |
| `apt-get install build-essential curl vim git` | Tools nobody needs at runtime, each with its own CVEs | Removed. Dependencies install into `/opt/venv` in a **builder** stage; only the venv is copied to the final stage |
| (no user) | Runs as root | `groupadd/useradd` with a fixed **numeric** UID/GID 10001, `USER 10001:10001` |
| `CMD python app.py` | Flask dev server, shell form (signals don't reach Python) | `CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]` in exec form |
| (no health check) | Docker can't tell a hung app from a running one | `HEALTHCHECK` with Python's `urllib`, so no `curl` is needed in the image |
| (no `.dockerignore`) | `__pycache__`, venvs and `.env` can leak into the image | `.dockerignore` |

`PYTHONDONTWRITEBYTECODE=1` stops `.pyc` files being written at runtime and `PYTHONUNBUFFERED=1` sends logs straight to `docker logs`.

## What changed in the frontend Dockerfile

| Neha's version | Problem | New version |
|---|---|---|
| `FROM node:22` | Full image, ~1.1 GB | `node:22-trixie-slim` |
| `COPY . .` then `npm install` | Cache busted on every change; dev dependencies (eslint, nodemon) installed; lockfile not enforced | `COPY package.json package-lock.json` then `npm ci --omit=dev && npm cache clean --force` in a **deps** stage |
| `CMD npm start` | npm sits between Docker and Node and swallows `SIGTERM` | `CMD ["node", "server.js"]` |
| runs as root | | `USER 1000:1000` (the image's built-in `node` user), files copied with `--chown=node:node` |
| (no health check) | | `HEALTHCHECK` with Node 22's built-in `fetch` |
| npm and corepack in the final image | The app never calls npm, but npm's bundled packages carried 11 HIGH CVEs | Removed in the runtime stage (see the twist below) |

## Linting: hadolint in a pre-commit hook

Before: the API Dockerfile had 5 findings (DL3008 unpinned apt packages, DL3009 apt lists not deleted, DL3015 recommended packages installed, DL3042 pip cache kept, DL3025 shell-form CMD); the frontend had 1 (DL3025).

The official hadolint pre-commit hook pulls `hadolint:latest`, which was newer (2.15.1) than the version I'd tested with and flagged two more rules:

- **DL3066**: `USER app` by name. Kubernetes `runAsNonRoot` can only verify a numeric UID, so I switched to `USER 10001:10001` / `USER 1000:1000`.
- **DL3025** on `HEALTHCHECK`: switched to JSON (exec) form.

Then I replaced the upstream hook with a **local hook pinned to `ghcr.io/hadolint/hadolint:v2.15.1`**, so the lint result can't change on its own when a new version is published. Both Dockerfiles now pass with zero findings.

## Scanning: Trivy gate and the twist

Trivy 0.76.1, run from its Docker image, scanning for HIGH and CRITICAL with `--ignore-unfixed --exit-code 1`. That way the build fails only on problems someone can actually fix today.

- **OS packages.** About 44 HIGH CVEs remain in each Debian 13 base, all marked *affected* or *fix_deferred* by Debian: no patched package exists yet. `--ignore-unfixed` skips them, and the next base-image rebuild picks up fixes as Debian releases them.
- **The twist, part 1: gunicorn.** The API's `requirements.txt` pins `gunicorn==21.2.0`, which has two HIGH request-smuggling CVEs (CVE-2024-1135, fixed in 22.0.0; CVE-2024-6827, fixed in 23.0.0). Upgrading an application dependency is Neha's change to make and test, not part of an image ticket. So instead of bumping it myself or hiding it, I:
  1. opened **OPS-104** for Neha and messaged her,
  2. added both CVEs to `.trivyignore` with **`exp:2026-11-22`**, so the gate fails again automatically if nobody fixes it,
  3. recorded owner, reason and expiry in [`docs/accepted-risks.md`](docs/accepted-risks.md). The risk is low for now because the API is only reachable on the internal Docker network.
- **The twist, part 2: npm.** The frontend gate still failed (exit 1) with 11 HIGH CVEs, all inside **npm's own bundled packages** (brace-expansion, ip-address, pacote, picomatch, sigstore). The app runs with `node server.js` and never calls npm at runtime, so I deleted npm, npx and corepack from the final stage. The gate passed (exit 0), and both containers are still healthy.

  The image size did **not** change (still 337 MB / 82.3 MB). Deleting files in a later layer hides them from the final filesystem, which is what Trivy scans, but the lower layer from the base image still holds the bytes. Shrinking it would need a base without npm, such as a distroless Node image.

## Problems I hit

| Problem | Cause | Fix |
|---|---|---|
| `curl localhost:5000` answered by something else | macOS AirPlay Receiver listens on port 5000 | Published the API on host port **5050** for testing |
| `.pre-commit-config.yaml` not picked up | VS Code had only a subfolder open, so the file was created in the wrong place | Reopened the repo root with `open -a "Visual Studio Code" .` |
| `Lint Dockerfiles....Failed` (DL3066, DL3025) | Upstream hook pulls `hadolint:latest` (2.15.1), stricter than my test run | Numeric UIDs, JSON-form healthchecks, hook pinned to `v2.15.1` |
| `yaml: did not find expected '-'` | `- repo: local` indented 4 spaces instead of 2, image tag missing the `v` | Fixed indentation and tag |
| `Conflict. The container name "/web" is already in use` | Ran `docker run --name web` a second time; the first run had already worked | `docker rm -f web` before re-running |
| Frontend Trivy gate exit 1 | CVEs in npm's bundled dependencies | Removed npm/corepack from the runtime stage |

## What I learned

- Order Dockerfile steps from least to most frequently changed: dependencies first, code last. That one change made API rebuilds take 4 seconds.
- Multi-stage builds keep compilers and package managers out of what you ship.
- Use numeric UIDs so orchestrators can prove the container is non-root.
- Exec-form `CMD` and `HEALTHCHECK` let signals and health probes reach the real process.
- Pin your tools (hadolint `v2.15.1`), not only your base images, or the lint result can change under you.
- A vulnerability gate needs a policy: fail on fixable issues, accept the rest **with an owner and an expiry**, never silently.
- Deleting files in a later layer removes them from scans but not from the image size.

**Next steps:** pin the Trivy image to `aquasec/trivy:0.76.1` instead of `latest`, and run hadolint and Trivy in CI as well as locally.

## Run it

```bash
docker build -t brewcart-api:after ./api
docker build -t brewcart-web:after ./frontend
docker network create brewcart
docker run -d --name api --network brewcart brewcart-api:after
docker run -d --name web --network brewcart -e API_URL=http://api:5000 -p 3000:3000 brewcart-web:after
curl localhost:3000        # BrewCart menu
docker ps                  # both (healthy)
```

## License

MIT. BrewCart and the team members named here are fictional, for training.
