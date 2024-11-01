FROM python:3.9-slim-buster

WORKDIR /app

COPY . /app

RUN pip install -r requirements.txt --no-cache-dir  

CMD [ "python", "app.py" ]