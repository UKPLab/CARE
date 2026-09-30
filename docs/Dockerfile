FROM sphinxdoc/sphinx:8.2.3
ARG ENV
ENV ENV=${ENV}

RUN apt-get update && \
    apt-get install -y --no-install-recommends nodejs npm && \
    npm install -g jsdoc && \
    pip install sphinx-rtd-theme sphinx-js && \
    rm -rf /var/lib/apt/lists/*
