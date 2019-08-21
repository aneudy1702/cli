import Setup from './class/Setup';

const { log, error } = console;

Setup.install()
  .then(log)
  .catch(error);
