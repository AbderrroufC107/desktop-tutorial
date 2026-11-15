-- NFC RS — MySQL / MariaDB schema.
-- Import once in cPanel → phpMyAdmin → (your database) → Import.
-- Works on MySQL 5.7+ and MariaDB 10.3+.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NULL,
  name          VARCHAR(80)  NOT NULL DEFAULT '',
  google_sub    VARCHAR(64)  NULL,
  photo_url     VARCHAR(500) NOT NULL DEFAULT '',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_google (google_sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One public page per user. Images are stored as small JPEG data URLs.
CREATE TABLE IF NOT EXISTS profiles (
  user_id     INT UNSIGNED NOT NULL,
  username    VARCHAR(30)  NOT NULL,
  name        VARCHAR(80)  NOT NULL DEFAULT '',
  bio         VARCHAR(300) NOT NULL DEFAULT '',
  avatar      MEDIUMTEXT   NULL,
  cover       MEDIUMTEXT   NULL,
  cover_light SMALLINT     NOT NULL DEFAULT 100,
  theme       VARCHAR(9)   NOT NULL DEFAULT 'p:gold',
  links       MEDIUMTEXT   NULL,
  views       INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_profiles_username (username),
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NFC cards created by the admin. owner_id stays NULL until a customer activates the card.
CREATE TABLE IF NOT EXISTS cards (
  code         VARCHAR(16)  NOT NULL,
  owner_id     INT UNSIGNED NULL,
  taps         INT UNSIGNED NOT NULL DEFAULT 0,
  note         VARCHAR(80)  NOT NULL DEFAULT '',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at DATETIME     NULL,
  PRIMARY KEY (code),
  KEY ix_cards_owner (owner_id),
  KEY ix_cards_created (created_at),
  CONSTRAINT fk_cards_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash CHAR(64)     NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  expires_at DATETIME     NOT NULL,
  PRIMARY KEY (token_hash),
  KEY ix_resets_user (user_id),
  CONSTRAINT fk_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admins, managed from admin.html. The first one is created with the one-time setup link.
CREATE TABLE IF NOT EXISTS admins (
  email      VARCHAR(190) NOT NULL,
  added_by   INT UNSIGNED NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Simple per-IP throttle for login, sign-up and password-reset attempts.
CREATE TABLE IF NOT EXISTS rate_limits (
  k            VARCHAR(100) NOT NULL,
  hits         INT UNSIGNED NOT NULL DEFAULT 0,
  window_start INT UNSIGNED NOT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
