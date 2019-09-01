import ora from 'ora';
import Client from './Cli/IPC/Client';
import Launcher from './Daemon/Launcher';
import config from '../config';

export default class Cli {
  static exec(cmd) {
    const spinner = ora('Connecting to OCM');
    const timeout = setTimeout(() => spinner.start(), 200);
    const clear = () => { clearTimeout(timeout); spinner.stop(); };
    const ready = () => { clear(); };

    const options = {
      interval: 100,
      timeout: config.ocm.cli.timeout,
      ready: cmd ? clear : ready,
    };

    return Launcher.start(options)
      .then(() => new Promise((resolve, reject) => {
        const client = new Client();
        client.exec(cmd, options);
        client.on('end', () => { resolve(); });
        client.on('error', (error) => { reject(error); });
      }))
      .catch((err) => { clear(); spinner.fail(err.message); });
  }
}
