FROM python:3.10.2-alpine

#ARG env=.env

# INSTALL REQUIREMENTS
RUN apk add git gcc

# INSTALL GROBID CLIENT FROM GIT
ADD frameworks/grobid_client_python /grobid_client_python
WORKDIR grobid_client_python
RUN python3 setup.py install

# COPY SERVER CODE
# ASSUMING ENTRYPOINT: ../nlp
WORKDIR /
ADD nlp /nlp-server
#ADD ./$env /nlp-server/$env

# INSTALL REQUIREMENTS
WORKDIR nlp-server
RUN python3 -m pip install -r requirements.txt

# RUN SERVER
WORKDIR src
RUN export PYTHON_PATH=/nlp-server/src
CMD python3 app.py