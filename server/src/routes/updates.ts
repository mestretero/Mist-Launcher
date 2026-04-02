import { FastifyInstance } from "fastify";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const UPDATES_DIR = join(import.meta.dirname, "../../public/updates");

/**
 * Tauri updater endpoint.
 *
 * Place update files in server/public/updates/:
 *   - latest.json  (version metadata)
 *   - MIST_<version>_x64-setup.nsis.zip      (NSIS bundle)
 *   - MIST_<version>_x64-setup.nsis.zip.sig  (signature)
 *
 * latest.json format:
 * {
 *   "version": "0.2.0",
 *   "notes": "Bug fixes and improvements",
 *   "pub_date": "2026-04-02T12:00:00Z",
 *   "platforms": {
 *     "windows-x86_64": {
 *       "url": "https://your-server.com/public/updates/MIST_0.2.0_x64-setup.nsis.zip",
 *       "signature": "CONTENT_OF_.sig_FILE"
 *     }
 *   }
 * }
 */
export default async function updateRoutes(app: FastifyInstance) {
  app.get("/updates/:target/:arch/:current_version", async (request, reply) => {
    const { current_version } = request.params as {
      target: string;
      arch: string;
      current_version: string;
    };

    const latestPath = join(UPDATES_DIR, "latest.json");
    if (!existsSync(latestPath)) {
      return reply.status(204).send();
    }

    try {
      const raw = await readFile(latestPath, "utf-8");
      const latest = JSON.parse(raw);

      // Compare versions — no update if current >= latest
      const current = current_version.replace(/^v/, "");
      const next = (latest.version || "").replace(/^v/, "");
      if (!next || current >= next) {
        return reply.status(204).send();
      }

      return reply.send(latest);
    } catch {
      return reply.status(204).send();
    }
  });
}
