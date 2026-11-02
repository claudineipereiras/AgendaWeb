<?php
declare(strict_types=1);

/**
 * Root Router Helper
 * If the entire repository is deployed to Hostinger public_html/, this redirects
 * or forwards traffic cleanly to Application/.
 */

if (file_exists(__DIR__ . '/Application/index.html')) {
    header('Location: Application/index.html', true, 302);
    exit;
}

http_response_code(404);
echo "AgendaWeb: Application directory not found.";
