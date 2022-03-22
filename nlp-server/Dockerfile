FROM python:3.10.2-alpine

# INSTALL REQUIREMENTS
RUN apk add git

# INSTALL GROBID CLIENT FROM GIT
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
WORKDIR nlp
RUN export PYTHON_PATH=/nlp-server/nlp
CMD python3 nlp/app.py