const { compile } = require("@tailwindcss/node");
const { Scanner } = require("@tailwindcss/oxide");
const postcss = require("postcss");

module.exports = () => {
  return {
    postcssPlugin: "tailwindcss-custom",
    async Once(root, { result }) {
      const inputCss = root.toString();
      if (!/@(import|reference|theme|variant|config|plugin|apply|tailwind)\b/.test(inputCss)) {
        return;
      }
      const compiler = await compile(inputCss, {
        base: process.cwd(),
        from: result.opts.from || "src/app/globals.css",
        shouldRewriteUrls: true,
        onDependency: () => {},
      });
      const scanner = new Scanner({
        sources: [{ base: process.cwd(), pattern: "src/**/*.{ts,tsx,js,jsx}", negated: false }],
      });
      const candidates = scanner.scan();
      const compiledCss = compiler.build(candidates);
      const parsed = postcss.parse(compiledCss, { from: result.opts.from });
      root.removeAll();
      root.append(parsed);
    },
  };
};
module.exports.postcss = true;
