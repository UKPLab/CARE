# syntax=docker/dockerfile:1
FROM python:3.10-slim-bullseye

WORKDIR /usr/src/app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8083

CMD [ "python", "./main.py"]
