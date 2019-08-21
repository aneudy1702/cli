import inquirer from 'inquirer';
import pBreak from 'p-break';
import pIf from 'p-if';
import OCM from './OCM';
import SSH from './SSH';

const { log } = console;

export default class Setup {
  static install() {
    return SSH.findKey()
      .catch((err) => {
        log(err.message);
        Setup.exit();
      })
      .then(OCM.get)
      .catch(() => pBreak())
      .then(Setup.askToDelete)
      .then(pIf((answer) => answer.delete, OCM.delete, Setup.exit))
      .catch(pBreak.end)
      .then(OCM.download)
      .then(OCM.import)
      .then(OCM.start)
      .then(OCM.waitGuestAdditionnals)
      .then(OCM.importSSHKey)
      .then(OCM.pause);
  }

  static askToDelete() {
    return inquirer.prompt({
      type: 'confirm',
      name: 'delete',
      default: false,
      message: 'OCM already installed, would you reinstall ?',
    });
  }

  static exit() {
    process.exit();
  }
}
