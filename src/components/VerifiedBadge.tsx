import { BadgeCheck } from "lucide-react";

type Props = {
  size?: number;
  className?: string;
  title?: string;
};

/**
 * Blue check shown next to an organizer's name when they are a verified
 * (approved) organizer on the Catholic Calendar.
 */
export default function VerifiedBadge({ size = 14, className = "", title = "Verified organizer" }: Props) {
  return (
    <BadgeCheck
      aria-label={title}
      role="img"
      width={size}
      height={size}
      className={`inline-block shrink-0 text-sky-500 fill-sky-500/15 ${className}`}
    >
      <title>{title}</title>
    </BadgeCheck>
  );
}