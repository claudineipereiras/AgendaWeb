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

CREATE TABLE IF NOT EXISTS `cities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(50) UNIQUE NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `state` VARCHAR(10) NOT NULL,
  `country` VARCHAR(10) DEFAULT 'AU',
  `postcode_prefix` VARCHAR(20) NOT NULL,
  `latitude` DECIMAL(10, 7) NULL,
  `longitude` DECIMAL(10, 7) NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_city_slug` (`slug`),
  INDEX `idx_city_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `venues` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(60) UNIQUE NOT NULL,
  `city_id` INT NULL,
  `name` VARCHAR(150) NOT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `suburb` VARCHAR(100) DEFAULT NULL,
  `state` VARCHAR(10) DEFAULT 'VIC',
  `postcode` VARCHAR(10) DEFAULT NULL,
  `latitude` DECIMAL(10, 7) NULL,
  `longitude` DECIMAL(10, 7) NULL,
  `website_url` VARCHAR(255) DEFAULT NULL,
  `feed_url` VARCHAR(255) DEFAULT NULL,
  `default_age_policy` ENUM('18+', 'all_ages', 'mixed', 'family') DEFAULT 'mixed',
  `source_id` INT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_venue_name` (`name`),
  INDEX `idx_venue_slug` (`slug`),
  INDEX `idx_venue_city` (`city_id`),
  INDEX `idx_venue_suburb` (`suburb`),
  FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `city_id` INT NULL,
  `venue_slug` VARCHAR(60) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(60) DEFAULT 'Culture',
  `age_restriction` ENUM('18+', 'all_ages', '15+', 'kids_family', 'unrated') NOT NULL DEFAULT 'unrated',
  `min_age` TINYINT UNSIGNED NULL,
  `is_family_friendly` TINYINT(1) DEFAULT 0,
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME DEFAULT NULL,
  `venue_name` VARCHAR(150) NOT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `suburb` VARCHAR(100) DEFAULT NULL,
  `ticket_url` VARCHAR(255) DEFAULT NULL,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `origin` ENUM('scraped', 'manual') DEFAULT 'scraped',
  `is_verified` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_venue_event_time` (`venue_slug`, `title`(100), `start_time`),
  INDEX `idx_start_time` (`start_time`),
  INDEX `idx_venue_slug` (`venue_slug`),
  INDEX `idx_event_category` (`category`),
  INDEX `idx_event_city_time` (`city_id`, `start_time`),
  INDEX `idx_event_age` (`age_restriction`),
  INDEX `idx_event_family` (`is_family_friendly`),
  FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON DELETE SET NULL
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

-- Initial Seed: Australian Cultural Hubs (Cities)
INSERT INTO `cities` (`slug`, `name`, `state`, `country`, `postcode_prefix`, `latitude`, `longitude`) VALUES
('melbourne', 'Melbourne', 'VIC', 'AU', '3', -37.8136, 144.9631),
('sydney', 'Sydney', 'NSW', 'AU', '2', -33.8688, 151.2093),
('brisbane', 'Brisbane', 'QLD', 'AU', '4', -27.4698, 153.0251),
('perth', 'Perth', 'WA', 'AU', '6', -31.9505, 115.8605),
('adelaide', 'Adelaide', 'SA', 'AU', '5', -34.9285, 138.6007),
('hobart', 'Hobart', 'TAS', 'AU', '7', -42.8821, 147.3272)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `postcode_prefix`=VALUES(`postcode_prefix`);

-- Authentication & Role-Based Access Control (Admin & Manager)
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(150) UNIQUE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'manager') NOT NULL DEFAULT 'manager',
  `is_active` TINYINT(1) DEFAULT 1,
  `last_login_at` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_email` (`email`),
  INDEX `idx_user_role` (`role`),
  INDEX `idx_user_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `token` VARCHAR(64) UNIQUE NOT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_session_token` (`token`),
  INDEX `idx_session_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial Seed: Default Admin & Manager Accounts
-- Admin:   admin@agendaweb.app   / AgendaAdmin2026!
-- Manager: curator@agendaweb.app / CuratorPass2026!
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `is_active`) VALUES
(1, 'Claudinei Sousa', 'admin@agendaweb.app', '$2y$10$sb9wf8j.iv3V1NafAV/dY.Xnd87ceUnqnrpMj/YFFUGaLqPmqcuZi', 'admin', 1),
(2, 'Curation Manager', 'curator@agendaweb.app', '$2y$10$VESMqZ7dTeU5OombW6PGcuPUAfZAAiHkOttXGdYj4UrcPQdgQGlPq', 'manager', 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`), `role`=VALUES(`role`), `password_hash`=VALUES(`password_hash`);