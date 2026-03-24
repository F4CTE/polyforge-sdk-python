import { Worker } from 'worker_threads';
import { join } from 'path';

export function hashPassword(password: string, rounds = 12): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(__dirname, 'bcrypt-worker.js'), {
      workerData: { action: 'hash', password, rounds },
    });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(__dirname, 'bcrypt-worker.js'), {
      workerData: { action: 'compare', password, hash },
    });
    worker.on('message', resolve);
    worker.on('error', reject);
  });
}
