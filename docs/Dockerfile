FROM sphinxdoc/sphinx:5.3.0
ARG ENV
ENV ENV=${ENV}

RUN apt-get update && \
    apt-get install -y nodejs npm && \
    npm install -g jsdoc && \
    pip install sphinx-rtd-theme sphinx-js && \
    rm -rf /var/lib/apt/lists/*
