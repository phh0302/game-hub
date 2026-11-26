/** Nhãn độ tuổi trên thẻ / trang game ("Mọi lứa tuổi" không hiện nhãn) */
export const AGE_LABEL: Record<string, string> = { AGE_7: "7+", AGE_12: "12+", AGE_16: "16+", AGE_18: "18+" };

export function AgeBadge({ rating, className = "" }: { rating: string; className?: string }) {
  const label = AGE_LABEL[rating];
  if (!label) return null;
  const tone = rating === "AGE_18" ? "bg-neon-pink text-bg" : rating === "AGE_16" ? "bg-amber-400 text-bg" : "bg-surface-2 text-ink";
  return (
    <span data-testid="age-badge" title={label} className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${tone} ${className}`}>
      {label}
    </span>
  );
}
