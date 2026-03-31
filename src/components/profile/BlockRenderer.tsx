import type React from "react";
import { TextBlock } from "./blocks/TextBlock";
import { StatsBlock } from "./blocks/StatsBlock";
import { ActivityBlock } from "./blocks/ActivityBlock";
import { GameShowcaseBlock } from "./blocks/GameShowcaseBlock";
import { FavoriteGameBlock } from "./blocks/FavoriteGameBlock";
import { SocialLinksBlock } from "./blocks/SocialLinksBlock";
import { ScreenshotsBlock } from "./blocks/ScreenshotsBlock";
import { AchievementsBlock } from "./blocks/AchievementsBlock";
import { CommentWallBlock } from "./blocks/CommentWallBlock";
import { ReferralBlock } from "./blocks/ReferralBlock";

const BLOCK_MAP: Record<string, React.ComponentType<any>> = {
  TEXT: TextBlock,
  STATS: StatsBlock,
  ACTIVITY: ActivityBlock,
  GAME_SHOWCASE: GameShowcaseBlock,
  FAVORITE_GAME: FavoriteGameBlock,
  SOCIAL_LINKS: SocialLinksBlock,
  SCREENSHOTS: ScreenshotsBlock,
  ACHIEVEMENTS: AchievementsBlock,
  COMMENT_WALL: CommentWallBlock,
  REFERRAL: ReferralBlock,
};

interface Props {
  block: { id: string; type: string; config: any; visible: boolean };
  isEditing: boolean;
  onConfigChange: (config: any) => void;
  extraProps?: Record<string, any>;
}

export function BlockRenderer({ block, isEditing, onConfigChange, extraProps = {} }: Props) {
  const Component = BLOCK_MAP[block.type];
  if (!Component) return null;
  if (!block.visible && !isEditing) return null;
  return (
    <Component
      config={block.config}
      isEditing={isEditing}
      onConfigChange={onConfigChange}
      {...extraProps}
    />
  );
}
