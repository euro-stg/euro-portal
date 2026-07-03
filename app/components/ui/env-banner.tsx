const BANNER: Record<string, { bg: string; text: string; label: string }> = {
  DEVELOPMENT: {
    bg:    "bg-orange-500",
    text:  "text-white",
    label: "⚠ MODE DEVELOPMENT",
  },
  REPLICA: {
    bg:    "bg-violet-600",
    text:  "text-white",
    label: "⚡ MODE REPLICA — Operasional Apps non-eksternal dinonaktifkan, login tetap berfungsi",
  },
};

export function EnvBanner() {
  // eslint-disable-next-line prefer-destructuring
  const mode   = process.env["ENV_MODE"] ?? "PRODUCTION";
  const banner = BANNER[mode];
  if (!banner) return null;

  return (
    <div className={`w-full py-1.5 px-4 text-center text-xs font-semibold tracking-wide ${banner.bg} ${banner.text}`}>
      {banner.label}
    </div>
  );
}
