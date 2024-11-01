FROM python:3.9-slim-buster

WORKDIR /app

# requirements don't change often so put them up top
COPY requirements.txt /app/requirements.txt

RUN pip install -r requirements.txt --no-cache-dir

COPY . /app

CMD [ "python", "app.py" ]