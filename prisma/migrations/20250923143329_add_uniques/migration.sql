/*
  Warnings:

  - A unique constraint covering the columns `[label]` on the table `ChecklistItem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_label_key" ON "ChecklistItem"("label");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_name_key" ON "Customer"("name");
