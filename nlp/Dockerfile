FROM python:3.10.2-alpine

# INSTALL REQUIREMENTS
RUN apk add git

# INSTALL GROBID CLIENT FROM GIT
# TODO: fix copy submodule from frameworks
RUN git clone https://github.com/kermitt2/grobid_client_python
WORKDIR grobid_client_python
RUN python3 setup.py install

# COPY SERVER CODE
WORKDIR /
ADD . /nlp-server/

# INSTALL REQUIREMENTS
WORKDIR nlp-server
RUN python3 -m pip install -r requirements.txt

# RUN SERVER
WORKDIR src
RUN export PYTHON_PATH=/nlp-server/src
CMD python3 app.py