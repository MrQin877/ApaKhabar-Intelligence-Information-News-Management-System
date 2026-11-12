FROM php:8.4-fpm-bookworm AS app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libpng-dev libjpeg62-turbo-dev libwebp-dev libzip-dev \
    unzip git libicu-dev libssl-dev pkg-config libonig-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install pdo_mysql pcntl gd zip intl bcmath mbstring \
    && pecl install mongodb-2.2.0 && docker-php-ext-enable mongodb \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && printf 'max_execution_time=1300\nmemory_limit=512M\nupload_max_filesize=110M\npost_max_size=120M\n' > /usr/local/etc/php/conf.d/apakhabar.ini \
    && printf '[www]\nrequest_terminate_timeout = 1350s\n' > /usr/local/etc/php-fpm.d/zz-apakhabar.conf

WORKDIR /var/www/html
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --prefer-dist --no-interaction
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN mkdir -p bootstrap/cache storage/app/public storage/app/private storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs \
    && composer dump-autoload --no-dev --no-scripts --optimize \
    && php artisan package:discover --ansi \
    && npm run build \
    && rm -rf node_modules \
    && mkdir -p storage/app/public storage/app/private storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs \
    && ln -sfn ../storage/app/public public/storage \
    && chown -R www-data:www-data storage bootstrap/cache

CMD ["php-fpm"]

FROM nginx:1.27-alpine AS web
COPY deployment/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=app /var/www/html/public /var/www/html/public
