-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: 127.0.0.1    Database: apakahbar
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ai_quality_evaluations`
--

DROP TABLE IF EXISTS `ai_quality_evaluations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `ai_quality_evaluations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `draft_id` bigint(20) unsigned NOT NULL,
  `draft_version_id` bigint(20) unsigned DEFAULT NULL,
  `evaluation_version` varchar(50) NOT NULL,
  `evaluator_model` varchar(255) DEFAULT NULL,
  `overall_score` decimal(5,2) NOT NULL,
  `quality_label` varchar(30) NOT NULL,
  `publish_blocked` tinyint(1) NOT NULL DEFAULT 0,
  `dimensions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`dimensions`)),
  `claim_checks` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`claim_checks`)),
  `warnings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`warnings`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `approved_by` bigint(20) unsigned DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `approval_note` text DEFAULT NULL,
  `approved_version` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ai_quality_evaluations_draft_id_foreign` (`draft_id`),
  KEY `ai_quality_evaluations_draft_version_id_foreign` (`draft_version_id`),
  KEY `ai_quality_evaluations_publish_blocked_index` (`publish_blocked`),
  KEY `ai_quality_evaluations_approved_by_foreign` (`approved_by`),
  CONSTRAINT `ai_quality_evaluations_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`userID`),
  CONSTRAINT `ai_quality_evaluations_draft_id_foreign` FOREIGN KEY (`draft_id`) REFERENCES `intelligent_news_drafts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ai_quality_evaluations_draft_version_id_foreign` FOREIGN KEY (`draft_version_id`) REFERENCES `intelligent_news_draft_versions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_quality_evaluations`
--

/*!40000 ALTER TABLE `ai_quality_evaluations` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_quality_evaluations` ENABLE KEYS */;

--
-- Table structure for table `archived_comment_moderation_assessments`
--

DROP TABLE IF EXISTS `archived_comment_moderation_assessments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `archived_comment_moderation_assessments` (
  `id` bigint(20) unsigned NOT NULL,
  `comment_id` bigint(20) unsigned NOT NULL,
  `classification` varchar(24) NOT NULL,
  `ai_flagged` tinyint(1) DEFAULT NULL,
  `categories` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`categories`)),
  `category_scores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`category_scores`)),
  `reason` varchar(255) DEFAULT NULL,
  `initial_status` varchar(24) DEFAULT NULL,
  `requested_model` varchar(255) DEFAULT NULL,
  `returned_model` varchar(255) DEFAULT NULL,
  `source` varchar(24) NOT NULL,
  `assessed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `comment_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`comment_snapshot`)),
  `source_sha256` char(64) NOT NULL,
  `archived_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `archived_comment_moderation_assessments_comment_id_index` (`comment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `archived_comment_moderation_assessments`
--

/*!40000 ALTER TABLE `archived_comment_moderation_assessments` DISABLE KEYS */;
INSERT INTO `archived_comment_moderation_assessments` VALUES (1,3,'not_flagged',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}',NULL,'checks_passed','published',NULL,NULL,'legacy_snapshot',NULL,'2026-10-19 13:08:39','{\"commentID\":3,\"content\":\"Pantes aja otaknya nggak nyampe, hal simpel gini aja nggak ngerti.\",\"created_at\":\"2026-10-19 17:42:51\",\"updated_at\":\"2026-10-19 21:08:39\",\"newsID\":18,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest435643\",\"status\":\"removed\",\"ai_flagged\":0,\"moderation_categories\":\"{\\\"harassment\\\":false,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"checks_passed\",\"moderator_id\":1,\"moderated_at\":\"2026-10-19 21:08:39\",\"submission_hash\":\"1ad5fbe90eea3409078eb8badf2e9fea0b6fd717d2bb29250d7ca3db2b3a8aca\",\"moderation_revision\":1}','42c23f432a7f579692a201cc28191d637da3ef7ff1431ad76ed35e7eeaed212c','2026-10-26 06:40:03'),(2,4,'not_flagged',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}',NULL,'checks_passed','published',NULL,NULL,'legacy_snapshot',NULL,'2026-10-19 13:09:03','{\"commentID\":4,\"content\":\"Wah, pinter banget ya adminnya, sampai berita salah aja diposting. Hebat deh.\",\"created_at\":\"2026-10-19 17:43:43\",\"updated_at\":\"2026-10-19 21:09:03\",\"newsID\":18,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest114550\",\"status\":\"removed\",\"ai_flagged\":0,\"moderation_categories\":\"{\\\"harassment\\\":false,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"checks_passed\",\"moderator_id\":1,\"moderated_at\":\"2026-10-19 21:09:03\",\"submission_hash\":\"5c14d125abd54ddd665da3798764682f49584687be982224e56a9f74bec15877\",\"moderation_revision\":1}','676f05e197a46971a7b9240bc89e709b5d72ccd712f4bef19b24eb8f58dd8120','2026-10-26 06:40:03'),(3,15,'not_flagged',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','{\"harassment\":1.8925148246037342e-6,\"harassment\\/threatening\":2.6425858208426533e-7,\"sexual\":1.3982207564732913e-5,\"hate\":3.84493505874534e-7,\"hate\\/threatening\":4.450850519411503e-8,\"illicit\":2.212566909570261e-6,\"illicit\\/violent\":1.5689549727726036e-6,\"self-harm\\/intent\":6.540437226933637e-7,\"self-harm\\/instructions\":2.0580491096133835e-7,\"self-harm\":8.013499398837462e-7,\"sexual\\/minors\":3.84493505874534e-7,\"violence\":6.605214485464791e-6,\"violence\\/graphic\":3.288749065460498e-7}','checks_passed','published','omni-moderation-latest','omni-moderation-latest','submission','2026-10-20 00:46:23','2026-10-20 00:46:23','{\"commentID\":15,\"content\":\"thank you\",\"created_at\":\"2026-10-20 08:46:22\",\"updated_at\":\"2026-10-20 08:46:22\",\"newsID\":18,\"userID\":9,\"parentID\":2,\"guest_name\":null,\"status\":\"published\",\"ai_flagged\":0,\"moderation_categories\":\"{\\\"harassment\\\":false,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"checks_passed\",\"moderator_id\":null,\"moderated_at\":null,\"submission_hash\":\"c5905339a43a74c4372b9a2a93f697bd9731156ba346b05732f1d5f9ccd959fe\",\"moderation_revision\":0}','359d15c48cb496eccd06500f67de699ec732c5a23c7ba90cf7c92ec661912eea','2026-10-26 06:40:03'),(4,16,'not_flagged',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','{\"harassment\":4.469407144215697e-6,\"harassment\\/threatening\":7.646537350121258e-7,\"sexual\":7.096703991005882e-5,\"hate\":2.0462932829931794e-6,\"hate\\/threatening\":7.338209805254082e-8,\"illicit\":1.941131867789626e-5,\"illicit\\/violent\":6.814872211615988e-6,\"self-harm\\/intent\":9.080474758713811e-7,\"self-harm\\/instructions\":5.594337713435001e-7,\"self-harm\":1.6442494559854523e-6,\"sexual\\/minors\":2.5071593847983196e-6,\"violence\":1.0229985472581487e-5,\"violence\\/graphic\":2.212566909570261e-6}','checks_passed','published','omni-moderation-latest','omni-moderation-latest','submission','2026-10-20 00:51:03','2026-10-20 00:51:03','{\"commentID\":16,\"content\":\"testing\",\"created_at\":\"2026-10-20 08:51:03\",\"updated_at\":\"2026-10-20 08:51:03\",\"newsID\":18,\"userID\":9,\"parentID\":15,\"guest_name\":null,\"status\":\"published\",\"ai_flagged\":0,\"moderation_categories\":\"{\\\"harassment\\\":false,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"checks_passed\",\"moderator_id\":null,\"moderated_at\":null,\"submission_hash\":\"617ffca59aac6f1e543cb0481bdc4b972b92fb5e7946f918755c9e190fcf498a\",\"moderation_revision\":0}','7360c5bfc9b0d9c29bc750dc9c4a6b4f26dc6a71f11ec0d1e8aac65556b2b589','2026-10-26 06:40:03'),(5,9,'flagged',1,'{\"harassment\":true,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}',NULL,'ai_flagged','pending_review',NULL,NULL,'legacy_snapshot',NULL,'2026-10-20 01:12:31','{\"commentID\":9,\"content\":\"Dasar b0d0h, bikin malu satu kampung aja.\",\"created_at\":\"2026-10-19 17:45:17\",\"updated_at\":\"2026-10-20 14:52:15\",\"newsID\":18,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest600704\",\"status\":\"rejected\",\"ai_flagged\":1,\"moderation_categories\":\"{\\\"harassment\\\":true,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"ai_flagged\",\"moderator_id\":1,\"moderated_at\":\"2026-10-20 14:52:15\",\"submission_hash\":\"6917d677b06de58a21688faef4d4d581872a4ffa0374b9c16ce1e9b15ccb3206\",\"moderation_revision\":3}','6cc6a69f698a7d91387275746fd7fa9a52dec25dbfb58e111a78d49798882c63','2026-10-26 06:40:03'),(6,5,'not_flagged',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}',NULL,'checks_passed','published',NULL,NULL,'legacy_snapshot',NULL,'2026-10-20 06:51:24','{\"commentID\":5,\"content\":\"Otak dipake dong, jangan cuma jadi pajangan.\",\"created_at\":\"2026-10-19 17:44:30\",\"updated_at\":\"2026-10-20 14:51:24\",\"newsID\":18,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest554893\",\"status\":\"removed\",\"ai_flagged\":0,\"moderation_categories\":\"{\\\"harassment\\\":false,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"checks_passed\",\"moderator_id\":1,\"moderated_at\":\"2026-10-20 14:51:24\",\"submission_hash\":\"c1c1f6b58fdd26811857a8895f0dc2b45f5010d25649a9043e8ac042a5cb85a7\",\"moderation_revision\":1}','e2d1241dde8cf0ba2aaf9f2656bdc202f3599d5c47cb359278f6394a7b04df6e','2026-10-26 06:40:03'),(7,17,'flagged',1,'{\"harassment\":true,\"harassment\\/threatening\":true,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":true,\"violence\\/graphic\":false}','{\"harassment\":0.5261331681895233,\"harassment\\/threatening\":0.548330609984228,\"sexual\":0.0001597845494017344,\"hate\":0.00015011822567369918,\"hate\\/threatening\":6.667023092435894e-5,\"illicit\":0.020305390929440996,\"illicit\\/violent\":0.0021871081774596937,\"self-harm\\/intent\":0.00026420311802226543,\"self-harm\\/instructions\":0.00021797638818859668,\"self-harm\":0.0005280223596327018,\"sexual\\/minors\":7.484622751061123e-6,\"violence\":0.9432894393611038,\"violence\\/graphic\":2.0027376671813928e-5}','ai_flagged','pending_review','omni-moderation-latest','omni-moderation-latest','submission','2026-10-22 04:00:58','2026-10-22 04:00:58','{\"commentID\":17,\"content\":\"saya akan pukul kamu\",\"created_at\":\"2026-10-22 12:00:58\",\"updated_at\":\"2026-10-22 12:00:58\",\"newsID\":14,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest552598\",\"status\":\"pending_review\",\"ai_flagged\":1,\"moderation_categories\":\"{\\\"harassment\\\":true,\\\"harassment\\\\\\/threatening\\\":true,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":true,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"ai_flagged\",\"moderator_id\":null,\"moderated_at\":null,\"submission_hash\":\"5207ed7075376d6a1a3455a05279da2abd239c977dc68dee18591ddd06bc4235\",\"moderation_revision\":0}','600e60d6c0205eddcd5d5afadfaadfd5596c74bb39aa555b5a39f07d0f8917e6','2026-10-26 06:40:03'),(8,18,'not_flagged',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','{\"harassment\":5.391084403253366e-6,\"harassment\\/threatening\":1.0451548051737735e-6,\"sexual\":4.442183589214344e-5,\"hate\":2.586743108135441e-6,\"hate\\/threatening\":1.136563710667868e-7,\"illicit\":1.0720880092159908e-5,\"illicit\\/violent\":1.0229985472581487e-5,\"self-harm\\/intent\":1.6187581436151335e-6,\"self-harm\\/instructions\":8.267873072601938e-7,\"self-harm\":2.4300240743279605e-6,\"sexual\\/minors\":2.7535691114583474e-6,\"violence\":1.4202364022997911e-5,\"violence\\/graphic\":1.8342893327886845e-6}','checks_passed','published','omni-moderation-latest','omni-moderation-latest','submission','2026-10-22 04:08:35','2026-10-22 04:08:35','{\"commentID\":18,\"content\":\"thank you for the information\",\"created_at\":\"2026-10-22 12:08:35\",\"updated_at\":\"2026-10-22 12:08:35\",\"newsID\":12,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest665023\",\"status\":\"published\",\"ai_flagged\":0,\"moderation_categories\":\"{\\\"harassment\\\":false,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"checks_passed\",\"moderator_id\":null,\"moderated_at\":null,\"submission_hash\":\"3555c0c68ae5b1794da0644f9aa720d873572f73a19546e729a34ea1a657bfdf\",\"moderation_revision\":0}','5994a141bdb4abfd9035af32e49801d64e7214fdea2e5a315faab3f9c63b5e57','2026-10-26 06:40:03'),(9,19,'flagged',1,'{\"harassment\":true,\"harassment\\/threatening\":true,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":true,\"violence\\/graphic\":false}','{\"harassment\":0.5263249757486824,\"harassment\\/threatening\":0.5484038369641788,\"sexual\":0.0001597845494017344,\"hate\":0.00014953384533104662,\"hate\\/threatening\":6.667023092435894e-5,\"illicit\":0.0202846295889463,\"illicit\\/violent\":0.0021831747887965046,\"self-harm\\/intent\":0.00026420311802226543,\"self-harm\\/instructions\":0.0002177994777081214,\"self-harm\":0.0005287474710982832,\"sexual\\/minors\":7.14190139989638e-6,\"violence\":0.9432950310140338,\"violence\\/graphic\":2.0027376671813928e-5}','ai_flagged','pending_review','omni-moderation-latest','omni-moderation-latest','submission','2026-10-22 04:09:27','2026-10-22 04:09:27','{\"commentID\":19,\"content\":\"saya akan pukul kamu\",\"created_at\":\"2026-10-22 12:09:27\",\"updated_at\":\"2026-10-22 12:09:27\",\"newsID\":12,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest734802\",\"status\":\"pending_review\",\"ai_flagged\":1,\"moderation_categories\":\"{\\\"harassment\\\":true,\\\"harassment\\\\\\/threatening\\\":true,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":true,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"ai_flagged\",\"moderator_id\":null,\"moderated_at\":null,\"submission_hash\":\"24a3acfbcbfd3ba95f05766a22b078d0b266a6961c7a9357d52fa65344146a13\",\"moderation_revision\":0}','74c1506a976744374e1cd58872d3eeace27bea0621976e3a082c9094717bbae1','2026-10-26 06:40:03'),(10,20,'not_flagged',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','{\"harassment\":1.7231572752142392e-6,\"harassment\\/threatening\":2.6425858208426533e-7,\"sexual\":9.314593042575101e-6,\"hate\":7.889262586245034e-7,\"hate\\/threatening\":4.450850519411503e-8,\"illicit\":4.61127481426412e-6,\"illicit\\/violent\":4.069457790466838e-6,\"self-harm\\/intent\":7.646537350121258e-7,\"self-harm\\/instructions\":3.668863309258988e-7,\"self-harm\":1.1300808333434096e-6,\"sexual\\/minors\":5.77192003016332e-7,\"violence\":5.307507822667365e-6,\"violence\\/graphic\":4.356879983467376e-7}','checks_passed','published','omni-moderation-latest','omni-moderation-latest','submission','2026-10-22 13:37:15','2026-10-22 13:37:15','{\"commentID\":20,\"content\":\"Thank you for the information\",\"created_at\":\"2026-10-22 21:37:15\",\"updated_at\":\"2026-10-22 21:37:15\",\"newsID\":13,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest496572\",\"status\":\"published\",\"ai_flagged\":0,\"moderation_categories\":\"{\\\"harassment\\\":false,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"checks_passed\",\"moderator_id\":null,\"moderated_at\":null,\"submission_hash\":\"2eebfdd47b2b8c3644f15ce0470695089fc60945ff122b93edc59e6ab0e5adf3\",\"moderation_revision\":0}','638b4b75abc47dc88772f2f16f743f98c4211218b7310ed664cef4dc87f80e29','2026-10-26 06:40:03');
/*!40000 ALTER TABLE `archived_comment_moderation_assessments` ENABLE KEYS */;

--
-- Table structure for table `archived_comment_moderation_feedback`
--

DROP TABLE IF EXISTS `archived_comment_moderation_feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `archived_comment_moderation_feedback` (
  `id` bigint(20) unsigned NOT NULL,
  `comment_id` bigint(20) unsigned NOT NULL,
  `assessment_id` bigint(20) unsigned NOT NULL,
  `history_id` bigint(20) unsigned NOT NULL,
  `administrator_id` bigint(20) unsigned DEFAULT NULL,
  `classification` varchar(24) NOT NULL,
  `category` varchar(40) NOT NULL,
  `explanation` varchar(1000) DEFAULT NULL,
  `verification_status` varchar(24) NOT NULL,
  `request_id` char(36) NOT NULL,
  `expected_revision` int(10) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `comment_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`comment_snapshot`)),
  `history_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`history_snapshot`)),
  `administrator_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`administrator_snapshot`)),
  `source_sha256` char(64) NOT NULL,
  `archived_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `archived_comment_moderation_feedback_history_id_unique` (`history_id`),
  UNIQUE KEY `archived_comment_moderation_feedback_request_id_unique` (`request_id`),
  KEY `archived_comment_moderation_feedback_comment_id_index` (`comment_id`),
  KEY `archived_comment_moderation_feedback_assessment_id_index` (`assessment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `archived_comment_moderation_feedback`
--

/*!40000 ALTER TABLE `archived_comment_moderation_feedback` DISABLE KEYS */;
INSERT INTO `archived_comment_moderation_feedback` VALUES (1,3,1,15,1,'inappropriate','hate_speech',NULL,'unverified','d456898c-2e61-4721-b298-af1c2304594d',0,'2026-10-19 13:08:39','{\"commentID\":3,\"content\":\"Pantes aja otaknya nggak nyampe, hal simpel gini aja nggak ngerti.\",\"created_at\":\"2026-10-19 17:42:51\",\"updated_at\":\"2026-10-19 21:08:39\",\"newsID\":18,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest435643\",\"status\":\"removed\",\"ai_flagged\":0,\"moderation_categories\":\"{\\\"harassment\\\":false,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"checks_passed\",\"moderator_id\":1,\"moderated_at\":\"2026-10-19 21:08:39\",\"submission_hash\":\"1ad5fbe90eea3409078eb8badf2e9fea0b6fd717d2bb29250d7ca3db2b3a8aca\",\"moderation_revision\":1}','{\"id\":15,\"comment_id\":3,\"moderator_id\":1,\"from_status\":\"published\",\"to_status\":\"removed\",\"reason\":\"remove: Ujaran kebencian\",\"created_at\":\"2026-10-19 21:08:39\",\"action\":null}','{\"userID\":1,\"name\":\"Admin\"}','e73f12c3c8cfc81318f08307abecc6bdb12bd7f0f515c878940c2ab3d33c23f0','2026-10-26 06:40:03'),(2,4,2,16,1,'inappropriate','hate_speech',NULL,'unverified','8b7ac404-8de9-4df3-b43d-37b739bd8956',0,'2026-10-19 13:09:03','{\"commentID\":4,\"content\":\"Wah, pinter banget ya adminnya, sampai berita salah aja diposting. Hebat deh.\",\"created_at\":\"2026-10-19 17:43:43\",\"updated_at\":\"2026-10-19 21:09:03\",\"newsID\":18,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest114550\",\"status\":\"removed\",\"ai_flagged\":0,\"moderation_categories\":\"{\\\"harassment\\\":false,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"checks_passed\",\"moderator_id\":1,\"moderated_at\":\"2026-10-19 21:09:03\",\"submission_hash\":\"5c14d125abd54ddd665da3798764682f49584687be982224e56a9f74bec15877\",\"moderation_revision\":1}','{\"id\":16,\"comment_id\":4,\"moderator_id\":1,\"from_status\":\"published\",\"to_status\":\"removed\",\"reason\":\"remove: Ujaran kebencian\",\"created_at\":\"2026-10-19 21:09:03\",\"action\":null}','{\"userID\":1,\"name\":\"Admin\"}','371177d1ad89826f8db93d6046b245950aee2cdfd2172af7da865343f556dc01','2026-10-26 06:40:03'),(3,5,6,20,1,'inappropriate','threat_intimidation',NULL,'unverified','77422927-9934-4cd5-a917-cfc25de047ed',0,'2026-10-20 06:51:24','{\"commentID\":5,\"content\":\"Otak dipake dong, jangan cuma jadi pajangan.\",\"created_at\":\"2026-10-19 17:44:30\",\"updated_at\":\"2026-10-20 14:51:24\",\"newsID\":18,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest554893\",\"status\":\"removed\",\"ai_flagged\":0,\"moderation_categories\":\"{\\\"harassment\\\":false,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"checks_passed\",\"moderator_id\":1,\"moderated_at\":\"2026-10-20 14:51:24\",\"submission_hash\":\"c1c1f6b58fdd26811857a8895f0dc2b45f5010d25649a9043e8ac042a5cb85a7\",\"moderation_revision\":1}','{\"id\":20,\"comment_id\":5,\"moderator_id\":1,\"from_status\":\"published\",\"to_status\":\"removed\",\"reason\":\"remove: Ancaman atau intimidasi\",\"created_at\":\"2026-10-20 14:51:24\",\"action\":null}','{\"userID\":1,\"name\":\"Admin\"}','4e9600ee26c0f08e3d180b38635a3f4e9269cb1ad197497aee7efc850d4bcd34','2026-10-26 06:40:03'),(4,9,5,21,1,'inappropriate','hate_speech',NULL,'unverified','f602e43a-cc08-46e4-ae0c-35814988243e',1,'2026-10-20 06:52:01','{\"commentID\":9,\"content\":\"Dasar b0d0h, bikin malu satu kampung aja.\",\"created_at\":\"2026-10-19 17:45:17\",\"updated_at\":\"2026-10-20 14:52:15\",\"newsID\":18,\"userID\":null,\"parentID\":null,\"guest_name\":\"guest600704\",\"status\":\"rejected\",\"ai_flagged\":1,\"moderation_categories\":\"{\\\"harassment\\\":true,\\\"harassment\\\\\\/threatening\\\":false,\\\"sexual\\\":false,\\\"hate\\\":false,\\\"hate\\\\\\/threatening\\\":false,\\\"illicit\\\":false,\\\"illicit\\\\\\/violent\\\":false,\\\"self-harm\\\\\\/intent\\\":false,\\\"self-harm\\\\\\/instructions\\\":false,\\\"self-harm\\\":false,\\\"sexual\\\\\\/minors\\\":false,\\\"violence\\\":false,\\\"violence\\\\\\/graphic\\\":false}\",\"moderation_reason\":\"ai_flagged\",\"moderator_id\":1,\"moderated_at\":\"2026-10-20 14:52:15\",\"submission_hash\":\"6917d677b06de58a21688faef4d4d581872a4ffa0374b9c16ce1e9b15ccb3206\",\"moderation_revision\":3}','{\"id\":21,\"comment_id\":9,\"moderator_id\":1,\"from_status\":\"published\",\"to_status\":\"removed\",\"reason\":\"remove: Ujaran kebencian\",\"created_at\":\"2026-10-20 14:52:01\",\"action\":null}','{\"userID\":1,\"name\":\"Admin\"}','3a44e0a2c37d4bac5bcac81066ab9d3b52e7c0fa89ee527d7f855828c36e5420','2026-10-26 06:40:03');
/*!40000 ALTER TABLE `archived_comment_moderation_feedback` ENABLE KEYS */;

