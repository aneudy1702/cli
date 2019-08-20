import pLog from 'p-log';
import Setup from './class/Setup';

Setup.install()
  .then(pLog())
  .catch(pLog(console.error));
