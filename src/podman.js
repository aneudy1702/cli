#!/usr/bin/env node

import Cli from './class/Cli';

const args = process.argv.slice(2).join(' ');
const cli = new Cli();
cli.exec(`podman ${args}`);
