-- AgendaWeb Database Schema for Hostinger MySQL (8.x)

CREATE TABLE IF NOT EXISTS `sources` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(60) UNIQUE NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `type` ENUM('rss', 'scrape_event') NOT NULL DEFAULT 'rss',
  `url` VARCHAR(255) NOT NULL,
  `category_tab` ENUM('events', 'news', 'politics', 'culture', 'blogs') NOT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `last_polled_at` DATETIME NULL,
  `last_status` ENUM('active', 'updated', 'failed', 'stale', 'pending') NOT NULL DEFAULT 'pending',
  `http_code` SMALLINT NULL,
  `last_error` VARCHAR(255) NULL,
  `item_count` INT NOT NULL DEFAULT 0,
  `contact_email` VARCHAR(150) NULL,
  `submission_notes` VARCHAR(255) NULL,
  INDEX (`category_tab`),
  INDEX (`is_active`),
  INDEX (`last_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `venues` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(60) UNIQUE NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `website_url` VARCHAR(255) DEFAULT NULL,
  `feed_url` VARCHAR(255) DEFAULT NULL,
  `source_id` INT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_venue_name` (`name`),
  INDEX `idx_venue_slug` (`slug`),
  FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL
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
  `image_url` VARCHAR(500) DEFAULT NULL,
  `origin` ENUM('scraped', 'manual') DEFAULT 'scraped',
  `is_verified` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_venue_event_time` (`venue_slug`, `title`(100), `start_time`),
  INDEX `idx_start_time` (`start_time`),
  INDEX `idx_venue_slug` (`venue_slug`),
  INDEX `idx_event_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `source_id` INT NOT NULL,
  `category_tab` ENUM('news', 'politics', 'culture', 'blogs') NOT NULL,
  `category` VARCHAR(60) DEFAULT 'General',
  `title` VARCHAR(255) NOT NULL,
  `link` VARCHAR(255) UNIQUE NOT NULL,
  `summary` TEXT,
  `content` MEDIUMTEXT DEFAULT NULL,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `published_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE CASCADE,
  INDEX `idx_published_at` (`published_at`),
  INDEX `idx_tab` (`category_tab`),
  INDEX `idx_item_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `suggestions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NULL,
  `email` VARCHAR(150) NULL,
  `category` VARCHAR(60) NOT NULL DEFAULT 'general',
  `message` TEXT NOT NULL,
  `status` ENUM('new', 'read', 'archived') NOT NULL DEFAULT 'new',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_status` (`status`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial Seed: Public Australian RSS & Event Targets
INSERT INTO `sources` (`slug`, `name`, `type`, `url`, `category_tab`) VALUES
('abc-just-in', 'ABC News', 'rss', 'https://www.abc.net.au/news/feed/51120/rss.xml', 'news'),
('sbs-top-stories', 'SBS News', 'rss', 'https://www.sbs.com.au/news/feed', 'news'),
('abc-politics', 'ABC Politics', 'rss', 'https://www.abc.net.au/news/feed/45910/rss.xml', 'politics'),
('the-conversation-au', 'The Conversation (AU)', 'rss', 'https://theconversation.com/au/politics/articles.atom', 'politics'),
('guardian-au-culture', 'The Guardian (AU Culture)', 'rss', 'https://www.theguardian.com/au/culture/rss', 'culture'),
('trouble-mag', 'Trouble Magazine', 'rss', 'https://www.troublemag.com/feed/', 'blogs'),
('the-gasometer-hotel', 'The Gasometer Hotel', 'scrape_event', 'https://www.thegasometerhotel.com.au/gigs', 'events')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- Initial Seed: Curated Venues
INSERT INTO `venues` (`slug`, `name`, `address`, `website_url`, `feed_url`, `source_id`) VALUES
('the-gasometer-hotel', 'The Gasometer Hotel', '484 Smith St, Collingwood VIC 3066', 'https://www.thegasometerhotel.com.au', 'https://www.thegasometerhotel.com.au/gigs', 7),
('the-corner-hotel', 'The Corner Hotel', '57 Swan St, Richmond VIC 3121', 'https://thecornerhotel.com', 'https://thecornerhotel.com/gigs', NULL),
('fitzroy-community-arts', 'Fitzroy Community Arts', '128 Gertrude St, Fitzroy VIC 3065', 'https://fitzroyarts.org.au', NULL, NULL)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `address`=VALUES(`address`), `website_url`=VALUES(`website_url`);