#!/usr/bin/env node

import uuid from 'uuid/v4';
import Cli from './class/Cli';
import VirtualBox from './class/Cli/VirtualBox';

const { error } = console;
const input = process.argv.slice(2);
const args = Cli.escape(input).join(' ');

if (input.length > 1 && input[0] === 'build') {
  const id = uuid();

  VirtualBox.share('ocm', {
    name: id,
    hostpath: process.cwd(),
    readonly: true,
    transient: true,
  })
    .then(() => Cli.exec(`sudo mkdir -p /media/${id} && sudo mount -t vboxsf -o gid=vboxsf ${id} /media/${id}`))
    .then(() => Cli.exec(`cd /media/${id} && sudo podman ${args}`))
    .then(() => Cli.exec(`sudo umount /media/${id} && sudo rmdir /media/${id}`))
    .then(() => VirtualBox.unshare('ocm', {
      name: id,
      transient: true,
    }))
    .catch((err) => { error(err.message); });
} else {
  Cli.exec(`sudo podman ${args}`)
    .catch((err) => error(err.message));
}
