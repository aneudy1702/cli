import { spawn } from 'child_process';
import pIf from 'p-if';
import pWaitFor from 'p-wait-for';
import Client from '../Cli/IPC/Client';
import config from '../../config';

export default class Launcher {
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
    const daemonBin = config.ocm.daemon.bin;

    return Launcher.isStopped()
      .then(pIf(
        (state) => state,
        () => {
          const exec = spawn(daemonBin, {
            stdio: 'ignore',
            shell: process.platform === 'win32',
            windowsHide: true,
          });

          exec.unref();
        },
      ))
      .then(() => Launcher.wait(options));
  }

  static wait(options = {}) {
    return pWaitFor(Launcher.isRunning, options);
  }
}
