<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/Database.php';

use AgendaWeb\Database;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Cache-Control: public, max-age=60');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$config = require __DIR__ . '/../config/config.php';
$appUrl = rtrim($config['app']['url'], '/');

$venue = filter_input(INPUT_GET, 'venue', FILTER_DEFAULT) ?? 'all';
$category = filter_input(INPUT_GET, 'category', FILTER_DEFAULT) ?? 'all';
$city = filter_input(INPUT_GET, 'city', FILTER_DEFAULT) ?? 'all';
$suburb = filter_input(INPUT_GET, 'suburb', FILTER_DEFAULT) ?? 'all';
$age = filter_input(INPUT_GET, 'age', FILTER_DEFAULT) ?? 'all';
$family = filter_input(INPUT_GET, 'family', FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
$limit = min(max((int)(filter_input(INPUT_GET, 'limit', FILTER_VALIDATE_INT) ?: 50), 1), 100);
$offset = max((int)(filter_input(INPUT_GET, 'offset', FILTER_VALIDATE_INT) ?: 0), 0);

try {
    $pdo = Database::getConnection();

    $where = ["e.start_time >= NOW()"];
    $params = [];

    if ($venue !== 'all') {
        $where[] = "e.venue_slug = :venue";
        $params['venue'] = $venue;
    }
    if ($category !== 'all' && $category !== 'All') {
        $where[] = "e.category = :category";
        $params['category'] = $category;
    }
    if ($city !== 'all' && $city !== 'All') {
        $where[] = "(c.slug = :city OR e.address LIKE CONCAT('%', :city, '%'))";
        $params['city'] = $city;
    }
    if ($suburb !== 'all' && $suburb !== 'All') {
        $where[] = "(e.suburb = :suburb OR v.suburb = :suburb OR e.address LIKE CONCAT('%', :suburb, '%'))";
        $params['suburb'] = $suburb;
    }
    if ($age !== 'all' && $age !== 'All') {
        $where[] = "e.age_restriction = :age";
        $params['age'] = $age;
    }
    if ($family === true) {
        $where[] = "(e.is_family_friendly = 1 OR e.age_restriction IN ('kids_family', 'all_ages'))";
    }

    $whereSql = implode(' AND ', $where);

    // Get total count
    $countStmt = $pdo->prepare("
        SELECT COUNT(e.id) 
        FROM events e
        LEFT JOIN venues v ON v.slug = e.venue_slug
        LEFT JOIN cities c ON (c.id = e.city_id OR c.id = v.city_id)
        WHERE {$whereSql}
    ");
    $countStmt->execute($params);
    $total = (int)$countStmt->fetchColumn();

    // Dynamically retrieve distinct available categories
    $catQuery = "
        SELECT DISTINCT e.category 
        FROM events e
        LEFT JOIN venues v ON v.slug = e.venue_slug
        LEFT JOIN cities c ON (c.id = e.city_id OR c.id = v.city_id)
        WHERE e.start_time >= NOW()
    ";
    $catParams = [];
    if ($city !== 'all' && $city !== 'All') {
        $catQuery .= " AND (c.slug = :city OR e.address LIKE CONCAT('%', :city, '%'))";
        $catParams['city'] = $city;
    }
    $catQuery .= " ORDER BY e.category ASC";
    $catStmt = $pdo->prepare($catQuery);
    $catStmt->execute($catParams);
    $rawCategories = $catStmt->fetchAll(PDO::FETCH_COLUMN);
    $categories = array_values(array_unique(array_merge(['All'], array_filter($rawCategories))));

    // Query events with image_url, location and age metadata
    $sql = "SELECT 
                e.id, 
                e.venue_slug, 
                e.venue_name, 
                e.title, 
                e.description, 
                e.category, 
                e.age_restriction,
                e.min_age,
                e.is_family_friendly,
                e.start_time, 
                e.end_time, 
                e.address, 
                e.suburb,
                e.ticket_url, 
                e.image_url, 
                e.origin, 
                e.is_verified,
                COALESCE(c.name, 'Melbourne') AS city_name,
                COALESCE(c.slug, 'melbourne') AS city_slug
            FROM events e
            LEFT JOIN venues v ON v.slug = e.venue_slug
            LEFT JOIN cities c ON (c.id = e.city_id OR c.id = v.city_id)
            WHERE {$whereSql}
            ORDER BY e.start_time ASC
            LIMIT {$limit} OFFSET {$offset}";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $events = $stmt->fetchAll();

    // Append helper URLs
    foreach ($events as &$ev) {
        $ev['calendar_url'] = "{$appUrl}/calendar.php?id={$ev['id']}";
    }

    // Query active cities for frontend switcher
    $cities = [];
    try {
        $citiesStmt = $pdo->query("SELECT id, slug, name, state, latitude, longitude FROM cities WHERE is_active = 1 ORDER BY name ASC");
        if ($citiesStmt) $cities = $citiesStmt->fetchAll();
    } catch (\Throwable $ce) {
        $cities = [
            ['id' => 1, 'slug' => 'melbourne', 'name' => 'Melbourne', 'state' => 'VIC'],
            ['id' => 2, 'slug' => 'sydney', 'name' => 'Sydney', 'state' => 'NSW'],
            ['id' => 3, 'slug' => 'brisbane', 'name' => 'Brisbane', 'state' => 'QLD']
        ];
    }

    // Query active venues for grouping and metadata
    $venues = [];
    try {
        $venuesStmt = $pdo->query("
            SELECT v.slug, v.name, v.address, v.suburb, v.website_url, v.feed_url, v.default_age_policy,
                   COUNT(e.id) AS event_count
            FROM venues v
            LEFT JOIN events e ON e.venue_slug = v.slug AND e.start_time >= NOW()
            WHERE v.is_active = 1
            GROUP BY v.id
            ORDER BY v.name ASC
        ");
        if ($venuesStmt) {
            $venues = $venuesStmt->fetchAll();
        }
    } catch (\Throwable $ve) {
        $venues = [];
    }

    echo json_encode([
        'status'     => 'success',
        'city'       => $city,
        'age'        => $age,
        'count'      => count($events),
        'total'      => $total,
        'offset'     => $offset,
        'limit'      => $limit,
        'categories' => $categories,
        'cities'     => $cities,
        'venues'     => $venues,
        'data'       => $events
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to fetch events: ' . $e->getMessage()]);
}
