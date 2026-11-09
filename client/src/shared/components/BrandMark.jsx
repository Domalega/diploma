import brand from "../brand";
import "../styles/BrandMark.css";

export default function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect className="brand-mark-ground" width="48" height="48" rx="14" />
      <path className="brand-mark-stride" d={brand.stridePath} />
      <path className="brand-mark-jot" d={brand.jotPath} />
    </svg>
  );
}
