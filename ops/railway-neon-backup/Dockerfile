FROM postgres:18-bookworm
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates python3 python3-venv \
 && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir 'boto3>=1.35,<2'
ENV PATH="/opt/venv/bin:$PATH"
WORKDIR /recovery
COPY recovery.sh upload.py restore-staging.py ./
RUN chmod 0755 /recovery/recovery.sh
USER postgres
ENTRYPOINT ["/bin/bash", "/recovery/recovery.sh"]
