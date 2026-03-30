import { prisma } from "../lib/prisma.js";
import { notFound, badRequest, forbidden, conflict } from "../lib/errors.js";

const VOTE_HIDE_THRESHOLD = -5;
const VIRUS_HIDE_THRESHOLD = 3;
const MAX_LINKS_PER_USER_PER_GAME = 5;
const MAX_LINKS_PER_USER_PER_DAY = 20;

export async function getLinksForGame(gameId: string, userId?: string, isAdmin = false) {
  const where: any = { gameId };
  if (!isAdmin) where.isHidden = false;

  const links = await prisma.communityLink.findMany({
    where,
    include: {
      user: { select: { username: true, avatarUrl: true } },
      mirrors: { select: { id: true, sourceName: true, url: true } },
      votes: userId ? { where: { userId }, select: { voteType: true } } : false,
      reports: userId ? { where: { userId }, select: { id: true } } : false,
    },
    orderBy: [{ isAdminPost: "desc" }, { score: "desc" }, { createdAt: "desc" }],
  });

  return links.map((link) => ({
    id: link.id,
    title: link.title,
    description: link.description,
    size: link.size,
    crackInfo: link.crackInfo,
    score: link.score,
    virusReports: link.virusReports,
    isAdminPost: link.isAdminPost,
    isHidden: link.isHidden,
    createdAt: link.createdAt,
    user: link.user,
    mirrors: link.mirrors,
    userVote: link.votes?.[0]?.voteType ?? null,
    hasReported: (link.reports?.length ?? 0) > 0,
  }));
}

export async function createLink(
  gameId: string,
  userId: string,
  isAdmin: boolean,
  data: {
    title: string;
    description?: string;
    size?: string;
    crackInfo?: string;
    mirrors: { sourceName: string; url: string }[];
  },
) {
  // Rate limit checks
  const userLinkCount = await prisma.communityLink.count({
    where: { gameId, userId },
  });
  if (userLinkCount >= MAX_LINKS_PER_USER_PER_GAME) {
    throw badRequest(`Maximum ${MAX_LINKS_PER_USER_PER_GAME} links per game`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dailyCount = await prisma.communityLink.count({
    where: { userId, createdAt: { gte: today } },
  });
  if (dailyCount >= MAX_LINKS_PER_USER_PER_DAY) {
    throw badRequest(`Maximum ${MAX_LINKS_PER_USER_PER_DAY} links per day`);
  }

  // Validate mirrors
  if (!data.mirrors.length) throw badRequest("At least one mirror required");
  for (const m of data.mirrors) {
    if (!m.url.startsWith("http://") && !m.url.startsWith("https://")) {
      throw badRequest("Mirror URL must start with http:// or https://");
    }
  }

  const link = await prisma.communityLink.create({
    data: {
      gameId,
      userId,
      title: data.title.slice(0, 100),
      description: data.description?.slice(0, 500) || null,
      size: data.size?.slice(0, 20) || null,
      crackInfo: data.crackInfo?.slice(0, 100) || null,
      isAdminPost: isAdmin,
      mirrors: {
        create: data.mirrors.map((m) => ({
          sourceName: m.sourceName.slice(0, 50),
          url: m.url.slice(0, 500),
        })),
      },
    },
    include: {
      user: { select: { username: true, avatarUrl: true } },
      mirrors: { select: { id: true, sourceName: true, url: true } },
    },
  });

  return {
    ...link,
    userVote: null,
    hasReported: false,
  };
}

export async function vote(communityLinkId: string, userId: string, voteType: "UP" | "DOWN") {
  const link = await prisma.communityLink.findUnique({ where: { id: communityLinkId } });
  if (!link) throw notFound("Link not found");

  const existing = await prisma.communityLinkVote.findUnique({
    where: { communityLinkId_userId: { communityLinkId, userId } },
  });

  return prisma.$transaction(async (tx) => {
    let scoreDelta = 0;
    let newUserVote: string | null = null;

    if (existing) {
      if (existing.voteType === voteType) {
        // Same vote — remove it
        await tx.communityLinkVote.delete({ where: { id: existing.id } });
        scoreDelta = voteType === "UP" ? -1 : 1;
        newUserVote = null;
      } else {
        // Different vote — switch
        await tx.communityLinkVote.update({ where: { id: existing.id }, data: { voteType } });
        scoreDelta = voteType === "UP" ? 2 : -2;
        newUserVote = voteType;
      }
    } else {
      // New vote
      await tx.communityLinkVote.create({ data: { communityLinkId, userId, voteType } });
      scoreDelta = voteType === "UP" ? 1 : -1;
      newUserVote = voteType;
    }

    const newScore = link.score + scoreDelta;
    const updated = await tx.communityLink.update({
      where: { id: communityLinkId },
      data: {
        score: { increment: scoreDelta },
        isHidden: newScore <= VOTE_HIDE_THRESHOLD,
      },
    });

    return { score: updated.score, userVote: newUserVote };
  });
}

export async function report(communityLinkId: string, userId: string) {
  const link = await prisma.communityLink.findUnique({ where: { id: communityLinkId } });
  if (!link) throw notFound("Link not found");

  const existing = await prisma.communityLinkReport.findUnique({
    where: { communityLinkId_userId: { communityLinkId, userId } },
  });
  if (existing) throw conflict("Already reported");

  return prisma.$transaction(async (tx) => {
    await tx.communityLinkReport.create({ data: { communityLinkId, userId } });

    const newReportCount = link.virusReports + 1;
    const updated = await tx.communityLink.update({
      where: { id: communityLinkId },
      data: {
        virusReports: { increment: 1 },
        isHidden: newReportCount >= VIRUS_HIDE_THRESHOLD || link.isHidden,
      },
    });

    return { reported: true, virusReports: updated.virusReports };
  });
}

export async function deleteLink(communityLinkId: string, userId: string, isAdmin: boolean) {
  const link = await prisma.communityLink.findUnique({ where: { id: communityLinkId } });
  if (!link) throw notFound("Link not found");
  if (link.userId !== userId && !isAdmin) throw forbidden("Not your link");

  await prisma.communityLink.delete({ where: { id: communityLinkId } });
}

export async function toggleHide(communityLinkId: string) {
  const link = await prisma.communityLink.findUnique({ where: { id: communityLinkId } });
  if (!link) throw notFound("Link not found");

  const updated = await prisma.communityLink.update({
    where: { id: communityLinkId },
    data: { isHidden: !link.isHidden },
  });

  return { isHidden: updated.isHidden };
}
