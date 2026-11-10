// Litix-owned, local FFmpeg repurposing worker.
 // Usage: node src/native/repurpose-video.mjs /trusted/video.mp4 /trusted/output --client-authorized
 // Requires ffmpeg in PATH. Works offline; makes NO social posts, purchases or supplier calls.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const baseFilter = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1";
export const PRESETS = Object.freeze([
  { name: "clean", filter: baseFilter + ",format=yuv420p" },
  { name: "warm", filter: baseFilter + ",eq=saturation=1.12:contrast=1.04,format=yuv420p" },
  { name: "bold", filter: baseFilter + ",eq=saturation=1.20:contrast=1.10,format=yuv420p" },
]);

export function buildCommand(source, output, filter) {
  return [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-n",
    "-i", source, "-vf", filter,
    "-c:v", "libx264", "-preset", "fast", "-crf", "24",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
    "-max_muxing_queue_size", "1024", output,
  ];
}

async function execute(args) {
  await new Promise((yes, no) => {
    const child = spawn("ffmpeg", args, { shell: false, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", part => { stderr = (stderr + String(part)).slice(-2000); });
    child.once("error", no);
    child.once("close", code => code === 0 ? yes() : no(new Error("ffmpeg exit " + code + ": " + stderr)));
  });
}

export async function repurpose(sourceFile, destinationDirectory, { authorized = false } = {}) {
  if (!authorized) throw new Error("An authorized client/source-content workflow is required");
  const source = resolve(sourceFile);
  const outDir = resolve(destinationDirectory);
  if (!existsSync(source) || !statSync(source).isFile() ||
      !/^(\\.mp4|\\.mov|\\.webm)$/i.test(extname(source)))
    throw new Error("A local MP4/MOV/WebM source file is required");
  if (statSync(source).size > 1024 * 1024 * 1024)
    throw new Error("Source exceeds 1 GB; transcode via managed video processing");
  if (source === outDir) throw new Error("Output must be a directory");
  mkdirSync(outDir, { recursive: true });
  const prefix = basename(source, extname(source)).replace(/[^a-z0-9_-]/gi, "_").slice(0, 80);
  const outputs = [];
  for (const preset of PRESETS) {
    const file = join(outDir, prefix + "__" + preset.name + ".mp4");
    await execute(buildCommand(source, file, preset.filter));
    outputs.push({ preset: preset.name, path: file });
  }
  return outputs;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  const [, , sourceFile, destinationDirectory, permission] = process.argv;
  if (!sourceFile || !destinationDirectory || permission !== "--client-authorized") {
    console.error("Usage: node repurpose-video.mjs <local-input-video> <output-dir> --client-authorized");
    process.exitCode = 2;
  } else {
    repurpose(sourceFile, destinationDirectory, { authorized: true })
      .then(outputs => process.stdout.write(JSON.stringify({ variants: outputs }) + "\\n"))
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
