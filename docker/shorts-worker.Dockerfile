FROM php:8.4-cli
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libpng-dev libjpeg62-turbo-dev libwebp-dev libzip-dev unzip git libicu-dev libssl-dev pkg-config libonig-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install pdo_mysql pcntl gd zip intl bcmath mbstring \
    && pecl install mongodb-2.2.0 && docker-php-ext-enable mongodb \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --prefer-dist --no-interaction
COPY app ./app
COPY bootstrap/app.php bootstrap/providers.php ./bootstrap/
COPY config ./config
COPY database ./database
COPY routes ./routes
COPY resources/views ./resources/views
COPY artisan ./artisan
RUN mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs \
    && composer dump-autoload --no-dev --no-scripts --optimize \
    && php artisan package:discover --ansi
CMD ["php", "artisan", "queue:work", "--queue=video-publishing", "--tries=1", "--timeout=90"]
