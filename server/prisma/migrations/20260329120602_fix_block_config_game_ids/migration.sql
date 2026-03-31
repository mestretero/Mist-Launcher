-- Fix FAVORITE_GAME blocks: LibraryItem.id → Game.id
UPDATE profile_blocks SET config = jsonb_set(
  config, '{gameId}',
  (SELECT to_jsonb(li.game_id::text) FROM library_items li WHERE li.id::text = config->>'gameId')
)
WHERE type = 'FAVORITE_GAME'
  AND config->>'gameId' IS NOT NULL
  AND EXISTS (SELECT 1 FROM library_items li WHERE li.id::text = config->>'gameId');

-- Fix GAME_SHOWCASE blocks: LibraryItem.id[] → Game.id[]
UPDATE profile_blocks SET config = jsonb_set(
  config, '{gameIds}',
  (
    SELECT COALESCE(
      jsonb_agg(
        COALESCE(
          (SELECT to_jsonb(li.game_id::text) FROM library_items li WHERE li.id::text = elem::text),
          elem
        )
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(config->'gameIds') AS elem
  )
)
WHERE type = 'GAME_SHOWCASE'
  AND config->'gameIds' IS NOT NULL
  AND jsonb_array_length(config->'gameIds') > 0;
