-- AlterTable
ALTER TABLE `filenode` ADD COLUMN `projectId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `FileNode_projectId_idx` ON `FileNode`(`projectId`);

-- AddForeignKey
ALTER TABLE `FileNode` ADD CONSTRAINT `FileNode_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
