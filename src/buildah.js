#!/usr/bin/env node

import exec from './class/Cli';

const args = process.argv.slice(2).join(' ');

exec(`sudo buildah ${args}`);
