-- Seed themes
INSERT INTO themes (id, name, image_url, price, category, is_active, created_at) VALUES
  ('midnight-bus-stop', 'Midnight Bus Stop', '/public/themes/midnight-bus-stop.jpeg', 0, 'default', true, NOW()),
  ('night-city-v', 'Night City', '/public/themes/night-city-v.jpeg', 0, 'default', true, NOW()),
  ('witchers-path', 'Witcher''s Path', '/public/themes/witchers-path.jpeg', 0, 'default', true, NOW()),
  ('red-dead-sunset', 'Red Dead Sunset', '/public/themes/red-dead-sunset.jpeg', 0, 'default', true, NOW()),
  ('elden-ring-tarnished', 'Elden Ring', '/public/themes/elden-ring-tarnished.jpeg', 200, 'game', true, NOW()),
  ('assassins-creed-firenze', 'Assassin''s Creed', '/public/themes/assassins-creed-firenze.jpeg', 200, 'game', true, NOW()),
  ('god-of-war-ragnarok', 'God of War', '/public/themes/god-of-war-ragnarok.jpeg', 200, 'game', true, NOW()),
  ('gta-v-trio', 'GTA V', '/public/themes/gta-v-trio.jpeg', 200, 'game', true, NOW()),
  ('horror-crossover', 'Horror Night', '/public/themes/horror-crossover.jpeg', 200, 'crossover', true, NOW()),
  ('internet-cafe-chaos', 'Internet Cafe', '/public/themes/internet-cafe-chaos.jpeg', 200, 'crossover', true, NOW()),
  ('kitchen-mayhem', 'Kitchen Mayhem', '/public/themes/kitchen-mayhem.jpeg', 200, 'crossover', true, NOW()),
  ('legends-tavern', 'Legends'' Tavern', '/public/themes/legends-tavern.jpeg', 200, 'crossover', true, NOW()),
  ('villains-feast', 'Villains'' Feast', '/public/themes/villains-feast.jpeg', 200, 'crossover', true, NOW()),
  ('villains-poker-night', 'Poker Night', '/public/themes/villains-poker-night.jpeg', 200, 'crossover', true, NOW()),
  ('gaming-legends-assembled', 'Gaming Legends', '/public/themes/gaming-legends-assembled.jpeg', 200, 'crossover', true, NOW()),
  ('covert-ops', 'Covert Ops', '/public/themes/covert-ops.jpeg', 200, 'crossover', true, NOW()),
  ('pixel-subway', 'Pixel Subway', '/public/themes/pixel-subway.jpeg', 200, 'crossover', true, NOW()),
  ('ultimate-battlefield', 'Ultimate Battlefield', '/public/themes/ultimate-battlefield.jpeg', 200, 'crossover', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Migrate old bannerTheme values to new slugs
UPDATE user_profiles SET banner_theme = 'midnight-bus-stop' WHERE banner_theme = 'default';
UPDATE user_profiles SET banner_theme = 'night-city-v' WHERE banner_theme = 'cyber';
UPDATE user_profiles SET banner_theme = 'witchers-path' WHERE banner_theme = 'nature';
UPDATE user_profiles SET banner_theme = 'red-dead-sunset' WHERE banner_theme = 'mech';
