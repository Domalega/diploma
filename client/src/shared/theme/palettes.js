export const COLOR_STORAGE_KEY = "calendar.color";
export const COLOR_PALETTES = [
  { value: "green", label: "Green", swatch: "#356a52" },
  { value: "blue", label: "Blue", swatch: "#426bb0" },
  { value: "purple", label: "Purple", swatch: "#8854ad" },
  { value: "rose", label: "Pink", swatch: "#b54f7c" },
  { value: "orange", label: "Orange", swatch: "#b97132" },
  {
    value: "monochrome",
    label: "Black & white",
    swatch: "linear-gradient(135deg, #252525 50%, #f5f5f5 50%)",
  },
];
export const validColor = (value) =>
  COLOR_PALETTES.some((palette) => palette.value === value) ? value : "green";

export function readColor() {
  try {
    return validColor(localStorage.getItem(COLOR_STORAGE_KEY));
  } catch {
    return "green";
  }
}
