const LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "X / Twitter",
  x: "X / Twitter",
  youtube: "YouTube",
  text: "Teks",
  "web article": "Artikel Web",
  generic_article: "Artikel Web",
};

export default function PlatformBadge({ platform }: { platform?: string | null }) {
  const key = (platform || "").toLowerCase().trim();
  const label = LABELS[key] || platform || "Web";

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
      style={{ border: "2px solid var(--line)", background: "var(--paper)" }}
    >
      {label}
    </span>
  );
}
