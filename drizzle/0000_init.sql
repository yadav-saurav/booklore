CREATE TABLE `api_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `authors` (
	`id` text PRIMARY KEY NOT NULL,
	`ol_key` text,
	`name` text NOT NULL,
	`birth_date` text,
	`death_date` text,
	`photo_id` integer,
	`photo_url` text,
	`bio` text,
	`nationality` text,
	`source` text DEFAULT 'seed' NOT NULL,
	`popularity` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_ol_key_unique` ON `authors` (`ol_key`);--> statement-breakpoint
CREATE TABLE `book_authors` (
	`book_id` text NOT NULL,
	`author_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`book_id`, `author_id`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ba_author_idx` ON `book_authors` (`author_id`);--> statement-breakpoint
CREATE TABLE `book_genres` (
	`book_id` text NOT NULL,
	`genre_slug` text NOT NULL,
	PRIMARY KEY(`book_id`, `genre_slug`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_slug`) REFERENCES `genres`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bg_genre_idx` ON `book_genres` (`genre_slug`);--> statement-breakpoint
CREATE TABLE `book_views` (
	`book_id` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`book_id`, `day`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`ol_work_key` text,
	`google_id` text,
	`title` text NOT NULL,
	`subtitle` text,
	`first_publish_year` integer,
	`cover_id` integer,
	`cover_url` text,
	`isbn13` text,
	`pages` integer,
	`publisher` text,
	`language` text,
	`synopsis` text,
	`subjects` text DEFAULT '[]' NOT NULL,
	`source` text DEFAULT 'seed' NOT NULL,
	`ol_rating_avg` real,
	`ol_rating_count` integer DEFAULT 0 NOT NULL,
	`ol_want_to_read` integer DEFAULT 0 NOT NULL,
	`rating_avg` real,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`weighted_score` real,
	`review_count` integer DEFAULT 0 NOT NULL,
	`shelf_count` integer DEFAULT 0 NOT NULL,
	`popularity_score` real DEFAULT 0 NOT NULL,
	`popularity_rank` integer,
	`prev_popularity_rank` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_ol_work_key_unique` ON `books` (`ol_work_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `books_google_id_unique` ON `books` (`google_id`);--> statement-breakpoint
CREATE INDEX `books_year_idx` ON `books` (`first_publish_year`);--> statement-breakpoint
CREATE INDEX `books_pop_idx` ON `books` (`popularity_rank`);--> statement-breakpoint
CREATE INDEX `books_weighted_idx` ON `books` (`weighted_score`);--> statement-breakpoint
CREATE TABLE `follows` (
	`follower_id` integer NOT NULL,
	`followee_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`follower_id`, `followee_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`followee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `genres` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`kanji` text,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `list_items` (
	`list_id` integer NOT NULL,
	`book_id` text NOT NULL,
	`position` integer NOT NULL,
	`note` text,
	PRIMARY KEY(`list_id`, `book_id`),
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `li_book_idx` ON `list_items` (`book_id`);--> statement-breakpoint
CREATE TABLE `list_likes` (
	`list_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	PRIMARY KEY(`list_id`, `user_id`),
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`is_featured` integer DEFAULT false NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`user_id` integer NOT NULL,
	`book_id` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `book_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ratings_book_idx` ON `ratings` (`book_id`);--> statement-breakpoint
CREATE INDEX `ratings_created_idx` ON `ratings` (`created_at`);--> statement-breakpoint
CREATE TABLE `review_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`review_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `review_votes` (
	`review_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`helpful` integer NOT NULL,
	PRIMARY KEY(`review_id`, `user_id`),
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`book_id` text NOT NULL,
	`headline` text NOT NULL,
	`body` text NOT NULL,
	`spoiler` integer DEFAULT false NOT NULL,
	`helpful_count` integer DEFAULT 0 NOT NULL,
	`unhelpful_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_user_book` ON `reviews` (`user_id`,`book_id`);--> statement-breakpoint
CREATE INDEX `reviews_book_idx` ON `reviews` (`book_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shelf` (
	`user_id` integer NOT NULL,
	`book_id` text NOT NULL,
	`status` text NOT NULL,
	`progress` integer,
	`added_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `book_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shelf_book_idx` ON `shelf` (`book_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`password_hash` text,
	`bio` text DEFAULT '' NOT NULL,
	`location` text,
	`avatar_hue` integer DEFAULT 220 NOT NULL,
	`is_mock` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);