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
    const options = opts || {};
    const pty = typeof options.pty === 'object' ? options.pty : window;

    return pIf(
      cmd !== undefined && cmd !== null,
      () => exec(cmd, options),
      () => shell(window, options),
    )()
      .then((stream) => {
        if (streams && streams.stdin) {
          streams.stdin.pipe(stream);
        }

        if (streams && streams.events) {
          streams.events.on('resize', (tty) => {
            stream.setWindow(tty.rows, tty.columns);
          });
          streams.events.on('stop', () => { stream.end(); });
        }

        if (pty) {
          stream.setWindow(pty.rows, pty.columns);
        }

        const outputs = [];
        stream.on('data', (output) => {
          this.emit('stdout', output);
          if (streams && streams.returnOutput === true) {
            outputs.push(output);
          }
        });
        stream.stderr.on('data', (output) => { this.emit('stderr', output); });

        stream.on('end', () => {
          const output = streams.returnOutput ? outputs.join('') : undefined;
          this.emit('end', output);
        });
        stream.on('error', (err) => { this.emit('error', err); });
      });
  }
}
