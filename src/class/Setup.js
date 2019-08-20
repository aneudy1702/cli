import inquirer from 'inquirer';
import pIf from 'p-if';
import pTap from 'p-tap';
import download from './Download';
import VirtualBox from './VirtualBox';
import config from '../config';

const ui = new inquirer.ui.BottomBar();

export default class Setup {
  static install() {
    return VirtualBox.list()
      .then((vms) => vms.find((vm) => vm.name === 'OCM'))
      .then(pIf(
        (find) => find !== undefined,
        () => Setup.askToDelete()
          .then(pIf((answer) => answer.delete, Setup.deleteOCM, Setup.exit)),
      ))
      .then(() => ui.log.write('Downloading OCM archive...'))
      .then(Setup.downloadOCM)
      .then(pTap(() => ui.log.write('Importing OCM archive...')))
      .then((ovaFile) => VirtualBox.import(ovaFile));
  }

  static exit() {
    process.exit();
  }

  static askToDelete() {
    return inquirer.prompt({
      type: 'confirm',
      name: 'delete',
      default: false,
      message: 'OCM already installed, would you reinstall ?',
    });
  }

  static deleteOCM() {
    return VirtualBox.list('runningvms')
      .then((vms) => vms.find((vm) => vm.name === 'OCM'))
      .then(pTap(pIf((vm) => vm !== undefined, (ocm) => VirtualBox.stopvm(ocm))))
      .then(VirtualBox.list)
      .then((vms) => vms.find((vm) => vm.name === 'OCM'))
      .then((ocm) => VirtualBox.unregister(ocm, { retry: 10 }));
  }

  static downloadOCM() {
    return download(config.ocm.repository.url, {
      path: config.ocm.download.path,
      file: config.ocm.download.file,
    });
  }
}
