<?php
declare(strict_types=1);

/**
 * AgendaWeb Model Context Protocol (MCP) JSON-RPC 2.0 Server Endpoint
 * Implements SEP-1649 MCP Server specification for LLM agents.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once __DIR__ . '/../src/Database.php';

// Handle GET request as a server description info
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'jsonrpc' => '2.0',
        'result' => [
            'protocolVersion' => '2024-11-05',
            'serverInfo' => [
                'name' => 'AgendaWeb Cultural Protocol',
                'version' => '1.0.0'
            ],
            'capabilities' => [
                'tools' => (object)[],
                'resources' => (object)[]
            ]
        ]
    ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}

$rawInput = file_get_contents('php://input');
$request = json_decode($rawInput, true);

if (!$request || !isset($request['jsonrpc']) || $request['jsonrpc'] !== '2.0') {
    http_response_code(400);
    echo json_encode([
        'jsonrpc' => '2.0',
        'id' => null,
        'error' => ['code' => -32600, 'message' => 'Invalid Request: Expected JSON-RPC 2.0']
    ]);
    exit;
}

$id = $request['id'] ?? null;
$method = $request['method'] ?? '';
$params = $request['params'] ?? [];

switch ($method) {
    case 'initialize':
        echo json_encode([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => [
                'protocolVersion' => '2024-11-05',
                'capabilities' => [
                    'tools' => (object)[],
                    'resources' => (object)[]
                ],
                'serverInfo' => [
                    'name' => 'AgendaWeb Cultural Protocol',
                    'version' => '1.0.0'
                ]
            ]
        ]);
        break;

    case 'tools/list':
        echo json_encode([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => [
                'tools' => [
                    [
                        'name' => 'get_events',
                        'description' => 'Fetch upcoming live concerts, arts exhibitions, and community gigs across Melbourne and Australian hubs with filtering by city, category, and age rating.',
                        'inputSchema' => [
                            'type' => 'object',
                            'properties' => [
                                'city' => ['type' => 'string', 'description' => 'Metropolitan city slug (e.g. melbourne, sydney, brisbane, or all)', 'default' => 'melbourne'],
                                'category' => ['type' => 'string', 'description' => 'Event category filter (e.g. Live Music, Culture)', 'default' => 'all'],
                                'age' => ['type' => 'string', 'enum' => ['all', '18+', 'all_ages', 'kids_family'], 'default' => 'all'],
                                'limit' => ['type' => 'integer', 'default' => 20]
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_venues',
                        'description' => 'Query directory of independent Australian live music venues, cultural halls, addresses, and age policies.',
                        'inputSchema' => [
                            'type' => 'object',
                            'properties' => [
                                'city' => ['type' => 'string', 'description' => 'City slug (e.g. melbourne)']
                            ]
                        ]
                    ],
                    [
                        'name' => 'get_calendar_feed',
                        'description' => 'Get standard RFC 5545 iCalendar (.ics) synchronization URL for adding events to calendar applications.',
                        'inputSchema' => [
                            'type' => 'object',
                            'properties' => [
                                'venue' => ['type' => 'string', 'default' => 'all']
                            ]
                        ]
                    ]
                ]
            ]
        ]);
        break;

    case 'tools/call':
        $toolName = $params['name'] ?? '';
        $arguments = $params['arguments'] ?? [];

        if ($toolName === 'get_events') {
            $city = $arguments['city'] ?? 'melbourne';
            $category = $arguments['category'] ?? 'all';
            $age = $arguments['age'] ?? 'all';
            $limit = min(max((int)($arguments['limit'] ?? 20), 1), 50);

            try {
                $pdo = \AgendaWeb\Database::getConnection();
                $where = ["(e.start_time >= DATE_SUB(NOW(), INTERVAL 14 HOUR))"];
                $sqlParams = [];

                if ($category !== 'all' && $category !== 'All') {
                    $where[] = "LOWER(TRIM(e.category)) = LOWER(TRIM(:category))";
                    $sqlParams['category'] = $category;
                }
                if ($city !== 'all' && $city !== 'All') {
                    $where[] = "(c.slug = :city OR e.address LIKE CONCAT('%', :city, '%'))";
                    $sqlParams['city'] = strtolower($city);
                }

                $whereSql = implode(' AND ', $where);
                $stmt = $pdo->prepare("
                    SELECT e.id, e.title, e.venue_name, e.category, e.age_restriction, e.start_time, e.address, e.suburb, e.ticket_url
                    FROM events e
                    LEFT JOIN venues v ON v.slug = e.venue_slug
                    LEFT JOIN cities c ON (c.id = e.city_id OR c.id = v.city_id)
                    WHERE {$whereSql}
                    ORDER BY e.start_time ASC
                    LIMIT {$limit}
                ");
                $stmt->execute($sqlParams);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                echo json_encode([
                    'jsonrpc' => '2.0',
                    'id' => $id,
                    'result' => [
                        'content' => [
                            [
                                'type' => 'text',
                                'text' => json_encode($rows, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
                            ]
                        ]
                    ]
                ]);
            } catch (\Throwable $e) {
                echo json_encode([
                    'jsonrpc' => '2.0',
                    'id' => $id,
                    'error' => ['code' => -32603, 'message' => 'Database error: ' . $e->getMessage()]
                ]);
            }
        } elseif ($toolName === 'get_venues') {
            try {
                $pdo = \AgendaWeb\Database::getConnection();
                $stmt = $pdo->query("SELECT v.id, v.name, v.slug, v.address, v.suburb, v.website_url, v.default_age_policy FROM venues v WHERE v.is_active = 1 ORDER BY v.name ASC LIMIT 50");
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

                echo json_encode([
                    'jsonrpc' => '2.0',
                    'id' => $id,
                    'result' => [
                        'content' => [
                            [
                                'type' => 'text',
                                'text' => json_encode($rows, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
                            ]
                        ]
                    ]
                ]);
            } catch (\Throwable $e) {
                echo json_encode([
                    'jsonrpc' => '2.0',
                    'id' => $id,
                    'error' => ['code' => -32603, 'message' => 'Database error: ' . $e->getMessage()]
                ]);
            }
        } elseif ($toolName === 'get_calendar_feed') {
            $venue = $arguments['venue'] ?? 'all';
            $icsUrl = "https://agendaweb.app/calendar.php?venue=" . urlencode($venue);
            echo json_encode([
                'jsonrpc' => '2.0',
                'id' => $id,
                'result' => [
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => "iCalendar subscription feed available at: {$icsUrl}"
                        ]
                    ]
                ]
            ]);
        } else {
            echo json_encode([
                'jsonrpc' => '2.0',
                'id' => $id,
                'error' => ['code' => -32601, 'message' => "Method or tool '{$toolName}' not found."]
            ]);
        }
        break;

    default:
        echo json_encode([
            'jsonrpc' => '2.0',
            'id' => $id,
            'error' => ['code' => -32601, 'message' => "Method '{$method}' not found."]
        ]);
        break;
}