--
-- Table structure for table `broadcast_categories`
--

DROP TABLE IF EXISTS `broadcast_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `broadcast_categories` (
  `categoryID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`categoryID`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `broadcast_categories`
--

/*!40000 ALTER TABLE `broadcast_categories` DISABLE KEYS */;
INSERT INTO `broadcast_categories` VALUES (1,'pengumuman','2026-08-28 08:11:24','2026-08-28 08:11:24'),(2,'darurat','2026-08-28 08:11:24','2026-08-28 08:11:24');
/*!40000 ALTER TABLE `broadcast_categories` ENABLE KEYS */;

--
-- Table structure for table `broadcast_channel`
--

DROP TABLE IF EXISTS `broadcast_channel`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `broadcast_channel` (
  `broadcast_id` bigint(20) unsigned NOT NULL,
  `channel_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`broadcast_id`,`channel_id`),
  KEY `broadcast_channel_channel_id_foreign` (`channel_id`),
  CONSTRAINT `broadcast_channel_broadcast_id_foreign` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts` (`alertID`) ON DELETE CASCADE,
  CONSTRAINT `broadcast_channel_channel_id_foreign` FOREIGN KEY (`channel_id`) REFERENCES `channels` (`channelID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `broadcast_channel`
--

/*!40000 ALTER TABLE `broadcast_channel` DISABLE KEYS */;
/*!40000 ALTER TABLE `broadcast_channel` ENABLE KEYS */;

--
-- Table structure for table `broadcast_user`
--

DROP TABLE IF EXISTS `broadcast_user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `broadcast_user` (
  `broadcast_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`broadcast_id`,`user_id`),
  KEY `broadcast_user_user_id_foreign` (`user_id`),
  CONSTRAINT `broadcast_user_broadcast_id_foreign` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts` (`alertID`) ON DELETE CASCADE,
  CONSTRAINT `broadcast_user_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `broadcast_user`
--

/*!40000 ALTER TABLE `broadcast_user` DISABLE KEYS */;
/*!40000 ALTER TABLE `broadcast_user` ENABLE KEYS */;

--
-- Table structure for table `broadcasts`
--

DROP TABLE IF EXISTS `broadcasts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `broadcasts` (
  `alertID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `send_mode` varchar(255) NOT NULL DEFAULT 'now',
  `status` varchar(255) NOT NULL DEFAULT 'tertunda',
  `sent_at` timestamp NULL DEFAULT NULL,
  `scheduled_at` timestamp NULL DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint(20) unsigned NOT NULL,
  `categoryID` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`alertID`),
  KEY `broadcasts_created_by_foreign` (`created_by`),
  KEY `broadcasts_categoryid_foreign` (`categoryID`),
  CONSTRAINT `broadcasts_categoryid_foreign` FOREIGN KEY (`categoryID`) REFERENCES `broadcast_categories` (`categoryID`) ON DELETE SET NULL,
  CONSTRAINT `broadcasts_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `broadcasts`
--

/*!40000 ALTER TABLE `broadcasts` DISABLE KEYS */;
/*!40000 ALTER TABLE `broadcasts` ENABLE KEYS */;

--
-- Table structure for table `channels`
--

DROP TABLE IF EXISTS `channels`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `channels` (
  `channelID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`channelID`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `channels`
--

/*!40000 ALTER TABLE `channels` DISABLE KEYS */;
INSERT INTO `channels` VALUES (1,'whatsapp','2026-08-28 08:11:24','2026-08-28 08:11:24'),(2,'sms','2026-08-28 08:11:24','2026-08-28 08:11:24'),(3,'aplikasi','2026-08-28 08:11:24','2026-08-28 08:11:24');
/*!40000 ALTER TABLE `channels` ENABLE KEYS */;

--
-- Table structure for table `comment_flags`
--

DROP TABLE IF EXISTS `comment_flags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `comment_flags` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `comment_id` bigint(20) unsigned NOT NULL,
  `moderator_id` bigint(20) unsigned NOT NULL,
  `category` varchar(80) NOT NULL,
  `explanation` varchar(1000) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `comment_flags_moderator_id_foreign` (`moderator_id`),
  KEY `comment_flags_comment_id_resolved_at_index` (`comment_id`,`resolved_at`),
  KEY `comment_flags_resolved_at_index` (`resolved_at`),
  CONSTRAINT `comment_flags_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`commentID`) ON DELETE CASCADE,
  CONSTRAINT `comment_flags_moderator_id_foreign` FOREIGN KEY (`moderator_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comment_flags`
--

/*!40000 ALTER TABLE `comment_flags` DISABLE KEYS */;
INSERT INTO `comment_flags` VALUES (1,3,1,'hate_speech',NULL,'2026-10-19 13:08:39',NULL),(2,4,1,'hate_speech',NULL,'2026-10-19 13:09:03',NULL),(3,5,1,'threat_intimidation',NULL,'2026-10-20 06:51:24',NULL);
/*!40000 ALTER TABLE `comment_flags` ENABLE KEYS */;

--
-- Table structure for table `comment_likes`
--

DROP TABLE IF EXISTS `comment_likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `comment_likes` (
  `comment_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`comment_id`,`user_id`),
  KEY `comment_likes_user_id_foreign` (`user_id`),
  CONSTRAINT `comment_likes_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`commentID`) ON DELETE CASCADE,
  CONSTRAINT `comment_likes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comment_likes`
--

/*!40000 ALTER TABLE `comment_likes` DISABLE KEYS */;
/*!40000 ALTER TABLE `comment_likes` ENABLE KEYS */;

--
-- Table structure for table `comment_moderation_history`
--

DROP TABLE IF EXISTS `comment_moderation_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `comment_moderation_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `comment_id` bigint(20) unsigned NOT NULL,
  `moderator_id` bigint(20) unsigned DEFAULT NULL,
  `from_status` varchar(24) DEFAULT NULL,
  `to_status` varchar(24) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `action` varchar(24) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `comment_moderation_history_comment_id_foreign` (`comment_id`),
  CONSTRAINT `comment_moderation_history_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`commentID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comment_moderation_history`
--

/*!40000 ALTER TABLE `comment_moderation_history` DISABLE KEYS */;
INSERT INTO `comment_moderation_history` VALUES (1,1,NULL,NULL,'pending_review','ai_flagged','2026-10-19 09:37:57',NULL),(2,2,NULL,NULL,'published','checks_passed','2026-10-19 09:38:27',NULL),(3,3,NULL,NULL,'published','checks_passed','2026-10-19 09:42:51',NULL),(4,4,NULL,NULL,'published','checks_passed','2026-10-19 09:43:43',NULL),(5,5,NULL,NULL,'published','checks_passed','2026-10-19 09:44:30',NULL),(6,6,NULL,NULL,'pending_review','ai_flagged','2026-10-19 09:44:41',NULL),(7,7,NULL,NULL,'published','checks_passed','2026-10-19 09:44:56',NULL),(8,8,NULL,NULL,'published','checks_passed','2026-10-19 09:45:06',NULL),(9,9,NULL,NULL,'pending_review','ai_flagged','2026-10-19 09:45:17',NULL),(10,10,NULL,NULL,'published','checks_passed','2026-10-19 09:45:31',NULL),(11,11,NULL,NULL,'published','checks_passed','2026-10-19 09:45:45',NULL),(12,12,NULL,NULL,'published','checks_passed','2026-10-19 09:46:01',NULL),(13,13,NULL,NULL,'pending_review','ai_flagged','2026-10-19 09:46:10',NULL),(14,14,NULL,NULL,'published','checks_passed','2026-10-19 09:46:21',NULL),(15,3,1,'published','removed','remove: Ujaran kebencian','2026-10-19 13:08:39',NULL),(16,4,1,'published','removed','remove: Ujaran kebencian','2026-10-19 13:09:03',NULL),(17,15,NULL,NULL,'published','checks_passed','2026-10-20 00:46:23',NULL),(18,16,NULL,NULL,'published','checks_passed','2026-10-20 00:51:03',NULL),(19,9,1,'pending_review','published','approve: Keputusan moderator.','2026-10-20 01:12:31',NULL),(20,5,1,'published','removed','remove: Ancaman atau intimidasi','2026-10-20 06:51:24',NULL),(21,9,1,'published','removed','remove: Ujaran kebencian','2026-10-20 06:52:01',NULL),(22,9,1,'removed','rejected','reject: Keputusan moderator.','2026-10-20 06:52:15',NULL),(23,17,NULL,NULL,'pending_review','ai_flagged','2026-10-22 04:00:58',NULL),(24,18,NULL,NULL,'published','checks_passed','2026-10-22 04:08:36',NULL),(25,19,NULL,NULL,'pending_review','ai_flagged','2026-10-22 04:09:28',NULL),(26,20,NULL,NULL,'published','checks_passed','2026-10-22 13:37:15',NULL);
/*!40000 ALTER TABLE `comment_moderation_history` ENABLE KEYS */;

--
-- Table structure for table `comment_reports`
--

DROP TABLE IF EXISTS `comment_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `comment_reports` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `comment_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL,
  `category` varchar(80) DEFAULT NULL,
  `explanation` varchar(450) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `comment_reports_comment_id_user_id_unique` (`comment_id`,`user_id`),
  KEY `comment_reports_user_id_foreign` (`user_id`),
  KEY `comment_reports_resolved_at_index` (`resolved_at`),
  CONSTRAINT `comment_reports_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`commentID`) ON DELETE CASCADE,
  CONSTRAINT `comment_reports_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comment_reports`
--

/*!40000 ALTER TABLE `comment_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `comment_reports` ENABLE KEYS */;

--
-- Table structure for table `comments`
--

DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `comments` (
  `commentID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `newsID` bigint(20) unsigned NOT NULL,
  `userID` bigint(20) unsigned DEFAULT NULL,
  `parentID` bigint(20) unsigned DEFAULT NULL,
  `guest_name` varchar(80) DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'pending_review',
  `ai_flagged` tinyint(1) DEFAULT NULL,
  `moderation_categories` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`moderation_categories`)),
  `moderation_reason` varchar(255) DEFAULT NULL,
  `moderated_at` timestamp NULL DEFAULT NULL,
  `submission_hash` varchar(64) DEFAULT NULL,
  `moderation_revision` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`commentID`),
  UNIQUE KEY `comments_submission_hash_unique` (`submission_hash`),
  KEY `comments_userid_foreign` (`userID`),
  KEY `comments_parentid_foreign` (`parentID`),
  KEY `comments_newsid_status_created_at_index` (`newsID`,`status`,`created_at`),
  KEY `comments_status_created_at_index` (`status`,`created_at`),
  CONSTRAINT `comments_newsid_foreign` FOREIGN KEY (`newsID`) REFERENCES `news` (`postID`) ON DELETE CASCADE,
  CONSTRAINT `comments_parentid_foreign` FOREIGN KEY (`parentID`) REFERENCES `comments` (`commentID`) ON DELETE SET NULL,
  CONSTRAINT `comments_userid_foreign` FOREIGN KEY (`userID`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comments`
--

/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
INSERT INTO `comments` VALUES (1,'Saya akan pukul kamu','2026-10-19 09:37:57','2026-10-19 09:37:57',18,NULL,NULL,'guest853744','pending_review',1,'{\"harassment\":true,\"harassment\\/threatening\":true,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":true,\"violence\\/graphic\":false}','ai_flagged',NULL,'dae2dd6eb5dedd94103fbc4f7b3f4279ca6b72495aa813002316d267a60255e2',0),(2,'Terima kasih atas informasinya!','2026-10-19 09:38:27','2026-10-19 09:38:27',18,NULL,NULL,'guest719554','published',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed',NULL,'fb1c8d3c5647b76e7634c0e28d24b91037c888f8c9c0601e7e29a42ef8dc5cd7',0),(3,'Pantes aja otaknya nggak nyampe, hal simpel gini aja nggak ngerti.','2026-10-19 09:42:51','2026-10-19 13:08:39',18,NULL,NULL,'guest435643','removed',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed','2026-10-19 13:08:39','1ad5fbe90eea3409078eb8badf2e9fea0b6fd717d2bb29250d7ca3db2b3a8aca',1),(4,'Wah, pinter banget ya adminnya, sampai berita salah aja diposting. Hebat deh.','2026-10-19 09:43:43','2026-10-19 13:09:03',18,NULL,NULL,'guest114550','removed',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed','2026-10-19 13:09:03','5c14d125abd54ddd665da3798764682f49584687be982224e56a9f74bec15877',1),(5,'Otak dipake dong, jangan cuma jadi pajangan.','2026-10-19 09:44:30','2026-10-20 06:51:24',18,NULL,NULL,'guest554893','removed',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed','2026-10-20 06:51:24','c1c1f6b58fdd26811857a8895f0dc2b45f5010d25649a9043e8ac042a5cb85a7',1),(6,'Lu tuh NPC banget dah, nggak ada otak buat mikir sendiri?','2026-10-19 09:44:41','2026-10-19 09:44:41',18,NULL,NULL,'guest495823','pending_review',1,'{\"harassment\":true,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','ai_flagged',NULL,'3b7fd8cb8ab7b1ad1f887beac84725aff2eb29ef9739ef0339122c744965685c',0),(7,'Hati-hati aja kalau ketemu gue di luar, ya. Jangan nyesel nanti.','2026-10-19 09:44:56','2026-10-19 09:44:56',18,NULL,NULL,'guest680595','published',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed',NULL,'5a86ccf902934d6a44408c0ef94d38c8bfd1191eee8258e4474d17ffea0d4300',0),(8,'Ya udahlah, emang nggak semua orang dikasih kemampuan buat mikir.','2026-10-19 09:45:06','2026-10-19 09:45:06',18,NULL,NULL,'guest188605','published',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed',NULL,'5243969232ae5e638dc3c1eb6ef0dffff80a11393ff97e7bf52e34f26adaa6b2',0),(9,'Dasar b0d0h, bikin malu satu kampung aja.','2026-10-19 09:45:17','2026-10-20 06:52:15',18,NULL,NULL,'guest600704','rejected',1,'{\"harassment\":true,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','ai_flagged','2026-10-20 06:52:15','6917d677b06de58a21688faef4d4d581872a4ffa0374b9c16ce1e9b15ccb3206',3),(10,'Menurut saya kepala desa kurang transparan soal anggaran. Tolong diperjelas.','2026-10-19 09:45:31','2026-10-19 09:45:31',18,NULL,NULL,'guest462481','published',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed',NULL,'fca7bb3912540f8d9e730022fb66399c64234c342553cc59cd3e4ec046ab128d',0),(11,'Wkwk, sok paling tahu padahal isi kepalanya kosong.','2026-10-19 09:45:45','2026-10-19 09:45:45',18,NULL,NULL,'guest944445','published',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed',NULL,'2af73aab4309de6a7b837f12c8d8e127de1dc1ddbc1fcb0bd1aaa62f996710d5',0),(12,'Orang kayak gitu mending nggak usah ikut diskusi, bikin suasana rusak.','2026-10-19 09:46:01','2026-10-19 09:46:01',18,NULL,NULL,'guest994910','published',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed',NULL,'7dff3c727547f48bf35c9e7f197ac9d5a29fb8aa97077c144207667f06bad8a0',0),(13,'Bro, stop acting smart. Lu cuma bikin malu diri sendiri, cringe parah.','2026-10-19 09:46:10','2026-10-19 09:46:10',18,NULL,NULL,'guest926252','pending_review',1,'{\"harassment\":true,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','ai_flagged',NULL,'10df5562f4429962e4d692d1b93a3edcadc96e12853aaaf822534fd3f287565a',0),(14,'Kayaknya informasi ini kurang akurat deh. Bisa dicek lagi sumbernya?','2026-10-19 09:46:21','2026-10-19 09:46:21',18,NULL,NULL,'guest109359','published',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed',NULL,'c73767c0585156169595502d39e6f36d1ac6e3fd364211c093051407c09a198f',0),(15,'thank you','2026-10-20 00:46:22','2026-10-20 00:46:22',18,9,2,NULL,'published',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed',NULL,'c5905339a43a74c4372b9a2a93f697bd9731156ba346b05732f1d5f9ccd959fe',0),(16,'testing','2026-10-20 00:51:03','2026-10-20 00:51:03',18,9,15,NULL,'published',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed',NULL,'617ffca59aac6f1e543cb0481bdc4b972b92fb5e7946f918755c9e190fcf498a',0),(17,'saya akan pukul kamu','2026-10-22 04:00:58','2026-10-22 04:00:58',14,NULL,NULL,'guest552598','pending_review',1,'{\"harassment\":true,\"harassment\\/threatening\":true,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":true,\"violence\\/graphic\":false}','ai_flagged',NULL,'5207ed7075376d6a1a3455a05279da2abd239c977dc68dee18591ddd06bc4235',0),(18,'thank you for the information','2026-10-22 04:08:35','2026-10-22 04:08:35',12,NULL,NULL,'guest665023','published',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed',NULL,'3555c0c68ae5b1794da0644f9aa720d873572f73a19546e729a34ea1a657bfdf',0),(19,'saya akan pukul kamu','2026-10-22 04:09:27','2026-10-22 04:09:27',12,NULL,NULL,'guest734802','pending_review',1,'{\"harassment\":true,\"harassment\\/threatening\":true,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":true,\"violence\\/graphic\":false}','ai_flagged',NULL,'24a3acfbcbfd3ba95f05766a22b078d0b266a6961c7a9357d52fa65344146a13',0),(20,'Thank you for the information','2026-10-22 13:37:15','2026-10-22 13:37:15',13,NULL,NULL,'guest496572','published',0,'{\"harassment\":false,\"harassment\\/threatening\":false,\"sexual\":false,\"hate\":false,\"hate\\/threatening\":false,\"illicit\":false,\"illicit\\/violent\":false,\"self-harm\\/intent\":false,\"self-harm\\/instructions\":false,\"self-harm\":false,\"sexual\\/minors\":false,\"violence\":false,\"violence\\/graphic\":false}','checks_passed',NULL,'2eebfdd47b2b8c3644f15ce0470695089fc60945ff122b93edc59e6ab0e5adf3',0);
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;

--
-- Table structure for table `emails`
--

DROP TABLE IF EXISTS `emails`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `emails` (
  `email` varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `userID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`email`),
  UNIQUE KEY `emails_userid_unique` (`userID`),
  CONSTRAINT `emails_userid_foreign` FOREIGN KEY (`userID`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `emails`
--

/*!40000 ALTER TABLE `emails` DISABLE KEYS */;
INSERT INTO `emails` VALUES ('noreply.apakhabar@gmail.com','2026-08-28 08:15:42','2026-08-28 08:11:25','2026-08-28 08:15:42',1),('yingxin0411@gmail.com','2026-10-19 13:24:06','2026-09-25 05:40:54','2026-10-19 13:24:06',9);
/*!40000 ALTER TABLE `emails` ENABLE KEYS */;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;

--
-- Table structure for table `guest_comment_days`
--

DROP TABLE IF EXISTS `guest_comment_days`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `guest_comment_days` (
  `guest_id` bigint(20) unsigned NOT NULL,
  `day` date NOT NULL,
  `comment_count` tinyint(3) unsigned NOT NULL,
  PRIMARY KEY (`guest_id`,`day`),
  CONSTRAINT `guest_comment_days_guest_id_foreign` FOREIGN KEY (`guest_id`) REFERENCES `guest_comment_identities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `guest_comment_days`
--

/*!40000 ALTER TABLE `guest_comment_days` DISABLE KEYS */;
/*!40000 ALTER TABLE `guest_comment_days` ENABLE KEYS */;

--
-- Table structure for table `guest_comment_identities`
--

DROP TABLE IF EXISTS `guest_comment_identities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `guest_comment_identities` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `token_hash` char(64) NOT NULL,
  `username` varchar(32) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `guest_comment_identities_token_hash_unique` (`token_hash`),
  UNIQUE KEY `guest_comment_identities_username_unique` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `guest_comment_identities`
--

/*!40000 ALTER TABLE `guest_comment_identities` DISABLE KEYS */;
/*!40000 ALTER TABLE `guest_comment_identities` ENABLE KEYS */;

--
-- Table structure for table `intelligence_documents`
--

DROP TABLE IF EXISTS `intelligence_documents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `intelligence_documents` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uploaded_by` bigint(20) unsigned NOT NULL,
  `ai_document_id` char(36) DEFAULT NULL,
  `original_name` varchar(255) NOT NULL,
  `storage_disk` varchar(50) NOT NULL DEFAULT 'local',
  `storage_path` varchar(255) NOT NULL,
  `mime_type` varchar(255) DEFAULT NULL,
  `file_size` bigint(20) unsigned NOT NULL,
  `sha256` varchar(64) NOT NULL,
  `status` enum('processing','ready','failed') NOT NULL DEFAULT 'processing',
  `embedding_status` enum('pending','ready','failed') NOT NULL DEFAULT 'pending',
  `processing_attempts` int(10) unsigned NOT NULL DEFAULT 0,
  `last_attempted_at` timestamp NULL DEFAULT NULL,
  `character_count` int(10) unsigned DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `archive_after` timestamp NULL DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `intelligence_documents_ai_document_id_unique` (`ai_document_id`),
  KEY `intelligence_documents_uploaded_by_foreign` (`uploaded_by`),
  KEY `intelligence_documents_sha256_index` (`sha256`),
  KEY `intelligence_documents_status_index` (`status`),
  KEY `intelligence_documents_embedding_status_index` (`embedding_status`),
  KEY `intelligence_documents_last_attempted_at_index` (`last_attempted_at`),
  KEY `intelligence_documents_archive_after_index` (`archive_after`),
  KEY `intelligence_documents_archived_at_index` (`archived_at`),
  CONSTRAINT `intelligence_documents_uploaded_by_foreign` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intelligence_documents`
--

/*!40000 ALTER TABLE `intelligence_documents` DISABLE KEYS */;
INSERT INTO `intelligence_documents` VALUES (1,1,'63f5650c-d77f-4999-b11e-fd8e3caa792a','apakhabar_data_uji_berita_lain.csv','local','intelligence-documents/VTKGlvPkIF1EoCTeSuCDuQOP0VBGXODO9Pd6IPMy.csv','text/csv',35970,'0720653c989808a52ef38c9498504056f95129b6f92ae2773ef6e68a4b2afa96','ready','pending',1,'2026-09-28 12:31:39',35483,NULL,'2026-09-28 12:32:20','2029-09-28 12:31:34',NULL,'2026-09-28 12:31:34','2026-09-28 12:32:20',NULL);
/*!40000 ALTER TABLE `intelligence_documents` ENABLE KEYS */;

--
-- Table structure for table `intelligence_extraction_requests`
--

DROP TABLE IF EXISTS `intelligence_extraction_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `intelligence_extraction_requests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `document_id` bigint(20) unsigned NOT NULL,
  `requested_by` bigint(20) unsigned NOT NULL,
  `mode` enum('general','targeted') NOT NULL DEFAULT 'general',
  `original_prompt` text DEFAULT NULL,
  `normalized_query` text DEFAULT NULL,
  `keywords` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`keywords`)),
  `model_name` varchar(255) DEFAULT NULL,
  `prompt_version` varchar(50) NOT NULL DEFAULT 'extraction-v2',
  `status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  `error_message` text DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `intelligence_extraction_requests_document_id_foreign` (`document_id`),
  KEY `intelligence_extraction_requests_requested_by_foreign` (`requested_by`),
  KEY `intelligence_extraction_requests_mode_index` (`mode`),
  KEY `intelligence_extraction_requests_status_index` (`status`),
  CONSTRAINT `intelligence_extraction_requests_document_id_foreign` FOREIGN KEY (`document_id`) REFERENCES `intelligence_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `intelligence_extraction_requests_requested_by_foreign` FOREIGN KEY (`requested_by`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intelligence_extraction_requests`
--

/*!40000 ALTER TABLE `intelligence_extraction_requests` DISABLE KEYS */;
INSERT INTO `intelligence_extraction_requests` VALUES (1,1,1,'targeted','Tolong buatkan berita untuk warga Desa Punggul dari data kegiatan kesehatan di file ini. Jelaskan kegiatannya dan hasilnya dengan bahasa yang mudah dipahami.','Tolong buatkan berita untuk warga Desa Punggul dari data kegiatan kesehatan di file ini. Jelaskan kegiatannya dan hasilnya dengan bahasa yang mudah dipahami.','[]',NULL,'extraction-v2','completed',NULL,'2026-09-28 12:31:39','2026-09-28 12:32:20','2026-09-28 12:31:34','2026-09-28 12:32:20');
/*!40000 ALTER TABLE `intelligence_extraction_requests` ENABLE KEYS */;

--
-- Table structure for table `intelligence_information`
--

DROP TABLE IF EXISTS `intelligence_information`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `intelligence_information` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `document_id` bigint(20) unsigned NOT NULL,
  `extraction_request_id` bigint(20) unsigned DEFAULT NULL,
  `item_index` int(10) unsigned NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `summary` longtext NOT NULL,
  `labels` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`labels`)),
  `fields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`fields`)),
  `evidence` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`evidence`)),
  `confidence` decimal(5,4) DEFAULT NULL,
  `review_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  `quality_score` decimal(5,2) DEFAULT NULL,
  `quality_breakdown` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quality_breakdown`)),
  `information_embedding_status` enum('pending','ready','failed') NOT NULL DEFAULT 'pending',
  `search_text` longtext NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `reviewed_by` bigint(20) unsigned DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `information_request_item_unique` (`extraction_request_id`,`item_index`),
  KEY `intelligence_information_type_created_at_index` (`type`,`created_at`),
  KEY `intelligence_information_is_active_index` (`is_active`),
  KEY `intelligence_information_document_id_index` (`document_id`),
  KEY `intelligence_information_reviewed_by_foreign` (`reviewed_by`),
  KEY `intelligence_information_review_status_index` (`review_status`),
  KEY `intelligence_information_information_embedding_status_index` (`information_embedding_status`),
  CONSTRAINT `intelligence_information_document_id_foreign` FOREIGN KEY (`document_id`) REFERENCES `intelligence_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `intelligence_information_extraction_request_id_foreign` FOREIGN KEY (`extraction_request_id`) REFERENCES `intelligence_extraction_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `intelligence_information_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`userID`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intelligence_information`
--

/*!40000 ALTER TABLE `intelligence_information` DISABLE KEYS */;
INSERT INTO `intelligence_information` VALUES (1,1,1,0,'General','Layanan skrining kesehatan warga','Layanan skrining kesehatan warga: 120 kunjungan tercatat. Rincian kegiatan dan hasil dihitung dari seluruh baris sumber; jumlah orang unik belum diketahui.','[\"ringkasan data\"]','{\"table_analysis\":{\"record_count\":120,\"record_unit\":\"kunjungan\",\"unique_person_count\":null,\"distinct_visit_id_count\":120,\"columns\":{\"id_kunjungan\":{\"label\":\"id_kunjungan\",\"missing\":0,\"distinct_values\":120},\"kategori_berita\":{\"label\":\"kategori_berita\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"Kesehatan\":120}},\"tanggal_kegiatan\":{\"label\":\"tanggal_kegiatan\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"2026-09-21\":120}},\"nama_kegiatan\":{\"label\":\"nama_kegiatan\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"Layanan skrining kesehatan warga\":120}},\"penyelenggara\":{\"label\":\"penyelenggara\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"Kader Posyandu Melati dan petugas Puskesmas setempat\":120}},\"lokasi_kegiatan\":{\"label\":\"lokasi_kegiatan\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"Balai Desa Punggul\":120}},\"dusun_asal\":{\"label\":\"dusun_asal\",\"missing\":0,\"distinct_values\":4,\"counts\":{\"Punggul Kaja\":30,\"Punggul Kelod\":30,\"Punggul Tengah\":30,\"Punggul Barat\":30}},\"kelompok_usia\":{\"label\":\"kelompok_usia\",\"missing\":0,\"distinct_values\":4,\"counts\":{\"40-49 tahun\":32,\"50-59 tahun\":32,\"60-69 tahun\":28,\"70 tahun ke atas\":28}},\"jenis_layanan\":{\"label\":\"jenis_layanan\",\"missing\":0,\"distinct_values\":3,\"counts\":{\"Pemeriksaan tekanan darah\":40,\"Pemeriksaan gula darah\":40,\"Konsultasi kesehatan umum\":40}},\"hasil_skrining\":{\"label\":\"hasil_skrining\",\"missing\":0,\"distinct_values\":4,\"counts\":{\"Hasil dicatat\":56,\"Konsultasi selesai\":40,\"Perlu pemeriksaan ulang\":16,\"Perlu pemeriksaan lanjutan\":8}},\"tindak_lanjut\":{\"label\":\"tindak_lanjut\",\"missing\":0,\"distinct_values\":3,\"counts\":{\"Tidak ada tindak lanjut khusus yang dicatat\":84,\"Disarankan pemeriksaan ulang\":24,\"Disarankan konsultasi lanjutan ke Puskesmas\":12}},\"biaya\":{\"label\":\"biaya\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"Gratis\":120}},\"status_data\":{\"label\":\"status_data\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"FIKTIF UNTUK UJI AI\":120}}},\"duplicate_rows\":0,\"source_row_ranges\":[[2,121]],\"method\":\"full_table_descriptive_v1\",\"limitations\":[\"Jumlah catatan\\/kunjungan bukan jumlah orang unik.\",\"Distribusi tiap kolom dihitung terpisah; jangan menjumlahkan hasil dan tindak lanjut sebagai orang berbeda.\"]}}','[{\"source\":\"filename=apakhabar_data_uji_berita_lain.csv, section=calculated-table-analysis\",\"quote\":\"Perhitungan seluruh baris sumber: {\\\"record_count\\\": 120, \\\"record_unit\\\": \\\"kunjungan\\\", \\\"unique_person_count\\\": null, \\\"distinct_visit_id_count\\\": 120, \\\"columns\\\": {\\\"id_kunjungan\\\": {\\\"label\\\": \\\"id_kunjungan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 120}, \\\"kategori_berita\\\": {\\\"label\\\": \\\"kategori_berita\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Kesehatan\\\": 120}}, \\\"tanggal_kegiatan\\\": {\\\"label\\\": \\\"tanggal_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"2026-09-21\\\": 120}}, \\\"nama_kegiatan\\\": {\\\"label\\\": \\\"nama_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Layanan skrining kesehatan warga\\\": 120}}, \\\"penyelenggara\\\": {\\\"label\\\": \\\"penyelenggara\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Kader Posyandu Melati dan petugas Puskesmas setempat\\\": 120}}, \\\"lokasi_kegiatan\\\": {\\\"label\\\": \\\"lokasi_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Balai Desa Punggul\\\": 120}}, \\\"dusun_asal\\\": {\\\"label\\\": \\\"dusun_asal\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"Punggul Kaja\\\": 30, \\\"Punggul Kelod\\\": 30, \\\"Punggul Tengah\\\": 30, \\\"Punggul Barat\\\": 30}}, \\\"kelompok_usia\\\": {\\\"label\\\": \\\"kelompok_usia\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"40-49 tahun\\\": 32, \\\"50-59 tahun\\\": 32, \\\"60-69 tahun\\\": 28, \\\"70 tahun ke atas\\\": 28}}, \\\"jenis_layanan\\\": {\\\"label\\\": \\\"jenis_layanan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 3, \\\"counts\\\": {\\\"Pemeriksaan tekanan darah\\\": 40, \\\"Pemeriksaan gula darah\\\": 40, \\\"Konsultasi kesehatan umum\\\": 40}}, \\\"hasil_skrining\\\": {\\\"label\\\": \\\"hasil_skrining\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"Hasil dicatat\\\": 56, \\\"Konsultasi selesai\\\": 40, \\\"Perlu pemeriksaan ulang\\\": 16, \\\"Perlu pemeriksaan lanjutan\\\": 8}}, \\\"tindak_lanjut\\\": {\\\"label\\\": \\\"tindak_lanjut\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 3, \\\"counts\\\": {\\\"Tidak ada tindak lanjut khusus yang dicatat\\\": 84, \\\"Disarankan pemeriksaan ulang\\\": 24, \\\"Disarankan konsultasi lanjutan ke Puskesmas\\\": 12}}, \\\"biaya\\\": {\\\"label\\\": \\\"biaya\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Gratis\\\": 120}}, \\\"status_data\\\": {\\\"label\\\": \\\"status_data\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"FIKTIF UNTUK UJI AI\\\": 120}}}, \\\"duplicate_rows\\\": 0, \\\"source_row_ranges\\\": [[2, 121]], \\\"method\\\": \\\"full_table_descriptive_v1\\\", \\\"limitations\\\": [\\\"Jumlah catatan\\/kunjungan bukan jumlah orang unik.\\\", \\\"Distribusi tiap kolom dihitung terpisah; jangan menjumlahkan hasil dan tindak lanjut sebagai orang berbeda.\\\"]}\"}]',0.9500,'approved',78.50,'{\"evidence_coverage\":50,\"completeness\":100,\"model_confidence\":95}','failed','Layanan skrining kesehatan warga Layanan skrining kesehatan warga: 120 kunjungan tercatat. Rincian kegiatan dan hasil dihitung dari seluruh baris sumber; jumlah orang unik belum diketahui. [\"ringkasan data\"] {\"table_analysis\":{\"record_count\":120,\"record_unit\":\"kunjungan\",\"unique_person_count\":null,\"distinct_visit_id_count\":120,\"columns\":{\"id_kunjungan\":{\"label\":\"id_kunjungan\",\"missing\":0,\"distinct_values\":120},\"kategori_berita\":{\"label\":\"kategori_berita\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"Kesehatan\":120}},\"tanggal_kegiatan\":{\"label\":\"tanggal_kegiatan\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"2026-09-21\":120}},\"nama_kegiatan\":{\"label\":\"nama_kegiatan\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"Layanan skrining kesehatan warga\":120}},\"penyelenggara\":{\"label\":\"penyelenggara\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"Kader Posyandu Melati dan petugas Puskesmas setempat\":120}},\"lokasi_kegiatan\":{\"label\":\"lokasi_kegiatan\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"Balai Desa Punggul\":120}},\"dusun_asal\":{\"label\":\"dusun_asal\",\"missing\":0,\"distinct_values\":4,\"counts\":{\"Punggul Kaja\":30,\"Punggul Kelod\":30,\"Punggul Tengah\":30,\"Punggul Barat\":30}},\"kelompok_usia\":{\"label\":\"kelompok_usia\",\"missing\":0,\"distinct_values\":4,\"counts\":{\"40-49 tahun\":32,\"50-59 tahun\":32,\"60-69 tahun\":28,\"70 tahun ke atas\":28}},\"jenis_layanan\":{\"label\":\"jenis_layanan\",\"missing\":0,\"distinct_values\":3,\"counts\":{\"Pemeriksaan tekanan darah\":40,\"Pemeriksaan gula darah\":40,\"Konsultasi kesehatan umum\":40}},\"hasil_skrining\":{\"label\":\"hasil_skrining\",\"missing\":0,\"distinct_values\":4,\"counts\":{\"Hasil dicatat\":56,\"Konsultasi selesai\":40,\"Perlu pemeriksaan ulang\":16,\"Perlu pemeriksaan lanjutan\":8}},\"tindak_lanjut\":{\"label\":\"tindak_lanjut\",\"missing\":0,\"distinct_values\":3,\"counts\":{\"Tidak ada tindak lanjut khusus yang dicatat\":84,\"Disarankan pemeriksaan ulang\":24,\"Disarankan konsultasi lanjutan ke Puskesmas\":12}},\"biaya\":{\"label\":\"biaya\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"Gratis\":120}},\"status_data\":{\"label\":\"status_data\",\"missing\":0,\"distinct_values\":1,\"counts\":{\"FIKTIF UNTUK UJI AI\":120}}},\"duplicate_rows\":0,\"source_row_ranges\":[[2,121]],\"method\":\"full_table_descriptive_v1\",\"limitations\":[\"Jumlah catatan\\/kunjungan bukan jumlah orang unik.\",\"Distribusi tiap kolom dihitung terpisah; jangan menjumlahkan hasil dan tindak lanjut sebagai orang berbeda.\"]}}',1,1,'2026-09-28 12:35:06','2026-09-28 12:32:20','2026-09-28 12:35:06',NULL);
/*!40000 ALTER TABLE `intelligence_information` ENABLE KEYS */;

--
-- Table structure for table `intelligent_news_draft_sources`
--

DROP TABLE IF EXISTS `intelligent_news_draft_sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `intelligent_news_draft_sources` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `draft_id` bigint(20) unsigned NOT NULL,
  `information_id` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `intelligent_news_draft_sources_draft_id_information_id_unique` (`draft_id`,`information_id`),
  KEY `intelligent_news_draft_sources_information_id_foreign` (`information_id`),
  CONSTRAINT `intelligent_news_draft_sources_draft_id_foreign` FOREIGN KEY (`draft_id`) REFERENCES `intelligent_news_drafts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `intelligent_news_draft_sources_information_id_foreign` FOREIGN KEY (`information_id`) REFERENCES `intelligence_information` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intelligent_news_draft_sources`
--

/*!40000 ALTER TABLE `intelligent_news_draft_sources` DISABLE KEYS */;
/*!40000 ALTER TABLE `intelligent_news_draft_sources` ENABLE KEYS */;

--
-- Table structure for table `intelligent_news_draft_versions`
--

DROP TABLE IF EXISTS `intelligent_news_draft_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `intelligent_news_draft_versions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `draft_id` bigint(20) unsigned NOT NULL,
  `version` int(10) unsigned NOT NULL,
  `change_type` varchar(30) NOT NULL,
  `revision_source` varchar(30) NOT NULL DEFAULT 'manual',
  `revision_instruction` text DEFAULT NULL,
  `snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`snapshot`)),
  `created_by` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `intelligent_news_draft_versions_draft_id_version_unique` (`draft_id`,`version`),
  KEY `intelligent_news_draft_versions_created_by_foreign` (`created_by`),
  CONSTRAINT `intelligent_news_draft_versions_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`userID`) ON DELETE CASCADE,
  CONSTRAINT `intelligent_news_draft_versions_draft_id_foreign` FOREIGN KEY (`draft_id`) REFERENCES `intelligent_news_drafts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intelligent_news_draft_versions`
--

/*!40000 ALTER TABLE `intelligent_news_draft_versions` DISABLE KEYS */;
/*!40000 ALTER TABLE `intelligent_news_draft_versions` ENABLE KEYS */;

--
-- Table structure for table `intelligent_news_drafts`
--

DROP TABLE IF EXISTS `intelligent_news_drafts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `intelligent_news_drafts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `created_by` bigint(20) unsigned NOT NULL,
  `creation_method` enum('manual','ai') NOT NULL DEFAULT 'ai',
  `category_id` bigint(20) unsigned DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `labels` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`labels`)),
  `sources_used` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`sources_used`)),
  `warnings` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`warnings`)),
  `user_prompt` text DEFAULT NULL,
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  `version` int(10) unsigned NOT NULL DEFAULT 1,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `published_news_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `show_on_homepage` tinyint(1) NOT NULL DEFAULT 1,
  `instagram_media_id` varchar(255) DEFAULT NULL,
  `facebook_post_id` varchar(255) DEFAULT NULL,
  `publication_results` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`publication_results`)),
  `publication_started_at` timestamp NULL DEFAULT NULL,
  `image_crops` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`image_crops`)),
  `image_variants` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`image_variants`)),
  `content` longtext NOT NULL,
  `excerpt` text DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `intelligent_news_drafts_created_by_foreign` (`created_by`),
  KEY `intelligent_news_drafts_published_news_id_foreign` (`published_news_id`),
  KEY `intelligent_news_drafts_status_index` (`status`),
  KEY `intelligent_news_drafts_category_id_foreign` (`category_id`),
  KEY `intelligent_news_drafts_creation_method_index` (`creation_method`),
  CONSTRAINT `intelligent_news_drafts_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `news_categories` (`categoryID`) ON DELETE SET NULL,
  CONSTRAINT `intelligent_news_drafts_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`userID`) ON DELETE CASCADE,
  CONSTRAINT `intelligent_news_drafts_published_news_id_foreign` FOREIGN KEY (`published_news_id`) REFERENCES `news` (`postID`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intelligent_news_drafts`
--

/*!40000 ALTER TABLE `intelligent_news_drafts` DISABLE KEYS */;
INSERT INTO `intelligent_news_drafts` VALUES (1,1,'manual',2,'http://localhost:8000/storage/news-images/GA1zry2xBMESzKX5VtuDKTdKWv1WvZs24zAkWJ4o.png','123','[]','[]','[]',NULL,'published',1,'2026-09-25 05:07:37',NULL,'2026-09-25 05:07:37','2026-09-25 05:07:37',0,NULL,NULL,NULL,NULL,NULL,NULL,'defrgtfhjsawqefvgrwcfdsefcvsd',NULL,NULL),(2,1,'manual',2,'http://192.168.68.59:8000/storage/news-images/578gn2N9fYQf2ur1swF7R7bKuAhHX3lYxCvAtO26.jpg','test','[]','[]','[]',NULL,'published',1,'2026-09-25 09:01:33',7,'2026-09-25 09:01:33','2026-09-25 09:01:33',1,NULL,NULL,NULL,NULL,NULL,NULL,'testtesttesttesttesttesttest',NULL,NULL),(3,1,'manual',2,'http://192.168.68.59:8000/storage/news-images/tdudaSanN0Jf41JGwvJ16jRqGcWmAHsEWwSGZx2T.png','milagro design sponsor apakhabar','[]','[]','[]',NULL,'draft',1,'2026-09-25 09:34:05',NULL,'2026-09-25 09:34:05','2026-09-25 09:34:05',1,NULL,NULL,NULL,NULL,NULL,NULL,'test1111test1111test1111test1111test1111',NULL,NULL),(4,1,'manual',2,'http://192.168.68.59:8000/storage/news-images/Kcok9m7WCPyQIZAi0xqfTwlX1s4m96HFN3VsP6HR.png','milagro design sponsor apakhabar','[]','[]','[]',NULL,'draft',1,'2026-09-25 09:35:41',NULL,'2026-09-25 09:35:41','2026-09-25 09:35:41',1,NULL,NULL,NULL,NULL,NULL,NULL,'test1111test1111test1111test1111test1111',NULL,NULL),(5,1,'manual',2,'http://192.168.68.59:8000/storage/news-images/mVE8Tf2LkRBXANKpRWN9TMdyBnOesWDJZFPYKXli.png','milagro design sponsor apakhabar','[]','[]','[]',NULL,'draft',1,'2026-09-25 09:36:38',NULL,'2026-09-25 09:36:38','2026-09-25 09:36:38',1,NULL,NULL,NULL,NULL,NULL,NULL,'test1111test1111test1111test1111test1111',NULL,NULL),(6,1,'manual',2,'http://192.168.68.59:8000/storage/news-images/a3IvQ1SyOMvXs7K6ucT1afCLTfGLXqJawgQi0aff.jpg','milagro design sponsor apakhabar','[]','[]','[]',NULL,'draft',1,'2026-09-25 10:52:20',8,'2026-09-25 10:48:53','2026-09-25 10:52:20',1,NULL,NULL,NULL,NULL,NULL,NULL,'test1111test1111test1111test1111test1111test1111test1111',NULL,NULL),(7,1,'manual',2,'http://192.168.68.59:8000/storage/news-images/1c7yIJWOa9iGsOxsU7fbexOB88WFtNn7yRpvSLEH.png','AAA milagro design sponsor apakhabar','[]','[]','[]',NULL,'draft',1,'2026-09-25 11:03:12',9,'2026-09-25 11:03:12','2026-09-25 11:03:12',1,NULL,NULL,NULL,NULL,NULL,NULL,'testabcdtestabcdtestabcdtestabcdtestabcd',NULL,NULL),(8,1,'manual',NULL,'http://192.168.68.59:8000/storage/news-images/oZTHkhxo94YkUJZYnSUiVW1dCe7b2cvgQiu0V9hX.png','BBBB milagro design sponsor apakhabar','[]','[]','[]',NULL,'draft',1,'2026-09-25 11:08:20',10,'2026-09-25 11:08:20','2026-09-25 11:08:20',1,NULL,NULL,NULL,NULL,NULL,NULL,'php -m | findstr gdphp -m | findstr gdphp -m | findstr gdphp -m | findstr gdphp -m | findstr gdphp -m | findstr gd',NULL,NULL),(9,1,'manual',2,'http://192.168.68.59:8000/storage/news-images/SOs1bMWtwfSVhzeWnB1NOKvttL2jewg7ozu10b1I.jpg','first post cat checking','[]','[]','[]',NULL,'published',1,'2026-09-26 02:35:44',11,'2026-09-26 02:20:19','2026-09-26 02:35:56',1,'18133977088635528',NULL,NULL,NULL,NULL,NULL,'testabcdtestabcdtestabcd',NULL,NULL),(10,1,'manual',1,'http://192.168.68.59:8000/storage/news-images/knkv0LNHmCZqqcIMp0wd8GLfTYDVPyZWBJi2hbYz.png','Milagro Design Resmi Menjadi Sponsor ApaKhabar','[]','[]','[]',NULL,'published',1,'2026-09-26 02:59:40',12,'2026-09-26 02:59:40','2026-09-26 02:59:52',1,'17971088220160017',NULL,NULL,NULL,NULL,NULL,'Kami dengan sukacita mengumumkan bahwa Milagro Design telah resmi menjadi sponsor ApaKhabar.<div>Dukungan dari Milagro Design menjadi bagian penting dalam pengembangan ApaKhabar sebagai platform informasi dan berita digital yang bertujuan membantu masyarakat Desa Punggul memperoleh informasi dengan lebih cepat, mudah, dan terstruktur.</div><div>Melalui dukungan ini, ApaKhabar dapat terus meningkatkan kualitas layanan serta mendukung penyampaian informasi yang lebih efektif kepada masyarakat.</div><div>Kami mengucapkan terima kasih kepada Milagro Design atas kepercayaan dan dukungannya terhadap ApaKhabar. Semoga kolaborasi ini dapat memberikan manfaat positif bagi masyarakat Desa Punggul.</div>',NULL,NULL),(11,1,'manual',2,'http://192.168.68.59:8000/storage/news-images/3zT6stwpo8d32fU4lEcGAhuViFWIki2PLOFoJeQW.jpg','testing kitty appear in page','[]','[]','[]',NULL,'published',1,'2026-09-26 12:44:03',13,'2026-09-26 12:24:55','2026-09-26 12:44:10',1,NULL,'1258664320673115_122106634629483094',NULL,NULL,NULL,NULL,'meowmeowmeowmeowmeowmeow',NULL,NULL),(12,1,'manual',2,'http://192.168.68.59:8000/storage/news-images/8uWBtDaE50ZN5nERAVv05csbkUG6h4Vy0L7NElXT.jpg','milagro design sponsor apakhabar','[]','[]','[]',NULL,'published',1,'2026-09-27 08:23:02',14,'2026-09-27 08:04:55','2026-09-27 08:23:12',1,'17941155990358237','1258664320673115_122107537989483094',NULL,NULL,NULL,NULL,'testtesttesttesttesttesttesttest',NULL,NULL),(13,1,'manual',NULL,'http://192.168.68.59:8000/storage/news-images/1t4586iG0gfAIpqMH99ZCr6miU56XH3S8gDT0LZ9.png','testing fb','[]','[]','[]',NULL,'published',1,'2026-09-27 08:24:53',NULL,'2026-09-27 08:24:53','2026-09-27 08:25:02',1,NULL,'1258664320673115_122107540143483094',NULL,NULL,NULL,NULL,'testing fb after close meta service for token reliable',NULL,NULL),(14,1,'manual',2,'http://localhost:8000/storage/news-images/BEXvmvi0d6xa3vgZug08B6m2uVgRWYgRVxlhmai8.jpg','Merry Christmas','[]','[]','[]',NULL,'published',1,'2026-09-28 06:16:56',15,'2026-09-28 06:16:56','2026-09-28 06:17:19',1,'17913949245463578','1258664320673115_122108472213483094',NULL,NULL,NULL,NULL,'testtesttesttesttesttesttesttesttesttesttesttesttesttest',NULL,NULL),(15,1,'manual',NULL,'http://localhost:8000/storage/news-images/Ae56fNguD7FUCp5qxS0LmUM1IsjwnOFewzjRql8n.png','test','[]','[]','[]',NULL,'published',1,'2026-09-28 08:37:33',NULL,'2026-09-28 08:37:33','2026-09-28 08:37:53',1,'18118379522075862','1410344055493000_122109440121483454',NULL,NULL,NULL,NULL,'testtesttesttesttesttesttesttesttest',NULL,NULL),(16,1,'manual',2,'http://localhost:8000/storage/news-images/uUMYh6OcWzyMPZxUT6kRn9jEsH16BH5v6mcgrqTp.png','pets','[]','[]','[]',NULL,'published',1,'2026-09-29 05:08:57',16,'2026-09-29 05:08:57','2026-09-29 05:09:29',1,'18104029813979045','1410344055493000_122110116429483454','{\"application\":{\"success\":true},\"facebook\":{\"success\":true},\"instagram\":{\"success\":true}}','2026-09-29 05:08:57',NULL,NULL,'<blockquote>petspetspetspetspets</blockquote>',NULL,NULL),(17,1,'manual',2,'http://localhost:8000/storage/news-images/CQdEXt44pobk9FR7bQnlWPdK9gR00UtbWzZLpg8E.png','test','[]','[]','[]',NULL,'published',1,'2026-09-29 06:07:09',17,'2026-09-29 06:07:09','2026-09-29 06:07:36',1,'18102646328528094','1410344055493000_122110141923483454','{\"application\":{\"success\":true},\"instagram\":{\"success\":true},\"facebook\":{\"success\":true}}','2026-09-29 06:07:09',NULL,NULL,'testtesttesttesttesttest',NULL,NULL),(18,1,'manual',NULL,'http://localhost:8000/storage/news-images/previews/029704b0-2fc0-4619-8427-215a1c252ac1/O6LnGkhLm1dgn5uoFjznbeFpGKOWZx5Ky6cl3ZPr.jpg','BBBB milagro design sponsor apakhabar','[]','[]','[]',NULL,'published',1,'2026-10-01 04:33:29',18,'2026-10-01 04:33:29','2026-10-01 04:33:52',1,'18008137292997232','1410344055493000_122111679405483454','{\"application\":{\"success\":true},\"facebook\":{\"success\":true},\"instagram\":{\"success\":true}}','2026-10-01 04:33:29','{\"sync\":true,\"website\":{\"x\":0.5,\"y\":0.5,\"zoom\":1},\"instagram\":{\"x\":0.5,\"y\":0.5,\"zoom\":3.42},\"facebook\":{\"x\":0.5,\"y\":0.5,\"zoom\":1}}','{\"website\":\"http:\\/\\/localhost:8000\\/storage\\/news-images\\/previews\\/029704b0-2fc0-4619-8427-215a1c252ac1\\/crops\\/0ce466c5c107c162337d690e8311530fa02bcee16f7ba20055481448f9d4ac21.jpg\",\"instagram\":\"http:\\/\\/localhost:8000\\/storage\\/news-images\\/previews\\/029704b0-2fc0-4619-8427-215a1c252ac1\\/crops\\/a537cabbdf4c225e7a642b4f18c6ddab7bd33b23652d58a46dd1b7fa0c711b8b.jpg\",\"facebook\":\"http:\\/\\/localhost:8000\\/storage\\/news-images\\/previews\\/029704b0-2fc0-4619-8427-215a1c252ac1\\/crops\\/61c74fd71eb732b4f4df24d41a1afe7a6c585257a3c06df2b39171a581db1388.jpg\"}','BBBB milagro design sponsor apakhabarBBBB milagro design sponsor apakhabar',NULL,NULL),(19,1,'manual',NULL,NULL,'bjb','[]','[]','[]',NULL,'draft',1,NULL,NULL,'2026-10-06 05:52:14','2026-10-06 05:52:14',1,NULL,NULL,NULL,NULL,NULL,NULL,'','',NULL),(20,1,'manual',3,'http://localhost:8000/storage/news-images/previews/8d1a543f-cebf-4172-aeee-ca20c7af864d/4f552040f3561bfc0f2e21522e13761ed3298bce182112370cbf1888c1af8448.webp','test','[]','[]','[]',NULL,'published',1,'2026-10-20 05:50:53',19,'2026-10-20 05:50:53','2026-10-20 05:50:53',1,NULL,NULL,'{\"application\":{\"success\":true}}','2026-10-20 05:50:53','{\"sync\":true,\"website\":{\"x\":0.5,\"y\":0.5,\"zoom\":1},\"instagram\":{\"x\":0.5,\"y\":0.5,\"zoom\":1,\"type\":\"portrait\"},\"facebook\":{\"x\":0.5,\"y\":0.5,\"zoom\":1,\"type\":\"portrait\"}}','{\"website\":\"http:\\/\\/localhost:8000\\/storage\\/news-images\\/previews\\/8d1a543f-cebf-4172-aeee-ca20c7af864d\\/crops\\/578041e85a499b801ee40c28d8cdbdb7b26285ec8069a9266d67d54d2ab2dabe.webp\",\"instagram\":\"http:\\/\\/localhost:8000\\/storage\\/news-images\\/previews\\/8d1a543f-cebf-4172-aeee-ca20c7af864d\\/crops\\/7e192458e43a5ee07e3db61eb4da55b7b177a51bba81a790520179e4b864a548.jpg\",\"facebook\":\"http:\\/\\/localhost:8000\\/storage\\/news-images\\/previews\\/8d1a543f-cebf-4172-aeee-ca20c7af864d\\/crops\\/8f4a038ca67c56888ffd2d10100398eee8bdb9f364522d7c085a7c7ec0343740.jpg\"}','testingdsvfsvwadfswfedsfftglkmANCXJFD','testingdsvfsvwadfswfedsfftglkmANCXJFD',NULL);
/*!40000 ALTER TABLE `intelligent_news_drafts` ENABLE KEYS */;

--
-- Table structure for table `intelligent_news_messages`
--

DROP TABLE IF EXISTS `intelligent_news_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `intelligent_news_messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `session_id` bigint(20) unsigned NOT NULL,
  `reply_to_id` bigint(20) unsigned DEFAULT NULL,
  `role` enum('user','assistant','tool','system') NOT NULL,
  `status` enum('pending','completed','failed') NOT NULL DEFAULT 'completed',
  `sequence` int(10) unsigned NOT NULL DEFAULT 0,
  `intent` varchar(50) DEFAULT NULL,
  `content` longtext DEFAULT NULL,
  `tool_name` varchar(100) DEFAULT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `draft_version_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `intelligent_news_messages_draft_version_id_foreign` (`draft_version_id`),
  KEY `intelligent_news_messages_session_id_created_at_index` (`session_id`,`created_at`),
  KEY `intelligent_news_messages_intent_index` (`intent`),
  KEY `intelligent_news_messages_reply_to_id_foreign` (`reply_to_id`),
  KEY `news_message_session_sequence_index` (`session_id`,`sequence`),
  KEY `intelligent_news_messages_status_index` (`status`),
  CONSTRAINT `intelligent_news_messages_draft_version_id_foreign` FOREIGN KEY (`draft_version_id`) REFERENCES `intelligent_news_draft_versions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `intelligent_news_messages_reply_to_id_foreign` FOREIGN KEY (`reply_to_id`) REFERENCES `intelligent_news_messages` (`id`) ON DELETE SET NULL,
  CONSTRAINT `intelligent_news_messages_session_id_foreign` FOREIGN KEY (`session_id`) REFERENCES `intelligent_news_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intelligent_news_messages`
--

/*!40000 ALTER TABLE `intelligent_news_messages` DISABLE KEYS */;
INSERT INTO `intelligent_news_messages` VALUES (1,1,NULL,'user','completed',1,'generate_news','Tolong buatkan berita untuk warga Desa Punggul dari data kegiatan kesehatan di file ini. Jelaskan kegiatannya dan hasilnya dengan bahasa yang mudah dipahami.',NULL,'{\"document_ids\":[1],\"filenames\":[\"apakhabar_data_uji_berita_lain.csv\"]}',NULL,'2026-09-28 12:31:34','2026-09-28 12:31:34'),(2,1,NULL,'assistant','completed',2,'document_processing','Saya menerima 1 file: apakhabar_data_uji_berita_lain.csv. Saya akan membaca dokumen, mengekstrak fakta dan bukti, lalu memberi tahu Anda ketika proses selesai. Anda boleh meninggalkan halaman ini sementara pemrosesan berjalan.',NULL,'{\"status\":\"processing\",\"document_ids\":[1]}',NULL,'2026-09-28 12:31:34','2026-09-28 12:31:34'),(3,1,NULL,'assistant','completed',3,'document_processed','Pemrosesan dokumen selesai. Saya menemukan 1 informasi dengan bukti sumber. Tinjau dan setujui informasi yang sesuai sebelum digunakan untuk membuat berita.',NULL,'{\"status\":\"ready\",\"information_count\":1,\"document_ids\":[1]}',NULL,'2026-09-28 12:32:20','2026-09-28 12:32:20'),(4,1,NULL,'system','completed',4,'queued_request','Permintaan sedang diproses.',NULL,'{\"request_id\":\"f5e9a10d-7bfe-4922-8b75-7e796ea7441f\"}',NULL,'2026-09-28 12:35:57','2026-09-28 12:35:57'),(5,1,NULL,'user','completed',5,'generate_news','Tolong buatkan berita untuk warga Desa Punggul dari data kegiatan kesehatan di file ini. Jelaskan kegiatannya dan hasilnya dengan bahasa yang mudah dipahami.',NULL,'{\"information_ids\":[1],\"document_ids\":[1],\"answers\":[],\"information_attachments\":[{\"id\":1,\"document_id\":1,\"title\":\"Layanan skrining kesehatan warga\",\"summary\":\"Layanan skrining kesehatan warga: 120 kunjungan tercatat. Rincian kegiatan dan hasil dihitung dari seluruh baris sumber; jumlah orang unik belum diketahui.\",\"labels\":[\"ringkasan data\"],\"evidence\":[{\"source\":\"filename=apakhabar_data_uji_berita_lain.csv, section=calculated-table-analysis\",\"quote\":\"Perhitungan seluruh baris sumber: {\\\"record_count\\\": 120, \\\"record_unit\\\": \\\"kunjungan\\\", \\\"unique_person_count\\\": null, \\\"distinct_visit_id_count\\\": 120, \\\"columns\\\": {\\\"id_kunjungan\\\": {\\\"label\\\": \\\"id_kunjungan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 120}, \\\"kategori_berita\\\": {\\\"label\\\": \\\"kategori_berita\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Kesehatan\\\": 120}}, \\\"tanggal_kegiatan\\\": {\\\"label\\\": \\\"tanggal_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"2026-09-21\\\": 120}}, \\\"nama_kegiatan\\\": {\\\"label\\\": \\\"nama_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Layanan skrining kesehatan warga\\\": 120}}, \\\"penyelenggara\\\": {\\\"label\\\": \\\"penyelenggara\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Kader Posyandu Melati dan petugas Puskesmas setempat\\\": 120}}, \\\"lokasi_kegiatan\\\": {\\\"label\\\": \\\"lokasi_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Balai Desa Punggul\\\": 120}}, \\\"dusun_asal\\\": {\\\"label\\\": \\\"dusun_asal\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"Punggul Kaja\\\": 30, \\\"Punggul Kelod\\\": 30, \\\"Punggul Tengah\\\": 30, \\\"Punggul Barat\\\": 30}}, \\\"kelompok_usia\\\": {\\\"label\\\": \\\"kelompok_usia\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"40-49 tahun\\\": 32, \\\"50-59 tahun\\\": 32, \\\"60-69 tahun\\\": 28, \\\"70 tahun ke atas\\\": 28}}, \\\"jenis_layanan\\\": {\\\"label\\\": \\\"jenis_layanan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 3, \\\"counts\\\": {\\\"Pemeriksaan tekanan darah\\\": 40, \\\"Pemeriksaan gula darah\\\": 40, \\\"Konsultasi kesehatan umum\\\": 40}}, \\\"hasil_skrining\\\": {\\\"label\\\": \\\"hasil_skrining\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"Hasil dicatat\\\": 56, \\\"Konsultasi selesai\\\": 40, \\\"Perlu pemeriksaan ulang\\\": 16, \\\"Perlu pemeriksaan lanjutan\\\": 8}}, \\\"tindak_lanjut\\\": {\\\"label\\\": \\\"tindak_lanjut\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 3, \\\"counts\\\": {\\\"Tidak ada tindak lanjut khusus yang dicatat\\\": 84, \\\"Disarankan pemeriksaan ulang\\\": 24, \\\"Disarankan konsultasi lanjutan ke Puskesmas\\\": 12}}, \\\"biaya\\\": {\\\"label\\\": \\\"biaya\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Gratis\\\": 120}}, \\\"status_data\\\": {\\\"label\\\": \\\"status_data\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"FIKTIF UNTUK UJI AI\\\": 120}}}, \\\"duplicate_rows\\\": 0, \\\"source_row_ranges\\\": [[2, 121]], \\\"method\\\": \\\"full_table_descriptive_v1\\\", \\\"limitations\\\": [\\\"Jumlah catatan\\/kunjungan bukan jumlah orang unik.\\\", \\\"Distribusi tiap kolom dihitung terpisah; jangan menjumlahkan hasil dan tindak lanjut sebagai orang berbeda.\\\"]}\"}],\"document\":{\"id\":1,\"original_name\":\"apakhabar_data_uji_berita_lain.csv\"}}]}',NULL,'2026-09-28 12:35:58','2026-09-28 12:35:58'),(6,1,NULL,'assistant','completed',6,'clarification','Informasi tambahan diperlukan sebelum draf dapat dibuat.',NULL,'{\"questions\":[{\"field\":\"unique_person_count\",\"importance\":\"required\",\"question\":\"Berapa jumlah orang unik yang mengikuti layanan skrining kesehatan warga berdasarkan data yang tersedia?\",\"options\":[],\"selection_type\":\"single\"}],\"agent_run_id\":\"f5e9a10d-7bfe-4922-8b75-7e796ea7441f\"}',NULL,'2026-09-28 12:37:12','2026-09-28 12:37:12'),(7,1,NULL,'user','completed',0,'generate_news','Tolong buatkan berita untuk warga Desa Punggul dari data kegiatan kesehatan di file ini. Jelaskan kegiatannya dan hasilnya dengan bahasa yang mudah dipahami.',NULL,'{\"information_ids\":[1],\"document_ids\":[1],\"answers\":{\"unique_person_count\":\"80\"}}',NULL,'2026-09-28 12:38:04','2026-09-28 12:38:04'),(8,1,NULL,'system','completed',7,'queued_request','Permintaan sedang diproses.',NULL,'{\"request_id\":\"5e9ca50a-4959-47ec-bc7f-46ced9a80144\"}',NULL,'2026-09-28 12:41:24','2026-09-28 12:41:24'),(9,1,NULL,'user','completed',8,'generate_news','Saya memilih: 80',NULL,'{\"information_ids\":[1],\"document_ids\":[],\"answers\":{\"unique_person_count\":\"80\"},\"information_attachments\":[{\"id\":1,\"document_id\":1,\"title\":\"Layanan skrining kesehatan warga\",\"summary\":\"Layanan skrining kesehatan warga: 120 kunjungan tercatat. Rincian kegiatan dan hasil dihitung dari seluruh baris sumber; jumlah orang unik belum diketahui.\",\"labels\":[\"ringkasan data\"],\"evidence\":[{\"source\":\"filename=apakhabar_data_uji_berita_lain.csv, section=calculated-table-analysis\",\"quote\":\"Perhitungan seluruh baris sumber: {\\\"record_count\\\": 120, \\\"record_unit\\\": \\\"kunjungan\\\", \\\"unique_person_count\\\": null, \\\"distinct_visit_id_count\\\": 120, \\\"columns\\\": {\\\"id_kunjungan\\\": {\\\"label\\\": \\\"id_kunjungan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 120}, \\\"kategori_berita\\\": {\\\"label\\\": \\\"kategori_berita\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Kesehatan\\\": 120}}, \\\"tanggal_kegiatan\\\": {\\\"label\\\": \\\"tanggal_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"2026-09-21\\\": 120}}, \\\"nama_kegiatan\\\": {\\\"label\\\": \\\"nama_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Layanan skrining kesehatan warga\\\": 120}}, \\\"penyelenggara\\\": {\\\"label\\\": \\\"penyelenggara\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Kader Posyandu Melati dan petugas Puskesmas setempat\\\": 120}}, \\\"lokasi_kegiatan\\\": {\\\"label\\\": \\\"lokasi_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Balai Desa Punggul\\\": 120}}, \\\"dusun_asal\\\": {\\\"label\\\": \\\"dusun_asal\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"Punggul Kaja\\\": 30, \\\"Punggul Kelod\\\": 30, \\\"Punggul Tengah\\\": 30, \\\"Punggul Barat\\\": 30}}, \\\"kelompok_usia\\\": {\\\"label\\\": \\\"kelompok_usia\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"40-49 tahun\\\": 32, \\\"50-59 tahun\\\": 32, \\\"60-69 tahun\\\": 28, \\\"70 tahun ke atas\\\": 28}}, \\\"jenis_layanan\\\": {\\\"label\\\": \\\"jenis_layanan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 3, \\\"counts\\\": {\\\"Pemeriksaan tekanan darah\\\": 40, \\\"Pemeriksaan gula darah\\\": 40, \\\"Konsultasi kesehatan umum\\\": 40}}, \\\"hasil_skrining\\\": {\\\"label\\\": \\\"hasil_skrining\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"Hasil dicatat\\\": 56, \\\"Konsultasi selesai\\\": 40, \\\"Perlu pemeriksaan ulang\\\": 16, \\\"Perlu pemeriksaan lanjutan\\\": 8}}, \\\"tindak_lanjut\\\": {\\\"label\\\": \\\"tindak_lanjut\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 3, \\\"counts\\\": {\\\"Tidak ada tindak lanjut khusus yang dicatat\\\": 84, \\\"Disarankan pemeriksaan ulang\\\": 24, \\\"Disarankan konsultasi lanjutan ke Puskesmas\\\": 12}}, \\\"biaya\\\": {\\\"label\\\": \\\"biaya\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Gratis\\\": 120}}, \\\"status_data\\\": {\\\"label\\\": \\\"status_data\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"FIKTIF UNTUK UJI AI\\\": 120}}}, \\\"duplicate_rows\\\": 0, \\\"source_row_ranges\\\": [[2, 121]], \\\"method\\\": \\\"full_table_descriptive_v1\\\", \\\"limitations\\\": [\\\"Jumlah catatan\\/kunjungan bukan jumlah orang unik.\\\", \\\"Distribusi tiap kolom dihitung terpisah; jangan menjumlahkan hasil dan tindak lanjut sebagai orang berbeda.\\\"]}\"}],\"document\":{\"id\":1,\"original_name\":\"apakhabar_data_uji_berita_lain.csv\"}}]}',NULL,'2026-09-28 12:41:27','2026-09-28 12:41:27'),(10,1,NULL,'system','completed',9,'queued_request','Permintaan sedang diproses.',NULL,'{\"request_id\":\"961b92b4-55a5-4cfd-a0ed-85175945829b\"}',NULL,'2026-09-28 12:41:37','2026-09-28 12:41:37'),(11,1,NULL,'user','completed',10,'generate_news','Saya memilih: 80',NULL,'{\"information_ids\":[1],\"document_ids\":[],\"answers\":{\"unique_person_count\":\"80\"},\"information_attachments\":[{\"id\":1,\"document_id\":1,\"title\":\"Layanan skrining kesehatan warga\",\"summary\":\"Layanan skrining kesehatan warga: 120 kunjungan tercatat. Rincian kegiatan dan hasil dihitung dari seluruh baris sumber; jumlah orang unik belum diketahui.\",\"labels\":[\"ringkasan data\"],\"evidence\":[{\"source\":\"filename=apakhabar_data_uji_berita_lain.csv, section=calculated-table-analysis\",\"quote\":\"Perhitungan seluruh baris sumber: {\\\"record_count\\\": 120, \\\"record_unit\\\": \\\"kunjungan\\\", \\\"unique_person_count\\\": null, \\\"distinct_visit_id_count\\\": 120, \\\"columns\\\": {\\\"id_kunjungan\\\": {\\\"label\\\": \\\"id_kunjungan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 120}, \\\"kategori_berita\\\": {\\\"label\\\": \\\"kategori_berita\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Kesehatan\\\": 120}}, \\\"tanggal_kegiatan\\\": {\\\"label\\\": \\\"tanggal_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"2026-09-21\\\": 120}}, \\\"nama_kegiatan\\\": {\\\"label\\\": \\\"nama_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Layanan skrining kesehatan warga\\\": 120}}, \\\"penyelenggara\\\": {\\\"label\\\": \\\"penyelenggara\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Kader Posyandu Melati dan petugas Puskesmas setempat\\\": 120}}, \\\"lokasi_kegiatan\\\": {\\\"label\\\": \\\"lokasi_kegiatan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Balai Desa Punggul\\\": 120}}, \\\"dusun_asal\\\": {\\\"label\\\": \\\"dusun_asal\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"Punggul Kaja\\\": 30, \\\"Punggul Kelod\\\": 30, \\\"Punggul Tengah\\\": 30, \\\"Punggul Barat\\\": 30}}, \\\"kelompok_usia\\\": {\\\"label\\\": \\\"kelompok_usia\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"40-49 tahun\\\": 32, \\\"50-59 tahun\\\": 32, \\\"60-69 tahun\\\": 28, \\\"70 tahun ke atas\\\": 28}}, \\\"jenis_layanan\\\": {\\\"label\\\": \\\"jenis_layanan\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 3, \\\"counts\\\": {\\\"Pemeriksaan tekanan darah\\\": 40, \\\"Pemeriksaan gula darah\\\": 40, \\\"Konsultasi kesehatan umum\\\": 40}}, \\\"hasil_skrining\\\": {\\\"label\\\": \\\"hasil_skrining\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 4, \\\"counts\\\": {\\\"Hasil dicatat\\\": 56, \\\"Konsultasi selesai\\\": 40, \\\"Perlu pemeriksaan ulang\\\": 16, \\\"Perlu pemeriksaan lanjutan\\\": 8}}, \\\"tindak_lanjut\\\": {\\\"label\\\": \\\"tindak_lanjut\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 3, \\\"counts\\\": {\\\"Tidak ada tindak lanjut khusus yang dicatat\\\": 84, \\\"Disarankan pemeriksaan ulang\\\": 24, \\\"Disarankan konsultasi lanjutan ke Puskesmas\\\": 12}}, \\\"biaya\\\": {\\\"label\\\": \\\"biaya\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"Gratis\\\": 120}}, \\\"status_data\\\": {\\\"label\\\": \\\"status_data\\\", \\\"missing\\\": 0, \\\"distinct_values\\\": 1, \\\"counts\\\": {\\\"FIKTIF UNTUK UJI AI\\\": 120}}}, \\\"duplicate_rows\\\": 0, \\\"source_row_ranges\\\": [[2, 121]], \\\"method\\\": \\\"full_table_descriptive_v1\\\", \\\"limitations\\\": [\\\"Jumlah catatan\\/kunjungan bukan jumlah orang unik.\\\", \\\"Distribusi tiap kolom dihitung terpisah; jangan menjumlahkan hasil dan tindak lanjut sebagai orang berbeda.\\\"]}\"}],\"document\":{\"id\":1,\"original_name\":\"apakhabar_data_uji_berita_lain.csv\"}}]}',NULL,'2026-09-28 12:43:00','2026-09-28 12:43:00');
/*!40000 ALTER TABLE `intelligent_news_messages` ENABLE KEYS */;

--
-- Table structure for table `intelligent_news_run_events`
--

DROP TABLE IF EXISTS `intelligent_news_run_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `intelligent_news_run_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `run_id` bigint(20) unsigned NOT NULL,
  `sequence` int(10) unsigned NOT NULL,
  `event_type` varchar(50) NOT NULL,
  `tool_name` varchar(100) DEFAULT NULL,
  `label` varchar(255) DEFAULT NULL,
  `content` longtext DEFAULT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `intelligent_news_run_events_run_id_sequence_unique` (`run_id`,`sequence`),
  KEY `intelligent_news_run_events_event_type_index` (`event_type`),
  CONSTRAINT `intelligent_news_run_events_run_id_foreign` FOREIGN KEY (`run_id`) REFERENCES `intelligent_news_runs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intelligent_news_run_events`
--

/*!40000 ALTER TABLE `intelligent_news_run_events` DISABLE KEYS */;
INSERT INTO `intelligent_news_run_events` VALUES (1,1,1,'commentary',NULL,'Memahami permintaan','Menentukan tujuan pengguna dan konteks percakapan yang relevan.',NULL,'2026-09-28 12:35:58','2026-09-28 12:35:58'),(2,1,2,'tool','source_check','Memeriksa sumber','Memeriksa informasi dan dokumen yang telah disetujui moderator.',NULL,'2026-09-28 12:35:58','2026-09-28 12:35:58'),(3,1,3,'commentary',NULL,'Menyusun draf','Mengirim fakta terverifikasi dan arahan editorial ke model AI.',NULL,'2026-09-28 12:35:58','2026-09-28 12:35:58'),(4,1,4,'source_loading',NULL,'Membaca dokumen asli','Membaca ulang file sumber untuk verifikasi draf.',NULL,'2026-09-28 12:35:58','2026-09-28 12:35:58'),(5,1,5,'agent_run',NULL,'Agen editorial dimulai','Menjalankan alur editorial.','{\"client_request_id\":\"f5e9a10d-7bfe-4922-8b75-7e796ea7441f\",\"agent_run_id\":\"f5e9a10d-7bfe-4922-8b75-7e796ea7441f\"}','2026-09-28 12:35:58','2026-09-28 12:35:58'),(6,1,6,'agent_context',NULL,'Prosedur editorial tercatat','Rencana dan versi keahlian disimpan untuk peninjauan.','{\"skills_used\":[{\"name\":\"evidence-research\",\"version\":\"f955e075805f3392a017cb36f5dacd70d74e8b754578760506423c0bc7c42c81\"}],\"plan\":[{\"task\":\"Write or revise draft\",\"skill\":\"indonesian-news-writing\"},{\"task\":\"Review evidence and revise within limits\",\"skill\":\"editorial-review\"}],\"metrics\":{\"elapsed_seconds\":73.437,\"model_calls\":2,\"tool_calls\":0,\"revisions\":0}}','2026-09-28 12:37:12','2026-09-28 12:37:12'),(7,1,7,'stage_started',NULL,'Memahami permintaan','Memahami permintaan','{\"stage\":\"RequestUnderstanding\"}','2026-09-28 12:37:12','2026-09-28 12:37:12'),(8,1,8,'stage_completed',NULL,'Memahami permintaan','Memahami permintaan','{\"stage\":\"RequestUnderstanding\",\"elapsed_seconds\":7.81}','2026-09-28 12:37:12','2026-09-28 12:37:12'),(9,1,9,'planning',NULL,'Rencana editorial disiapkan','Rencana editorial disiapkan','{\"steps\":[]}','2026-09-28 12:37:12','2026-09-28 12:37:12'),(10,1,10,'stage_started',NULL,'Memeriksa kelengkapan fakta','Memeriksa kelengkapan fakta','{\"stage\":\"CompletenessResult\"}','2026-09-28 12:37:12','2026-09-28 12:37:12'),(11,1,11,'stage_completed',NULL,'Memeriksa kelengkapan fakta','Memeriksa kelengkapan fakta','{\"stage\":\"CompletenessResult\",\"elapsed_seconds\":65.36}','2026-09-28 12:37:12','2026-09-28 12:37:12'),(12,1,12,'completeness',NULL,'Kelengkapan dan konflik diperiksa','Kelengkapan dan konflik diperiksa','[]','2026-09-28 12:37:12','2026-09-28 12:37:12'),(13,1,13,'commentary',NULL,'Memerlukan keputusan pengguna','Satu putaran klarifikasi diperlukan sebelum draf dibuat.',NULL,'2026-09-28 12:37:12','2026-09-28 12:37:12'),(14,2,1,'commentary',NULL,'Memahami permintaan','Menentukan tujuan pengguna dan konteks percakapan yang relevan.',NULL,'2026-09-28 12:41:27','2026-09-28 12:41:27'),(15,2,2,'tool','source_check','Memeriksa sumber','Memeriksa informasi dan dokumen yang telah disetujui moderator.',NULL,'2026-09-28 12:41:27','2026-09-28 12:41:27'),(16,2,3,'commentary',NULL,'Menyusun draf','Mengirim fakta terverifikasi dan arahan editorial ke model AI.',NULL,'2026-09-28 12:41:27','2026-09-28 12:41:27'),(17,2,4,'source_loading',NULL,'Membaca dokumen asli','Membaca ulang file sumber untuk verifikasi draf.',NULL,'2026-09-28 12:41:27','2026-09-28 12:41:27'),(18,2,5,'agent_run',NULL,'Agen editorial dimulai','Menjalankan alur editorial.','{\"client_request_id\":\"5e9ca50a-4959-47ec-bc7f-46ced9a80144\",\"agent_run_id\":\"f5e9a10d-7bfe-4922-8b75-7e796ea7441f\"}','2026-09-28 12:41:27','2026-09-28 12:41:27'),(19,2,6,'error',NULL,'Proses gagal','Penyedia AI tidak menyelesaikan permintaan.',NULL,'2026-09-28 12:43:00','2026-09-28 12:43:00'),(20,3,1,'commentary',NULL,'Memahami permintaan','Menentukan tujuan pengguna dan konteks percakapan yang relevan.',NULL,'2026-09-28 12:43:00','2026-09-28 12:43:00'),(21,3,2,'tool','source_check','Memeriksa sumber','Memeriksa informasi dan dokumen yang telah disetujui moderator.',NULL,'2026-09-28 12:43:00','2026-09-28 12:43:00'),(22,3,3,'commentary',NULL,'Menyusun draf','Mengirim fakta terverifikasi dan arahan editorial ke model AI.',NULL,'2026-09-28 12:43:00','2026-09-28 12:43:00'),(23,3,4,'source_loading',NULL,'Membaca dokumen asli','Membaca ulang file sumber untuk verifikasi draf.',NULL,'2026-09-28 12:43:00','2026-09-28 12:43:00'),(24,3,5,'agent_run',NULL,'Agen editorial dimulai','Menjalankan alur editorial.','{\"client_request_id\":\"961b92b4-55a5-4cfd-a0ed-85175945829b\",\"agent_run_id\":\"f5e9a10d-7bfe-4922-8b75-7e796ea7441f\"}','2026-09-28 12:43:03','2026-09-28 12:43:03'),(25,3,6,'error',NULL,'Proses gagal','Penyedia AI tidak menyelesaikan permintaan.',NULL,'2026-09-28 12:43:05','2026-09-28 12:43:05');
/*!40000 ALTER TABLE `intelligent_news_run_events` ENABLE KEYS */;

--
-- Table structure for table `intelligent_news_runs`
--

DROP TABLE IF EXISTS `intelligent_news_runs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `intelligent_news_runs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `session_id` bigint(20) unsigned NOT NULL,
  `user_message_id` bigint(20) unsigned DEFAULT NULL,
  `intent` varchar(50) NOT NULL,
  `status` enum('queued','running','awaiting_approval','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
  `current_stage` varchar(80) DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `intelligent_news_runs_user_message_id_foreign` (`user_message_id`),
  KEY `intelligent_news_runs_session_id_created_at_index` (`session_id`,`created_at`),
  KEY `intelligent_news_runs_intent_index` (`intent`),
  KEY `intelligent_news_runs_status_index` (`status`),
  CONSTRAINT `intelligent_news_runs_session_id_foreign` FOREIGN KEY (`session_id`) REFERENCES `intelligent_news_sessions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `intelligent_news_runs_user_message_id_foreign` FOREIGN KEY (`user_message_id`) REFERENCES `intelligent_news_messages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intelligent_news_runs`
--

/*!40000 ALTER TABLE `intelligent_news_runs` DISABLE KEYS */;
INSERT INTO `intelligent_news_runs` VALUES (1,1,5,'generate_news','awaiting_approval','commentary',NULL,'2026-09-28 12:35:58','2026-09-28 12:37:12','2026-09-28 12:35:58','2026-09-28 12:37:12'),(2,1,9,'generate_news','failed','error','HTTP request returned status code 503:\n{\"detail\":\"Generation provider llama_cpp failed (ConnectionError)\"}\n','2026-09-28 12:41:27','2026-09-28 12:43:00','2026-09-28 12:41:27','2026-09-28 12:43:00'),(3,1,11,'generate_news','failed','error','cURL error 7: Failed to connect to 127.0.0.1 port 8001 after 2052 ms: Couldn\'t connect to server (see https://curl.haxx.se/libcurl/c/libcurl-errors.html) for http://127.0.0.1:8001/agent/runs/f5e9a10d-7bfe-4922-8b75-7e796ea7441f/resume','2026-09-28 12:43:00','2026-09-28 12:43:05','2026-09-28 12:43:00','2026-09-28 12:43:05');
/*!40000 ALTER TABLE `intelligent_news_runs` ENABLE KEYS */;

--
-- Table structure for table `intelligent_news_sessions`
--

DROP TABLE IF EXISTS `intelligent_news_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `intelligent_news_sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `created_by` bigint(20) unsigned NOT NULL,
  `status` enum('collecting_sources','processing_files','awaiting_answers','ready_to_generate','draft_generated') NOT NULL DEFAULT 'collecting_sources',
  `title` varchar(255) DEFAULT NULL,
  `prompt` text DEFAULT NULL,
  `context_summary` longtext DEFAULT NULL,
  `current_intent` varchar(50) DEFAULT NULL,
  `selected_document_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`selected_document_ids`)),
  `selected_information_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`selected_information_ids`)),
  `user_facts` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`user_facts`)),
  `pending_questions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`pending_questions`)),
  `conflicts` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`conflicts`)),
  `clarification_rounds` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `draft_id` bigint(20) unsigned DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT NULL,
  `last_message_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `intelligent_news_sessions_created_by_foreign` (`created_by`),
  KEY `intelligent_news_sessions_draft_id_foreign` (`draft_id`),
  KEY `intelligent_news_sessions_status_index` (`status`),
  KEY `intelligent_news_sessions_archived_at_index` (`archived_at`),
  KEY `intelligent_news_sessions_last_message_at_index` (`last_message_at`),
  CONSTRAINT `intelligent_news_sessions_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`userID`) ON DELETE CASCADE,
  CONSTRAINT `intelligent_news_sessions_draft_id_foreign` FOREIGN KEY (`draft_id`) REFERENCES `intelligent_news_drafts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intelligent_news_sessions`
--

/*!40000 ALTER TABLE `intelligent_news_sessions` DISABLE KEYS */;
INSERT INTO `intelligent_news_sessions` VALUES (1,1,'awaiting_answers',NULL,'Tolong buatkan berita untuk warga Desa Punggul dari data kegiatan kesehatan di file ini. Jelaskan kegiatannya dan hasilnya dengan bahasa yang mudah dipahami.',NULL,'generate_news','[]','[1]','[{\"field\":\"unique_person_count\",\"value\":\"80\"}]','[{\"field\":\"unique_person_count\",\"importance\":\"required\",\"question\":\"Berapa jumlah orang unik yang mengikuti layanan skrining kesehatan warga berdasarkan data yang tersedia?\",\"options\":[],\"selection_type\":\"single\"}]','[]',1,NULL,NULL,'2026-09-28 12:43:00','2026-09-28 12:31:34','2026-09-28 12:43:00',NULL);
/*!40000 ALTER TABLE `intelligent_news_sessions` ENABLE KEYS */;

--
-- Table structure for table `intelligent_news_source_selections`
--

DROP TABLE IF EXISTS `intelligent_news_source_selections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `intelligent_news_source_selections` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `session_id` bigint(20) unsigned NOT NULL,
  `message_id` bigint(20) unsigned DEFAULT NULL,
  `run_id` bigint(20) unsigned DEFAULT NULL,
  `source_type` enum('information','document','web') NOT NULL,
  `information_id` bigint(20) unsigned DEFAULT NULL,
  `document_id` bigint(20) unsigned DEFAULT NULL,
  `url` text DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `source_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`source_snapshot`)),
  `decision` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `decided_by` bigint(20) unsigned DEFAULT NULL,
  `decided_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `intelligent_news_source_selections_message_id_foreign` (`message_id`),
  KEY `intelligent_news_source_selections_run_id_foreign` (`run_id`),
  KEY `intelligent_news_source_selections_information_id_foreign` (`information_id`),
  KEY `intelligent_news_source_selections_document_id_foreign` (`document_id`),
  KEY `intelligent_news_source_selections_decided_by_foreign` (`decided_by`),
  KEY `news_source_session_type_decision` (`session_id`,`source_type`,`decision`),
  KEY `intelligent_news_source_selections_decision_index` (`decision`),
  CONSTRAINT `intelligent_news_source_selections_decided_by_foreign` FOREIGN KEY (`decided_by`) REFERENCES `users` (`userID`) ON DELETE SET NULL,
  CONSTRAINT `intelligent_news_source_selections_document_id_foreign` FOREIGN KEY (`document_id`) REFERENCES `intelligence_documents` (`id`) ON DELETE SET NULL,
  CONSTRAINT `intelligent_news_source_selections_information_id_foreign` FOREIGN KEY (`information_id`) REFERENCES `intelligence_information` (`id`) ON DELETE SET NULL,
  CONSTRAINT `intelligent_news_source_selections_message_id_foreign` FOREIGN KEY (`message_id`) REFERENCES `intelligent_news_messages` (`id`) ON DELETE SET NULL,
  CONSTRAINT `intelligent_news_source_selections_run_id_foreign` FOREIGN KEY (`run_id`) REFERENCES `intelligent_news_runs` (`id`) ON DELETE SET NULL,
  CONSTRAINT `intelligent_news_source_selections_session_id_foreign` FOREIGN KEY (`session_id`) REFERENCES `intelligent_news_sessions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `intelligent_news_source_selections`
--

/*!40000 ALTER TABLE `intelligent_news_source_selections` DISABLE KEYS */;
INSERT INTO `intelligent_news_source_selections` VALUES (1,1,5,1,'information',1,1,NULL,'Layanan skrining kesehatan warga','{\"summary\":\"Layanan skrining kesehatan warga: 120 kunjungan tercatat. Rincian kegiatan dan hasil dihitung dari seluruh baris sumber; jumlah orang unik belum diketahui.\"}','approved',1,'2026-09-28 12:35:58','2026-09-28 12:35:58','2026-09-28 12:35:58'),(2,1,9,2,'information',1,1,NULL,'Layanan skrining kesehatan warga','{\"summary\":\"Layanan skrining kesehatan warga: 120 kunjungan tercatat. Rincian kegiatan dan hasil dihitung dari seluruh baris sumber; jumlah orang unik belum diketahui.\"}','approved',1,'2026-09-28 12:41:27','2026-09-28 12:41:27','2026-09-28 12:41:27'),(3,1,11,3,'information',1,1,NULL,'Layanan skrining kesehatan warga','{\"summary\":\"Layanan skrining kesehatan warga: 120 kunjungan tercatat. Rincian kegiatan dan hasil dihitung dari seluruh baris sumber; jumlah orang unik belum diketahui.\"}','approved',1,'2026-09-28 12:43:00','2026-09-28 12:43:00','2026-09-28 12:43:00');
/*!40000 ALTER TABLE `intelligent_news_source_selections` ENABLE KEYS */;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;

--
-- Table structure for table `likes`
--

DROP TABLE IF EXISTS `likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `likes` (
  `likeID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `postID` bigint(20) unsigned NOT NULL,
  `userID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`likeID`),
  UNIQUE KEY `likes_postid_userid_unique` (`postID`,`userID`),
  KEY `likes_userid_foreign` (`userID`),
  CONSTRAINT `likes_postid_foreign` FOREIGN KEY (`postID`) REFERENCES `news` (`postID`) ON DELETE CASCADE,
  CONSTRAINT `likes_userid_foreign` FOREIGN KEY (`userID`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `likes`
--

/*!40000 ALTER TABLE `likes` DISABLE KEYS */;
/*!40000 ALTER TABLE `likes` ENABLE KEYS */;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'2026_08_23_001125_create_user_roles_table',1),(2,'2026_08_23_001407_create_users_table',1),(3,'2026_08_23_001433_create_emails_table',1),(4,'2026_08_23_001603_create_phone_table',1),(5,'2026_08_23_001644_create_two_factor_table',1),(6,'2026_08_23_001726_create_password_reset_tokens_table',1),(7,'2026_08_23_001853_create_personal_access_tokens_table',1),(8,'2026_08_23_001941_create_broadcast_categories_table',1),(9,'2026_08_23_002011_create_channel_table',1),(10,'2026_08_23_002104_create_broadcast_table',1),(11,'2026_08_23_002139_create_broadcast_channel_table',1),(12,'2026_08_23_002210_create_broadcast_user_table',1),(13,'2026_08_23_002234_create_news_categories_table',1),(14,'2026_08_23_002256_create_news_table',1),(15,'2026_08_23_002323_create_comments_table',1),(16,'2026_08_23_002349_create_likes_table',1),(17,'2026_08_23_002426_create_notifications_table',1),(18,'2026_09_16_000001_create_intelligent_news_tables',2),(19,'2026_09_16_000002_create_intelligent_news_sessions_table',2),(20,'2026_09_16_000003_add_cloud_storage_to_intelligence_documents',2),(21,'2026_09_16_000004_add_editorial_workflow_fields',2),(22,'2026_09_16_000005_add_persistent_document_queue',2),(23,'2026_09_16_000006_track_news_clarification_rounds',2),(24,'2026_09_16_000007_add_review_workflow_to_intelligent_news_drafts',2),(25,'2026_09_16_000008_create_intelligent_news_draft_versions_table',2),(26,'2026_09_16_000009_expand_news_categories_for_admin_management',2),(27,'2026_09_22_000001_enhance_ai_workspace_schema',2),(28,'2026_09_24_150000_add_homepage_visibility_to_news',3),(29,'2026_09_24_170000_create_social_connections_table',4),(30,'2026_09_25_180000_add_instagram_media_id_to_intelligent_news_drafts',5),(31,'2026_09_26_110000_add_facebook_post_id_to_intelligent_news_drafts',6),(32,'2026_09_27_180000_add_auth_source_to_social_connections',7),(33,'2026_09_28_150000_add_publication_results_to_intelligent_news_drafts',8),(34,'2026_09_28_160000_remove_obsolete_news_text_fields',9),(35,'2026_09_24_000001_add_agent_runs_and_source_decisions',10),(36,'2026_09_25_000001_add_information_soft_deletes_and_document_archiving',10),(37,'2026_09_25_000002_add_workflow_state_machine_to_sessions',10),(38,'2026_09_29_160000_add_image_crops_to_intelligent_news_drafts',11),(39,'2026_10_01_000001_remove_lainnya_news_category',12),(40,'2026_10_01_000002_add_news_category_activity_and_soft_deletes',13),(41,'2026_09_29_180000_unify_draft_article_columns',14),(42,'2026_10_01_050000_add_fortify_two_factor_fields_to_users',14),(43,'2026_10_04_220000_add_moderator_approval_to_ai_quality_evaluations',14),(44,'2026_10_07_000001_add_soft_deletes_to_news_drafts_and_sessions',15),(45,'2026_10_19_000001_add_news_engagement',16),(46,'2026_10_19_000002_create_moderation_feedback',17),(47,'2026_10_20_000001_create_comment_likes_table',18),(48,'2026_10_21_000001_create_short_videos',19),(49,'2026_10_21_000002_add_short_video_views',20),(50,'2026_10_21_000003_create_short_video_engagement',21),(51,'2026_10_22_000001_create_guest_comment_identities',22),(52,'2026_10_24_000001_make_short_video_title_nullable',23),(53,'2026_10_26_000001_simplify_comment_moderation',24),(54,'2026_10_26_000002_backfill_legacy_comment_flags',25),(55,'2026_10_26_000003_archive_legacy_comment_moderation',26),(56,'2026_10_26_000004_remove_redundant_moderation_columns',27),(57,'2026_10_26_000005_retire_legacy_comment_moderation_tables',27);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;

