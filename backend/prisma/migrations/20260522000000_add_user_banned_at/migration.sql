-- AlterTable
ALTER TABLE `User` ADD COLUMN `bannedAt` DATETIME(3) NULL;

-- Backfill: any user whose role was previously overwritten to 'banned' should
-- be marked banned via bannedAt instead. We can't recover their original role
-- (it was destructively overwritten), so we leave the role as 'banned' for
-- now; an admin can re-promote them through PATCH /admin/users/:id/role.
UPDATE `User` SET `bannedAt` = NOW() WHERE `role` = 'banned' AND `bannedAt` IS NULL;
