import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin"
import globals from "globals";

export const configs = tseslint.config(
    eslint.configs.recommended,
    // https://typescript-eslint.io/users/configs/#recommended
    tseslint.configs.recommended,
    // https://typescript-eslint.io/users/configs/#stylistic
    tseslint.configs.stylistic,
    // https://typescript-eslint.io/users/what-about-formatting
    // https://eslint.style/guide/config-presets
    stylistic.configs.customize({
        indent: 4,
        quotes: "double",
        semi: true,
        jsx: true,
    }),
    {
        languageOptions: {
            globals: {
                ...globals.node,
            }
        }
    }
);

export const typecheckedConfigs = tseslint.config(
    eslint.configs.recommended,
    // https://typescript-eslint.io/users/configs/#recommended-type-checked
    tseslint.configs.recommendedTypeChecked,
    // https://typescript-eslint.io/users/configs/#stylistic-type-checked
    tseslint.configs.stylisticTypeChecked,
    // https://typescript-eslint.io/users/what-about-formatting
    // https://eslint.style/guide/config-presets
    stylistic.configs.customize({
        indent: 4,
        quotes: "double",
        semi: true,
        jsx: true,
    }),
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    }
);
