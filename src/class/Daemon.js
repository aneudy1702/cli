import EventEmitter from 'events';
import { IPC } from 'node-ipc';
import net from 'net';
import pRetry from 'p-retry';
import { PassThrough } from 'stream';
import { Connection, Exec } from './SSH';
import config from '../config';

export default class Daemon {
  constructor() {
    this.ssh = new Connection(config.ocm.ssh);

    const ipc = new IPC();
    ipc.config.appspace = 'ocm.';
    ipc.config.id = 'daemon';
    // ipc.config.silent = true;
    ipc.serve(() => this.serve());
    this.ipc = ipc;
  }

  start() {
    return this.ipc.server.start();
  }

  stop() {
    return this.ipc.server.stop();
  }

  serve() {
    const { ipc, ssh } = this;
    // ipc.server.on('stop', this.stop.bind(this));
    const noSSH = this.noSSH.bind(this);
    const stop = this.stop.bind(this);
    const remote = this.remote.bind(this);
    const forward = this.forward.bind(this);

    ipc.server.on('connect', noSSH);

    pRetry(
      () => ssh.connect(),
      { forever: true, maxTimeout: 1000, maxRetryTime: config.ocm.ssh.daemon.timeout },
    )
      .then(() => {
        ipc.server.off('connect', noSSH);

        ipc.server.on('stop', ssh.disconnect.bind(ssh));
        ssh.on('end', stop);

        ipc.server.broadcast('ready');

        ipc.server.on('connect', (socket) => { ipc.server.emit(socket, 'ready'); });
        ipc.server.on('exec', remote);
        ipc.server.on('forward-out', forward);
      })
      .catch((err) => { console.error(err); stop(); ssh.disconnect(); });
  }

  remote(data, socket) {
    const { ipc, ssh } = this;
    const stdin = new PassThrough();
    const events = new EventEmitter();
    const sshExec = new Exec(ssh.client);
    const exec = data || {};

    sshExec.exec(exec.cmd, exec.options, exec.window, { stdin, events });

    ipc.server.emit(socket, 'stdin-request');

    ipc.server.on('stdin', (input, client) => {
      if (socket === client) {
        stdin.write(Buffer.from(input.data));
      }
    });

    ipc.server.on('stdout-resize', (info, client) => {
      if (socket === client) {
        events.emit('resize', info);
      }
    });

    sshExec.on('stdout', (output) => { ipc.server.emit(socket, 'stdout', output); });
    sshExec.on('stderr', (output) => { ipc.server.emit(socket, 'stderr', output); });
    sshExec.on('end', () => { ipc.server.emit(socket, 'end'); });
    sshExec.on('error', (err) => { this.error(socket, err); });
  }

  forward(data, socket) {
    const { ipc, ssh, error } = this;

    ssh.forwardOut('0.0.0.0', data.port, '127.0.0.1', data.port)
      .then((stream) => {
        const server = net.createServer((client) => {
          client.pipe(stream);
          stream.pipe(client);
        });

        server.listen(data.port, () => {
          ipc.server.emit(socket, 'forward-ready', data);

          stream.on('end', () => { server.close(); });
          stream.on('error', (err) => { server.close(); error(socket, err); });
        });

        server.on('error', (err) => { stream.end(); error(socket, err); });
      })
      .catch((err) => { error(socket, err); });
  }

  noSSH(socket) {
    this.ipc.server.emit(socket, 'no-ssh');
  }

  error(socket, err) {
    this.ipc.server.emit(socket, 'error', err);
  }
}
