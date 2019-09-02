import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import pIf from 'p-if';
import pSettle from 'p-settle';
import pTap from 'p-tap';
import OCM from './OCM';
import config from '../../config';

export default class Setup {
  static install() {
    return pSettle([
      OCM.get(),
      OCM.existsSSHKeys(),
    ])
      .then(Setup.ask)
      .then(pTap(pIf((answers) => answers.deleteOCM === false, Setup.exit)))
      .then(pTap(pIf((answers) => answers.deleteOCM === true, OCM.delete)))
      .then(pTap(pIf((answers) => answers.keepOCMSSHKeys !== true, OCM.generateSSHKeys)))
      .then(pIf(
        (answers) => answers.useCache !== true, OCM.download,
        () => path.join(config.ocm.download.path, config.ocm.download.file),
      ))
      .then(OCM.import)
      .then(OCM.existsPersistentStorage)
      .then(pTap(pIf(
        (exists) => exists === false,
        OCM.createPersistentStorage,
      )))
      .then(pTap(OCM.attachPersistentStorage))
      .then(pTap(OCM.start))
      .then(pTap(OCM.waitGuestAdditionnals))
      .then(pTap(OCM.importSSHKey))
      .then(pTap(OCM.startDaemon))
      .then(pIf(
        (exists) => exists === false,
        OCM.formatPersistentStorage,
      ))
      .then(OCM.mountPersistentStorage);
  }

  static ask(checks) {
    const questions = [];

    checks.forEach((check, i) => {
      switch (i) {
        case 0:
          questions.push({
            type: 'confirm',
            name: 'deleteOCM',
            default: false,
            message: 'OCM already installed, do you want to reinstall ?',
            when: () => check.isFulfilled,
          });
          questions.push({
            type: 'confirm',
            name: 'useCache',
            default: true,
            message: 'OCM already downloaded, do you want to use cache ?',
            when: (answers) => answers.deleteOCM !== false && fs.existsSync(path.join(
              config.ocm.download.path,
              config.ocm.download.file,
            )),
          });
          break;
        case 1:
          questions.push({
            type: 'confirm',
            name: 'keepOCMSSHKeys',
            default: true,
            message: 'OCM SSH keys exists, do you want to use them ?',
            when: (answers) => answers.deleteOCM !== false && check.isFulfilled && check.value,
          });
          break;
        default:
          break;
      }
    });

    return inquirer.prompt(questions);
  }

  static exit() {
    process.exit();
  }
}
