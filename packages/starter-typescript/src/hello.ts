/**
 * @param name
 * @returns Hello World message
 */
export function hello(name?: string) {
    return `Hello ${name ?? "World"}!`;
}
