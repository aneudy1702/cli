import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import SSH from '../src/class/SSH';

const args = process.argv.slice(2).join(' ');
const privateKey = fs.readFileSync(path.join(os.homedir(), '.ssh', 'ocm_rsa'));

SSH.exec(`sudo podman ${args}`, privateKey)
  .catch((err) => console.error(err.message));
