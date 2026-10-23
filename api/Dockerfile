# syntax=docker/dockerfile:1

# ---------- Stage 1: builder (installs Python libraries) ----------
FROM python:3.12-slim-trixie AS builder
WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---------- Stage 2: runtime (only what the app needs) ----------
FROM python:3.12-slim-trixie
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"
WORKDIR /app
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --no-create-home app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=app:app app.py .
USER 10001:10001
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:5000/health').status == 200 else 1)"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "app:app"]
