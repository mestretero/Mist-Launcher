import { prisma } from "../lib/prisma.js";
import { notFound, forbidden, badRequest } from "../lib/errors.js";

// Default blocks created when a new profile is first accessed
const DEFAULT_BLOCK_TYPES = [
  { type: "STATS" as const, position: 0 },
  { type: "ACTIVITY" as const, position: 1 },
  { type: "COMMENT_WALL" as const, position: 2 },
];

/**
 * Get a user's profile, creating it with default blocks if it doesn't exist.
 */
export async function getOrCreateProfile(userId: string) {
  let profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: { blocks: { orderBy: { position: "asc" } } },
  });

  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        userId,
        blocks: {
          create: DEFAULT_BLOCK_TYPES,
        },
      },
      include: { blocks: { orderBy: { position: "asc" } } },
    });
  }

  return profile;
}

/**
 * Check whether viewerId can see profileUserId's profile.
 * Throws notFound if blocked (mutual), or forbidden if visibility doesn't allow it.
 * Returns true if allowed.
 */
export async function checkVisibility(profileUserId: string, viewerId: string | undefined) {
  // If viewing own profile, always allow
  if (viewerId && viewerId === profileUserId) return true;

  // Check for block in either direction
  if (viewerId) {
    const block = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: profileUserId, receiverId: viewerId, status: "BLOCKED" },
          { senderId: viewerId, receiverId: profileUserId, status: "BLOCKED" },
        ],
      },
    });
    if (block) throw notFound("Profile not found");
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: profileUserId },
    select: { visibility: true },
  });

  if (!profile) return true; // Profile doesn't exist yet — will be created on access

  if (profile.visibility === "PRIVATE") {
    if (!viewerId) throw notFound("Profile not found");
    throw notFound("Profile not found");
  }

  if (profile.visibility === "FRIENDS") {
    if (!viewerId) throw notFound("Profile not found");

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: profileUserId, receiverId: viewerId },
          { senderId: viewerId, receiverId: profileUserId },
        ],
        status: "ACCEPTED",
      },
    });
    if (!friendship) throw notFound("Profile not found");
  }

  return true;
}

/**
 * Get a public-facing profile by username, with visibility enforcement.
 */
export async function getProfileByUsername(username: string, viewerId: string | undefined) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, avatarUrl: true, bio: true, createdAt: true },
  });
  if (!user) throw notFound("User not found");

  await checkVisibility(user.id, viewerId);

  const profile = await getOrCreateProfile(user.id);

  return { user, profile };
}

/**
 * Update a user's profile settings.
 */
export async function updateProfile(
  userId: string,
  data: {
    visibility?: "PUBLIC" | "FRIENDS" | "PRIVATE";
    allowComments?: boolean;
    bannerTheme?: string;
    customStatus?: string | null;
  }
) {
  // Ensure profile exists
  await getOrCreateProfile(userId);

  return prisma.userProfile.update({
    where: { userId },
    data,
    include: { blocks: { orderBy: { position: "asc" } } },
  });
}

/**
 * Atomically replace all blocks for a profile.
 * Accepts an array of { type, position, config?, visible? }.
 */
export async function saveBlocks(
  userId: string,
  blocks: Array<{
    type: string;
    position: number;
    config?: Record<string, unknown>;
    visible?: boolean;
  }>
) {
  const profile = await getOrCreateProfile(userId);

  return prisma.$transaction(async (tx) => {
    await tx.profileBlock.deleteMany({ where: { profileId: profile.id } });
    const created = await Promise.all(
      blocks.map((b) =>
        tx.profileBlock.create({
          data: {
            profileId: profile.id,
            type: b.type as any,
            position: b.position,
            config: (b.config ?? {}) as any,
            visible: b.visible ?? true,
          },
        })
      )
    );
    return created;
  });
}

/**
 * Add a single block to a profile (max 20 blocks).
 */
export async function addBlock(
  userId: string,
  type: string,
  config: Record<string, unknown> = {}
) {
  const profile = await getOrCreateProfile(userId);

  const count = await prisma.profileBlock.count({ where: { profileId: profile.id } });
  if (count >= 20) throw badRequest("Profile cannot have more than 20 blocks");

  const maxPositionResult = await prisma.profileBlock.aggregate({
    where: { profileId: profile.id },
    _max: { position: true },
  });
  const nextPosition = (maxPositionResult._max.position ?? -1) + 1;

  return prisma.profileBlock.create({
    data: {
      profileId: profile.id,
      type: type as any,
      position: nextPosition,
      config: config as any,
    },
  });
}

/**
 * Delete a single block by ID, verifying ownership.
 */
export async function deleteBlock(userId: string, blockId: string) {
  const profile = await getOrCreateProfile(userId);

  const block = await prisma.profileBlock.findUnique({ where: { id: blockId } });
  if (!block || block.profileId !== profile.id) throw notFound("Block not found");

  return prisma.profileBlock.delete({ where: { id: blockId } });
}

/**
 * Add a comment to a profile identified by username.
 */
export async function addComment(
  profileUsername: string,
  authorId: string,
  content: string
) {
  const trimmed = content.trim();
  if (!trimmed) throw badRequest("Comment content cannot be empty");
  if (trimmed.length > 1000) throw badRequest("Comment cannot exceed 1000 characters");

  const profileUser = await prisma.user.findUnique({ where: { username: profileUsername } });
  if (!profileUser) throw notFound("User not found");

  // Check blocks — if either side blocked, deny
  const block = await prisma.friendship.findFirst({
    where: {
      OR: [
        { senderId: profileUser.id, receiverId: authorId, status: "BLOCKED" },
        { senderId: authorId, receiverId: profileUser.id, status: "BLOCKED" },
      ],
    },
  });
  if (block) throw notFound("Profile not found");

  const profile = await getOrCreateProfile(profileUser.id);

  if (!profile.allowComments) throw forbidden("Comments are disabled on this profile");

  // Check visibility — commenter must be able to see the profile
  await checkVisibility(profileUser.id, authorId);

  return prisma.profileComment.create({
    data: {
      profileId: profile.id,
      authorId,
      content: trimmed,
    },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
    },
  });
}

/**
 * Soft-delete a comment. Allowed if the caller is the profile owner or comment author.
 */
export async function deleteComment(userId: string, commentId: string) {
  const comment = await prisma.profileComment.findUnique({
    where: { id: commentId },
    include: { profile: { select: { userId: true } } },
  });
  if (!comment || comment.deletedAt) throw notFound("Comment not found");

  const isAuthor = comment.authorId === userId;
  const isProfileOwner = comment.profile.userId === userId;
  if (!isAuthor && !isProfileOwner) throw forbidden("Not allowed to delete this comment");

  return prisma.profileComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Get paginated comments for a profile, filtering out soft-deleted ones.
 */
export async function getComments(
  profileUsername: string,
  viewerId: string,
  page = 1,
  limit = 20
) {
  const profileUser = await prisma.user.findUnique({ where: { username: profileUsername } });
  if (!profileUser) throw notFound("User not found");

  await checkVisibility(profileUser.id, viewerId);

  const profile = await getOrCreateProfile(profileUser.id);

  const skip = (page - 1) * limit;
  const [comments, total] = await prisma.$transaction([
    prisma.profileComment.findMany({
      where: { profileId: profile.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
      },
    }),
    prisma.profileComment.count({
      where: { profileId: profile.id, deletedAt: null },
    }),
  ]);

  return { comments, total, page, limit };
}
