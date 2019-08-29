import { spawn } from 'child_process';
import pIf from 'p-if';
import pWaitFor from 'p-wait-for';
import { Client } from './Client';
import config from '../../config';

export default class Daemon {
  static isRunning() {
    const client = new Client();
    return client.status()
      .then((state) => state === 'running');
  }

  static isStopped() {
    const client = new Client();
    return client.status()
      .then((state) => state === 'stopped');
  }

  static start(options = {}) {
    const daemonBin = config.ocm.ssh.daemon.bin;

    return SSHDaemon.isStopped()
      .then(pIf(
        (state) => state,
        () => {
          const exec = spawn(daemonBin, {
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