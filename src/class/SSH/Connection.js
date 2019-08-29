import EventEmitter from 'events';
import fs from 'fs-extra';
import path from 'path';
import pify from 'pify';
import { Client } from 'ssh2';

export default class Connection extends EventEmitter {
  constructor(opts) {
    super();
    this.config = opts;
    this.client = new Client();
  }

  connect() {
    return fs.readFile(path.join(this.config.keys.path, this.config.keys.private))
      .then((privateKey) => new Promise((resolve, reject) => {
        const { client } = this;
        const { host, port, credential } = this.config;
        client.connect({
          host,
          port,
          username: credential.username,
          privateKey,
        });

        client.on('ready', () => { resolve(); });
        client.on('end', () => { this.emit('end'); });
        client.on('error', (err) => { reject(err); });
      }));
  }

  disconnect() {
    this.client.end();
  }

  forwardOut(host, hostPort, localhost, localPort) {
    const { client } = this;
    const forward = pify(client.forwardOut.bind(client));
    return forward(host, hostPort, localhost, localPort);
  }
}
