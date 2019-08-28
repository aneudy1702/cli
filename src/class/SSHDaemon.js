import { spawn } from 'child_process';
import fs from 'fs-extra';
import pIf from 'p-if';
import pWaitFor from 'p-wait-for';
import Client from './SSHClient';
import config from '../config';

export default class SSHDaemon {
  static isRunning() {
    const client = new Client();
    return client.status()
      .then((state) => state === 'running');
  }

  static start(options = {}) {
    const daemonBinPath = config.ocm.ssh.daemon.path;

    if (!fs.pathExistsSync(daemonBinPath)) {
      return Promise.reject(new Error('SSH daemon binary not found'));
    }

    return SSHDaemon.isRunning()
      .then(pIf(
        (state) => !state,
        () => {
          const exec = spawn('node', [daemonBinPath], {
            stdio: 'ignore',
            detached: true,
            windowsHide: true,
          });

          exec.unref();
        },
      ))
      .then(() => SSHDaemon.wait(options));
  }

  static wait(options = {}) {
    return pWaitFor(SSHDaemon.isRunning, options);
  }
}
