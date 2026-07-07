-- Built-in contact types: user_id NULL, labels resolved via i18n keys by id.
-- 'congratulate' has weight 0: it is only ever assigned to birthday tasks and
-- never enters the random activity rotation.
INSERT INTO `contact_types` (`id`, `user_id`, `name`, `emoji`, `default_weight`, `sort_order`, `archived`) VALUES
  ('message',      NULL, NULL, '💬', 30, 1, 0),
  ('call',         NULL, NULL, '📞', 25, 2, 0),
  ('coffee',       NULL, NULL, '☕', 20, 3, 0),
  ('activity',     NULL, NULL, '🎬', 10, 4, 0),
  ('visit_them',   NULL, NULL, '🚗', 10, 5, 0),
  ('host_visit',   NULL, NULL, '🏠', 5,  6, 0),
  ('congratulate', NULL, NULL, '🎂', 0,  7, 0);
