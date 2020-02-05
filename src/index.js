#!/usr/bin/env node

import Ora from 'ora';
import pIf from 'p-if';
import OCM from './class/Cli/OCM';
import Setup from './class/Cli/Setup';
import { version } from '../package.json';

const { log, error } = console;

const input = process.argv.slice(2);

switch (input[0] || null) {
  case 'install':
    Setup.install()
      .catch((err) => error(err.message));
    break;
  case 'status':
    OCM.status();
    break;
  case 'console':
  case 'shell':
    OCM.shell();
    break;
  case 'start':
    OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate !== 'running',
        () => OCM.start()
          .then(OCM.waitGuestAdditionnals)
          .then(OCM.startDaemon)
          .then(OCM.existsPersistentStorage),
        () => new Ora('OCM running').succeed(),
      ))
      .catch((err) => error(err.message));
    break;
  case 'stop':
    OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate === 'running',
        () => OCM.acpipower(),
        () => new Ora('OCM stopped').succeed(),
      ))
      .catch((err) => error(err.message));
    break;
  case '-v':
  case '--version':
    log(version);
    break;
  default:
    log(`manage ocm virtual machine

Usage:
  ocm [command]

Available commands:
  install     Download & install OCM virtual mahcine
  status      Display the status of the OCM virtual machine
  start       Start the OCM virtual machine
  stop        Stop the OCM virtual machine
  console     Open an interactive console
`);
    break;
}
