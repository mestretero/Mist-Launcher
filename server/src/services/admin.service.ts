import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/errors.js";
import { getClient } from "../ws/gateway.js";

const USER_SELECT = {
  id: true,
  username: true,
  email: true,
  isAdmin: true,
  isBanned: true,
  bannedAt: true,
  createdAt: true,
};

export async function listUsers(search: string | undefined, page: number, limit: number) {
  const where = search
    ? {
        OR: [
          { username: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit };
}

export async function banUser(targetId: string) {
  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw notFound("User not found");

  await prisma.user.update({
    where: { id: targetId },
    data: { isBanned: true, bannedAt: new Date() },
  });

  try {
    const client = getClient(targetId);
    if (client) client.ws.close(4004, "Account banned");
  } catch { /* WS client may not be connected */ }

  return { success: true };
}

export async function unbanUser(targetId: string) {
  const user = await prisma.user.findUnique({ where: { id: targetId } });
  if (!user) throw notFound("User not found");

  await prisma.user.update({
    where: { id: targetId },
    data: { isBanned: false, bannedAt: null },
  });

  return { success: true };
}

export async function getReportedUsers(page: number, limit: number) {
  const grouped = await prisma.userReport.groupBy({
    by: ["reportedUserId"],
    where: { status: "OPEN" },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    skip: (page - 1) * limit,
    take: limit,
  });

  const userIds = grouped.map((g) => g.reportedUserId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      ...USER_SELECT,
      reportsReceived: {
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { reason: true, createdAt: true },
      },
    },
  });

  const countMap = new Map(grouped.map((g) => [g.reportedUserId, g._count.id]));
  const result = users.map((u) => ({
    ...u,
    openReportCount: countMap.get(u.id) ?? 0,
    latestReason: u.reportsReceived[0]?.reason ?? null,
    latestReportAt: u.reportsReceived[0]?.createdAt ?? null,
    reportsReceived: undefined,
  }));

  const total = await prisma.userReport
    .groupBy({ by: ["reportedUserId"], where: { status: "OPEN" } })
    .then((r) => r.length);

  return { users: result, total, page, limit };
}

export async function getUserReports(userId: string) {
  return prisma.userReport.findMany({
    where: { reportedUserId: userId },
    include: { reporter: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveReport(reportId: string, status: "RESOLVED" | "DISMISSED") {
  const report = await prisma.userReport.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("Report not found");

  return prisma.userReport.update({
    where: { id: reportId },
    data: { status },
  });
}

export async function getReportedLinks(page: number, limit: number) {
  const links = await prisma.communityLink.findMany({
    where: { virusReports: { gt: 0 } },
    include: {
      user: { select: { id: true, username: true } },
      game: { select: { id: true, title: true, slug: true } },
      mirrors: { select: { id: true, sourceName: true, url: true } },
      reports: { select: { id: true, userId: true, createdAt: true } },
    },
    orderBy: { virusReports: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.communityLink.count({ where: { virusReports: { gt: 0 } } });

  return { links, total, page, limit };
}

export async function hideCommunityLink(linkId: string) {
  const link = await prisma.communityLink.findUnique({ where: { id: linkId } });
  if (!link) throw notFound("Link not found");

  return prisma.communityLink.update({
    where: { id: linkId },
    data: { isHidden: true },
  });
}

export async function deleteCommunityLink(linkId: string) {
  const link = await prisma.communityLink.findUnique({ where: { id: linkId } });
  if (!link) throw notFound("Link not found");

  await prisma.communityLink.delete({ where: { id: linkId } });
  return { success: true };
}

export async function getDashboardStats() {
  const [totalUsers, bannedUsers, openReports, reportedLinks] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.userReport.count({ where: { status: "OPEN" } }),
    prisma.communityLink.count({ where: { virusReports: { gt: 0 } } }),
  ]);

  return { totalUsers, bannedUsers, openReports, reportedLinks };
}
