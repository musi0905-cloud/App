// Internal QA viewer server: serves the project folder (room404/ and asset-source/) on localhost only.
//   npm run qa        -> prints http://127.0.0.1:<port>/room404/qa/
// Nothing is deployed or published; the viewer reads dist/ data and the v05 QA package copy in asset-source/.
import {resolve,dirname} from 'node:path';import {fileURLToPath} from 'node:url';
import {startServer} from '../tests/static-server.mjs';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..','..');
const {origin}=await startServer(project);
console.log(`QA viewer: ${origin}/room404/qa/  (Ctrl+C to stop)`);
