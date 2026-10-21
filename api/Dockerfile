# Neha's Dockerfile. It works. Please don't ship it.
FROM python:3.12
WORKDIR /app
COPY . .
RUN apt-get update && apt-get install -y build-essential curl vim git
RUN pip install -r requirements.txt
EXPOSE 5000
CMD python app.py
