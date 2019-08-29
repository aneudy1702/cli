import ipc from 'node-ipc';
import { Connection } from './SSH';

export default class Daemon {
  constructor() {
    this.connection = new Connection(config.ocm.ssh);
  }

  start() {
  }

  stop() {
  }
}
