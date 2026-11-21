<?php
declare(strict_types=1);

/**
 * AgendaWeb Markdown Content Negotiation Responder
 * Serves clean, token-efficient Markdown representations to AI agents
 * when requested with `Accept: text/markdown` or accessed directly.
 */

header('Content-Type: text/markdown; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=300');
header('Link: <https://agendaweb.app/llms.txt>; rel="alternate"; type="text/markdown", <https://agendaweb.app/sitemap.xml>; rel="sitemap"');

$city = filter_input(INPUT_GET, 'city', FILTER_DEFAULT) ?? 'melbourne';
$category = filter_input(INPUT_GET, 'category', FILTER_DEFAULT) ?? 'all';

// Try loading real events from Database if available
$events = [];
try {
    require_once __DIR__ . '/src/Database.php';
    $pdo = \AgendaWeb\Database::getConnection();
    $stmt = $pdo->prepare("
        SELECT e.title, e.venue_name, e.category, e.age_restriction, e.start_time, e.address, e.suburb, e.ticket_url
        FROM events e
        WHERE (e.start_time >= DATE_SUB(NOW(), INTERVAL 14 HOUR))
        ORDER BY e.start_time ASC
        LIMIT 25
    ");
    $stmt->execute();
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (\Throwable $e) {
    // Graceful fallback if database connection fails
}

$now = date('l, j F Y H:i T');
?>
# AgendaWeb — Live Cultural Broadsheet & Australian Gigs

> Open-web decentralized cultural calendar, independent venue directory, and grassroots magazine reader.
> Current Date & Snapshot: <?= $now ?>

---

## 📍 Cultural Hub: <?= htmlspecialchars(ucfirst($city)) ?>

AgendaWeb aggregates live music, community theatre, art exhibitions, and zine culture directly from local independent venues and verified feeds.

### 🗓️ Upcoming Gigs & Featured Events

<?php if (!empty($events)): ?>
| Date & Time | Event Title | Venue / Location | Category | Age Policy | Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
<?php foreach ($events as $ev): ?>
| <?= date('D, j M H:i', strtotime($ev['start_time'])) ?> | **<?= htmlspecialchars($ev['title']) ?>** | <?= htmlspecialchars($ev['venue_name'] . ($ev['suburb'] ? ' (' . $ev['suburb'] . ')' : '')) ?> | <?= htmlspecialchars($ev['category']) ?> | `<?= htmlspecialchars($ev['age_restriction']) ?>` | [Details](<?= htmlspecialchars($ev['ticket_url'] ?: 'https://agendaweb.app/') ?>) |
<?php endforeach; ?>
<?php else: ?>
*No upcoming events currently scheduled in local snapshot. Visit the live feeds below for current dates.*
<?php endif; ?>

---

## ⚡ Direct Syndication & Machine-Readable Feeds

Agents and readers can access or subscribe to live feeds directly:

- **RSS 2.0 / Atom:** [https://agendaweb.app/feed.php](https://agendaweb.app/feed.php)
- **iCalendar (.ics Stream):** [https://agendaweb.app/calendar.php?venue=all](https://agendaweb.app/calendar.php?venue=all)
- **JSON REST API:** [https://agendaweb.app/api/events.php](https://agendaweb.app/api/events.php)
- **Venues Directory:** [https://agendaweb.app/venues/](https://agendaweb.app/venues/)
- **Agent Guide (llms.txt):** [https://agendaweb.app/llms.txt](https://agendaweb.app/llms.txt)
- **MCP Server Card:** [https://agendaweb.app/.well-known/mcp/server-card.json](https://agendaweb.app/.well-known/mcp/server-card.json)

---

## 🏢 Publisher & Contact Information

- **Organization:** AgendaWeb Cultural Guide
- **Curator Desk Email:** [curator@agendaweb.app](mailto:curator@agendaweb.app)
- **Website:** [https://agendaweb.app](https://agendaweb.app)
- **Open-Source Repository:** [https://github.com/claudinei/AgendaWeb](https://github.com/claudinei/AgendaWeb)
- **Content Policy:** `Content-Signal: search=yes, ai-train=no`
