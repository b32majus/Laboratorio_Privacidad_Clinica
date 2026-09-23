import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/", "coverage/", "js/", "lib/"]
  },
  {
    files: ["app-v4/src/**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
    plugins: {
      "react-hooks": reactHooks
    },
    rules: {
      ...reactHooks.configs.recommended.rules
    }
  }
);
