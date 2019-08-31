import ora from 'ora';
import Client from './Cli/IPC/Client';
import Launcher from './Daemon/Launcher';
import config from '../config';

export default class Cli {
  constructor() {
    this.client = new Client();
    this.spinner = ora('Connecting to OCM SSH daemon');
    this.retried = false;
  }

  clear() {
    clearTimeout(this.timeout);
    this.spinner.stop();
  }

  exec(cmd) {
    this.timeout = setTimeout(() => this.spinner.start(), 50);
    this.client.exec(cmd, { ready: this.clear.bind(this) });
    this.client.on('error', (err) => {
      if (!this.retried) {
        this.retried = true;
        Launcher.start({ interval: 100, timeout: config.ocm.cli.timeout })
          .then(() => this.exec(cmd))
          .catch(() => this.fail(err));
      } else {
        this.fail(err);
      }
    });
  }

  fail(err) {
    this.clear();
    this.spinner.fail(err.message);
  }
}
