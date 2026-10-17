<?php
declare(strict_types=1);

require_once __DIR__ . '/src/Database.php';

use AgendaWeb\Database;

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$venue = filter_input(INPUT_GET, 'venue', FILTER_DEFAULT);

$pdo = Database::getConnection();

if ($id) {
    $stmt = $pdo->prepare("SELECT * FROM events WHERE id = ?");
    $stmt->execute([$id]);
    $events = $stmt->fetchAll();
    $filename = "agendaweb-event-{$id}.ics";
} elseif ($venue) {
    $stmt = $pdo->prepare("SELECT * FROM events WHERE (venue_slug = :v OR :v = 'all') AND start_time >= NOW() ORDER BY start_time ASC LIMIT 100");
    $stmt->execute(['v' => $venue]);
    $events = $stmt->fetchAll();
    $filename = "agendaweb-{$venue}.ics";
} else {
    http_response_code(400);
    exit('Invalid Event or Venue Parameter');
}

header('Content-Type: text/calendar; charset=utf-8');
header("Content-Disposition: attachment; filename=\"{$filename}\"");

echo "BEGIN:VCALENDAR\r\n";
echo "VERSION:2.0\r\n";
echo "PRODID:-//AgendaWeb//agendaweb.app//EN\r\n";
echo "CALSCALE:GREGORIAN\r\n";

foreach ($events as $e) {
    $dtstamp = gmdate('Ymd\THis\Z');
    $start   = gmdate('Ymd\THis\Z', strtotime($e['start_time']));
    $end     = !empty($e['end_time']) ? gmdate('Ymd\THis\Z', strtotime($e['end_time'])) : gmdate('Ymd\THis\Z', strtotime($e['start_time'] . ' +2 hours'));

    echo "BEGIN:VEVENT\r\n";
    echo "UID:agendaweb-{$e['id']}@agendaweb.app\r\n";
    echo "DTSTAMP:{$dtstamp}\r\n";
    echo "DTSTART:{$start}\r\n";
    echo "DTEND:{$end}\r\n";
    echo "SUMMARY:" . addcslashes($e['title'], ",\\;") . "\r\n";
    echo "LOCATION:" . addcslashes($e['venue_name'] . ', ' . $e['address'], ",\\;") . "\r\n";
    echo "DESCRIPTION:" . addcslashes(($e['description'] ?? '') . "\n\nTickets: " . ($e['ticket_url'] ?: ''), ",\\;") . "\r\n";
    if (!empty($e['ticket_url'])) {
        echo "URL:{$e['ticket_url']}\r\n";
    }
    echo "END:VEVENT\r\n";
}

echo "END:VCALENDAR\r\n";