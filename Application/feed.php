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
        LEFT JOIN sources s ON e.source_id = s.id 
        WHERE e.start_time >= NOW() AND (s.is_active = 1 OR e.source_id IS NULL)";
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
    $sql .= " AND (e.city_slug = :city OR e.city_id IN (SELECT id FROM cities WHERE slug = :city))";
    $params['city'] = $city;
}

$sql .= " ORDER BY e.start_time ASC LIMIT 60";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$events = $stmt->fetchAll();

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