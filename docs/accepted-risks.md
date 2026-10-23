# Accepted risks

Vulnerabilities that are known, assessed and temporarily accepted. Each one has an owner, a reason, a tracking ticket and an expiry date. After the expiry date Trivy reports it again and the build gate fails.

## gunicorn 21.2.0 (API image)

| Field | Value |
|---|---|
| Image | `brewcart-api` |
| Package | `gunicorn==21.2.0` (pinned in `api/requirements.txt`) |
| Findings | CVE-2024-1135 (HIGH, fixed in 22.0.0) and CVE-2024-6827 (HIGH, fixed in 23.0.0): HTTP request smuggling through malformed `Transfer-Encoding` headers |
| Found by | Trivy image scan during OPS-103 (Docker image hardening) |
| Owner | Neha Kapoor, Backend Developer (owns application dependencies) |
| Ticket | OPS-104: upgrade gunicorn to 23.x and re-test |
| Decision | Accepted temporarily. Upgrading an application dependency is a code change that needs the developer's testing, so it is out of scope for an image-hardening ticket. |
| Why the risk is acceptable for now | The API is not published to the host or the internet: it is reachable only on the internal Docker network, from the frontend. Request smuggling needs an attacker who can send crafted raw HTTP to gunicorn. |
| Expiry | 2026-11-22 (in `.trivyignore`). After this date the scan fails again. |
| Status | Raised with Neha on 2026-10-23 |

### Message sent to the owner

> Hi Neha, the Trivy scan on the hardened API image flags two HIGH CVEs in gunicorn 21.2.0 (CVE-2024-1135 and CVE-2024-6827, both request smuggling, fixed in 22.0.0 and 23.0.0). The image work for OPS-103 is done, so I haven't changed `requirements.txt`: the upgrade is your call and needs your testing. I've opened OPS-104 and recorded a temporary exception that expires on 22 Nov. Until then the API stays on the internal network only. Could you pick it up this sprint?
