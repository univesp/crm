FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY tools/knowledge-studio/package.json ./
RUN npm install --omit=dev

COPY tools/knowledge-studio/server ./server
COPY tools/knowledge-studio/public ./public
COPY ops/knowledge-ingest /pipeline

RUN pip3 install --no-cache-dir -r /pipeline/requirements.txt --break-system-packages

ENV PORT=8090
ENV DATA_DIR=/data
ENV PIPELINE_PATH=/pipeline/pipeline.py

VOLUME ["/data"]

EXPOSE 8090

CMD ["node", "server/index.js"]
