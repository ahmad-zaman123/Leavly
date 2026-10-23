/** A fixed set of muted hues chosen to stay clear of the leave-type colours (blue, amber, violet, pink, green, gold). */
const AVATAR_COLORS = ["#8a5a44", "#5b6b7c", "#7a4e6d", "#4f6f52", "#9b5d2f", "#3f6b78", "#6d5f8e", "#7c6b3d"];

export function avatarColor(id: number): string {
  return AVATAR_COLORS[Math.abs(id) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  id,
  name,
  className = "",
  title,
  style,
}: {
  id: number;
  name: string;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`avatar ${className}`} style={{ background: avatarColor(id), ...style }} title={title ?? name} aria-label={name}>
      {initials(name)}
    </span>
  );
}