--
-- Table structure for table `news`
--

DROP TABLE IF EXISTS `news`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `news` (
  `postID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `status` enum('active','archived') NOT NULL DEFAULT 'active',
  `creation_method` enum('manual','ai') NOT NULL DEFAULT 'manual',
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `content` longtext NOT NULL,
  `image` varchar(255) DEFAULT NULL,
  `likes_count` int(10) unsigned NOT NULL DEFAULT 0,
  `view` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `category_id` bigint(20) unsigned DEFAULT NULL,
  `show_on_homepage` tinyint(1) NOT NULL DEFAULT 1,
  `excerpt` text DEFAULT NULL,
  `unique_views` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`postID`),
  KEY `news_category_id_foreign` (`category_id`),
  KEY `news_created_by_foreign` (`created_by`),
  KEY `news_status_index` (`status`),
  KEY `news_creation_method_index` (`creation_method`),
  CONSTRAINT `news_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `news_categories` (`categoryID`) ON DELETE SET NULL,
  CONSTRAINT `news_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`userID`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news`
--

/*!40000 ALTER TABLE `news` DISABLE KEYS */;
INSERT INTO `news` VALUES (1,'active','manual',NULL,'Pembangunan Jalan Desa Baru Permudah Akses Warga','Pemerintah Desa Sari Makmur resmi menyelesaikan pembangunan jalan desa yang menghubungkan area permukiman dengan lahan pertanian warga. Jalan baru ini diharapkan dapat mempermudah mobilitas masyarakat serta mempercepat distribusi hasil panen. Kepala desa menyampaikan bahwa proyek ini merupakan bagian dari program pembangunan desa tahun ini yang bertujuan meningkatkan kesejahteraan masyarakat.','https://images.unsplash.com/photo-1617719491063-fc9443eb8bd9?q=80&w=764&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',0,0,'2026-03-14 16:00:00','2026-03-14 16:00:00',1,1,NULL,0),(2,'active','manual',NULL,'Siswa SD Desa Sari Makmur Tanam Pohon di Halaman Sekolah','Pada 18 Maret 2026, siswa SD Desa Sari Makmur melakukan kegiatan penanaman pohon di halaman sekolah. Kegiatan ini bertujuan menumbuhkan kesadaran lingkungan sejak dini dan mempercantik lingkungan sekolah. Guru dan orang tua turut mendampingi kegiatan agar berjalan aman dan tertib.','https://images.unsplash.com/photo-1634151389979-2dea7604b36f?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',0,1,'2026-03-17 16:00:00','2026-08-28 08:16:15',2,1,NULL,0),(3,'active','manual',NULL,'Pelatihan Komputer Gratis untuk Pemuda Desa','Karang Taruna Desa Sari Makmur bekerja sama dengan relawan pendidikan mengadakan pelatihan komputer gratis bagi pemuda desa. Pelatihan ini bertujuan meningkatkan keterampilan digital generasi muda agar mampu bersaing di era teknologi. Peserta diajarkan dasar-dasar penggunaan komputer, pengolahan dokumen, serta pengenalan internet secara aman.','https://images.unsplash.com/photo-1569653402334-2e98fbaa80ee?q=80&w=1631&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',0,12,'2026-03-19 16:00:00','2026-03-19 16:00:00',3,1,NULL,0),(4,'active','manual',NULL,'Perpustakaan Mini Desa Sari Makmur Resmi Dibuka','Pada 13 Maret 2026, Desa Sari Makmur meresmikan perpustakaan mini yang dapat diakses oleh semua warga, khususnya anak-anak dan pelajar. Perpustakaan ini menyediakan buku pelajaran, buku cerita, dan materi literasi digital. Kepala desa berharap fasilitas ini dapat menumbuhkan minat baca dan mendukung pendidikan anak-anak desa.','https://images.unsplash.com/photo-1646706751203-5b30c16bb137?q=80&w=736&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',0,1,'2026-03-12 16:00:00','2026-09-01 07:26:06',3,1,NULL,0),(5,'active','manual',NULL,'Festival Panen Raya Desa Sari Makmur Meriahkan Akhir Pekan','Desa Sari Makmur menggelar Festival Panen Raya pada akhir pekan ini. Warga berkumpul untuk menikmati pertunjukan musik tradisional, lomba masak, dan pameran produk lokal. Kepala desa, Bapak Iwan, menyampaikan bahwa acara ini bertujuan mempererat kebersamaan masyarakat serta mempromosikan hasil pertanian desa. Festival akan berlangsung dari pagi hingga sore, dengan berbagai kegiatan menarik untuk anak-anak dan dewasa. Warga dan pengunjung diharapkan tetap mematuhi protokol kesehatan selama acara.','https://images.unsplash.com/photo-1719406567281-e929125f5cb4?q=80&w=1932&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',0,4,'2026-03-21 16:00:00','2026-09-25 05:48:09',1,1,NULL,0),(7,'active','manual',1,'test','testtesttesttesttesttesttest','http://192.168.68.59:8000/storage/news-images/578gn2N9fYQf2ur1swF7R7bKuAhHX3lYxCvAtO26.jpg',0,0,'2026-09-25 09:01:33','2026-09-25 09:01:33',2,1,NULL,0),(8,'active','manual',1,'milagro design sponsor apakhabar','test1111test1111test1111test1111test1111test1111test1111','http://192.168.68.59:8000/storage/news-images/JWpPl5M9r18LQNqeTNxCOkw9M2ZLRcMwuAYWDSYm.png',0,0,'2026-09-25 10:48:53','2026-09-25 10:48:53',2,1,NULL,0),(9,'active','manual',1,'AAA milagro design sponsor apakhabar','testabcdtestabcdtestabcdtestabcdtestabcd','http://192.168.68.59:8000/storage/news-images/1c7yIJWOa9iGsOxsU7fbexOB88WFtNn7yRpvSLEH.png',0,0,'2026-09-25 11:03:12','2026-09-25 11:03:12',2,1,NULL,0),(10,'active','manual',1,'BBBB milagro design sponsor apakhabar','php -m | findstr gdphp -m | findstr gdphp -m | findstr gdphp -m | findstr gdphp -m | findstr gdphp -m | findstr gd','http://192.168.68.59:8000/storage/news-images/oZTHkhxo94YkUJZYnSUiVW1dCe7b2cvgQiu0V9hX.png',0,0,'2026-09-25 11:08:20','2026-09-25 11:08:20',NULL,1,NULL,0),(11,'active','manual',1,'CCCC milagro design sponsor apakhabar','testabcdtestabcdtestabcd','http://192.168.68.59:8000/storage/news-images/2Jj1BSlZVX0H7emW7igIDuBu5vJvqqexlvMlbZeg.png',0,0,'2026-09-26 02:20:25','2026-09-26 02:20:25',2,1,NULL,0),(12,'active','manual',1,'Milagro Design Resmi Menjadi Sponsor ApaKhabar','Kami dengan sukacita mengumumkan bahwa Milagro Design telah resmi menjadi sponsor ApaKhabar.<div>Dukungan dari Milagro Design menjadi bagian penting dalam pengembangan ApaKhabar sebagai platform informasi dan berita digital yang bertujuan membantu masyarakat Desa Punggul memperoleh informasi dengan lebih cepat, mudah, dan terstruktur.</div><div>Melalui dukungan ini, ApaKhabar dapat terus meningkatkan kualitas layanan serta mendukung penyampaian informasi yang lebih efektif kepada masyarakat.</div><div>Kami mengucapkan terima kasih kepada Milagro Design atas kepercayaan dan dukungannya terhadap ApaKhabar. Semoga kolaborasi ini dapat memberikan manfaat positif bagi masyarakat Desa Punggul.</div>','http://192.168.68.59:8000/storage/news-images/knkv0LNHmCZqqcIMp0wd8GLfTYDVPyZWBJi2hbYz.png',0,6,'2026-09-26 02:59:40','2026-10-22 04:08:24',1,1,NULL,1),(13,'active','manual',1,'testing kitty appear in page','meowmeowmeowmeowmeowmeow','http://192.168.68.59:8000/storage/news-images/WTkj75C3gvtyoNSmdaVAF89NBvtzGImT5NgMfEDz.jpg',0,2,'2026-09-26 12:24:58','2026-10-22 13:37:49',2,1,NULL,2),(14,'active','manual',1,'milagro design sponsor apakhabar','testtesttesttesttesttesttesttest','http://192.168.68.59:8000/storage/news-images/wXGRFxdaIjp3YByS5b2R5gaMsqjnMUjFCJ3VYcEi.jpg',0,2,'2026-09-27 08:04:56','2026-10-22 04:18:54',2,1,NULL,2),(15,'active','manual',1,'Merry Christmas','testtesttesttesttesttesttesttesttesttesttesttesttesttest','http://localhost:8000/storage/news-images/BEXvmvi0d6xa3vgZug08B6m2uVgRWYgRVxlhmai8.jpg',0,2,'2026-09-28 06:16:56','2026-09-28 09:03:38',2,1,NULL,0),(16,'active','manual',1,'pets','<blockquote>petspetspetspetspets</blockquote>','http://localhost:8000/storage/news-images/uUMYh6OcWzyMPZxUT6kRn9jEsH16BH5v6mcgrqTp.png',0,1,'2026-09-29 05:08:57','2026-09-29 05:11:22',2,1,NULL,0),(17,'active','manual',1,'test','testtesttesttesttesttest','http://localhost:8000/storage/news-images/CQdEXt44pobk9FR7bQnlWPdK9gR00UtbWzZLpg8E.png',0,3,'2026-09-29 06:07:10','2026-10-06 07:01:56',2,1,NULL,0),(18,'active','manual',1,'BBBB milagro design sponsor apakhabar','BBBB milagro design sponsor apakhabarBBBB milagro design sponsor apakhabar','http://localhost:8000/storage/news-images/previews/029704b0-2fc0-4619-8427-215a1c252ac1/crops/0ce466c5c107c162337d690e8311530fa02bcee16f7ba20055481448f9d4ac21.jpg',0,27,'2026-10-01 04:33:29','2026-10-20 06:51:56',NULL,1,NULL,4),(19,'active','manual',1,'test','testingdsvfsvwadfswfedsfftglkmANCXJFD','http://localhost:8000/storage/news-images/previews/8d1a543f-cebf-4172-aeee-ca20c7af864d/crops/578041e85a499b801ee40c28d8cdbdb7b26285ec8069a9266d67d54d2ab2dabe.webp',0,1,'2026-10-20 05:50:53','2026-10-22 04:00:34',3,1,'testingdsvfsvwadfswfedsfftglkmANCXJFD',1);
/*!40000 ALTER TABLE `news` ENABLE KEYS */;

--
-- Table structure for table `news_categories`
--

DROP TABLE IF EXISTS `news_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `news_categories` (
  `categoryID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `display_order` int(10) unsigned NOT NULL DEFAULT 0,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`categoryID`),
  UNIQUE KEY `news_categories_slug_unique` (`slug`),
  KEY `news_categories_created_by_foreign` (`created_by`),
  KEY `news_categories_status_index` (`status`),
  KEY `news_categories_display_order_index` (`display_order`),
  KEY `news_categories_is_default_index` (`is_default`),
  KEY `news_categories_is_active_index` (`is_active`),
  CONSTRAINT `news_categories_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`userID`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news_categories`
