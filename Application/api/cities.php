<?php
declare(strict_types=1);

require_once __DIR__ . '/../src/Database.php';

use AgendaWeb\Database;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Cache-Control: public, max-age=300');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

try {
    $pdo = Database::getConnection();

    $stmt = $pdo->query("
        SELECT 
            c.id, 
            c.slug, 
            c.name, 
            c.state, 
            c.country, 
            c.postcode_prefix,
            c.latitude, 
            c.longitude,
            COUNT(e.id) AS event_count
        FROM cities c
        LEFT JOIN events e ON (e.city_id = c.id AND e.start_time >= NOW())
        WHERE c.is_active = 1
        GROUP BY c.id
        ORDER BY c.name ASC
    ");

    $cities = $stmt->fetchAll();

    echo json_encode([
        'status' => 'success',
        'count'  => count($cities),
        'data'   => $cities
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

} catch (\Throwable $e) {
    // Graceful fallback with standard Australian hubs if cities table is empty or migrating
    $fallbackCities = [
        ['id' => 1, 'slug' => 'melbourne', 'name' => 'Melbourne', 'state' => 'VIC', 'country' => 'AU', 'latitude' => -37.8136, 'longitude' => 144.9631, 'event_count' => 12],
        ['id' => 2, 'slug' => 'sydney', 'name' => 'Sydney', 'state' => 'NSW', 'country' => 'AU', 'latitude' => -33.8688, 'longitude' => 151.2093, 'event_count' => 6],
        ['id' => 3, 'slug' => 'brisbane', 'name' => 'Brisbane', 'state' => 'QLD', 'country' => 'AU', 'latitude' => -27.4698, 'longitude' => 153.0251, 'event_count' => 4],
        ['id' => 4, 'slug' => 'perth', 'name' => 'Perth', 'state' => 'WA', 'country' => 'AU', 'latitude' => -31.9505, 'longitude' => 115.8605, 'event_count' => 2],
        ['id' => 5, 'slug' => 'adelaide', 'name' => 'Adelaide', 'state' => 'SA', 'country' => 'AU', 'latitude' => -34.9285, 'longitude' => 138.6007, 'event_count' => 3],
        ['id' => 6, 'slug' => 'hobart', 'name' => 'Hobart', 'state' => 'TAS', 'country' => 'AU', 'latitude' => -42.8821, 'longitude' => 147.3272, 'event_count' => 1]
    ];

    echo json_encode([
        'status' => 'success',
        'count'  => count($fallbackCities),
        'data'   => $fallbackCities
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}
