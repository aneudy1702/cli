import EventEmitter from 'events';
import { IPC } from 'node-ipc';
import net from 'net';
import pRetry from 'p-retry';
import { PassThrough } from 'stream';
import { Connection, Exec } from './SSH';
import { Monitoring } from './Daemon/Container';
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

    this.forwardedPorts = [];
  }

  start() {
    this.ipc.server.start();
  }

  stop() {
    this.ipc.server.stop();
  }

  serve() {
    const { ipc, ssh } = this;
    // ipc.server.on('stop', this.stop.bind(this));
    const noSSH = this.noSSH.bind(this);
    const stop = this.stop.bind(this);
    const remote = this.remote.bind(this);
    const forwards = this.forwards.bind(this);
    const monitoring = new Monitoring(ssh.client);

    ipc.server.on('connect', noSSH);

    pRetry(
      () => ssh.connect(),
      { forever: true, maxTimeout: 1000, maxRetryTime: config.ocm.ssh.daemon.timeout },
    )
      .then(() => {
        ipc.server.off('connect', noSSH);

        ipc.server.on('stop', () => { monitoring.stop(); ssh.disconnect(); });
        ssh.on('end', () => { monitoring.stop(); stop(); });

        monitoring.start();
        monitoring.on('forwards', forwards);

        ipc.server.broadcast('ready');

        ipc.server.on('connect', (socket) => { ipc.server.emit(socket, 'ready'); });
        ipc.server.on('exec', remote);
      })
      .catch((err) => {
        const { error } = console;
        error(err);
        stop();
        ssh.disconnect();
      });
  }

  remote(data, socket) {
    const { ipc, ssh } = this;
    const error = this.error.bind(this);
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
    sshExec.on('error', (err) => { error(socket, err); });
  }

  forwards(ports) {
    const { error } = console;

    ports.forEach((port) => {
      this.ssh.forwardOut('0.0.0.0', port, '127.0.0.1', port)
        .then((stream) => {
          const server = net.createServer((client) => {
            client.pipe(stream);
            stream.pipe(client);
          });

          server.listen(port, () => {
            this.forwardedPorts.push(port);

            stream.on('end', () => { server.close(); });
            stream.on('error', (err) => { server.close(); error(err); });
          });

          server.on('error', (err) => { stream.end(); error(err); });
          server.on('close', () => {
            this.forwardedPorts = this.forwardedPorts.filter(
              (forwardedPort) => forwardedPort !== port,
            );
          });
        })
        .catch((err) => { error(err); });
    });
  }

  noSSH(socket) {
    this.ipc.server.emit(socket, 'no-ssh');
  }

  error(socket, err) {
    this.ipc.server.emit(socket, 'error', err);
  }
}
