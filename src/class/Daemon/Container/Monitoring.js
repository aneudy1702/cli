import EventEmitter from 'events';
import net from 'net';
import pAll from 'p-all';
import pEvent from 'p-event';
import pIf from 'p-if';
import pSettle from 'p-settle';
import { PassThrough } from 'stream';
import { Exec } from '../../SSH';

/**
 * TODO: check settled
 */

export default class Monitoring extends EventEmitter {
  constructor(connection) {
    super();
    this.connection = connection;
    this.client = connection.client;
    this.internal = new EventEmitter();
  }

  start() {
    return this.init()
      .then(() => this.listen());
  }

  listen() {
    const controller = new PassThrough();
    const ssh = new Exec(this.client, null, null, { events: controller });
    this.internal.on('stop', () => controller.emit('stop'));

    ssh.exec('sudo podman events --format json --filter type=container');
    ssh.on('stdout', (output) => {
      const events = output.toString().split('\n').filter((e) => e !== '');
      const containers = events.map((evt) => {
        try {
          return JSON.parse(evt);
        } catch (err) {
          return null;
        }
      }).filter((evt) => evt !== null);

      const start = containers
        .filter((container) => container.Status === 'start')
        .map((container) => container.ID);
      const stop = containers
        .filter((container) => container.Status === 'stop')
        .map((container) => container.ID);

      pIf(stop.length > 0, () => this.unforwards(stop))()
        .then(pIf(
          start.length > 0,
          () => this.inspect(start)
            .then(this.forwards.bind(this)),
        ))
        .catch((err) => { this.emit('error', err); });
    });

    ssh.on('end', () => { this.emit('end'); });
    ssh.on('error', (err) => { this.emit('error', err); });
  }

  stop() {
    this.internal.emit('stop');
  }

  init() {
    return new Promise((resolve, reject) => {
      const ssh = new Exec(this.client);

      ssh.exec('sudo podman ps -q', null, null, { returnOutput: true });
      ssh.on('end', (output) => {
        resolve(
          output
            .toString()
            .split('\n')
            .filter((id) => id !== ''),
        );
      });
      ssh.on('error', (err) => { reject(err); });
    })
      .then((container) => this.inspect(container))
      .then(this.forwards.bind(this));
  }

  inspect(containers) {
    return new Promise((resolve, reject) => {
      const ssh = new Exec(this.client);
      const containersList = containers.join(' ');

      ssh.exec(`sudo podman inspect ${containersList}`, null, null, { returnOutput: true });
      ssh.on('end', (output) => {
        let data = null;
        try {
          data = JSON.parse(output);
        } catch (err) {
          data = [];
        }

        resolve(data);
      });
      ssh.on('error', (err) => { reject(err); });
    });
  }

  forwards(containers) {
    return pAll(containers.map((container) => () => this.forward(container)));
  }

  forward(container) {
    const id = container.Id;
    const ports = container.NetworkSettings.Ports.map((forward) => forward.hostPort);

    let listeningPorts = [];

    this.internal.on('forwards-stop', (containerId) => {
      if (id === containerId && listeningPorts.length === 0) {
        this.internal.emit(`${id}-forwards-stopped`);
      }
    });

    return pSettle(
      ports.map((port) => {
        this.internal.on(`${port}-forward-stopped`, () => {
          listeningPorts = listeningPorts.filter((p) => p !== port);
          if (listeningPorts.length === 0) {
            this.internal.emit(`${id}-forwards-stopped`);
          }
        });

        listeningPorts.push(port);
        return this.forwardPort(id, port);
      }),
    );
  }

  forwardPort(id, port) {
    return new Promise((resolve, reject) => {
      const { error } = console;

      this.connection.forwardOut('0.0.0.0', port, '127.0.0.1', port)
        .then((stream) => {
          const server = net.createServer((client) => {
            client.pipe(stream);
            stream.pipe(client);
          });

          server.listen(port, () => {
            this.internal.on('forwards-stop', (containerId) => {
              if (id === containerId) {
                // stream.end();
                server.close();
              }
            });

            stream.on('end', () => { server.close(); });
            stream.on('error', (err) => { server.close(); error(err); });

            resolve();
          });

          server.on('close', () => { this.internal.emit(`${port}-forward-stopped`); });
          server.on('error', (err) => { stream.end(); reject(err); });
        })
        .catch((err) => { reject(err); });
    });
  }

  unforwards(containers) {
    return pAll(containers.map((container) => () => this.unforward(container)));
  }

  unforward(container) {
    this.internal.emit('forwards-stop', container);
    return pEvent(this.internal, `${container}-forwards-stopped`);
  }
}
