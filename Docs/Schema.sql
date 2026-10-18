-- AgendaWeb Database Schema for Hostinger MySQL (8.x)

CREATE TABLE IF NOT EXISTS `sources` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(60) UNIQUE NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `type` ENUM('rss', 'scrape_event') NOT NULL DEFAULT 'rss',
  `url` VARCHAR(255) NOT NULL,
  `category_tab` ENUM('events', 'news', 'politics', 'culture') NOT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `last_polled_at` DATETIME NULL,
  INDEX (`category_tab`),
  INDEX (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `venue_slug` VARCHAR(60) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(60) DEFAULT 'Culture',
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME DEFAULT NULL,
  `venue_name` VARCHAR(150) NOT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `ticket_url` VARCHAR(255) DEFAULT NULL,
  `origin` ENUM('scraped', 'manual') DEFAULT 'scraped',
  `is_verified` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_venue_event_time` (`venue_slug`, `title`(100), `start_time`),
  INDEX `idx_start_time` (`start_time`),
  INDEX `idx_venue_slug` (`venue_slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `source_id` INT NOT NULL,
  `category_tab` ENUM('news', 'politics', 'culture') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `link` VARCHAR(255) UNIQUE NOT NULL,
  `summary` TEXT,
  `published_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE CASCADE,
  INDEX `idx_published_at` (`published_at`),
  INDEX `idx_tab` (`category_tab`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial Seed: Public Australian RSS & Event Targets
INSERT INTO `sources` (`slug`, `name`, `type`, `url`, `category_tab`) VALUES
('abc-just-in', 'ABC News', 'rss', 'https://www.abc.net.au/news/feed/51120/rss.xml', 'news'),
('sbs-top-stories', 'SBS News', 'rss', 'https://www.sbs.com.au/news/feed', 'news'),
('abc-politics', 'ABC Politics', 'rss', 'https://www.abc.net.au/news/feed/45910/rss.xml', 'politics'),
('the-conversation-au', 'The Conversation (AU)', 'rss', 'https://theconversation.com/au/politics/articles.atom', 'politics'),
('guardian-au-culture', 'The Guardian (AU Culture)', 'rss', 'https://www.theguardian.com/au/culture/rss', 'culture'),
('the-gasometer-hotel', 'The Gasometer Hotel', 'scrape_event', 'https://www.thegasometerhotel.com.au/gigs', 'events')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);