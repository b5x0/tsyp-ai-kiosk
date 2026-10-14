FROM python:3.11-slim

ENV PYTHONUNBUFFERED=True \
    PORT=8080 \
    APP_HOME=/app

WORKDIR $APP_HOME

# Install production dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application assets and code
COPY . ./

# Run web service on container startup using gunicorn
CMD exec gunicorn --bind :$PORT --workers 2 --threads 8 --timeout 0 app:app
