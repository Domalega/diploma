const fs = require("fs");
const path = require("path");
const vm = require("vm");
const html = fs.readFileSync(path.resolve(__dirname, "../../../public/index.html"), "utf8");
const bootstrap = html.match(/<script id="theme-init">([\s\S]*?)<\/script>/)[1];
const { COLOR_PALETTES } = require("./palettes");

test.each([
  ["dark", false, "dark"],
  ["light", true, "light"],
  [null, true, "dark"],
  ["invalid", false, "light"],
  ["system", true, "dark"],
])(
  "the page applies saved %s with system dark=%s before React loads",
  (saved, systemDark, expected) => {
    const root = { dataset: {}, style: {} };
    const postMessage = jest.fn();
    vm.runInNewContext(bootstrap, {
      localStorage: { getItem: () => saved },
      window: {
        matchMedia: () => ({ matches: systemDark }),
        DaymarkAppearance: { postMessage },
      },
      document: { documentElement: root, querySelector: () => ({ setAttribute() {} }) },
    });
    expect(root.dataset.theme).toBe(expected);
    expect(root.style.colorScheme).toBe(expected);
    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ theme: expected }));
  },
);

test.each(COLOR_PALETTES.flatMap(({ value }) => ["light", "dark"].map((theme) => [value, theme])))(
  "the saved %s palette is applied in %s mode before React loads",
  (color, theme) => {
    const root = { dataset: {}, style: {} };
    vm.runInNewContext(bootstrap, {
      localStorage: { getItem: (key) => (key === "calendar.color" ? color : theme) },
      window: { matchMedia: () => ({ matches: false }) },
      document: { documentElement: root, querySelector: () => ({ setAttribute() {} }) },
    });
    expect(root.dataset.color).toBe(color);
    expect(root.dataset.theme).toBe(theme);
  },
);
