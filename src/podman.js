#!/usr/bin/env node

import pIf from 'p-if';
import pSettle from 'p-settle';
import OCM from './class/OCM';

const { log, error } = console;

const input = process.argv.slice(2);

const args = input.join(' ');
const matches = args.match(/run .*-p ([^ ]+).*/);
const portList = matches && matches.length == 2 ? matches[1].split(',').map((port) => port.split(':')[0]) : [];

pSettle(portList.map(OCM.forward))
  .then(OCM.exec(`sudo podman ${args}`))
  .catch((err) => error(err.message));
