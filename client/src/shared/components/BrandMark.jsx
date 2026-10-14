import "../styles/BrandMark.css";

export default function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect className="brand-mark-ground" width="48" height="48" rx="14" />
      <path className="brand-mark-outline" d="M14 14h10c8 0 12 4 12 11s-4 11-12 11H14Z" />
      <path className="brand-mark-outline" d="M14 22h21M20 11v6M29 11v6" />
      <path className="brand-mark-check" d="m20 29 4 4 7-8" />
    </svg>
  );
}
