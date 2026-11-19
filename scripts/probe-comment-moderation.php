<?php

// Comment moderation is handled by admins; this command makes no API requests.
fwrite(STDOUT, "OpenAI comment moderation has been removed. Comments publish immediately; admins can review reports and hide or remove comments.\n");
