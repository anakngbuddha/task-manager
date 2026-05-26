-- Dedupe any existing duplicate (projectId, title) pairs before adding the
-- unique constraint. We append a short suffix derived from the row id so the
-- resulting titles are deterministic and human-readable.
UPDATE `Task` t
JOIN (
  SELECT id, projectId, title,
         ROW_NUMBER() OVER (PARTITION BY projectId, title ORDER BY createdAt, id) AS rn
  FROM `Task`
) ranked ON ranked.id = t.id
SET t.title = CONCAT(t.title, ' (', SUBSTRING(t.id, 1, 6), ')')
WHERE ranked.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX `Task_projectId_title_key` ON `Task`(`projectId`, `title`);
