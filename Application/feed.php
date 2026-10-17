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

$sql = "SELECT * FROM events WHERE start_time >= NOW()";
$params = [];

if ($venue !== 'all') {
    $sql .= " AND venue_slug = :venue";
    $params['venue'] = $venue;
}
if (!empty($category) && $category !== 'All') {
    $sql .= " AND category = :cat";
    $params['cat'] = $category;
}

$sql .= " ORDER BY start_time ASC LIMIT 60";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$events = $stmt->fetchAll();

echo '<?xml version="1.0" encoding="UTF-8"?>' . PHP_EOL;
?>
<rss version="2.0" 
     xmlns:ev="http://purl.org/rss/1.0/modules/event/" 
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AgendaWeb — <?= htmlspecialchars(ucfirst($venue)) ?></title>
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