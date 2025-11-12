import { hello } from "./hello.js";

async function main() {
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log(`${Date.now()} ${hello()}`);
}

if (typeof require !== "undefined" && require.main === module) {
    main().catch(console.error);
}
