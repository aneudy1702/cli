#!/usr/bin/env node

import Ora from 'ora';
import pIf from 'p-if';
import OCM from './class/Cli/OCM';
import Setup from './class/Cli/Setup';

const { error } = console;

const input = process.argv.slice(2);

if (input.length > 0) {
  switch (input[0]) {
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
    default:
      break;
  }
}
