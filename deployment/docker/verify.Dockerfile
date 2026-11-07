# Build-only verification of the existing local images. No services are started.
FROM apakhabar-docker-app:latest AS php-check
RUN composer check-platform-reqs --no-dev \
    && php --version \
    && php-fpm -t \
    && ffmpeg -version \
    && ffprobe -version \
    && test -s public/build/manifest.json \
    && test -d resources/js/routes \
    && test ! -f .env \
    && test ! -f deployment/laravel.env \
    && touch /tmp/php-verified

FROM apakhabar-docker-ai:latest AS python-check
RUN pip check \
    && python -c "import fastapi, chromadb, langgraph, fitz, openpyxl, docx; from app.main import app; print('FastAPI and runtime imports passed')" \
    && tesseract --list-langs \
    && test ! -f /app/.env \
    && touch /tmp/python-verified

FROM apakhabar-docker-web:latest AS web-check
RUN nginx -v \
    && test -s /var/www/html/public/build/manifest.json \
    && test -L /var/www/html/public/storage \
    && touch /tmp/web-verified

FROM scratch AS verified
COPY --from=php-check /tmp/php-verified /
COPY --from=python-check /tmp/python-verified /
COPY --from=web-check /tmp/web-verified /
