import inquirer from 'inquirer';
import pIf from 'p-if';
import pSettle from 'p-settle';
import pTap from 'p-tap';
import OCM from './OCM';

export default class Setup {
  static install() {
    return pSettle([
      OCM.get(),
      OCM.existsSSHKeys(),
    ])
      .then(Setup.ask)
      .then(pTap(pIf((answers) => answers.deleteOCM === false, Setup.exit)))
      .then(pTap(pIf((answers) => answers.deleteOCM === true, OCM.delete)))
      .then(pIf((answers) => answers.keepOCMSSHKeys === false, OCM.generateSSHKeys))
      .then(OCM.download)
      .then(OCM.import)
      .then(OCM.start)
      .then(OCM.waitGuestAdditionnals)
      .then(OCM.importSSHKey);
  }

  static ask(checks) {
    const questions = [];

    checks.forEach((check, i) => {
      switch (i) {
        case 0:
          if (check.isFulfilled) {
            questions.push({
              type: 'confirm',
              name: 'deleteOCM',
              default: false,
              message: 'OCM already installed, would you reinstall ?',
            });
          }
          break;
        case 1:
          if (check.isFulfilled && check.value) {
            questions.push({
              type: 'confirm',
              name: 'keepOCMSSHKeys',
              default: true,
              message: 'OCM SSH keys found, would you keep them ?',
              when: (answers) => answers.deleteOCM !== false,
            });
          }
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
