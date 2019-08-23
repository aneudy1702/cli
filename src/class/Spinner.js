import chalk from 'chalk';
import cliSpinners from 'cli-spinners';

export default class {
  constructor() {
    if (process.platform === 'win32') {
      Object.assign(this, cliSpinners.line);
    } else {
      Object.assign(this, cliSpinners.dots);
    }

    this.index = 0;
    this.runner = null;
  }

  start() {
    this.runner = setInterval(() => {
      this.index = (this.index + 1) % this.frames.length;
    }, this.interval);

    return this;
  }

  get() {
    return chalk.cyan(this.frames[this.index]);
  }

  stop() {
    if (this.runner !== null) {
      clearInterval(this.runner);
    }

    return this;
  }
}
