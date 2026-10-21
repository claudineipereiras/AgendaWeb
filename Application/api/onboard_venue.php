<?php
declare(strict_types=1);

/**
 * Public Venue Onboarding API Endpoint
 * Handles public venue self-service registration and live Schema.org testing.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$action = filter_input(INPUT_GET, 'action', FILTER_DEFAULT) ?? 'preview';

// 1. Live Schema.org / RSS Preview Test (Public)
if ($action === 'preview') {
    $targetUrl = filter_input(INPUT_GET, 'url', FILTER_VALIDATE_URL);
    if (!$targetUrl) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Please provide a valid HTTP/HTTPS URL']);
        exit;
    }

    $ctx = stream_context_create([
        'http' => [
            'timeout'    => 10,
            'user_agent' => 'AgendaWeb-Bot/1.0 (+https://agendaweb.app; Open Culture Broadcaster)'
        ]
    ]);

    $html = @file_get_contents($targetUrl, false, $ctx);
    if ($html === false) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Could not fetch website. Please ensure the URL is publicly reachable.']);
        exit;
    }

    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    @$dom->loadHTML($html);
    libxml_clear_errors();

    // Extract title
    $titleNode = $dom->getElementsByTagName('title')->item(0);
    $pageTitle = $titleNode ? trim($titleNode->nodeValue) : '';

    // Check RSS/Atom links
    $discoveredFeed = null;
    $xpath = new DOMXPath($dom);
    $rssLinks = $xpath->query('//link[@type="application/rss+xml" or @type="application/atom+xml"]');
    if ($rssLinks && $rssLinks->length > 0) {
        $feedHref = $rssLinks->item(0)->getAttribute('href');
        $discoveredFeed = (str_starts_with($feedHref, 'http')) ? $feedHref : rtrim($targetUrl, '/') . '/' . ltrim($feedHref, '/');
    }

    // Parse Schema.org JSON-LD
    $events = [];
    $detectedVenue = null;
    $detectedAddress = null;
    $detectedSuburb = null;
    $detectedState = null;
    $detectedPostcode = null;
    $scripts = $xpath->query('//script[@type="application/ld+json"]');

    foreach ($scripts as $s) {
        $json = json_decode(trim($s->nodeValue), true);
        if (!is_array($json)) continue;

        $nodes = isset($json['@graph']) ? $json['@graph'] : ($json[0] ? $json : [$json]);
        foreach ($nodes as $node) {
            $type = $node['@type'] ?? '';
            if (is_string($type) && (str_ends_with($type, 'Event') || $type === 'Event')) {
                if (empty($node['name']) || empty($node['startDate'])) continue;

                $start = date('Y-m-d H:i:s', strtotime($node['startDate']));
                if (strtotime($start) < time()) continue;

                $vName = $node['location']['name'] ?? null;
                if ($vName && !$detectedVenue) $detectedVenue = $vName;

                $locAddr = $node['location']['address'] ?? null;
                $vAddr = is_array($locAddr) ? ($locAddr['streetAddress'] ?? '') : ($locAddr ?? '');
                $suburb = is_array($locAddr) ? ($locAddr['addressLocality'] ?? '') : '';
                $postcode = is_array($locAddr) ? ($locAddr['postalCode'] ?? '') : '';
                $state = is_array($locAddr) ? ($locAddr['addressRegion'] ?? '') : '';

                if ($vAddr && !$detectedAddress) $detectedAddress = $vAddr;
                if ($suburb && !$detectedSuburb) $detectedSuburb = $suburb;
                if ($postcode && !$detectedPostcode) $detectedPostcode = $postcode;
                if ($state && !$detectedState) $detectedState = $state;

                // Detect age restriction
                $haystack = strtolower(($node['typicalAgeRange'] ?? '') . ' ' . ($node['name'] ?? '') . ' ' . ($node['description'] ?? ''));
                $ageTag = 'all_ages';
                if (str_contains($haystack, '18+') || str_contains($haystack, 'over 18') || str_contains($haystack, 'licensed')) {
                    $ageTag = '18+';
                } elseif (str_contains($haystack, 'kid') || str_contains($haystack, 'children') || str_contains($haystack, 'family') || str_contains($haystack, 'puppet') || str_contains($haystack, 'matinee')) {
                    $ageTag = 'kids_family';
                }

                $events[] = [
                    'title'      => trim($node['name']),
                    'start_time' => $start,
                    'category'   => str_replace('Event', '', $type) ?: 'Live Music',
                    'venue_name' => $vName,
                    'address'    => $vAddr,
                    'suburb'     => $suburb,
                    'age'        => $ageTag,
                    'ticket_url' => $node['offers']['url'] ?? $node['url'] ?? $targetUrl
                ];
            }
        }
    }

    $suggestedName = $detectedVenue ?: preg_replace('/(\s*[-|–]\s*.*)$/i', '', $pageTitle);
    $suggestedName = trim($suggestedName) ?: parse_url($targetUrl, PHP_URL_HOST);

    // Resolve city hub
    $detectedCitySlug = 'melbourne';
    $detectedCityName = 'Melbourne';
    $firstDigit = $detectedPostcode ? substr(trim($detectedPostcode), 0, 1) : '';
    if ($firstDigit === '2' || strtoupper((string)$detectedState) === 'NSW' || stripos($pageTitle, 'Sydney') !== false) {
        $detectedCitySlug = 'sydney';
        $detectedCityName = 'Sydney';
    } elseif ($firstDigit === '3' || strtoupper((string)$detectedState) === 'VIC' || stripos($pageTitle, 'Melbourne') !== false) {
        $detectedCitySlug = 'melbourne';
        $detectedCityName = 'Melbourne';
    } elseif ($firstDigit === '4' || strtoupper((string)$detectedState) === 'QLD' || stripos($pageTitle, 'Brisbane') !== false) {
        $detectedCitySlug = 'brisbane';
        $detectedCityName = 'Brisbane';
    } elseif ($firstDigit === '6' || strtoupper((string)$detectedState) === 'WA' || stripos($pageTitle, 'Perth') !== false) {
        $detectedCitySlug = 'perth';
        $detectedCityName = 'Perth';
    } elseif ($firstDigit === '5' || strtoupper((string)$detectedState) === 'SA' || stripos($pageTitle, 'Adelaide') !== false) {
        $detectedCitySlug = 'adelaide';
        $detectedCityName = 'Adelaide';
    } elseif ($firstDigit === '7' || strtoupper((string)$detectedState) === 'TAS' || stripos($pageTitle, 'Hobart') !== false) {
        $detectedCitySlug = 'hobart';
        $detectedCityName = 'Hobart';
    }

    echo json_encode([
        'status'         => 'success',
        'url'            => $targetUrl,
        'page_title'     => $pageTitle,
        'suggested_name' => $suggestedName,
        'feed_url'       => $discoveredFeed,
        'events_count'   => count($events),
        'venue'          => [
            'name'      => $suggestedName,
            'address'   => $detectedAddress ?: '',
            'suburb'    => $detectedSuburb ?: '',
            'state'     => $detectedState ?: '',
            'postcode'  => $detectedPostcode ?: '',
            'city_slug' => $detectedCitySlug,
            'city_name' => $detectedCityName
        ],
        'events'         => array_slice($events, 0, 6)
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. Submit Venue for Moderation & Broadcasting
if ($action === 'submit' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once __DIR__ . '/../src/Database.php';

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: $_POST;

    // Honeypot check
    if (!empty($data['website_hp'])) {
        http_response_code(200);
        echo json_encode(['status' => 'success', 'message' => 'Submission received']);
        exit;
    }

    $name      = trim((string)($data['name'] ?? ''));
    $url       = trim((string)($data['url'] ?? ''));
    $email     = trim((string)($data['contact_email'] ?? ''));
    $address   = trim((string)($data['address'] ?? ''));
    $suburb    = trim((string)($data['suburb'] ?? ''));
    $state     = trim((string)($data['state'] ?? 'VIC'));
    $postcode  = trim((string)($data['postcode'] ?? ''));
    $citySlug  = trim((string)($data['city_slug'] ?? 'melbourne'));
    $agePolicy = trim((string)($data['default_age_policy'] ?? 'mixed'));
    $feedUrl   = trim((string)($data['feed_url'] ?? ''));
    $polling   = trim((string)($data['polling_frequency'] ?? '24h'));

    if (!$name || !filter_var($url, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Valid venue name and events URL are required']);
        exit;
    }

    $slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower($name));
    $slug = trim($slug, '-') ?: ('venue-' . time());

    try {
        $pdo = \AgendaWeb\Database::getConnection();

        // Check if URL or slug already exists
        $chkStmt = $pdo->prepare("SELECT id, name, is_active FROM sources WHERE url = :url OR slug = :slug LIMIT 1");
        $chkStmt->execute(['url' => $url, 'slug' => $slug]);
        $existing = $chkStmt->fetch();

        if ($existing) {
            echo json_encode([
                'status'  => 'success',
                'message' => "Venue '$name' is already registered in our database! Our curator has it on file.",
                'id'      => (int)$existing['id']
            ]);
            exit;
        }

        // Insert into sources awaiting curator review (is_active = 0, last_status = 'pending')
        $stmt = $pdo->prepare("
            INSERT INTO sources (slug, name, type, url, category_tab, is_active, last_status, contact_email, submission_notes)
            VALUES (:slug, :name, 'scrape_event', :url, 'events', 0, 'pending', :email, :notes)
        ");
        $stmt->execute([
            'slug'  => $slug,
            'name'  => $name,
            'url'   => $url,
            'email' => $email ?: null,
            'notes' => "Self-service onboarding request. City: {$citySlug}. Age: {$agePolicy}. Polling: {$polling}"
        ]);
        $newSourceId = (int)$pdo->lastInsertId();

        // Resolve city_id
        $cityId = 1;
        try {
            $cstmt = $pdo->prepare("SELECT id FROM cities WHERE slug = :slug LIMIT 1");
            $cstmt->execute(['slug' => $citySlug]);
            $cid = $cstmt->fetchColumn();
            if ($cid) $cityId = (int)$cid;
        } catch (\Throwable $e) {}

        // Stage venue in venues table with is_active = 0
        try {
            $vstmt = $pdo->prepare("
                INSERT INTO venues (slug, city_id, name, address, suburb, state, postcode, default_age_policy, website_url, feed_url, source_id, is_active)
                VALUES (:slug, :city_id, :name, :address, :suburb, :state, :postcode, :age_policy, :web, :feed, :sid, 0)
                ON DUPLICATE KEY UPDATE 
                    name = VALUES(name),
                    city_id = VALUES(city_id),
                    address = IF(VALUES(address) != '', VALUES(address), address),
                    suburb = IF(VALUES(suburb) != '', VALUES(suburb), suburb),
                    state = VALUES(state),
                    postcode = IF(VALUES(postcode) != '', VALUES(postcode), postcode),
                    default_age_policy = VALUES(default_age_policy),
                    website_url = VALUES(website_url),
                    source_id = VALUES(source_id)
            ");
            $vstmt->execute([
                'slug'       => $slug,
                'city_id'    => $cityId,
                'name'       => $name,
                'address'    => $address ?: null,
                'suburb'     => $suburb ?: null,
                'state'      => $state ?: 'VIC',
                'postcode'   => $postcode ?: null,
                'age_policy' => $agePolicy,
                'web'        => $url,
                'feed'       => $feedUrl ?: null,
                'sid'        => $newSourceId
            ]);
        } catch (\Throwable $ve) {
            // Non-fatal if venues table not migrated
        }

        echo json_encode([
            'status'  => 'success',
            'message' => "Venue '$name' submitted successfully for review and broadcasting.",
            'id'      => $newSourceId
        ]);
        exit;

    } catch (\Throwable $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Database error recording submission']);
        exit;
    }
}

http_response_code(400);
echo json_encode(['status' => 'error', 'message' => 'Invalid action']);
