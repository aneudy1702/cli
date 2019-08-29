import EventEmitter from 'events';
import pEvent from 'p-event';
import pRace from 'p-race';
import { Exec } from '../../SSH';

export default class Monitoring extends EventEmitter {
  constructor(connection) {
    super();
    this.connection = connection;
    this.monitoring = null;
    this.forwards = [];
  }

  start() {
    if (this.monitoring === null) {
      this.monitoring = setTimeout(this.detect.bind(this), 250);
    }
  }

  detect() {
    const ssh = new Exec(this.connection);
    const stdout = [];
    ssh.exec('sudo podman inspect $(sudo podman ps -q)');
    ssh.on('stdout', (output) => { stdout.push(output); });

    ssh.on('end', () => {
      let data = null;
      try {
        data = JSON.parse(stdout.join(''));
      } catch (err) {
        data = [];
      }
      const ports = data
        .map((pod) => pod.NetworkSettings)
        .map((settings) => settings.Ports)
        .map((forwards) => forwards.map(
          (forward) => forward.hostPort,
        ))
        .flat();

      const newForwards = ports.filter((port) => !this.forwards.includes(port));
      this.forwards = ports;
      this.emit('forwards', newForwards);
    });
    ssh.on('error', (err) => { this.emit('error', err); });

    pRace([
      pEvent(ssh, 'end'),
      pEvent(ssh, 'error'),
    ])
      .then(() => {
        this.monitoring = setTimeout(this.detect.bind(this), 1000);
      });
  }

  stop() {
    if (this.monitoring !== null) {
      clearTimeout(this.monitoring);
      this.monitoring = null;
    }
  }
}
