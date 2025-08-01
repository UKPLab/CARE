# syntax=docker/dockerfile:1
FROM python:3.10-slim-bullseye

WORKDIR /usr/src/app

# Install requirements
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Expose port
EXPOSE 3005

CMD [ "python", "./main.py"]
