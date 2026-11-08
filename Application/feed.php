<?php
declare(strict_types=1);

require_once __DIR__ . '/src/Database.php';

use AgendaWeb\Database;

header('Content-Type: application/rss+xml; charset=utf-8');
header('Cache-Control: public, max-age=300');

$config = require __DIR__ . '/config/config.php';
$appUrl = rtrim($config['app']['url'], '/');

try {
    $pdo = Database::getConnection();
} catch (\Throwable $e) {
    http_response_code(500);
    exit('<error>Database Connection Failed</error>');
}

$venue = filter_input(INPUT_GET, 'venue', FILTER_DEFAULT) ?? 'all';
$category = filter_input(INPUT_GET, 'category', FILTER_DEFAULT);
$city = filter_input(INPUT_GET, 'city', FILTER_DEFAULT) ?? 'all';

$sql = "SELECT e.* FROM events e 
        LEFT JOIN venues v ON (v.slug = e.venue_slug OR (e.venue_name IS NOT NULL AND v.name = e.venue_name))
        LEFT JOIN sources s ON v.source_id = s.id 
        LEFT JOIN cities c ON (c.id = e.city_id OR c.id = v.city_id)
        WHERE (e.start_time >= DATE_SUB(NOW(), INTERVAL 14 HOUR) OR (e.end_time IS NOT NULL AND e.end_time >= NOW()))
          AND (s.is_active = 1 OR s.id IS NULL OR e.origin = 'manual')";
$params = [];

if ($venue !== 'all') {
    $sql .= " AND e.venue_slug = :venue";
    $params['venue'] = $venue;
}
if (!empty($category) && $category !== 'All') {
    $sql .= " AND e.category = :cat";
    $params['cat'] = $category;
}
if (!empty($city) && $city !== 'all') {
    $cityLower = strtolower($city);
    if ($cityLower === 'melbourne') {
        $sql .= " AND (c.slug = 'melbourne' OR c.slug IS NULL OR e.city_id IS NULL OR e.address LIKE '%melbourne%' OR v.address LIKE '%melbourne%' OR e.address LIKE '%VIC%' OR v.address LIKE '%VIC%' OR v.state = 'VIC' OR e.suburb = 'Melbourne' OR v.suburb = 'Melbourne')";
    } else {
        $sql .= " AND (c.slug = :city OR e.address LIKE CONCAT('%', :city, '%') OR v.address LIKE CONCAT('%', :city, '%') OR e.suburb = :city OR v.suburb = :city)";
        $params['city'] = $city;
    }
}

$sql .= " ORDER BY e.start_time ASC LIMIT 60";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$events = $stmt->fetchAll();

// Calculate ETag & Last-Modified for HTTP 304 caching
$lastModifiedTime = 0;
$etagParts = [];
foreach ($events as $ev) {
    $etagParts[] = $ev['id'] . ':' . ($ev['start_time'] ?? '');
    $itemTime = strtotime($ev['created_at'] ?? $ev['start_time'] ?? '');
    if ($itemTime > $lastModifiedTime) {
        $lastModifiedTime = $itemTime;
    }
}
$etag = '"' . md5(implode('|', $etagParts) . ':' . count($events)) . '"';
$lastModified = $lastModifiedTime > 0 ? gmdate('D, d M Y H:i:s', $lastModifiedTime) . ' GMT' : gmdate('D, d M Y H:i:s') . ' GMT';

header('ETag: ' . $etag);
header('Last-Modified: ' . $lastModified);

if (
    (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) ||
    (isset($_SERVER['HTTP_IF_MODIFIED_SINCE']) && strtotime($_SERVER['HTTP_IF_MODIFIED_SINCE']) >= $lastModifiedTime && $lastModifiedTime > 0)
) {
    http_response_code(304);
    exit;
}

$feedTitle = 'AgendaWeb — Cultural Feed';
if ($venue !== 'all') {
    $feedTitle .= ' · ' . ucfirst($venue);
} elseif ($city !== 'all') {
    $feedTitle .= ' · ' . ucfirst($city);
}
if (!empty($category) && $category !== 'All') {
    $feedTitle .= ' (' . $category . ')';
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . PHP_EOL;
?>
<rss version="2.0" 
     xmlns:ev="http://purl.org/rss/1.0/modules/event/" 
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><?= htmlspecialchars($feedTitle) ?></title>
    <link><?= htmlspecialchars($appUrl) ?></link>
    <description>YOUR CULTURAL WEB FEED</description>
    <language>en-AU</language>
    <atom:link href="<?= htmlspecialchars($appUrl) ?>/feed.php" rel="self" type="application/rss+xml" />

    <?php foreach ($events as $row): ?>
    <item>
      <title><?= htmlspecialchars($row['title'], ENT_XML1, 'UTF-8') ?></title>
      <link><?= htmlspecialchars($row['ticket_url'] ?: $appUrl, ENT_XML1, 'UTF-8') ?></link>
      <pubDate><?= date(DATE_RSS, strtotime($row['created_at'])) ?></pubDate>
      <category><?= htmlspecialchars($row['category'], ENT_XML1, 'UTF-8') ?></category>
      <description><![CDATA[<?= $row['description'] ?>]]></description>
      
      <ev:startdate><?= date('c', strtotime($row['start_time'])) ?></ev:startdate>
      <?php if (!empty($row['end_time'])): ?>
      <ev:enddate><?= date('c', strtotime($row['end_time'])) ?></ev:enddate>
      <?php endif; ?>
      <ev:location><?= htmlspecialchars($row['venue_name'] . ' · ' . $row['address'], ENT_XML1, 'UTF-8') ?></ev:location>
      <enclosure url="<?= htmlspecialchars($appUrl) ?>/calendar.php?id=<?= $row['id'] ?>" type="text/calendar" />
    </item>
    <?php endforeach; ?>
  </channel>
</rss>