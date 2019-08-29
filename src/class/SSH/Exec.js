import EventEmitter from 'events';
import pify from 'pify';
import pIf from 'p-if';

export default class Exec extends EventEmitter {
  constructor(conn) {
    super();
    this.conn = conn;
  }

  exec(cmd, opts, window, streams) {
    const exec = pify(this.conn.exec.bind(this.conn));
    const shell = pify(this.conn.shell.bind(this.conn));
    const pty = typeof opts.pty === 'object' ? opts.pty : window;

    return pIf(
      cmd !== undefined && cmd !== null,
      () => exec(cmd, opts),
      () => shell(window, opts),
    )()
      .then((stream) => {
        if (streams && streams.stdin) {
          streams.stdin.pipe(stream);
        }

        if (streams && streams.events) {
          streams.events.on('resize', (tty) => {
            stream.setWindow(tty.rows, tty.columns);
          });
        }

        if (pty) {
          stream.setWindow(pty.rows, pty.columns);
        }

        stream.on('data', (output) => { this.emit('stdout', output); });
        stream.stderr.on('data', (output) => { this.emit('stderr', output); });

        stream.on('end', () => { this.emit('end'); });
        stream.on('error', (err) => { this.emit('error', err); });
      });
  }
}
