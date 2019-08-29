#!/usr/bin/env node

import EventEmitter from 'events';
import ipc from 'node-ipc';
import net from 'net';
import pRetry from 'p-retry';
import { PassThrough } from 'stream';
import SSHConnection from './class/SSHConnection';
import SSHExec from './class/SSHExec';
import config from './config';

const ssh = new SSHConnection(config.ocm.ssh);

ipc.config.appspace = 'ocm.';
ipc.config.id = 'daemon';
// ipc.config.silent = true;

const noSSH = (socket) => { ipc.server.emit(socket, 'no-ssh'); };
const stop = () => { ipc.server.stop(); };
const disconnect = () => { ssh.disconnect(); };
const remote = (data, socket) => {
  const stdin = new PassThrough();
  const events = new EventEmitter();
  const sshExec = new SSHExec(ssh.client);
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

  sshExec.on('stdout', (output) => {
    ipc.server.emit(socket, 'stdout', output);
  });

  sshExec.on('stderr', (output) => {
    ipc.server.emit(socket, 'stderr', output);
  });

  sshExec.on('end', () => {
    ipc.server.emit(socket, 'end');
  });

  sshExec.on('error', (err) => {
    ipc.server.emit(socket, 'err', err);
  });
};
const forwardOut = (data, socket) => {
  const error = (err) => { ipc.server.emit(socket, 'error', err); };

  ssh.forwardOut('0.0.0.0', data.port, '127.0.0.1', data.port)
    .then((stream) => {
      const server = net.createServer((client) => {
        client.pipe(stream);
        stream.pipe(client);
      });

      server.listen(data.port, () => {
        ipc.server.emit(socket, 'forward-ready', data);

        stream.on('end', () => { server.close(); });
        stream.on('error', (err) => { server.close(); error(err); });
      });

      server.on('error', (err) => { stream.end(); error(err); });
    })
    .catch((err) => { error(err); });
};

ipc.serve(() => {
  ipc.server.on('stop', stop);
  ipc.server.on('connect', noSSH);

  pRetry(
    () => ssh.connect(),
    { forever: true, maxTimeout: 1000, maxRetryTime: config.ocm.ssh.daemon.timeout },
  )
    .then(() => {
      ipc.server.off('connect', noSSH);

      ipc.server.on('stop', disconnect); // External event
      ssh.on('end', stop);

      ipc.server.broadcast('ready');

      ipc.server.on('connect', (socket) => { ipc.server.emit(socket, 'ready'); });
      ipc.server.on('exec', remote);
      ipc.server.on('forward-out', forwardOut);
    })
    .catch(() => { stop(); disconnect(); });
});

ipc.server.start();
