import { exec } from 'child_process';
import pify from 'pify';

const pExec = pify(exec);

function getArgs(options) {
  return Object.keys(options || {}).map((key) => [`--${key}`, `${typeof options[key] === 'string' ? options[key] : ''}`].join(' ')).join(' ');
}

export default class VirtualBox {
  static version() {
    return pExec('VBoxManage --version')
      .then((stdout) => stdout.replace('\n', ''))
      .then((version) => ({ version }));
  }

  static showvminfo(vm, options = {}) {
    const args = getArgs(options);
    return pExec(`VBoxManage showvminfo ${vm.uuid || vm.name || vm} ${args}`);
  }

  static startvm(vm, type = 'headless') {
    return pExec(`VBoxManage startvm --type ${type} ${vm.uuid || vm.name || vm}`);
  }

  static stopvm(vm) {
    return pExec(`VBoxManage controlvm ${vm.uuid || vm.name || vm} poweroff`);
  }

  static acpipowerbutton(vm) {
    return pExec(`VBoxManage controlvm ${vm.uuid || vm.name || vm} acpipowerbutton`);
  }

  static pause(vm) {
    return pExec(`VBoxManage controlvm ${vm.uuid || vm.name || vm} pause`);
  }

  static resume(vm) {
    return pExec(`VBoxManage controlvm ${vm.uuid || vm.name || vm} resume`);
  }

  static mkdir(vm, dest, options = {}) {
    const args = getArgs(options);
    return pExec(`VBoxManage guestcontrol ${vm.uuid || vm.name || vm} mkdir ${args} "${dest}"`);
  }

  static copyto(vm, src, dest, options = {}) {
    const args = getArgs(options);
    return pExec(`VBoxManage guestcontrol ${vm.uuid || vm.name || vm} copyto ${args} "${src}" "${dest}"`);
  }

  static unregister(vm, options = {}) {
    const args = getArgs(options);
    return pExec(`VBoxManage unregistervm ${vm.uuid || vm.name || vm} ${args}`);
  }

  static import(ovaFile, options = {}) {
    const args = getArgs(options);
    return pExec(`VBoxManage import "${ovaFile}" ${args}`);
  }

  static forward(vm, nic, name, proto, host, hostPort, internal, internalPort, options = {}) {
    const args = getArgs(options);
    return pExec(`VBoxManage controlvm ${vm.uuid || vm.name || vm} natpf${nic} "${name},${proto},${host},${hostPort},${internal},${internalPort}" ${args}`);
  }

  static unforward(vm, nic, name, options = {}) {
    const args = getArgs(options);
    return pExec(`VBoxManage controlvm ${vm.uuid || vm.name || vm} natpf${nic} delete "${name}" ${args}`);
  }
}
