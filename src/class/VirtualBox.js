import { exec } from 'child_process';
import pify from 'pify';
import pRetry from 'p-retry';

const pExec = pify(exec);

export default class VirtualBox {
  static version() {
    return pExec('VBoxManage --version')
      .then((stdout) => stdout.replace('\n', ''))
      .then((version) => ({ version }));
  }

  static list(type = 'vms') {
    const regex = /"([^"]+)" {([^}]+)}/;
    return pExec(`VBoxManage list ${type}`)
      .then((stdout) => stdout.split('\n')
        .filter((line) => line !== '')
        .map((line) => line.match(regex))
        .map((match) => ({ name: match[1], uuid: match[2] })));
  }

  static stopvm(vm) {
    return pExec(`VBoxManage controlvm ${vm.uuid} poweroff`);
  }

  static unregister(vm, retry = { retry: 1 }) {
    return pRetry(() => pExec(`VBoxManage unregistervm ${vm.uuid} --delete`), retry);
  }

  static import(ovaFile) {
    return pExec(`VBoxManage import ${ovaFile} --vsys 0 --eula accept`);
  }
}
