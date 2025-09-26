-- CreateTable
CREATE TABLE "public"."Game" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "seed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Player" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#cccccc',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mainPawnId" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Pawn" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "ownerPlayerId" TEXT,
    "kind" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "state" JSONB,

    CONSTRAINT "Pawn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Die" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "ownerPlayerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "faces" JSONB NOT NULL,

    CONSTRAINT "Die_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tile" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "preset" TEXT NOT NULL,
    "custom" JSONB,
    "tags" TEXT[],

    CONSTRAINT "Tile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Connection" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "fromTileId" TEXT NOT NULL,
    "toTileId" TEXT NOT NULL,
    "bidir" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TileEffect" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "tileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB,

    CONSTRAINT "TileEffect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rule" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "conditions" JSONB,
    "effects" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "specificity" INTEGER NOT NULL DEFAULT 0,
    "duration" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VictoryCondition" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "logic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VictoryCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResourceDef" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "min" DOUBLE PRECISION,
    "max" DOUBLE PRECISION,

    CONSTRAINT "ResourceDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlayerResource" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InventoryItem" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stack" INTEGER NOT NULL DEFAULT 1,
    "meta" JSONB,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Turn" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "currentPlayerId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Turn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EventLog" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "turnId" TEXT,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Player_gameId_idx" ON "public"."Player"("gameId");

-- CreateIndex
CREATE INDEX "Pawn_gameId_idx" ON "public"."Pawn"("gameId");

-- CreateIndex
CREATE INDEX "Pawn_ownerPlayerId_idx" ON "public"."Pawn"("ownerPlayerId");

-- CreateIndex
CREATE INDEX "Die_gameId_idx" ON "public"."Die"("gameId");

-- CreateIndex
CREATE INDEX "Die_ownerPlayerId_idx" ON "public"."Die"("ownerPlayerId");

-- CreateIndex
CREATE INDEX "Tile_gameId_idx" ON "public"."Tile"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Tile_gameId_x_y_key" ON "public"."Tile"("gameId", "x", "y");

-- CreateIndex
CREATE INDEX "Connection_gameId_idx" ON "public"."Connection"("gameId");

-- CreateIndex
CREATE INDEX "Connection_fromTileId_idx" ON "public"."Connection"("fromTileId");

-- CreateIndex
CREATE INDEX "Connection_toTileId_idx" ON "public"."Connection"("toTileId");

-- CreateIndex
CREATE INDEX "TileEffect_gameId_idx" ON "public"."TileEffect"("gameId");

-- CreateIndex
CREATE INDEX "TileEffect_tileId_idx" ON "public"."TileEffect"("tileId");

-- CreateIndex
CREATE INDEX "Rule_gameId_idx" ON "public"."Rule"("gameId");

-- CreateIndex
CREATE INDEX "VictoryCondition_gameId_idx" ON "public"."VictoryCondition"("gameId");

-- CreateIndex
CREATE INDEX "ResourceDef_gameId_idx" ON "public"."ResourceDef"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceDef_gameId_name_key" ON "public"."ResourceDef"("gameId", "name");

-- CreateIndex
CREATE INDEX "PlayerResource_gameId_idx" ON "public"."PlayerResource"("gameId");

-- CreateIndex
CREATE INDEX "PlayerResource_playerId_idx" ON "public"."PlayerResource"("playerId");

-- CreateIndex
CREATE INDEX "PlayerResource_resourceId_idx" ON "public"."PlayerResource"("resourceId");

-- CreateIndex
CREATE INDEX "InventoryItem_gameId_idx" ON "public"."InventoryItem"("gameId");

-- CreateIndex
CREATE INDEX "InventoryItem_playerId_idx" ON "public"."InventoryItem"("playerId");

-- CreateIndex
CREATE INDEX "Turn_gameId_idx" ON "public"."Turn"("gameId");

-- CreateIndex
CREATE INDEX "Turn_currentPlayerId_idx" ON "public"."Turn"("currentPlayerId");

-- CreateIndex
CREATE INDEX "EventLog_gameId_idx" ON "public"."EventLog"("gameId");

-- CreateIndex
CREATE INDEX "EventLog_turnId_idx" ON "public"."EventLog"("turnId");

-- CreateIndex
CREATE INDEX "EventLog_actorId_idx" ON "public"."EventLog"("actorId");

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pawn" ADD CONSTRAINT "Pawn_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pawn" ADD CONSTRAINT "Pawn_ownerPlayerId_fkey" FOREIGN KEY ("ownerPlayerId") REFERENCES "public"."Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Die" ADD CONSTRAINT "Die_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Die" ADD CONSTRAINT "Die_ownerPlayerId_fkey" FOREIGN KEY ("ownerPlayerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tile" ADD CONSTRAINT "Tile_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Connection" ADD CONSTRAINT "Connection_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Connection" ADD CONSTRAINT "Connection_fromTileId_fkey" FOREIGN KEY ("fromTileId") REFERENCES "public"."Tile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Connection" ADD CONSTRAINT "Connection_toTileId_fkey" FOREIGN KEY ("toTileId") REFERENCES "public"."Tile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TileEffect" ADD CONSTRAINT "TileEffect_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TileEffect" ADD CONSTRAINT "TileEffect_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "public"."Tile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rule" ADD CONSTRAINT "Rule_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VictoryCondition" ADD CONSTRAINT "VictoryCondition_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResourceDef" ADD CONSTRAINT "ResourceDef_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerResource" ADD CONSTRAINT "PlayerResource_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerResource" ADD CONSTRAINT "PlayerResource_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlayerResource" ADD CONSTRAINT "PlayerResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."ResourceDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryItem" ADD CONSTRAINT "InventoryItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Turn" ADD CONSTRAINT "Turn_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventLog" ADD CONSTRAINT "EventLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "public"."Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventLog" ADD CONSTRAINT "EventLog_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "public"."Turn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EventLog" ADD CONSTRAINT "EventLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
