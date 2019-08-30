import { exec } from 'child_process';
import pify from 'pify';
import config from '../../config';

const pExec = pify(exec);

function getArgs(options) {
  return Object.keys(options || {}).map((key) => [`--${key}`, `${typeof options[key] === 'string' ? options[key] : ''}`].join(' ')).join(' ');
}

export default class VirtualBox {
  static version() {
    return pExec(`"${config.vboxmanage.bin}" --version`)
      .then((stdout) => stdout.replace('\n', ''))
      .then((version) => ({ version }));
  }

  static showvminfo(vm, options = {}) {
    const args = getArgs(options);
    return pExec(`"${config.vboxmanage.bin}" showvminfo ${vm.uuid || vm.name || vm} ${args}`);
  }

  static startvm(vm, type = 'headless') {
    return pExec(`"${config.vboxmanage.bin}" startvm --type ${type} ${vm.uuid || vm.name || vm}`);
  }

  static stopvm(vm) {
    return pExec(`"${config.vboxmanage.bin}" controlvm ${vm.uuid || vm.name || vm} poweroff`);
  }

  static acpipowerbutton(vm) {
    return pExec(`"${config.vboxmanage.bin}" controlvm ${vm.uuid || vm.name || vm} acpipowerbutton`);
  }

  static pause(vm) {
    return pExec(`"${config.vboxmanage.bin}" controlvm ${vm.uuid || vm.name || vm} pause`);
  }

  static resume(vm) {
    return pExec(`"${config.vboxmanage.bin}" controlvm ${vm.uuid || vm.name || vm} resume`);
  }

  static mkdir(vm, dest, options = {}) {
    const args = getArgs(options);
    return pExec(`"${config.vboxmanage.bin}" guestcontrol ${vm.uuid || vm.name || vm} mkdir ${args} "${dest}"`);
  }

  static copyto(vm, src, dest, options = {}) {
    const args = getArgs(options);
    return pExec(`"${config.vboxmanage.bin}" guestcontrol ${vm.uuid || vm.name || vm} copyto ${args} "${src}" "${dest}"`);
  }

  static unregister(vm, options = {}) {
    const args = getArgs(options);
    return pExec(`"${config.vboxmanage.bin}" unregistervm ${vm.uuid || vm.name || vm} ${args}`);
  }

  static share(vm, options = {}) {
    const args = getArgs(options);
    return pExec(`"${config.vboxmanage.bin}" sharedfolder add ${vm.uuid || vm.name || vm} ${args}`);
  }

  static unshare(vm, options = {}) {
    const args = getArgs(options);
    return pExec(`"${config.vboxmanage.bin}" sharedfolder remove ${vm.uuid || vm.name || vm} ${args}`);
  }

  static import(ovaFile, options = {}) {
    const args = getArgs(options);
    return pExec(`"${config.vboxmanage.bin}" import "${ovaFile}" ${args}`);
  }
}
