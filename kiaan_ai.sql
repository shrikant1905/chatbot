-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 29, 2026 at 07:54 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `kiaan_ai`
--

-- --------------------------------------------------------

--
-- Table structure for table `attachments`
--

CREATE TABLE `attachments` (
  `id` varchar(64) NOT NULL,
  `conversation_id` varchar(64) NOT NULL,
  `message_id` varchar(64) DEFAULT NULL,
  `filename` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `mime_type` varchar(120) NOT NULL,
  `file_size` bigint(20) NOT NULL,
  `storage_path` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `attachments`
--

INSERT INTO `attachments` (`id`, `conversation_id`, `message_id`, `filename`, `original_name`, `mime_type`, `file_size`, `storage_path`, `created_at`) VALUES
('074a0ff8-5a11-4450-85fc-a77dc3d1ef58', 'conv-user-a', NULL, '1793255797576-68f14ba65ba5d2cc83ebe901.txt', 'secret.txt', 'text/plain', 6, 'C:\\kiaan project\\jonny\\chatbot\\backend\\uploads\\1793255797576-68f14ba65ba5d2cc83ebe901.txt', '2026-10-29 06:36:37'),
('350ffc87-aecb-4865-8cab-c1d1682dc520', 'conv-user-a', NULL, '1793255849314-fbc6f1cf5793b17b7ebe1b4c.txt', 'secret.txt', 'text/plain', 6, 'C:\\kiaan project\\jonny\\chatbot\\backend\\uploads\\1793255849314-fbc6f1cf5793b17b7ebe1b4c.txt', '2026-10-29 06:37:29'),
('3cbdc41b-acfb-4fa3-8ded-d79487088a54', 'conv-att-test', NULL, '1793255849283-165d87cebc2310283e0c0742.txt', 'notes.txt', 'text/plain', 35, 'C:\\kiaan project\\jonny\\chatbot\\backend\\uploads\\1793255849283-165d87cebc2310283e0c0742.txt', '2026-10-29 06:37:29'),
('53bd4821-5e8a-4292-b598-24b28d93db5a', 'auto-conv-1793255849224', NULL, '1793256640585-ec29d098055dc2ad86eb3ee7.jpg', 'WhatsApp Image 2024-10-06 at 14.21.21_1c6d7c4f.jpg', 'image/jpeg', 189977, 'C:\\kiaan project\\jonny\\chatbot\\backend\\uploads\\1793256640585-ec29d098055dc2ad86eb3ee7.jpg', '2026-10-29 06:50:40'),
('709236d8-1b32-4ea0-8a36-4756690d4a77', 'auto-conv-1793255849224', NULL, '1793256658448-febb54894acabd1ee1677cc2.webm', 'voice-note-1793256657090.webm', 'audio/webm', 90134, 'C:\\kiaan project\\jonny\\chatbot\\backend\\uploads\\1793256658448-febb54894acabd1ee1677cc2.webm', '2026-10-29 06:50:58'),
('7459c047-10f3-4913-bd03-349a814bceb3', 'conv-att-test', NULL, '1793255797542-ec25f36b14e863003ae70803.txt', 'notes.txt', 'text/plain', 35, 'C:\\kiaan project\\jonny\\chatbot\\backend\\uploads\\1793255797542-ec25f36b14e863003ae70803.txt', '2026-10-29 06:36:37');

-- --------------------------------------------------------

--
-- Table structure for table `conversations`
--

CREATE TABLE `conversations` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `title` varchar(255) NOT NULL,
  `model` varchar(64) DEFAULT 'kiaan-ultra',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `conversations`
--

INSERT INTO `conversations` (`id`, `user_id`, `title`, `model`, `created_at`, `updated_at`) VALUES
('auto-conv-1793255797463', 'user_default', 'Explain quantum computing in detail', 'kiaan-ultra', '2026-10-29 06:36:37', '2026-10-29 06:36:37'),
('auto-conv-1793255849224', 'user_default', 'Explain quantum computing in detail', 'kiaan-ultra', '2026-10-29 06:37:29', '2026-10-29 06:53:50'),
('conv-att-test', 'user_default', 'Attachment Test', 'kiaan-ultra', '2026-10-29 06:36:37', '2026-10-29 06:36:37'),
('conv-search-1', 'user_default', 'Superconductors and Quantum Logic', 'kiaan-ultra', '2026-10-29 06:36:37', '2026-10-29 06:36:37'),
('conv-user-a', 'user_default', 'User A Conv', 'kiaan-ultra', '2026-10-29 06:36:37', '2026-10-29 06:36:37'),
('test-conv-blank', 'user_default', 'Valid', 'kiaan-ultra', '2026-10-29 06:36:37', '2026-10-29 06:36:37');

-- --------------------------------------------------------

--
-- Table structure for table `feedback`
--

CREATE TABLE `feedback` (
  `id` varchar(64) NOT NULL,
  `message_id` varchar(64) NOT NULL,
  `rating` enum('like','dislike') NOT NULL,
  `comment` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `id` varchar(64) NOT NULL,
  `conversation_id` varchar(64) NOT NULL,
  `role` enum('user','assistant','system') NOT NULL,
  `content` longtext NOT NULL,
  `status` enum('pending','completed','failed','cancelled') DEFAULT 'completed',
  `model` varchar(64) DEFAULT NULL,
  `tokens_used` int(11) DEFAULT 0,
  `created_at` timestamp(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `messages`
--

INSERT INTO `messages` (`id`, `conversation_id`, `role`, `content`, `status`, `model`, `tokens_used`, `created_at`) VALUES
('0903948e-66eb-47c4-b80f-84b3af1ed443', 'auto-conv-1793255797463', 'assistant', 'Error: Ollama generation failed: unable to connect to Ollama at http://127.0.0.1:11434. Verify that Ollama is running and has the \'kiaan-ultra\' model installed (\'ollama pull kiaan-ultra\').', 'failed', 'kiaan-ultra', 0, '2026-10-29 06:36:37.000'),
('25b974e0-4947-4590-afe9-8bbe5a33c969', 'auto-conv-1793255849224', 'user', 'd', 'completed', 'kiaan-ultra', 0, '2026-10-29 06:53:50.117'),
('2b91af2c-a964-4421-bd0f-0d5a1ab7833b', 'auto-conv-1793255849224', 'assistant', 'Error: Ollama generation failed: unable to connect to Ollama at http://127.0.0.1:11434. Verify that Ollama is running and has the \'kiaan-ultra\' model installed (\'ollama pull kiaan-ultra\').', 'failed', 'kiaan-ultra', 0, '2026-10-29 06:50:07.536'),
('2de1e843-1e0b-4174-8300-bc8d8dc9e677', 'auto-conv-1793255849224', 'assistant', 'Error: Ollama generation failed: unable to connect to Ollama at http://127.0.0.1:11434. Verify that Ollama is running and has the \'kiaan-ultra\' model installed (\'ollama pull kiaan-ultra\').', 'failed', 'kiaan-ultra', 0, '2026-10-29 06:37:29.000'),
('613115bc-b0ac-4ec8-9047-3ee85ede45dd', 'auto-conv-1793255797463', 'user', 'Explain quantum computing in detail', 'completed', 'kiaan-ultra', 0, '2026-10-29 06:36:37.000'),
('c886fa86-43ae-40a6-9b19-e40dc5daf5c9', 'auto-conv-1793255849224', 'user', 'wdsa', 'completed', 'kiaan-ultra', 0, '2026-10-29 06:50:07.484'),
('d5f1d306-592f-45f3-bf2a-bfcf760f9923', 'auto-conv-1793255849224', 'user', 'Explain quantum computing in detail', 'completed', 'kiaan-ultra', 0, '2026-10-29 06:37:29.000'),
('e5c4bf12-7107-4f57-a9e2-384896fe42cc', 'auto-conv-1793255849224', 'assistant', 'Error: Ollama generation failed: unable to connect to Ollama at http://127.0.0.1:11434. Verify that Ollama is running and has the \'kiaan-ultra\' model installed (\'ollama pull kiaan-ultra\').', 'failed', 'kiaan-ultra', 0, '2026-10-29 06:53:50.142');

-- --------------------------------------------------------

--
-- Table structure for table `search_history`
--

CREATE TABLE `search_history` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `query` varchar(255) NOT NULL,
  `result_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` varchar(64) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `avatar_initials` varchar(10) DEFAULT 'AM',
  `plan_badge` varchar(50) DEFAULT 'Workspace Member',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `avatar_initials`, `plan_badge`, `created_at`) VALUES
('user_default', 'Alex Morgan', 'alex.morgan@workspace.local', 'AM', 'Workspace Member', '2026-10-29 06:29:53');

-- --------------------------------------------------------

--
-- Table structure for table `user_memories`
--

CREATE TABLE `user_memories` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `key_name` varchar(128) NOT NULL,
  `value_text` text NOT NULL,
  `category` varchar(64) DEFAULT 'general',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_memories`
--

INSERT INTO `user_memories` (`id`, `user_id`, `key_name`, `value_text`, `category`, `created_at`, `updated_at`) VALUES
('f143f04b-bd1b-4762-9db2-daabd71f3240', 'user_default', 'preferred_programming_language', 'Python and JavaScript', 'preference', '2026-10-29 06:36:37', '2026-10-29 06:37:29');

-- --------------------------------------------------------

--
-- Table structure for table `_migrations`
--

CREATE TABLE `_migrations` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `executed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `_migrations`
--

INSERT INTO `_migrations` (`id`, `name`, `executed_at`) VALUES
(1, '001_initial_schema.sql', '2026-10-29 06:29:53');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `attachments`
--
ALTER TABLE `attachments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_attachments_conversation` (`conversation_id`),
  ADD KEY `idx_attachments_message` (`message_id`);

--
-- Indexes for table `conversations`
--
ALTER TABLE `conversations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_conversations_user_updated` (`user_id`,`updated_at`);

--
-- Indexes for table `feedback`
--
ALTER TABLE `feedback`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_feedback_message` (`message_id`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_messages_conversation` (`conversation_id`,`created_at`);

--
-- Indexes for table `search_history`
--
ALTER TABLE `search_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_search_history_user` (`user_id`,`created_at`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `user_memories`
--
ALTER TABLE `user_memories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_memories_user_key` (`user_id`,`key_name`);

--
-- Indexes for table `_migrations`
--
ALTER TABLE `_migrations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `_migrations`
--
ALTER TABLE `_migrations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `attachments`
--
ALTER TABLE `attachments`
  ADD CONSTRAINT `fk_attachments_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_attachments_message` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `conversations`
--
ALTER TABLE `conversations`
  ADD CONSTRAINT `fk_conversations_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `feedback`
--
ALTER TABLE `feedback`
  ADD CONSTRAINT `fk_feedback_message` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `search_history`
--
ALTER TABLE `search_history`
  ADD CONSTRAINT `fk_search_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_memories`
--
ALTER TABLE `user_memories`
  ADD CONSTRAINT `fk_memories_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
