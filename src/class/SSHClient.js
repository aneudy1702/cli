import EventEmitter from 'events';
import { IPC } from 'node-ipc';

export default class SSHClient extends EventEmitter {
  constructor() {
    super();

    const client = new IPC();
    client.config.appspace = 'ocm.';
    client.config.id = 'client';
    client.config.stopRetrying = true;
    client.config.silent = true;

    this.client = client;
  }

  status() {
    return new Promise((resolve) => {
      const { client } = this;

      client.connectTo('daemon', () => {
        client.of.daemon.on('ready', () => {
          client.disconnect('daemon');
          resolve('running');
        });

        client.of.daemon.on('no-ssh', () => {
          client.disconnect('daemon');
          resolve('no-ssh');
        });
      });

      client.of.daemon.on('error', () => {
        client.disconnect('daemon');
        resolve('stopped');
      });
    });
  }

  exec(cmd, options = {}) {
    const { client } = this;

    client.connectTo('daemon', () => {
      client.of.daemon.on('ready', () => {
        if (typeof options.ready === 'function') {
          options.ready();
        }

        const { stdin, stdout, stderr } = process;
        const { rows, columns } = stdout;
        const window = stdout.isTTY ? { rows, columns, term: process.env.TERM || 'vt100' } : null;

        client.of.daemon.emit('exec', {
          cmd: cmd || null,
          options: {
            pty: cmd ? window : true,
          },
          window: !cmd ? window : null,
        });

        client.of.daemon.on('stdin-request', () => {
          stdin.setRawMode(true);
          stdin.on('data', (data) => {
            client.of.daemon.emit('stdin', data);
          });

          client.of.daemon.on('disconnect', () => {
            stdin.unref();
          });
        });

        stdout.on('resize', () => {
          client.of.daemon.emit('stdout-resize', { rows: stdout.rows, columns: stdout.columns });
        });

        client.of.daemon.on('stdout', (output) => {
          stdout.write(Buffer.from(output.data));
        });

        client.of.daemon.on('stderr', (output) => {
          stderr.write(Buffer.from(output.data));
        });

        client.of.daemon.on('end', () => {
          this.emit('end');
          client.disconnect('daemon');
        });
      });
    });

    client.of.daemon.on('no-ssh', () => {
      client.disconnect('daemon');
      this.emit('error', new Error('no ssh connection available from the daemon'));
    });

    client.of.daemon.on('error', (err) => {
      client.disconnect('deamon');
      this.emit('error', err);
    });
  }
}
