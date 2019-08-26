#!/usr/bin/env node

import OCM from './class/OCM';

const { error } = console;

const input = process.argv.slice(2);
const args = input.join(' ');

OCM.exec(`sudo buildah ${args}`)
  .catch((err) => error(err.message));
