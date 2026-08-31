FROM linkedin-profile-enhancer-api:latest

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       xvfb \
       x11vnc \
       fluxbox \
    && rm -rf /var/lib/apt/lists/*

ENV DISPLAY=:99
ENV CHROME_HEADLESS=false

WORKDIR /app

CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x800x24 & fluxbox >/tmp/fluxbox.log 2>&1 & x11vnc -display :99 -forever -shared -nopw -listen 0.0.0.0 -rfbport 5900 >/tmp/x11vnc.log 2>&1 & npm run chrome:login"]