<?php
declare(strict_types=1);

require_once __DIR__ . '/src/Database.php';

use AgendaWeb\Database;

set_time_limit(300);

$config = require __DIR__ . '/config/config.php';
$botUserAgent = $config['app']['bot_user_agent'] ?? 'AgendaWeb-Bot/1.0';

try {
    $pdo = Database::getConnection();
} catch (\Throwable $e) {
    if (php_sapi_name() === 'cli') {
        fwrite(STDERR, "Database connection error: " . $e->getMessage() . "\n");
    }
    exit(1);
}

function runAllSync(PDO $pdo, string $botUserAgent): array {
    $sources = $pdo->query("SELECT * FROM sources WHERE is_active = 1")->fetchAll();
    $report = ['total' => count($sources), 'success' => 0, 'failed' => 0, 'details' => []];

    foreach ($sources as $source) {
        $count = 0;
        try {
            if ($source['type'] === 'rss') {
                $count = syncRss($pdo, $source, $botUserAgent);
            } elseif ($source['type'] === 'scrape_event') {
                $count = syncSchemaOrgEvents($pdo, $source, $botUserAgent);
            }
            $pdo->prepare("
                UPDATE sources 
                SET last_polled_at = NOW(), last_status = 'updated', http_code = 200, item_count = ?, last_error = NULL 
                WHERE id = ?
            ")->execute([$count, $source['id']]);
            $report['success']++;
            $report['details'][] = ['id' => $source['id'], 'name' => $source['name'], 'status' => 'updated', 'count' => $count];
        } catch (\Throwable $e) {
            $report['failed']++;
            $errMsg = mb_substr($e->getMessage(), 0, 250);
            $pdo->prepare("
                UPDATE sources 
                SET last_polled_at = NOW(), last_status = 'failed', last_error = ? 
                WHERE id = ?
            ")->execute([$errMsg, $source['id']]);
            $report['details'][] = ['id' => $source['id'], 'name' => $source['name'], 'status' => 'failed', 'error' => $errMsg];
        }
    }
    return $report;
}

if (php_sapi_name() === 'cli' || (isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === realpath(__FILE__))) {
    $report = runAllSync($pdo, $botUserAgent);
    echo "Sync Complete: {$report['success']} succeeded, {$report['failed']} failed.\n";
}

function syncRss(PDO $pdo, array $source, string $userAgent): int {
    $ctx = stream_context_create(['http' => ['timeout' => 10, 'user_agent' => $userAgent]]);
    $xmlData = @file_get_contents($source['url'], false, $ctx);
    if (!$xmlData) return 0;

    $xml = @simplexml_load_string($xmlData);
    if (!$xml) return 0;

    $stmt = $pdo->prepare("
        INSERT INTO items (source_id, category_tab, category, title, link, summary, content, image_url, published_at)
        VALUES (:sid, :tab, :cat, :title, :link, :summary, :content, :image, :pub_date)
        ON DUPLICATE KEY UPDATE 
            summary = VALUES(summary),
            content = VALUES(content),
            image_url = IF(image_url IS NULL, VALUES(image_url), image_url)
    ");

    $items = isset($xml->channel->item) ? $xml->channel->item : ($xml->entry ?? []);
    $count = 0;
    foreach ($items as $item) {
        if ($count >= 30) break;
        $title = trim((string)$item->title);
        $link  = (string)($item->link['href'] ?? $item->link);
        $rawDesc = (string)($item->description ?? $item->summary ?? '');
        $date  = (string)($item->pubDate ?? $item->updated ?? date('r'));

        // Extract full content (<content:encoded> or <content>)
        $namespaces = $item->getNameSpaces(true);
        $fullContent = null;
        if (isset($namespaces['content'])) {
            $contentNs = $item->children($namespaces['content']);
            if (isset($contentNs->encoded)) {
                $fullContent = (string)$contentNs->encoded;
            }
        }
        if (!$fullContent && isset($item->content)) {
            $fullContent = (string)$item->content;
        }
        if (!$fullContent) {
            $fullContent = $rawDesc;
        }

        // Extract category tag
        $cat = 'General';
        if (isset($item->category)) {
            $cat = trim((string)$item->category);
        }

        // Extract image
        $imageUrl = null;
        if (isset($item->enclosure)) {
            $encType = (string)$item->enclosure['type'];
            if (str_starts_with($encType, 'image/')) {
                $imageUrl = (string)$item->enclosure['url'];
            }
        }
        if (!$imageUrl) {
            if (isset($namespaces['media'])) {
                $media = $item->children($namespaces['media']);
                if (isset($media->content) && isset($media->content->attributes()->url)) {
                    $imageUrl = (string)$media->content->attributes()->url;
                }
            }
        }
        if (!$imageUrl && preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $fullContent ?: $rawDesc, $match)) {
            $imageUrl = $match[1];
        }

        $desc = strip_tags($rawDesc);

        $stmt->execute([
            'sid'      => $source['id'],
            'tab'      => $source['category_tab'],
            'cat'      => $cat ?: 'General',
            'title'    => $title,
            'link'     => $link,
            'summary'  => mb_substr($desc, 0, 300) . '...',
            'content'  => $fullContent,
            'image'    => $imageUrl,
            'pub_date' => date('Y-m-d H:i:s', strtotime($date))
        ]);
        $count++;
    }
    return $count;
}

function resolveAustralianCity(PDO $pdo, string $addressText, ?string $postcode): ?int {
    if ($postcode && strlen(trim($postcode)) >= 4) {
        $firstDigit = substr(trim($postcode), 0, 1);
        try {
            $stmt = $pdo->prepare("SELECT id FROM cities WHERE postcode_prefix = :pfx LIMIT 1");
            $stmt->execute(['pfx' => $firstDigit]);
            $cityId = $stmt->fetchColumn();
            if ($cityId) return (int)$cityId;
        } catch (\Throwable $e) {}
    }
    $lower = strtolower($addressText);
    if (str_contains($lower, 'vic') || str_contains($lower, 'melbourne')) return 1;
    if (str_contains($lower, 'nsw') || str_contains($lower, 'sydney')) return 2;
    if (str_contains($lower, 'qld') || str_contains($lower, 'brisbane')) return 3;
    if (str_contains($lower, 'wa') || str_contains($lower, 'perth')) return 4;
    if (str_contains($lower, 'sa') || str_contains($lower, 'adelaide')) return 5;
    if (str_contains($lower, 'tas') || str_contains($lower, 'hobart')) return 6;
    return 1; // Default to Melbourne hub
}

function resolveAgeRestriction(?string $ageRange, string $title, string $description): array {
    $haystack = strtolower(($ageRange ?? '') . ' ' . $title . ' ' . $description);
    
    // Check for kids / family first
    if (str_contains($haystack, 'kids') || str_contains($haystack, 'children') || str_contains($haystack, 'family') || str_contains($haystack, 'puppet') || str_contains($haystack, 'under 12') || str_contains($haystack, 'matinee') || str_contains($haystack, 'workshop for')) {
        return ['age' => 'kids_family', 'min_age' => 0, 'family' => 1];
    }
    // Check for 18+
    if (str_contains($haystack, '18+') || str_contains($haystack, 'over 18') || str_contains($haystack, 'licensed') || str_contains($haystack, 'photo id')) {
        return ['age' => '18+', 'min_age' => 18, 'family' => 0];
    }
    // Check for All Ages
    if (str_contains($haystack, 'all ages') || str_contains($haystack, ' aa ') || str_ends_with($haystack, ' aa') || str_contains($haystack, 'under 18')) {
        return ['age' => 'all_ages', 'min_age' => 0, 'family' => 1];
    }
    // Check for 15+
    if (str_contains($haystack, '15+')) {
        return ['age' => '15+', 'min_age' => 15, 'family' => 0];
    }
    return ['age' => 'unrated', 'min_age' => null, 'family' => 0];
}

function syncSchemaOrgEvents(PDO $pdo, array $source, string $userAgent): int {
    $ctx = stream_context_create(['http' => ['timeout' => 12, 'user_agent' => $userAgent]]);

    $stmt = $pdo->prepare("
        INSERT INTO events (city_id, venue_slug, title, description, category, age_restriction, min_age, is_family_friendly, start_time, end_time, venue_name, address, suburb, ticket_url, image_url, origin)
        VALUES (:city_id, :slug, :title, :description, :cat, :age, :min_age, :family, :start, :end, :vname, :addr, :suburb, :turl, :image, 'scraped')
        ON DUPLICATE KEY UPDATE 
            description = IF(origin = 'manual', description, VALUES(description)),
            ticket_url = IF(origin = 'manual', ticket_url, VALUES(ticket_url)),
            end_time = IF(origin = 'manual', end_time, VALUES(end_time)),
            image_url = IF(origin = 'manual', image_url, VALUES(image_url)),
            age_restriction = VALUES(age_restriction),
            is_family_friendly = VALUES(is_family_friendly)
    ");

    $count = 0;

    // Direct Bar Oussou WordPress REST Events API
    if (str_contains($source['url'], 'baroussou.com.au') || str_contains($source['slug'], 'bar-oussou')) {
        $apiData = @file_get_contents('https://www.baroussou.com.au/wp-json/baroussou/v1/events', false, $ctx);
        if ($apiData) {
            $json = json_decode($apiData, true);
            $items = $json['items'] ?? [];
            foreach ($items as $item) {
                if (empty($item['eventDate'])) continue;
                $parts = explode('/', $item['eventDate']);
                if (count($parts) !== 3) continue;
                $time = !empty($item['eventTime']) ? $item['eventTime'] : '20:00';
                $start = "{$parts[2]}-{$parts[1]}-{$parts[0]} {$time}:00";
                if (strtotime($start) < time() - 86400) continue;

                $title = trim($item['artistName'] ?? 'Live Music at Bar Oussou');
                $isKoorie = str_contains(strtolower($title), 'koorie');
                $ageInfo = [
                    'age' => $isKoorie ? 'all_ages' : '18+',
                    'min_age' => $isKoorie ? 0 : 18,
                    'family' => $isKoorie ? 1 : 0
                ];
                $ticketUrl = !empty($item['slug']) ? "https://events.baroussou.com.au/{$item['slug']}" : $source['url'];

                $stmt->execute([
                    'city_id'     => 1,
                    'slug'        => 'bar-oussou',
                    'title'       => $title,
                    'description' => "Live performance at Bar Oussou, Brunswick.",
                    'cat'         => ($item['eventCategory'] ?? '') === 'recurring' ? 'Community' : 'Live Music',
                    'age'         => $ageInfo['age'],
                    'min_age'     => $ageInfo['min_age'],
                    'family'      => $ageInfo['family'],
                    'start'       => $start,
                    'end'         => null,
                    'vname'       => 'Bar Oussou',
                    'addr'        => '659 Sydney Rd, Brunswick VIC 3056',
                    'suburb'      => 'Brunswick',
                    'turl'        => $ticketUrl,
                    'image'       => $item['posterImage'] ?? null
                ]);
                $count++;
            }
            return $count;
        }
    }

    $html = @file_get_contents($source['url'], false, $ctx);
    if (!$html) return 0;

    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    @$dom->loadHTML($html);
    libxml_clear_errors();

    $xpath = new DOMXPath($dom);
    $scripts = $xpath->query('//script[@type="application/ld+json"]');

    foreach ($scripts as $s) {
        $data = json_decode(trim($s->nodeValue), true);
        if (!is_array($data)) continue;

        $nodes = isset($data['@graph']) ? $data['@graph'] : ($data[0] ? $data : [$data]);
        foreach ($nodes as $node) {
            $type = $node['@type'] ?? '';
            if (is_string($type) && (str_ends_with($type, 'Event') || $type === 'Event')) {
                if (empty($node['name']) || empty($node['startDate'])) continue;

                $start = date('Y-m-d H:i:s', strtotime($node['startDate']));
                if (strtotime($start) < time()) continue;

                // Extract image from schema.org
                $imageUrl = null;
                if (!empty($node['image'])) {
                    $imageUrl = is_array($node['image']) ? ($node['image'][0] ?? ($node['image']['url'] ?? null)) : (string)$node['image'];
                }

                $vname = $node['location']['name'] ?? $source['name'];
                $locAddr = $node['location']['address'] ?? null;
                $vaddr = is_array($locAddr) ? ($locAddr['streetAddress'] ?? '') : ($locAddr ?? '');
                $suburb = is_array($locAddr) ? ($locAddr['addressLocality'] ?? '') : '';
                $postcode = is_array($locAddr) ? ($locAddr['postalCode'] ?? '') : '';
                $state = is_array($locAddr) ? ($locAddr['addressRegion'] ?? 'VIC') : 'VIC';

                if (!$vaddr && is_array($locAddr)) {
                    $vaddr = trim(($locAddr['streetAddress'] ?? '') . ', ' . $suburb . ' ' . $state . ' ' . $postcode);
                }

                // Resolve City Hub & Age Restrictions
                $cityId = resolveAustralianCity($pdo, $vaddr . ' ' . $source['name'], $postcode);
                $titleText = trim($node['name']);
                $descText = strip_tags($node['description'] ?? '');
                $ageInfo = resolveAgeRestriction($node['typicalAgeRange'] ?? null, $titleText, $descText);

                // Ensure venues table is updated with auto-detected venue details
                try {
                    $vstmt = $pdo->prepare("
                        INSERT INTO venues (slug, city_id, name, address, suburb, state, postcode, default_age_policy, website_url, source_id)
                        VALUES (:slug, :city_id, :name, :address, :suburb, :state, :postcode, :age_policy, :web, :sid)
                        ON DUPLICATE KEY UPDATE 
                            name = VALUES(name),
                            city_id = COALESCE(VALUES(city_id), city_id),
                            address = IF(VALUES(address) != '', VALUES(address), address),
                            suburb = IF(VALUES(suburb) != '', VALUES(suburb), suburb),
                            state = VALUES(state),
                            postcode = IF(VALUES(postcode) != '', VALUES(postcode), postcode),
                            website_url = VALUES(website_url),
                            source_id = VALUES(source_id)
                    ");
                    $vstmt->execute([
                        'slug'       => $source['slug'],
                        'city_id'    => $cityId,
                        'name'       => $vname,
                        'address'    => $vaddr,
                        'suburb'     => $suburb,
                        'state'      => $state,
                        'postcode'   => $postcode,
                        'age_policy' => ($ageInfo['age'] === '18+') ? '18+' : (($ageInfo['family']) ? 'family' : 'mixed'),
                        'web'        => $source['url'],
                        'sid'        => $source['id']
                    ]);
                } catch (\Throwable $ve) {
                    // Continue gracefully
                }

                $stmt->execute([
                    'city_id'     => $cityId,
                    'slug'        => $source['slug'],
                    'title'       => $titleText,
                    'description' => $descText,
                    'cat'         => str_replace('Event', '', (string)$type) ?: 'Culture',
                    'age'         => $ageInfo['age'],
                    'min_age'     => $ageInfo['min_age'],
                    'family'      => $ageInfo['family'],
                    'start'       => $start,
                    'end'         => !empty($node['endDate']) ? date('Y-m-d H:i:s', strtotime($node['endDate'])) : null,
                    'vname'       => $vname,
                    'addr'        => $vaddr,
                    'suburb'      => $suburb,
                    'turl'        => $node['offers']['url'] ?? $node['url'] ?? $source['url'],
                    'image'       => $imageUrl
                ]);
                $count++;
            }
        }
    }
    return $count;
}