--

/*!40000 ALTER TABLE `news_categories` DISABLE KEYS */;
INSERT INTO `news_categories` VALUES (1,'Pengumuman','pengumuman',NULL,'active',0,0,NULL,'2026-08-28 08:11:27','2026-08-28 08:11:27',1,NULL),(2,'Lingkungan','lingkungan',NULL,'inactive',0,0,NULL,'2026-08-28 08:11:27','2026-10-01 05:22:09',0,NULL),(3,'Pendidikan','pendidikan',NULL,'active',0,0,NULL,'2026-08-28 08:11:27','2026-08-28 08:11:27',1,NULL),(5,'PPID Punggul','ppid-punggul',NULL,'active',3,0,1,'2026-10-06 05:03:44','2026-10-06 05:03:44',1,NULL);
/*!40000 ALTER TABLE `news_categories` ENABLE KEYS */;

--
-- Table structure for table `news_viewers`
--

DROP TABLE IF EXISTS `news_viewers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `news_viewers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `news_id` bigint(20) unsigned NOT NULL,
  `viewer_key` varchar(80) NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `news_viewers_news_id_viewer_key_unique` (`news_id`,`viewer_key`),
  KEY `news_viewers_expires_at_index` (`expires_at`),
  CONSTRAINT `news_viewers_news_id_foreign` FOREIGN KEY (`news_id`) REFERENCES `news` (`postID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news_viewers`
--

/*!40000 ALTER TABLE `news_viewers` DISABLE KEYS */;
INSERT INTO `news_viewers` VALUES (1,18,'guest:d254b0bedea8f4226cddd159a3d72c7d1c21b0da3e4d094e7f83aa80f5038ba8','2027-01-17 08:16:49'),(2,18,'guest:ba5e2d7677586626daf787b5e6438ffa51e978c163f2e9dec4545faa848000ae','2027-01-17 09:37:15'),(3,18,'user:1',NULL),(4,18,'user:9',NULL),(5,19,'user:1',NULL),(6,14,'guest:d254b0bedea8f4226cddd159a3d72c7d1c21b0da3e4d094e7f83aa80f5038ba8','2027-01-20 04:00:54'),(7,12,'guest:d254b0bedea8f4226cddd159a3d72c7d1c21b0da3e4d094e7f83aa80f5038ba8','2027-01-20 04:08:24'),(8,14,'user:1',NULL),(9,13,'guest:d254b0bedea8f4226cddd159a3d72c7d1c21b0da3e4d094e7f83aa80f5038ba8','2027-01-20 13:37:11'),(10,13,'user:1',NULL);
/*!40000 ALTER TABLE `news_viewers` ENABLE KEYS */;

--
-- Table structure for table `news_visits`
--

DROP TABLE IF EXISTS `news_visits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `news_visits` (
  `id` varchar(64) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `news_visits_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news_visits`
--

/*!40000 ALTER TABLE `news_visits` DISABLE KEYS */;
INSERT INTO `news_visits` VALUES ('9696ae24281296ece5d159573e618a28e9ee54b4be7001727bac99bb8eda3082','2026-10-21 08:16:49'),('790d95653444dc94b5ad64c0adf58508d899d52e27298376b6d3c303d25d15b1','2026-10-21 08:28:09'),('0ea547667882dbfbf0268497693a34ac536a533076ac89d0e2085761edf485a7','2026-10-21 08:28:24'),('aeec90f12e111c3b33afcc2f0232fa8a0f8a24bcec2d93dd55510e9f101120ad','2026-10-21 08:28:46'),('642a48b51ecdba0d79288fda9e826503f0ecc57652634f239b73ff246980a6a8','2026-10-21 09:04:19'),('0069e9d8029b56274d5a709223a06a74acf0488d0a6389384198463c817128f3','2026-10-21 09:37:15'),('dae544adced652d27b28d6e49fc2834a00eb6ad45fd30461f192252f10239ff6','2026-10-21 12:27:46'),('3e911f0e20d4c0274cc4ed112261d1be6e92726387837c56fcf2f883b35d7ef7','2026-10-21 12:28:11'),('1b1dbd0aaab1bee9e24cc5a0d34e9c0dc66a1829d3f9e47442089530c2c48eb8','2026-10-21 13:08:34'),('178c5ce8886eddab051be118480f8cd05d00c13f24ea9111b791ed3e45491aea','2026-10-21 13:09:16'),('0ecdd2f81aabec509ed1e6dd5d56a5724aa83cad21a58eaf33d2c702d596b394','2026-10-21 13:24:28'),('5281470527dc38044d1681ba7867fcff9caa967d1600f55263f4811e24994330','2026-10-22 00:42:37'),('ad1552b60a67bd241c712bdb31b0d79763d65e2dc0bb7ad63456cd3e5dfc1db4','2026-10-22 00:46:24'),('b267cb1b49468e6d36f83d0521dd382bf0f33d1ae25f9c49674f770592f6a3c8','2026-10-22 00:50:59'),('c28799dd0a34185980efa422f2d593eb7787fe7bfa46cc0937f1ed94cbd278c7','2026-10-22 01:13:04'),('66b9f99e67534e9325663dc51312d4219e587ca2354dace473d3d8ae21e5ccbd','2026-10-22 04:25:42'),('09c4dd0a889e63d9e74bf8266245b375400e481dd6fe5eed85a92880ab2a073d','2026-10-22 04:31:37'),('0438f9323f34cd363c51fef32138fd74df38e4195b15197b9f99448e718d6823','2026-10-22 04:32:26'),('f9fa096e9c8a2e17e7f09192c26dfacf5191f408a9905a76c5fd72fa58ef7ca2','2026-10-22 06:14:08'),('39fb515eb8d0595137494b8d9f4bb0ce4e29648198c6ee730fdf9a8d1fa4795d','2026-10-22 06:50:06'),('9fbadf6a2e6b2a4744287673f30443cbd1def32e756815044d03c6b68e4a32df','2026-10-22 06:51:09'),('67f3008f5685722be63ce565b0a4e1250641e45e7e10af61b1dca6a7e11661f7','2026-10-22 06:51:56'),('11bf94752b59d191723506258bb492106950555a316333a845f3869c9ac770e5','2026-10-24 04:00:34'),('0a065c851f7b2ba8792b440527d8dbcf36d680d23d2abd390ea0ab4911472e5b','2026-10-24 04:00:54'),('f207cafd8a6f32ebcf89e3a8a0423b45ffcb97d7a05b710b596cc58dfce7bcd3','2026-10-24 04:08:24'),('4eaf6c36c21ce43f0a605fbf5f606750e45991ed9dbdf1541275aecf41bc8dca','2026-10-24 04:18:54'),('00cee4c36397601e4c4dfda1e6209fb25400515e6e58b38cf5900c08204e96de','2026-10-24 13:37:11'),('85ae0192705b0caababd462528b2ba192dd136cb5f0e6b72a901050a5d37f246','2026-10-24 13:37:49');
/*!40000 ALTER TABLE `news_visits` ENABLE KEYS */;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notifications` (
  `notificationID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `type` varchar(255) NOT NULL,
  `data` text DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `notifiable_id` bigint(20) unsigned NOT NULL,
  `notifiable_type` varchar(255) NOT NULL DEFAULT 'AppModelsUser',
  `alertID` bigint(20) unsigned DEFAULT NULL,
  `postID` bigint(20) unsigned DEFAULT NULL,
  `commentID` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`notificationID`),
  KEY `notifications_notifiable_id_foreign` (`notifiable_id`),
  KEY `notifications_alertid_foreign` (`alertID`),
  KEY `notifications_postid_foreign` (`postID`),
  KEY `notifications_commentid_foreign` (`commentID`),
  CONSTRAINT `notifications_alertid_foreign` FOREIGN KEY (`alertID`) REFERENCES `broadcasts` (`alertID`) ON DELETE SET NULL,
  CONSTRAINT `notifications_commentid_foreign` FOREIGN KEY (`commentID`) REFERENCES `comments` (`commentID`) ON DELETE SET NULL,
  CONSTRAINT `notifications_notifiable_id_foreign` FOREIGN KEY (`notifiable_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE,
  CONSTRAINT `notifications_postid_foreign` FOREIGN KEY (`postID`) REFERENCES `news` (`postID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_reset_tokens` (
  `passwordID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`passwordID`),
  KEY `password_reset_tokens_email_index` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;

--
-- Table structure for table `personal_access_tokens`
--

DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `personal_access_tokens` (
  `tokenID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `tokenable_type` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`tokenID`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_id_foreign` (`tokenable_id`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  CONSTRAINT `personal_access_tokens_tokenable_id_foreign` FOREIGN KEY (`tokenable_id`) REFERENCES `users` (`userID`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `personal_access_tokens`
--

/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
INSERT INTO `personal_access_tokens` VALUES (18,9,'App\\Models\\User','mobile-app','f0be07fbaa0951b7dd0f5597ffbdcb842dd5ce6e55e937f5860a3577166f485a','[\"*\"]',NULL,'2026-09-25 06:08:36','2026-09-25 06:08:36');
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;

--
-- Table structure for table `phones`
--

DROP TABLE IF EXISTS `phones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `phones` (
  `phone` varchar(255) NOT NULL,
  `phone_otp` varchar(255) DEFAULT NULL,
  `phone_otp_expires_at` timestamp NULL DEFAULT NULL,
  `phone_verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `userID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`phone`),
  UNIQUE KEY `phones_userid_unique` (`userID`),
  CONSTRAINT `phones_userid_foreign` FOREIGN KEY (`userID`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phones`
--

/*!40000 ALTER TABLE `phones` DISABLE KEYS */;
/*!40000 ALTER TABLE `phones` ENABLE KEYS */;

--
-- Table structure for table `short_video_comment_flags`
--

DROP TABLE IF EXISTS `short_video_comment_flags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `short_video_comment_flags` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `comment_id` bigint(20) unsigned NOT NULL,
  `moderator_id` bigint(20) unsigned NOT NULL,
  `category` varchar(80) NOT NULL,
  `explanation` varchar(1000) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `short_video_comment_flags_comment_id_foreign` (`comment_id`),
  KEY `short_video_comment_flags_moderator_id_foreign` (`moderator_id`),
  KEY `short_video_comment_flags_resolved_at_index` (`resolved_at`),
  CONSTRAINT `short_video_comment_flags_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `short_video_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `short_video_comment_flags_moderator_id_foreign` FOREIGN KEY (`moderator_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `short_video_comment_flags`
--

/*!40000 ALTER TABLE `short_video_comment_flags` DISABLE KEYS */;
/*!40000 ALTER TABLE `short_video_comment_flags` ENABLE KEYS */;

--
-- Table structure for table `short_video_comment_history`
--

DROP TABLE IF EXISTS `short_video_comment_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `short_video_comment_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `comment_id` bigint(20) unsigned NOT NULL,
  `moderator_id` bigint(20) unsigned DEFAULT NULL,
  `from_status` varchar(24) DEFAULT NULL,
  `to_status` varchar(24) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `action` varchar(24) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `short_video_comment_history_comment_id_foreign` (`comment_id`),
  KEY `short_video_comment_history_moderator_id_foreign` (`moderator_id`),
  CONSTRAINT `short_video_comment_history_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `short_video_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `short_video_comment_history_moderator_id_foreign` FOREIGN KEY (`moderator_id`) REFERENCES `users` (`userID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `short_video_comment_history`
--

/*!40000 ALTER TABLE `short_video_comment_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `short_video_comment_history` ENABLE KEYS */;

--
-- Table structure for table `short_video_comment_likes`
--

DROP TABLE IF EXISTS `short_video_comment_likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `short_video_comment_likes` (
  `comment_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`comment_id`,`user_id`),
  KEY `short_video_comment_likes_user_id_foreign` (`user_id`),
  CONSTRAINT `short_video_comment_likes_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `short_video_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `short_video_comment_likes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `short_video_comment_likes`
--

/*!40000 ALTER TABLE `short_video_comment_likes` DISABLE KEYS */;
/*!40000 ALTER TABLE `short_video_comment_likes` ENABLE KEYS */;

--
-- Table structure for table `short_video_comment_reports`
--

DROP TABLE IF EXISTS `short_video_comment_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `short_video_comment_reports` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `comment_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `resolved_at` timestamp NULL DEFAULT NULL,
  `category` varchar(80) DEFAULT NULL,
  `explanation` varchar(450) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `short_video_comment_reports_comment_id_user_id_unique` (`comment_id`,`user_id`),
  KEY `short_video_comment_reports_user_id_foreign` (`user_id`),
  KEY `short_video_comment_reports_resolved_at_index` (`resolved_at`),
  CONSTRAINT `short_video_comment_reports_comment_id_foreign` FOREIGN KEY (`comment_id`) REFERENCES `short_video_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `short_video_comment_reports_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `short_video_comment_reports`
--

/*!40000 ALTER TABLE `short_video_comment_reports` DISABLE KEYS */;
/*!40000 ALTER TABLE `short_video_comment_reports` ENABLE KEYS */;

--
-- Table structure for table `short_video_comments`
--

DROP TABLE IF EXISTS `short_video_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `short_video_comments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `short_video_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `parent_id` bigint(20) unsigned DEFAULT NULL,
  `root_id` bigint(20) unsigned DEFAULT NULL,
  `guest_name` varchar(80) DEFAULT NULL,
  `content` text NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'pending_review',
  `ai_flagged` tinyint(1) DEFAULT NULL,
  `moderation_categories` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`moderation_categories`)),
  `moderation_reason` varchar(255) DEFAULT NULL,
  `moderated_at` timestamp NULL DEFAULT NULL,
  `moderation_revision` int(10) unsigned NOT NULL DEFAULT 0,
  `submission_hash` varchar(64) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `short_video_comments_submission_hash_unique` (`submission_hash`),
  KEY `short_video_comments_user_id_foreign` (`user_id`),
  KEY `short_video_comments_parent_id_foreign` (`parent_id`),
  KEY `short_video_comments_root_id_foreign` (`root_id`),
  KEY `short_comments_public_index` (`short_video_id`,`status`,`root_id`,`created_at`),
  CONSTRAINT `short_video_comments_parent_id_foreign` FOREIGN KEY (`parent_id`) REFERENCES `short_video_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `short_video_comments_root_id_foreign` FOREIGN KEY (`root_id`) REFERENCES `short_video_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `short_video_comments_short_video_id_foreign` FOREIGN KEY (`short_video_id`) REFERENCES `short_videos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `short_video_comments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`userID`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `short_video_comments`
--

/*!40000 ALTER TABLE `short_video_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `short_video_comments` ENABLE KEYS */;

--
-- Table structure for table `short_video_likes`
--

DROP TABLE IF EXISTS `short_video_likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `short_video_likes` (
  `short_video_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`short_video_id`,`user_id`),
  KEY `short_video_likes_user_id_foreign` (`user_id`),
  CONSTRAINT `short_video_likes_short_video_id_foreign` FOREIGN KEY (`short_video_id`) REFERENCES `short_videos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `short_video_likes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `short_video_likes`
--

/*!40000 ALTER TABLE `short_video_likes` DISABLE KEYS */;
INSERT INTO `short_video_likes` VALUES (5,1);
/*!40000 ALTER TABLE `short_video_likes` ENABLE KEYS */;

--
-- Table structure for table `short_video_publications`
--

DROP TABLE IF EXISTS `short_video_publications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `short_video_publications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `short_video_id` bigint(20) unsigned NOT NULL,
  `platform` varchar(255) NOT NULL,
  `connection_id` bigint(20) unsigned DEFAULT NULL,
  `account_id` varchar(255) DEFAULT NULL,
  `account_name` varchar(255) DEFAULT NULL,
  `graph_host` varchar(255) DEFAULT NULL,
  `graph_version` varchar(255) DEFAULT NULL,
  `credential` text DEFAULT NULL,
  `credential_expires_at` timestamp NULL DEFAULT NULL,
  `container_id` varchar(255) DEFAULT NULL,
  `media_id` varchar(255) DEFAULT NULL,
  `permalink` text DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'queued',
  `stage` varchar(255) NOT NULL DEFAULT 'create',
  `locked_until` timestamp NULL DEFAULT NULL,
  `attempts` int(10) unsigned NOT NULL DEFAULT 0,
  `polls` int(10) unsigned NOT NULL DEFAULT 0,
  `error_summary` text DEFAULT NULL,
  `next_attempt_at` timestamp NULL DEFAULT NULL,
  `published_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `short_video_publications_short_video_id_platform_unique` (`short_video_id`,`platform`),
  KEY `short_video_publications_connection_id_foreign` (`connection_id`),
  KEY `short_video_publications_status_index` (`status`),
  KEY `short_video_publications_next_attempt_at_index` (`next_attempt_at`),
  CONSTRAINT `short_video_publications_connection_id_foreign` FOREIGN KEY (`connection_id`) REFERENCES `social_connections` (`id`) ON DELETE SET NULL,
  CONSTRAINT `short_video_publications_short_video_id_foreign` FOREIGN KEY (`short_video_id`) REFERENCES `short_videos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `short_video_publications`
--

/*!40000 ALTER TABLE `short_video_publications` DISABLE KEYS */;
INSERT INTO `short_video_publications` VALUES (1,1,'website',NULL,NULL,NULL,NULL,'v25.0',NULL,NULL,NULL,NULL,NULL,'published','done',NULL,0,0,NULL,'2026-10-21 03:23:44','2026-10-21 03:23:44','2026-10-21 03:23:44','2026-10-21 03:23:44'),(2,1,'instagram',4,'17841425731286796','@apakhabar.fyp','graph.facebook.com','v25.0','eyJpdiI6IjdFKzgyRmhUck1XNTJSajZlOFgwRlE9PSIsInZhbHVlIjoiZXNmekhXVXFWRml2bXhWY3RrUnk2cjNzeGpZaW8zVFViclU3Zkp3NTZuM3RBRGM3eXZBbEpNK0FBUlpPSFlhU3lFQ00zd0MvQk52Mk1GSjA4ai9ha1pGbXFtVWs4SlhUMEUySlRhUmh0ZXFOaWFEZHAvNEM0WmRsU1JyVUJXclRKV2Nmbk9pakYyZGZ5cFhQcnN3aDNUV204SE1FSGUwMWdrTGRuOWUzVlhSV0NBa1hWOFhBL2I1MEdBUmZQdktHalg0MDU4RnRlckkxZFFKOEZYaWwySFhSZHlZNStVdnJFV1ltNmdNNGZKSTZyS2ZPTSt0YW5XTUxGZStlWURRNWpLRHIzcFpudTk4ZGRaYXVPTzhNVlE9PSIsIm1hYyI6IjRlNWM3M2E2ZWEzYzc2NDE2ZmM5MzcwYTRmMWJjZDYyNDczNjUxOGRkYzQyZTdkZDY1ZGM5ODM5MDYzYjUyYmYiLCJ0YWciOiIifQ==',NULL,'18123721435857710','17920907970235817','https://www.instagram.com/reel/Devb0Rgj1Y4/','published','done',NULL,3,2,NULL,'2026-10-21 03:25:03','2026-10-21 03:24:33','2026-10-21 03:23:44','2026-10-21 03:25:07'),(3,1,'facebook',3,'1258664320673115','ApaKhabar','graph.facebook.com','v26.0','eyJpdiI6IkYrR1VJU1ZWajBPdFJvcURxOVl5aVE9PSIsInZhbHVlIjoiNkxOcTZIcDBQR3BhSHJ6bThCQjVQcEQyZnlhbCtkOGRrakdNbCt1Zkh1RlRpMDk4QTBIMFR3L2puQVdkdWJ0R3ZZaisxZTk3eGtkVmY2amFkS3g0QzYrVFh5NnVxelNuU3lBRkdsU2s0aVhCYjUyZ2EwblJDc0lsTnJHVzV0RSsyZENOaHE2V1pzb014cUlodFNhVHY3VU04S3Rhdi9GVGwraWgyMFFBbXNWZ25LamtibnFHSldHYk96bVU5U3RUKy9oUVAxZi8vdXo3c3N4M2ZxeWhKeE5zWm52UTNJMlY2bU1HVmluNUJLKy9FSkJFWDJpNFQ2MmpmTWlJWDlSQVR0SSt1Y3VxaTBNeWsrN1lPQU1wblE9PSIsIm1hYyI6ImU4ZTdhNTZiMjNhMGE2MTRjZmY4MDdlMWQ3N2RlZTAyMDAzODhlOWRiNDA1Yzc3ZGEzNjg5MGI2YTI2MWYwY2QiLCJ0YWciOiIifQ==',NULL,'1836759844165483','1836759844165483','https://www.facebook.com/reel/1836759844165483/','published','done',NULL,5,4,NULL,'2026-10-21 03:26:13','2026-10-21 03:25:43','2026-10-21 03:23:44','2026-10-21 07:39:58'),(4,5,'website',NULL,NULL,NULL,NULL,'v25.0',NULL,NULL,NULL,NULL,NULL,'published','done',NULL,0,0,NULL,'2026-10-21 13:32:12','2026-10-21 13:32:12','2026-10-21 13:32:12','2026-10-21 13:32:12'),(5,5,'facebook',3,'1410344055493000','Tester Service Day','graph.facebook.com','v26.0','eyJpdiI6IlljdWtxcCt2Y0FWelZCYjVaNldlb2c9PSIsInZhbHVlIjoiV242elozbFlmQnVmV1R2YWpvNnBkVW45cjBPMm5uMjZmUkN1ckY0ZzdhYzEySjdNbHM1Vk9GU3lXYVgxRmtsWlprcUt5a2RwdElDQ25oV0dqODFEL3kvU0wyNys0M3loTm4weEJSUitOY0gxQzFGVW1WcjRzQ2VQWjFKV2p5Znpobml2NWtCbkQxZHpqdDBNSDZ0WlFCQjRjbTZmS3pSL2VzaGphdkdWamFVbWxyVEdLbmhyTm9aK01Gd0ZBSDNoRnd4M0ZxZkkybXFpSGt1UWtWUzY1N0hQT1Z2LzNUVmVEYmR1SkY4M0t6VnlQblhId05yNmtDalhlV1RuL3JxVkR2MTl5eDI2M3JGRjJSZldmbHJJN0UwOG5ZSERIbjVFQlVxV25MUS8xZWc9IiwibWFjIjoiNmI3YjM4ZTdiNWQwZTkyMDI5NTIzMjFjMWI3NTUwZTYyYTMzOTdmN2ZkOGIyMTM5OWU2ZmZkYmYyNWZiNGViMiIsInRhZyI6IiJ9',NULL,'978847388627273','978847388627273','https://www.facebook.com/reel/978847388627273/','published','done',NULL,5,1,NULL,'2026-10-21 13:34:28','2026-10-21 13:33:58','2026-10-21 13:32:12','2026-10-21 13:34:29'),(6,5,'instagram',4,'17841425581410317','@noreply.serviceday','graph.facebook.com','v25.0','eyJpdiI6IkhYaitRdWxSQTc2TG5hVjg4S3AwcFE9PSIsInZhbHVlIjoiRnBNa21LYkpNbVREc0NtNkxSem1JUjhUckJkdWMxbFBZRHdDZlltcm9SNlA2bzN4ZEl3WTlTSXEwOEYxYUU5R3NVZnpFTnpsQitSVzMyS0hBcmhLelRkNHJLeFdBWFFrSTZtbWUrL0lYWmhXd0RYc2hKNllRWnhrT2REaXhSSEJqNk0rc2RvblBsNjdvd1NyOGMrUlBTTE13bFk3ckJlMEVhWDFXT2JwSXp1K294SE5VQlBVYVg2WU9kVGJiMEQ0TVppNDcvS29sbmtIZXduYWo0dDlXdWRMM0hLTFNoa1pWVmNyMkptd0t2a3B2NjFBTU94UGZPQzAwZ2RrUDYrK1NRY2prVEVSQXJ1dElsY1VwZHdPSGc9PSIsIm1hYyI6IjI4ZTFkYzQ4MGM4ZDAyZGU3MDBjODNlZTEzZDQ5YzU3Zjk3NTE1ZjdmYzk1N2YxMjQxZGM0NjhiODc1MGNjOTkiLCJ0YWciOiIifQ==',NULL,'18124102909852714','18375349087214641','https://www.instagram.com/reel/DewhdALCZmZ/','published','done',NULL,3,1,NULL,'2026-10-21 13:33:34','2026-10-21 13:33:04','2026-10-21 13:32:12','2026-10-21 13:33:35'),(7,6,'website',NULL,NULL,NULL,NULL,'v25.0',NULL,NULL,NULL,NULL,NULL,'published','done',NULL,0,0,NULL,'2026-10-22 04:14:42','2026-10-22 04:14:42','2026-10-22 04:14:43','2026-10-22 04:14:43'),(8,6,'facebook',3,'1410344055493000','Tester Service Day','graph.facebook.com','v26.0','eyJpdiI6ImNuM24wMWpIUXN0MXYxTytXQlZJQWc9PSIsInZhbHVlIjoiaW1DQk1scnV5NENKUjd3bkMyMVpJekM3aXI3ZHZFTndaY2F5Z0dFMngwbEdIdU53czNxVCtJUzhtTFdQVU90c05DNnV3UzhUK2JVOXJORFJFTm9GR010RG8rZSs0Z2dSdlMyMUNqaldlTnhpbFpWYng1bmRMUXc1THlqTjM3TkQwRUdHSmY5V2pSVjJ6K3lUeVh1NDQ4OTZrZ3JPT3d4R3ltQlQ1NGp3VTBlUy9aMVFaNGRreGZweFFJdlQ1eG9VbGJ0K1NvbkhkZDdubWNYSkVHeGNpOWlJMVVxZ1ZBRUI0QWJHZTBrL1JmZlhLdkViN2VBS0VYbnU0T2IyajBPbkFBWnRMWm5WNFN1UVJqUFUrcmJSbFZsQTg2UmQ4UXkzUXBwQWt4cnFadFU9IiwibWFjIjoiNDc1NjllODFlMTQxMTM3MWRhODdmOTlmMzk2OTEzN2U0NDY2NWE0ZjUxYWM5MzBhMDdlMTllMmJlYjM5NGUwNiIsInRhZyI6IiJ9',NULL,'1139284152112216','1139284152112216','https://www.facebook.com/reel/1139284152112216/','published','done',NULL,5,1,NULL,'2026-10-22 04:17:00','2026-10-22 04:16:30','2026-10-22 04:14:43','2026-10-22 04:17:01'),(9,6,'instagram',4,'17841425581410317','@noreply.serviceday','graph.facebook.com','v25.0','eyJpdiI6ImJ0VFlUSEZCMy8rQ1gyejJaT1JCMHc9PSIsInZhbHVlIjoiQk00YnIydWZDV1FteUZqSUh1UllrTEFnam5kNzFWRTRNSmxGaGRQamFRWUh2SElPbVhld3BiRE5iZHlnL1piQjhaSnptZWdTZ2NGdnJlcjUxend4RDhvdHFDRVFMV0I5cjZORDZIQ0k2eHltRWFoOUFCV200SFJ3NnQ4ckFXYzdjSWZGblEwam9oT2NmbXhrdG1kZUhtVko0dHZtNjdMRVRWcUI3L3VsNFhqNGY5U2lwbGJaZVQyMzdZUjg1cWhBMzc3bFh2d3dKZ3R6bDBtaEY4WFFUUC82elNEWjBXcSszRll4b05UZmlhamxEbnZzODlZMG13LzFqSjNQNUhFOWtDQTFaUnlTdEV6SWE1V1BmZjJCalE9PSIsIm1hYyI6ImE3MTVkODNhZTdjY2ZkYjI4MTU4NzZiNjUzZThlZTI1ZTI0NmVhZjFlMTRhYmQ1NzYxOTFhZTQ1YjJmMzYxM2UiLCJ0YWciOiIifQ==',NULL,'18124252237852714','18080821679371884','https://www.instagram.com/reel/DeyGc_NlZwV/','published','done',NULL,3,1,NULL,'2026-10-22 04:16:06','2026-10-22 04:15:36','2026-10-22 04:14:43','2026-10-22 04:16:08'),(10,7,'website',NULL,NULL,NULL,NULL,'v25.0',NULL,NULL,NULL,NULL,NULL,'published','done',NULL,0,0,NULL,'2026-10-22 13:28:15','2026-10-22 13:28:15','2026-10-22 13:28:15','2026-10-22 13:28:15'),(11,7,'facebook',3,'1410344055493000','Tester Service Day','graph.facebook.com','v26.0','eyJpdiI6Im9DYnFPdXVOVDVXckIzMmc0dDIwT0E9PSIsInZhbHVlIjoiMFk4QzkycTk2YmF1R3Z2UXoxazNtOExsNVB5ZmlLdjZCZ3hnTm93ZTgrQmpCK1ByczFUSmZYSFJCZ1VzNm1ROHNuSHo1OWF0V2dqZkk5UVNNQyt3d3kxVDB2SXFYWXV4SmdBTTlUdTFzbVVKUU44empjSmFSdlloL3RLNUc0OEhZaHU3RFAyQm9YSEhFRlo1a0NhS1FEcG9TZW1xV1VEMHZBLytFZVJqSEZvZnZoSFhkU0FGR1o5RnVhY1E4SmNQb0pSQXQ4MjhOR0tVQWsyOThrQk9zSGxWSXJBZ0xUWWhiQWR4U0d4cUg2VTdRd1VhYVJpVWdHSFNEcWlMWXhSQ2Q2UlNreDhWaklzSGFmV2hVM0UrTVp6ZytLOGhSSUtndzdnUWo4ZjFFVjQ9IiwibWFjIjoiNDBjOTdlYTJlYjk5ZTk2MjVhMTY0ZjI5OWY0MDNhNjc1MWVhZDRjZjJhOGI3NjM1MTNlODcwODU0ZjMyYjI0MCIsInRhZyI6IiJ9',NULL,'971611955465343','971611955465343','https://www.facebook.com/reel/971611955465343/','published','done',NULL,5,1,NULL,'2026-10-22 13:30:32','2026-10-22 13:30:02','2026-10-22 13:28:15','2026-10-22 13:30:33'),(12,7,'instagram',4,'17841425581410317','@noreply.serviceday','graph.facebook.com','v25.0','eyJpdiI6InlCZkFILzJWRzZDbEttaGova2R5SlE9PSIsInZhbHVlIjoiaDJWNk90U1hvVjAvZUY3RlpYcjBSSnJBdEQvYnYyV1d1a1N4a2RQOHZYbWtZd1A2cG9RbjJwTVdCVDgwRVdCa1ovNG9YWTM1ZjhCcEhuNncvVmxENWNkcTMrdGlhK1BvWmduUGpmREpWamgvUS9IR1Fwa0Q4Z0xYTTFTbzhRVlZmWWhqRk5VSmwyeGZEM0NIK3AzUVpPTWdsenZ0WFpyMzc5blJXejc1aFBkZG1NS3VSRkJ5ajZRUHkvR0FWRmFOV3M4dW1lakNrZ3V0K3lPQlp0VEcvNlpkRWxpTnhLcWd0dXVmMDVMOXZXU1ozVDN5YlF2cUp3RktpdUZQcm5FTnhtV3pyZ0FrLzFVK3pXT2N5SWtkcGc9PSIsIm1hYyI6ImE4NDhmYTA5YWEyODA4ZDgyZjAzYTEwMDdiMGYzZDczNjM4ODYwODgzMmM3MmQwZGJjZjlkYmRlZGZlYmZkOTAiLCJ0YWciOiIifQ==',NULL,'18124339330852714','17963492448235418','https://www.instagram.com/reel/DezFzJQlUNm/','published','done',NULL,3,1,NULL,'2026-10-22 13:29:40','2026-10-22 13:29:10','2026-10-22 13:28:15','2026-10-22 13:29:42'),(13,8,'website',NULL,NULL,NULL,NULL,'v25.0',NULL,NULL,NULL,NULL,NULL,'published','done',NULL,0,0,NULL,'2026-10-23 04:54:44','2026-10-23 04:54:44','2026-10-23 04:54:44','2026-10-23 04:54:44'),(14,8,'facebook',3,'1410344055493000','Tester Service Day','graph.facebook.com','v26.0','eyJpdiI6IlBDdjV5Uk1vRFh3QkpZQzFGUjNLMWc9PSIsInZhbHVlIjoiY1ZGcjVKd1dSRStYdXJoOFZVVDFHMFpjaC9hMUJuc1pQN1YzMUdHWllJWHBISjdDRS9zUnpNSGg3aTZpZ2RTVURDRmRTV0xTbjJZZGt2OFBDbitsOTZvTjFoSWp2TE85TmNVSW5sc2pTcGZlckRNeVBsN3NQczQwUE03RzM5MmRteG1vcGZqeHhLa1o4d1pLZlhDOGRoWXUzb050NE9ZK0lDK2g4YjhzanRnWTRiSGNYVFI5STRuUnJXUG55dlBWVjRRZjkwMmt3eFZsKzMxaStjM0VwR2RBNTBQeUMzQW1pU3pwbFJSUHlGLzJwNDhvM2xlZjJQMmZOYjR1a2ZYMkhoYjd1b3RzT2M5Si8xSkhjWk5uLzhVcVBwSDNSVjdrNzUzQ0RNTzNkQW89IiwibWFjIjoiYWJiMzhjZTYyZGQ0YmY4ZGM2NWE2MzI1NzcwYzdmODE3MGQxOTUzZGY1ZmYxZTYwNTgwNTBmZGQ3YzE5MmE3ZCIsInRhZyI6IiJ9',NULL,'1433753048968731','1433753048968731','https://www.facebook.com/reel/1433753048968731/','published','done',NULL,6,1,NULL,'2026-10-23 04:55:39','2026-10-23 04:55:29','2026-10-23 04:54:44','2026-10-23 04:55:42'),(15,8,'instagram',4,'17841425581410317','@noreply.serviceday','graph.facebook.com','v25.0','eyJpdiI6ImhQcVlBbDkveWtiYmU2WVlGalFnb2c9PSIsInZhbHVlIjoicDdVZVpGbmMrNStSR3N6Umh5VGVWQ3J3RnhhazAzVmlLWnA0ajlhNlBTZUwrcjZEbTZMWXpZbHJ6Und2Vk5KdW5YbktMbXRRazk1SktjUDJ1Tk80a3JqbWtFQjBmakVlSjBMc3hWK2pVdWNyUHdJY3hpUnBrRjlwY1Q0QzdsR25idTlNaWl0Nld6cXQ4K3dzWUVCaDB4d0xEOE1YUzlpd1FBOFkxUmhMdHJOeDU2OTZsVmdKTEZDVVRXZUFsOEh1N3h0OXFNK0Q5SWhMazJwU1BLSHRiYUtBQ3R4VzljM2kyRXRUREdnbVFZcHJEakRQK1docmNUWlMxM0w4Qzl1V2RoUDdmU1BlZXJuSkZyWU1yS1hYckE9PSIsIm1hYyI6IjIxM2MyNmM4YjI1ZmU1Yzc2NjUyYzI1Mzg5NGFhMTU1OWMxNzdhYWQxMzVjMjY3Zjc1YjcxMTczOWFjNmQ0OGIiLCJ0YWciOiIifQ==',NULL,'18124495531852714','18110254196598680','https://www.instagram.com/reel/De0v0a9D0SX/','published','done',NULL,6,1,NULL,'2026-10-23 04:55:53','2026-10-23 04:55:43','2026-10-23 04:54:44','2026-10-23 04:55:55');
/*!40000 ALTER TABLE `short_video_publications` ENABLE KEYS */;

--
-- Table structure for table `short_video_viewers`
--

DROP TABLE IF EXISTS `short_video_viewers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `short_video_viewers` (
  `short_video_id` bigint(20) unsigned NOT NULL,
  `viewer_key` varchar(71) NOT NULL,
  `viewed_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`short_video_id`,`viewer_key`),
  CONSTRAINT `short_video_viewers_short_video_id_foreign` FOREIGN KEY (`short_video_id`) REFERENCES `short_videos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `short_video_viewers`
--

/*!40000 ALTER TABLE `short_video_viewers` DISABLE KEYS */;
INSERT INTO `short_video_viewers` VALUES (5,'user:1','2026-10-22 02:54:46'),(7,'user:1','2026-10-23 05:30:36'),(8,'user:1','2026-10-23 04:58:49');
/*!40000 ALTER TABLE `short_video_viewers` ENABLE KEYS */;

--
-- Table structure for table `short_videos`
--

DROP TABLE IF EXISTS `short_videos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `short_videos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `created_by` bigint(20) unsigned NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `video_url` text NOT NULL,
  `video_public_id` varchar(255) NOT NULL,
  `thumbnail_url` text NOT NULL,
  `thumbnail_public_id` varchar(255) DEFAULT NULL,
  `frame_offset` decimal(10,3) NOT NULL DEFAULT 0.000,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`metadata`)),
  `status` varchar(255) NOT NULL DEFAULT 'draft',
  `published_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `view_count` bigint(20) unsigned NOT NULL DEFAULT 0,
  `likes_count` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `short_videos_created_by_foreign` (`created_by`),
  KEY `short_videos_status_index` (`status`),
  KEY `short_videos_published_at_index` (`published_at`),
  CONSTRAINT `short_videos_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`userID`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `short_videos`
--

/*!40000 ALTER TABLE `short_videos` DISABLE KEYS */;
INSERT INTO `short_videos` VALUES (1,1,'Negotiate','Presentation in BIT312 Cloud','https://res.cloudinary.com/xs7txoot/video/upload/v1792552918/apakhabar/shorts/cc93d427-608f-4a0c-b874-19de55aa18bf.mp4','apakhabar/shorts/cc93d427-608f-4a0c-b874-19de55aa18bf','https://res.cloudinary.com/xs7txoot/video/upload/so_0.000,f_jpg/apakhabar/shorts/cc93d427-608f-4a0c-b874-19de55aa18bf.jpg',NULL,0.000,'{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":576,\"height\":1024,\"duration\":11.9,\"fps\":29.915966386554622,\"bitrate\":424135,\"bytes\":714411,\"audio_codec\":\"aac\",\"audio_rate\":44100,\"audio_channels\":2,\"field_order\":\"progressive\",\"rotation\":0}','published','2026-10-21 03:23:43','2026-10-21 03:21:59','2026-10-21 03:23:43',NULL,0,0),(2,1,'',NULL,'https://res.cloudinary.com/xs7txoot/video/upload/v1792553366/apakhabar/shorts/98833b67-7fc6-4d81-b774-4ef1e4ac32fa.mp4','apakhabar/shorts/98833b67-7fc6-4d81-b774-4ef1e4ac32fa','https://res.cloudinary.com/xs7txoot/video/upload/so_0.000,f_jpg/apakhabar/shorts/98833b67-7fc6-4d81-b774-4ef1e4ac32fa.jpg',NULL,0.000,'{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":576,\"height\":1024,\"duration\":11.9,\"fps\":29.915966386554622,\"bitrate\":424135,\"bytes\":714411,\"audio_codec\":\"aac\",\"audio_rate\":44100,\"audio_channels\":2,\"field_order\":\"progressive\",\"rotation\":0}','draft',NULL,'2026-10-21 03:29:26','2026-10-21 13:18:38','2026-10-21 13:18:38',0,0),(3,1,'Testingsdaf sdaF dsfshushfu','Testing the content hfjdsfhjsdhfjhsdjsdf','https://res.cloudinary.com/xs7txoot/video/upload/v1792587634/apakhabar/shorts/2b121bb3-9176-49e1-b27d-3ff748712682.mp4','apakhabar/shorts/2b121bb3-9176-49e1-b27d-3ff748712682','https://res.cloudinary.com/xs7txoot/video/upload/so_0.000,f_jpg/apakhabar/shorts/2b121bb3-9176-49e1-b27d-3ff748712682.jpg',NULL,0.000,'{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":576,\"height\":1024,\"duration\":11.9,\"fps\":29.915966386554622,\"bitrate\":424135,\"bytes\":714411,\"audio_codec\":\"aac\",\"audio_rate\":44100,\"audio_channels\":2,\"field_order\":\"progressive\",\"rotation\":0}','draft',NULL,'2026-10-21 13:00:35','2026-10-21 13:18:41','2026-10-21 13:18:41',0,0),(4,1,'',NULL,'https://res.cloudinary.com/xs7txoot/video/upload/v1792588731/apakhabar/shorts/ba4e03e0-63a3-4b51-a388-de77cfc9043e.mp4','apakhabar/shorts/ba4e03e0-63a3-4b51-a388-de77cfc9043e','https://res.cloudinary.com/xs7txoot/video/upload/so_0.000,f_jpg/apakhabar/shorts/ba4e03e0-63a3-4b51-a388-de77cfc9043e.jpg',NULL,0.000,'{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":576,\"height\":1024,\"duration\":11.9,\"fps\":29.915966386554622,\"bitrate\":424135,\"bytes\":714411,\"audio_codec\":\"aac\",\"audio_rate\":44100,\"audio_channels\":2,\"field_order\":\"progressive\",\"rotation\":0}','draft',NULL,'2026-10-21 13:18:52','2026-10-21 13:18:52',NULL,0,0),(5,1,'Testing123','Testing123Testing123Testing123','https://res.cloudinary.com/xs7txoot/video/upload/v1792589525/apakhabar/shorts/5605ce7c-82ef-4831-84de-15a2d975fc9d.mp4','apakhabar/shorts/5605ce7c-82ef-4831-84de-15a2d975fc9d','https://res.cloudinary.com/xs7txoot/video/upload/so_0.000,f_jpg/apakhabar/shorts/5605ce7c-82ef-4831-84de-15a2d975fc9d.jpg',NULL,0.000,'{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":576,\"height\":1024,\"duration\":11.9,\"fps\":29.915966386554622,\"bitrate\":424135,\"bytes\":714411,\"audio_codec\":\"aac\",\"audio_rate\":44100,\"audio_channels\":2,\"field_order\":\"progressive\",\"rotation\":0}','published','2026-10-21 13:32:12','2026-10-21 13:32:06','2026-10-22 03:33:55',NULL,1,1),(6,1,'Testingsdaf sdaF dsfshushfu','sadfhbashjdbgjkhashd','https://res.cloudinary.com/xs7txoot/video/upload/v1792642461/apakhabar/shorts/06027804-a8c3-4a81-9d70-ce585e5d6231.mp4','apakhabar/shorts/06027804-a8c3-4a81-9d70-ce585e5d6231','https://res.cloudinary.com/xs7txoot/video/upload/so_0.000,f_jpg/apakhabar/shorts/06027804-a8c3-4a81-9d70-ce585e5d6231.jpg',NULL,0.000,'{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":576,\"height\":1024,\"duration\":11.9,\"fps\":29.915966386554622,\"bitrate\":424135,\"bytes\":714411,\"audio_codec\":\"aac\",\"audio_rate\":44100,\"audio_channels\":2,\"field_order\":\"progressive\",\"rotation\":0}','published','2026-10-22 04:14:42','2026-10-22 04:14:22','2026-10-22 04:14:42',NULL,0,0),(7,1,'Celcom digi visit','HELP University student have a industrial visit in Celcom Digi, understanding about AI will be use in different sector and the usage of AI in future','https://res.cloudinary.com/xs7txoot/video/upload/v1792655056/apakhabar/shorts/0207d737-7bbf-436d-b886-9a8653b03249.mp4','apakhabar/shorts/0207d737-7bbf-436d-b886-9a8653b03249','https://res.cloudinary.com/xs7txoot/video/upload/so_0.400,f_jpg/apakhabar/shorts/0207d737-7bbf-436d-b886-9a8653b03249.jpg',NULL,0.400,'{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":1080,\"height\":1920,\"sample_aspect_ratio\":1,\"duration\":7.81,\"fps\":59.94005994005994,\"bitrate\":6091939,\"bytes\":6084618,\"audio_codec\":\"aac\",\"audio_rate\":48000,\"audio_channels\":2,\"field_order\":\"progressive\",\"rotation\":0,\"crop_source\":{\"url\":\"https:\\/\\/res.cloudinary.com\\/xs7txoot\\/video\\/upload\\/v1792652039\\/apakhabar\\/shorts\\/746d1679-1267-4eab-9229-dec0614d2728.mp4\",\"public_id\":\"apakhabar\\/shorts\\/746d1679-1267-4eab-9229-dec0614d2728\",\"metadata\":{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":464,\"height\":832,\"duration\":15.525,\"fps\":59.90338164251208,\"bitrate\":1610713,\"bytes\":3257859,\"audio_codec\":\"aac\",\"audio_rate\":44100,\"audio_channels\":2,\"field_order\":\"progressive\",\"rotation\":0}},\"video_crop\":{\"x\":0.5,\"y\":0.5,\"zoom\":1,\"start\":4.17,\"end\":11.98},\"cover_source\":\"frame\",\"social_asset\":{\"url\":\"https:\\/\\/res.cloudinary.com\\/xs7txoot\\/video\\/upload\\/v1792655056\\/apakhabar\\/shorts\\/0207d737-7bbf-436d-b886-9a8653b03249.mp4\",\"public_id\":\"apakhabar\\/shorts\\/0207d737-7bbf-436d-b886-9a8653b03249\"}}','published','2026-10-22 13:28:15','2026-10-22 06:54:01','2026-10-23 05:30:36',NULL,1,0),(8,1,'Bangi Waterpark','Memories in the waterpark on hot weather','http://localhost:8000/storage/shorts/edits/4de56297-8575-41a4-965e-e2d6dedef1a9.mp4','','http://localhost:8000/storage/shorts/covers/f9938f1d-3fd2-4148-820c-459014a06085.jpg',NULL,0.000,'{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":1080,\"height\":1920,\"sample_aspect_ratio\":1,\"duration\":9.3,\"fps\":30,\"bitrate\":6269546,\"bytes\":7449142,\"audio_codec\":\"aac\",\"audio_rate\":48000,\"audio_channels\":2,\"field_order\":\"progressive\",\"display_transform\":false,\"rotation\":0,\"crop_source\":{\"path\":\"shorts\\/original\\/30156a99-9b29-4e6e-b0df-0b2722d3fe42.mp4\",\"url\":\"http:\\/\\/localhost:8000\\/storage\\/shorts\\/original\\/30156a99-9b29-4e6e-b0df-0b2722d3fe42.mp4\",\"public_id\":\"\",\"metadata\":{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":1024,\"height\":576,\"sample_aspect_ratio\":1,\"duration\":9.3,\"fps\":30,\"bitrate\":1629532,\"bytes\":1972661,\"audio_codec\":\"aac\",\"audio_rate\":44100,\"audio_channels\":2,\"field_order\":\"progressive\",\"display_transform\":true,\"rotation\":-90}},\"video_crop\":{\"mode\":\"fit\",\"x\":0.5,\"y\":0.5,\"zoom\":1,\"start\":0,\"end\":9.3},\"local_path\":\"shorts\\/edits\\/4de56297-8575-41a4-965e-e2d6dedef1a9.mp4\",\"cover_source\":\"photo\",\"cover_original\":\"http:\\/\\/localhost:8000\\/storage\\/shorts\\/covers\\/ebe8327a-f31b-4984-b59a-ab237bd971ba.png\",\"cover_crop\":{\"mode\":\"fit\",\"x\":0.5,\"y\":0.5,\"zoom\":1},\"social_asset\":{\"source_path\":\"shorts\\/edits\\/4de56297-8575-41a4-965e-e2d6dedef1a9.mp4\",\"url\":\"https:\\/\\/res.cloudinary.com\\/xs7txoot\\/video\\/upload\\/v1792731278\\/apakhabar\\/shorts\\/6354573e-47ad-42f9-9ae8-cdbcf9a9cd61.mp4\",\"public_id\":\"apakhabar\\/shorts\\/6354573e-47ad-42f9-9ae8-cdbcf9a9cd61\"},\"social_cover\":{\"source_url\":\"http:\\/\\/localhost:8000\\/storage\\/shorts\\/covers\\/f9938f1d-3fd2-4148-820c-459014a06085.jpg\",\"url\":\"https:\\/\\/res.cloudinary.com\\/xs7txoot\\/image\\/upload\\/v1792731283\\/r15ejwok36ooggiwseqe.jpg\"}}','published','2026-10-23 04:54:44','2026-10-23 02:51:39','2026-10-23 04:58:49',NULL,1,0),(9,1,'','','http://localhost:8000/storage/shorts/edits/5a0ac760-4c3b-4ce0-a452-35f0de96796b.mp4','','http://localhost:8000/storage/shorts/covers/dba28f86-b710-4e32-9fdf-396ce3221837.jpg',NULL,21.301,'{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":1080,\"height\":1920,\"sample_aspect_ratio\":1,\"duration\":47.025,\"fps\":29.96387334419494,\"bitrate\":5325006,\"bytes\":32134975,\"audio_codec\":\"aac\",\"audio_rate\":48000,\"audio_channels\":2,\"field_order\":\"progressive\",\"display_transform\":false,\"rotation\":0,\"crop_source\":{\"path\":\"shorts\\/original\\/c46f5468-4baa-46fe-9d1e-314048122e14.mp4\",\"url\":\"http:\\/\\/localhost:8000\\/storage\\/shorts\\/original\\/c46f5468-4baa-46fe-9d1e-314048122e14.mp4\",\"public_id\":\"\",\"metadata\":{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":1024,\"height\":576,\"sample_aspect_ratio\":1,\"duration\":47.025,\"fps\":29.984051036682615,\"bitrate\":1605029,\"bytes\":9822750,\"audio_codec\":\"aac\",\"audio_rate\":44100,\"audio_channels\":2,\"field_order\":\"progressive\",\"display_transform\":true,\"rotation\":-90}},\"video_crop\":{\"mode\":\"fit\",\"x\":0.5,\"y\":0.5,\"zoom\":1,\"start\":0,\"end\":47.025},\"local_path\":\"shorts\\/edits\\/5a0ac760-4c3b-4ce0-a452-35f0de96796b.mp4\",\"cover_source\":\"frame\",\"processing\":{\"revision\":\"6cb5ee67-08b7-4b9d-8780-605dd43eda76\",\"status\":\"ready\",\"edit\":null,\"error\":null,\"started_at\":\"2026-10-23T20:54:27+08:00\"}}','draft',NULL,'2026-10-23 11:14:36','2026-10-24 02:27:48','2026-10-24 02:27:48',0,0),(10,1,'Like Jennie Performance','','http://localhost:8000/storage/shorts/edits/a1a1ff31-f12d-4ee2-9d99-2a8343a3f641.mp4','','http://localhost:8000/storage/shorts/covers/1bed98ba-8000-4b91-be85-d92468f8e8d5.jpg',NULL,18.809,'{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":1080,\"height\":1920,\"sample_aspect_ratio\":1,\"duration\":47.025,\"fps\":29.96387334419494,\"bitrate\":5325006,\"bytes\":32134975,\"audio_codec\":\"aac\",\"audio_rate\":48000,\"audio_channels\":2,\"field_order\":\"progressive\",\"display_transform\":false,\"rotation\":0,\"local_path\":\"shorts\\/edits\\/a1a1ff31-f12d-4ee2-9d99-2a8343a3f641.mp4\",\"cover_source\":\"frame\",\"crop_source\":{\"path\":\"shorts\\/original\\/1896f2a1-fa44-4a17-a20c-86904e5411aa.mp4\",\"url\":\"http:\\/\\/localhost:8000\\/storage\\/shorts\\/original\\/1896f2a1-fa44-4a17-a20c-86904e5411aa.mp4\",\"public_id\":\"\",\"metadata\":{\"format\":\"mov,mp4,m4a,3gp,3g2,mj2\",\"codec\":\"h264\",\"pixel_format\":\"yuv420p\",\"width\":1024,\"height\":576,\"sample_aspect_ratio\":1,\"duration\":47.025,\"fps\":29.984051036682615,\"bitrate\":1605029,\"bytes\":9822750,\"audio_codec\":\"aac\",\"audio_rate\":44100,\"audio_channels\":2,\"field_order\":\"progressive\",\"display_transform\":true,\"rotation\":-90}},\"video_crop\":{\"mode\":\"fit\",\"x\":0.5,\"y\":0.5,\"zoom\":1,\"start\":0,\"end\":47.025},\"processing\":{\"revision\":\"4260048f-5a01-446c-a045-bc96e9d19bc5\",\"status\":\"ready\",\"edit\":{\"mode\":\"fit\",\"x\":0.5,\"y\":0.5,\"zoom\":1,\"start\":0,\"end\":47.025},\"error\":null,\"started_at\":\"2026-10-24T10:28:17+08:00\"}}','draft',NULL,'2026-10-24 02:28:16','2026-10-24 02:43:10','2026-10-24 02:43:10',0,0);
/*!40000 ALTER TABLE `short_videos` ENABLE KEYS */;

--
-- Table structure for table `social_connections`
--

DROP TABLE IF EXISTS `social_connections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `social_connections` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `platform` varchar(255) NOT NULL,
  `account_id` varchar(255) NOT NULL,
  `account_name` varchar(255) NOT NULL,
  `access_token` text NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `invalidated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `auth_source` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `social_connections_user_id_platform_unique` (`user_id`,`platform`),
  CONSTRAINT `social_connections_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `social_connections`
--

/*!40000 ALTER TABLE `social_connections` DISABLE KEYS */;
INSERT INTO `social_connections` VALUES (3,1,'facebook','1410344055493000','Tester Service Day','eyJpdiI6IktJNHJPMVlsU2hGNEk5WWYvRVZjZVE9PSIsInZhbHVlIjoiN1I0MUxpeW51WUYxTVpkaWI1U3ZkUXp4WU5ydkV4SzRWL2NvT1BqVERyYUJCdURDZHA3OGw4aVZwdDhrWVVCd005NEZ5cmF1T3ZUNFJWWkY2T1U3UHZ6Qm9qc0Rpc3hWMUh3S2Q2TDVQUDdGT2JaWG5MYmw1NE9Ya0lMLytWVTRKR0NoSmp2WW9WcmxWR3l2TU94N0I5SkNZNEo1c1RYYy9IYW05R0x5RXpvTUFPK0tVeXovbEIzaXBXQnE5SzRoRkk3bkw3SHNydlhrREg1TVNJOXlqR0oxcmJENCtOL3BoL1loZUxNS1liRHZtaGRZY0FHNHU3Tk5tR3JKVURLZVlBVUZyT2dZU1RiZ1NvbkVhK3Z5bEJjekIwM0FwSXdMNzhJSVE4UW00RVk9IiwibWFjIjoiYzMwNTI5MWQ3MzhjNWI0NjA1YmNkN2EzMTI0ZmQ4N2Y4MTM5ZjNkY2VkNjA2OGI1ZTM5ZDI3ODk3MWQ1N2VhMSIsInRhZyI6IiJ9',NULL,NULL,'2026-09-28 01:21:42','2026-10-21 12:59:23','facebook_login'),(4,1,'instagram','17841425581410317','@noreply.serviceday','eyJpdiI6InY3RTRQS0l1LzBYeXhlOExHYXFFckE9PSIsInZhbHVlIjoiV0xLcVJGc2RUTEVBS2NaS0ZxMlA5SlAvSmtMaUYxUmxsbjArNkx1MnVJNWxZQXFoYXhnL0xldmNWZzVNSEttWnZPMjhBTERndGRwRnZxMWFLTGJuVGNhc2lKd3QwdlkwTlhnZTVMWFFOeDBDVCtWV3pkQkM1NVdKTENLYVFlQ1MzNUl4SzZyMjRyQVFIL0lRUW1IeVhzb1NsbndSeEdBNGJvNXg1aTlkZ3RpV1AwRm42NEZCMXVtcTNDNG5TdzFsSmw0c3RYMnZRaW5nNmZHNVE5RFlDYngrY293UVpOK2xsSm00Rnh5N0lMdTNDUHUxYytTRU5kQ3NXaE5JMzFDaXVZdENIck1McGUwUjhNTis4ZVZJZGc9PSIsIm1hYyI6IjBjNWJiZjU0ZGMwZDY5NjQyODhmYWE4ZjI0YjdhMmNlYzVhNzU3NDYyYWIzMjg1M2M2N2U3NTg0MWJlN2RjNjYiLCJ0YWciOiIifQ==',NULL,NULL,'2026-09-28 01:21:45','2026-10-21 13:00:14','facebook_login');
/*!40000 ALTER TABLE `social_connections` ENABLE KEYS */;

--
-- Table structure for table `two_factors`
--

DROP TABLE IF EXISTS `two_factors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `two_factors` (
  `two_factor_secret` varchar(255) NOT NULL,
  `two_factor_recovery_codes` text DEFAULT NULL,
  `two_factor_confirmed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `userID` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`two_factor_secret`),
  UNIQUE KEY `two_factors_userid_unique` (`userID`),
  CONSTRAINT `two_factors_userid_foreign` FOREIGN KEY (`userID`) REFERENCES `users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `two_factors`
--

/*!40000 ALTER TABLE `two_factors` DISABLE KEYS */;
/*!40000 ALTER TABLE `two_factors` ENABLE KEYS */;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_roles` (
  `roleID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`roleID`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,'admin','2026-08-28 08:11:24','2026-08-28 08:11:24'),(2,'moderator','2026-08-28 08:11:24','2026-08-28 08:11:24'),(3,'villager','2026-08-28 08:11:24','2026-08-28 08:11:24');
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `userID` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `push_token` varchar(255) DEFAULT NULL,
  `remember_token` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `roleID` bigint(20) unsigned NOT NULL,
  `two_factor_secret` text DEFAULT NULL,
  `two_factor_recovery_codes` text DEFAULT NULL,
  `two_factor_confirmed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`userID`),
  KEY `users_roleid_foreign` (`roleID`),
  CONSTRAINT `users_roleid_foreign` FOREIGN KEY (`roleID`) REFERENCES `user_roles` (`roleID`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Admin','$2y$12$LiT8j0aSKbwL8LQ73L/r0upr7Rlx9Vh55U7CXXWZjmcf/EzNNx2y.',NULL,'DQcQF65Q1Qboyj2kbkOiUElDGdS0gcR7xBRb5WX7lKt3edrehD49SSJtoRfi','2026-08-28 08:11:25','2026-08-28 08:11:25',1,NULL,NULL,NULL),(9,'kaikai','$2y$12$exrA1ABwLEhC2lC3kgAocehcLI7fWFp1dtIWD.ufSVzu9Lah1xeUq',NULL,'yQV0T7wxSg7PNaMMEohbNISixxQl5C0KJuLi8vkQ0Wj4E0Tveyr12ovzNlR2','2026-09-25 05:40:54','2026-10-19 13:23:18',3,NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-26 15:11:49
