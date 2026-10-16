function canonical(value) {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(value)
      .sort()
      .map((key) => JSON.stringify(key) + ":" + canonical(value[key]))
      .join(",") +
    "}"
  );
}
const equal = (a, b) => canonical(a) === canonical(b);
// One unit is one note/task/intake or one set of board/schedule settings.
// Missing keys are deletions; never treat a deletion as an empty object.
function merge(base, local, remote, preference = "local") {
  const state = Object.create(null),
    conflicts = [];
  for (const key of new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote),
  ])) {
    const b = base[key],
      l = local[key],
      r = remote[key];
    let value;
    if (key.startsWith("intake/") && l && r) value = r;
    else if (equal(l, b)) value = r;
    else if (equal(r, b) || equal(l, r)) value = l;
    else {
      conflicts.push(key);
      value = preference === "remote" ? r : l;
    }
    if (value !== undefined) state[key] = value;
  }
  return { state, conflicts };
}
module.exports = { canonical, equal, merge };
