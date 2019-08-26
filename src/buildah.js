#!/usr/bin/env node

import pIf from 'p-if';
import pSettle from 'p-settle';
import OCM from './class/OCM';

const { log, error } = console;

const input = process.argv.slice(2);
const args = input.join(' ');

OCM.exec(`sudo buildah ${args}`)
  .catch((err) => error(err.message));
