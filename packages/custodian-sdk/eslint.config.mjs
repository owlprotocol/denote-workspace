import { typecheckedConfigs } from "@veraswap/eslint-config"

export default [
    ...typecheckedConfigs,
    {
        files: ["index.mjs"],
    }
]
