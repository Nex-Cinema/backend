-- A sellable seat may occupy multiple physical columns and admit more than one guest.
-- Standard/VIP seats remain 1x1; a couple seat is stored once with span/capacity 2.
ALTER TABLE `ghe`
  ADD COLUMN `DoRongCot` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `SucChua` INTEGER NOT NULL DEFAULT 1;
