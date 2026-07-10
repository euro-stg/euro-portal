import { redirect } from "next/navigation";
import { Lock, Layers, Cake, CalendarDays, Megaphone, ThumbsUp, MessageCircle, FileText } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { EuLink } from "@/components/ui/eu-link";
import prisma from "@/lib/db/db";
import { auth } from "@/lib/auth";
import { ExternalAppCard } from "@/components/ui/external-app-card";
import { InternalAppCard } from "@/components/ui/internal-app-card";
import { ChatWidget } from "@/components/ui/chat-widget";
import { getAppIcon } from "@/lib/icon-registry";

export const dynamic = "force-dynamic";

const colorMap: Record<string, { gradient: string; border: string }> = {
  blue:    { gradient: "from-blue-500 to-blue-600",      border: "border-blue-100"    },
  indigo:  { gradient: "from-indigo-500 to-indigo-600",  border: "border-indigo-100"  },
  violet:  { gradient: "from-violet-500 to-violet-600",  border: "border-violet-100"  },
  emerald: { gradient: "from-emerald-500 to-emerald-600",border: "border-emerald-100" },
  orange:  { gradient: "from-orange-500 to-orange-600",  border: "border-orange-100"  },
  rose:    { gradient: "from-rose-500 to-rose-600",      border: "border-rose-100"    },
  cyan:    { gradient: "from-cyan-500 to-cyan-600",      border: "border-cyan-100"    },
  amber:   { gradient: "from-amber-500 to-amber-600",    border: "border-amber-100"   },
  teal:    { gradient: "from-teal-500 to-teal-600",      border: "border-teal-100"    },
  pink:    { gradient: "from-pink-500 to-pink-600",      border: "border-pink-100"    },
};

function getColor(color: string | null) {
  return (color && colorMap[color]) ? colorMap[color] : colorMap.blue;
}

function isImage(mimeType: string | null) {
  return !!mimeType && mimeType.startsWith("image/");
}

function timeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs    = Date.now() - d.getTime();
  const diffMins  = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays  = Math.floor(diffHours / 24);
  if (diffMins  < 1)  return "Baru saja";
  if (diffMins  < 60) return `${diffMins} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays  === 1) return "Kemarin";
  if (diffDays  < 30) return `${diffDays} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const Home = async () => {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const userId = session.user?.id;
  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true, image: true,
          jobPositionName: true, organizationName: true, branchName: true,
          userRoles: { select: { appId: true, role: { select: { name: true } } } },
        },
      })
    : null;

  const portalRole    = dbUser?.userRoles.find((ur) => ur.appId === null)?.role.name ?? null;
  const appRoleAppIds = new Set(dbUser?.userRoles.filter((ur) => ur.appId !== null).map((ur) => ur.appId!) ?? []);

  const allApps = await prisma.module.findMany({
    where: { status: "active", deletedAt: null, type: "app" },
    orderBy: { order: "asc" },
    select: { id: true, name: true, path: true, icon: true, color: true, description: true, isExternal: true, externalUrl: true },
  });

  const accessibleAppIds = portalRole === "superadmin"
    ? new Set(allApps.map((a) => a.id))
    : appRoleAppIds;

  // ── EU access check ──────────────────────────────────────────────────────────
  const euApp = allApps.find((a) => a.path === "/apps/euro-update");
  const hasEuAccess = !!euApp && accessibleAppIds.has(euApp.id);

  // ── EU data ───────────────────────────────────────────────────────────────────
  type EuBirthday  = { id: string; name: string | null; image: string | null; jobPositionName: string | null };
  type EuPostLight = { id: string; title: string; category: { name: string }; attachments: { url: string; name: string; mimeType: string | null }[] };
  type EuPostFull  = EuPostLight & {
    content: string; isPinned: boolean; publishedAt: Date | null;
    author: { name: string | null; image: string | null; jobPositionName: string | null };
    category: { name: string; color: string | null; icon: string | null };
  };

  let euBirthdays:    EuBirthday[]  = [];
  let euEvents:       EuPostLight[] = [];
  let euAnnouncements:EuPostLight[] = [];
  let euFeedPosts:    EuPostFull[]  = [];
  let reactionMap:    Record<string, number> = {};
  let commentMap:     Record<string, number> = {};

  if (hasEuAccess) {
    try {
      const now   = new Date();
      const month = now.getMonth() + 1;
      const day   = now.getDate();

      const [allUsers, posts] = await Promise.all([
        prisma.user.findMany({
          where: { status: "active", birthDate: { not: null } },
          select: { id: true, name: true, image: true, jobPositionName: true, birthDate: true },
        }),
        prisma.euPost.findMany({
          where: { deletedAt: null, publishedAt: { not: null, lte: now } },
          include: {
            author:      { select: { name: true, image: true, jobPositionName: true } },
            category:    { select: { name: true, color: true, icon: true } },
            attachments: { orderBy: { order: "asc" }, take: 1 },
          },
          orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
          take: 20,
        }),
      ]);

      euBirthdays = allUsers.filter((u) => {
        if (!u.birthDate) return false;
        const d = new Date(u.birthDate);
        return d.getMonth() + 1 === month && d.getDate() === day;
      });

      euEvents        = posts.filter((p) => p.category.name === "Event").slice(0, 3);
      euAnnouncements = posts.filter((p) => p.category.name === "Announcement" || p.category.name === "Pengumuman").slice(0, 3);
      euFeedPosts     = posts.slice(0, 5) as EuPostFull[];

      const feedIds = euFeedPosts.map((p) => p.id);
      const [reactions, comments] = await Promise.all([
        prisma.euReaction.groupBy({ by: ["targetId"], where: { targetType: "post", targetId: { in: feedIds } }, _count: { _all: true } }),
        prisma.euComment.groupBy({ by: ["targetId"], where: { targetType: "post", targetId: { in: feedIds }, deletedAt: null }, _count: { _all: true } }),
      ]);
      reactionMap = Object.fromEntries(reactions.map((r) => [r.targetId, r._count._all]));
      commentMap  = Object.fromEntries(comments.map((c) => [c.targetId, c._count._all]));
    } catch (err) {
      console.error("[portal] EU data fetch failed:", err);
      // EU widgets silently degraded — page still loads normally
    }
  }

  const fullName = dbUser?.name ?? "Karyawan";
  const hour     = new Date().getHours();
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
  const userInfo = [dbUser?.jobPositionName, dbUser?.organizationName, dbUser?.branchName].filter(Boolean).join(" · ");

  return (
    <>
    <div className="space-y-4">
      {/* Welcome */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 sm:gap-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          {dbUser?.image ? (
            <Image src={dbUser.image} alt={fullName} width={56} height={56} className="object-cover w-full h-full" />
          ) : (
            <span className="text-white font-bold text-lg sm:text-xl">
              {fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-slate-400 text-xs">{greeting},</p>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 leading-snug truncate">{fullName}</h1>
          {userInfo && <p className="text-slate-500 text-xs mt-0.5 truncate">{userInfo}</p>}
        </div>
      </div>

      {/* 2-zone layout: main content + right sidebar */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Aplikasi card */}
          {allApps.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Aplikasi</p>
              <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-5 xl:grid-cols-7 gap-1">
                {allApps.map((app) => {
                  const hasAccess = accessibleAppIds.has(app.id);
                  const c    = getColor(app.color);
                  const Icon = getAppIcon(app.icon);

                  if (hasAccess) {
                    if (app.isExternal) return <ExternalAppCard key={app.id} app={app} colorCls={c} iconName={app.icon} compact />;
                    return <InternalAppCard key={app.id} app={app} colorCls={c} iconName={app.icon} compact />;
                  }

                  return (
                    <div key={app.id} className="flex flex-col items-center gap-1.5 p-3 rounded-xl opacity-40 cursor-not-allowed select-none text-center">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center relative">
                        <Icon className="w-5 h-5 text-slate-400" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                          <Lock className="w-2 h-2 text-slate-400" />
                        </div>
                      </div>
                      <p className="text-xs font-medium text-slate-400 leading-tight line-clamp-2">{app.name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Layers className="w-7 h-7 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700 mb-1">Belum ada aplikasi</p>
              <p className="text-slate-400 text-sm">
                Tambahkan melalui menu <span className="font-medium text-slate-600">Master Module</span> dengan type <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">app</span>.
              </p>
            </div>
          )}

          {/* EU Feed section */}
          {hasEuAccess && euFeedPosts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Feed Terbaru</p>
                <EuLink href="/apps/euro-update" className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  Lihat semua →
                </EuLink>
              </div>
              <div className="space-y-3">
                {euFeedPosts.map((post) => {
                  const thumb    = post.attachments.find((a) => isImage(a.mimeType));
                  const fileAtt  = post.attachments.find((a) => !isImage(a.mimeType));
                  const excerpt  = post.content.replace(/<[^>]*>/g, "").slice(0, 180);
                  const catColor = post.category.color;
                  return (
                    <EuLink
                      key={post.id}
                      href={`/apps/euro-update?post=${post.id}`}
                      className="block bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-slate-300 transition-all group"
                    >
                      <div className="flex gap-3 items-start">
                        <div className="flex-1 min-w-0">
                          {/* Author + meta */}
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            {post.author.image ? (
                              <div className="w-5 h-5 rounded-full overflow-hidden relative flex-shrink-0">
                                <Image src={post.author.image} alt={post.author.name ?? ""} fill className="object-cover" unoptimized />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-[9px] font-bold">
                                  {(post.author.name ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <span className="text-xs font-semibold text-slate-700 truncate">{post.author.name}</span>
                            <span className="text-slate-300 text-xs">·</span>
                            <span className="text-xs text-slate-400">{timeAgo(post.publishedAt)}</span>
                            <span className="text-slate-300 text-xs">·</span>
                            <span
                              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border"
                              style={{
                                backgroundColor: catColor ? `${catColor}18` : "#e0e7ff",
                                color:           catColor ?? "#4f46e5",
                                borderColor:     catColor ? `${catColor}40` : "#c7d2fe",
                              }}
                            >
                              {post.category.icon} {post.category.name}
                            </span>
                            {post.isPinned && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium border border-amber-100">📌 Pinned</span>
                            )}
                          </div>

                          {/* Title + content */}
                          <h3 className="font-semibold text-slate-800 mb-1 line-clamp-1 group-hover:text-blue-600 transition-colors">
                            {post.title}
                          </h3>
                          <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{excerpt}</p>

                          {/* Non-image attachment */}
                          {fileAtt && !thumb && (
                            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate max-w-[200px]">{fileAtt.name}</span>
                            </div>
                          )}

                          {/* Counts */}
                          <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="w-3.5 h-3.5" />
                              {reactionMap[post.id] ?? 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="w-3.5 h-3.5" />
                              {commentMap[post.id] ?? 0}
                            </span>
                          </div>
                        </div>

                        {/* Thumbnail */}
                        {thumb && (
                          <div className="w-[172px] h-[129px] rounded-xl overflow-hidden relative flex-shrink-0 border border-slate-100">
                            <Image src={thumb.url} alt={post.title} fill className="object-cover" unoptimized />
                          </div>
                        )}
                      </div>
                    </EuLink>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar (EU only) ── */}
        {hasEuAccess && (
          <div className="w-full lg:w-72 shrink-0 flex flex-col gap-4">

            {/* Birthday */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <Cake className="w-4 h-4 text-pink-500" />
                <span className="text-sm font-semibold text-slate-700">Ulang Tahun Hari Ini</span>
                {euBirthdays.length > 0 && (
                  <span className="ml-auto text-xs font-medium bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full border border-pink-200">
                    {euBirthdays.length}
                  </span>
                )}
              </div>
              {euBirthdays.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-5">Tidak ada ulang tahun hari ini 🎂</p>
              ) : (
                <>
                  <div className="divide-y divide-slate-50">
                    {euBirthdays.slice(0, 3).map((u) => (
                      <EuLink key={u.id} href="/apps/euro-update" className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                        {u.image ? (
                          <div className="w-8 h-8 rounded-full overflow-hidden relative flex-shrink-0">
                            <Image src={u.image} alt={u.name ?? ""} fill className="object-cover" unoptimized />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-[10px] font-bold">
                              {(u.name ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{u.name}</p>
                          <p className="text-xs text-slate-400 truncate">{u.jobPositionName ?? ""}</p>
                        </div>
                        <span className="text-sm flex-shrink-0">🎂</span>
                      </EuLink>
                    ))}
                  </div>
                  <EuLink href="/apps/euro-update" className="flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors border-t border-slate-50">
                    Lihat semua ulang tahun
                    <span className="text-slate-300">→</span>
                  </EuLink>
                </>
              )}
            </div>

            {/* Events */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-semibold text-slate-700">Event Terbaru</span>
              </div>
              {euEvents.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-5">Belum ada event</p>
              ) : (
                <>
                  <div className="divide-y divide-slate-50">
                    {euEvents.map((e) => {
                      const thumb = e.attachments.find((a) => isImage(a.mimeType));
                      return (
                        <EuLink key={e.id} href={`/apps/euro-update?post=${e.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                          {thumb ? (
                            <div className="w-10 h-8 rounded-md overflow-hidden relative flex-shrink-0">
                              <Image src={thumb.url} alt={e.title} fill className="object-cover" unoptimized />
                            </div>
                          ) : (
                            <div className="w-10 h-8 rounded-md bg-violet-50 flex items-center justify-center flex-shrink-0 text-base">🎉</div>
                          )}
                          <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-tight flex-1 min-w-0">{e.title}</p>
                        </EuLink>
                      );
                    })}
                  </div>
                  <EuLink href="/apps/euro-update" className="flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors border-t border-slate-50">
                    Lihat semua event
                    <span className="text-slate-300">→</span>
                  </EuLink>
                </>
              )}
            </div>

            {/* Announcements */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-slate-700">Pengumuman Terbaru</span>
              </div>
              {euAnnouncements.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-5">Belum ada pengumuman</p>
              ) : (
                <>
                  <div className="divide-y divide-slate-50">
                    {euAnnouncements.map((p) => {
                      const thumb = p.attachments.find((a) => isImage(a.mimeType));
                      return (
                        <EuLink key={p.id} href={`/apps/euro-update?post=${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                          {thumb ? (
                            <div className="w-10 h-8 rounded-md overflow-hidden relative flex-shrink-0">
                              <Image src={thumb.url} alt={p.title} fill className="object-cover" unoptimized />
                            </div>
                          ) : (
                            <div className="w-10 h-8 rounded-md bg-orange-50 flex items-center justify-center flex-shrink-0 text-base">📢</div>
                          )}
                          <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-tight flex-1 min-w-0">{p.title}</p>
                        </EuLink>
                      );
                    })}
                  </div>
                  <EuLink href="/apps/euro-update" className="flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors border-t border-slate-50">
                    Lihat semua pengumuman
                    <span className="text-slate-300">→</span>
                  </EuLink>
                </>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
    <ChatWidget />
    </>
  );
};

export default Home;
