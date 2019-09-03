import boxen from 'boxen';
import chalk from 'chalk';
import ora from 'ora';
import Client from './Cli/IPC/Client';
import Launcher from './Daemon/Launcher';
import config from '../config';

export default class Cli {
  static escape(cmd) {
    return cmd.map((arg) => {
      if (arg.includes(' ')) {
        return `'${arg}'`;
      }

      return arg;
    });
  }

  static exec(cmd, opts = {}) {
    const spinner = ora('Connecting to OCM');
    const timeout = opts.stdio !== false ? setTimeout(() => spinner.start(), 200) : null;
    const clear = () => { clearTimeout(timeout); spinner.stop(); };
    const warning = () => {
      clear();

      const { error } = console;
      error(boxen(chalk.cyan('Experimental feature'), {
        padding: 1,
        margin: 1,
        align: 'center',
        borderColor: 'yellow',
        borderStyle: 'round',
      }));
    };

    const options = {
      interval: 100,
      timeout: config.ocm.cli.timeout,
    };

    const cmdOptions = {
      ready: cmd ? clear : warning,
      ...opts,
    };

    return Launcher.start(options)
      .then(() => new Promise((resolve, reject) => {
        const client = new Client();
        client.exec(cmd, cmdOptions);
        client.on('end', () => { resolve(); });
        client.on('error', (error) => { reject(error); });
      }))
      .catch((err) => { clear(); spinner.fail(err.message); });
  }
}
