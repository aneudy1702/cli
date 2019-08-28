import ora from 'ora';
import Client from './SSHClient';
import Daemon from './SSHDaemon';

const client = new Client();

let retried = false;
let command = null;

const spinner = ora('Connecting to OCM SSH daemon');
const timeout = setTimeout(() => spinner.start(), 50);
const clear = () => { clearTimeout(timeout); spinner.stop(); };
const exec = (cmd) => { command = cmd; client.exec(cmd, { ready: clear }); };
const fail = (err) => { clear(); spinner.fail(err.message); };

client.on('error', (err) => {
  if (!retried) {
    retried = true;
    Daemon.start({ interval: 100, timeout: 2000 })
      .then(() => exec(command))
      .catch(fail);
  } else {
    fail(err);
  }
});

export default exec;
