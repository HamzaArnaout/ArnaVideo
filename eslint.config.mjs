import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    rules: {
      // These effects intentionally synchronize state from incoming editor recipes.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "release/**",
      "node_modules/**",
      "media/**",
      "pics/**",
      "data/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
