import { copyFile, mkdir } from "node:fs/promises";

const source = new URL("../.openai/hosting.json", import.meta.url);
const targetDirectory = new URL("../dist/.openai/", import.meta.url);
const target = new URL("hosting.json", targetDirectory);

await mkdir(targetDirectory, { recursive: true });
await copyFile(source, target);
