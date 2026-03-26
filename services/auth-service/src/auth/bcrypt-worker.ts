import { parentPort, workerData } from 'worker_threads';
import * as bcrypt from "bcrypt";

const { action, password, hash, rounds } = workerData;

if (action === 'hash') {
  const result = bcrypt.hashSync(password, rounds || 12);
  parentPort?.postMessage(result);
} else if (action === 'compare') {
  const result = bcrypt.compareSync(password, hash);
  parentPort?.postMessage(result);
}
