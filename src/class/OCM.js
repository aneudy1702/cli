import boxen from 'boxen';
import chalk from 'chalk';
import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import pIf from 'p-if';
import pFinally from 'p-finally';
import pRetry from 'p-retry';
import pTap from 'p-tap';
import download from './Download';
import SSH from './SSH';
import VirtualBox from './VirtualBox';
import config from '../config';

const { ssh } = config.ocm;

export default class OCM {
  static get() {
    return VirtualBox.showvminfo('ocm', { machinereadable: true })
      .then(OCM.parseInfo);
  }

  static parseInfo(rawData) {
    const data = rawData.split('\n');

    return data.reduce((acc, line) => {
      const matches = line
        .replace('\r', '')
        .match(/^"?([^"=]+)"?=+"?([^"]*)"?$/);

      if (matches && matches.length === 3) {
        Object.assign(acc, { [matches[1].toLowerCase()]: matches[2] });
      }
      return acc;
    }, {});
  }

  static status() {
    const spinner = ora();
    const sshSpinner = ora();
    return OCM.get()
      .then(pTap(pIf(
        (ocm) => ocm.vmstate === 'running' && ocm.guestadditionsrunlevel === '2',
        () => spinner.succeed('OCM running'),
      )))
      .then(pTap(pIf(
        (ocm) => ocm.vmstate === 'running' && ocm.guestadditionsrunlevel !== '2',
        () => spinner.warn('OCM starting'),
      )))
      .then(pTap(pIf(
        (ocm) => ocm.vmstate !== 'running',
        () => spinner.fail('OCM stopped'),
      )))
      .then(SSH.status)
      .then(pIf(
        (state) => state === 'running',
        () => sshSpinner.succeed('SSH daemon running'),
        pIf(
          (state) => state === 'no-ssh',
          () => sshSpinner.warn('SSH daemon not ready'),
          () => sshSpinner.fail('SSH daemon stopped'),
        ),
      ))
      .catch(pTap.catch(() => spinner.fail('OCM not installed')));
  }

  static delete() {
    return pFinally(
      OCM.stop(),
      OCM.unregister,
    );
  }

  static download() {
    const spinner = ora();
    return pIf(
      !/^file:/.test(config.ocm.repository.url),
      () => download(config.ocm.repository.url, {
        path: config.ocm.download.path,
        file: config.ocm.download.file,
      })
        .then(pTap(() => spinner.succeed('OCM archive downloaded')))
        .catch(pTap.catch(() => spinner.fail())),
      () => config.ocm.repository.url.replace(/^file:\/\//, ''),
    )();
  }

  static import(ovafile) {
    const spinner = ora('Importing OCM archive').start();
    return VirtualBox.import(ovafile, { vsys: '0', eula: 'accept' })
      .then(() => spinner.succeed('OCM archive imported'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static existsSSHKeys() {
    return SSH.existsKeys('ocm_rsa');
  }

  static generateSSHKeys() {
    const spinner = ora('Generating SSH keys').start();
    return SSH.generatePairKey(ssh.keys.comment, ssh.keys.type, ssh.keys.generateOptions)
      .then(OCM.saveSSHKeys)
      .then(() => spinner.succeed('SSH keys generated'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static saveSSHKeys(keys) {
    return fs.outputFile(path.join(ssh.keys.path, ssh.keys.public), keys.public)
      .then(() => fs.outputFile(
        path.join(ssh.keys.path, ssh.keys.private),
        keys.private,
        { mode: 384 },
      ));
  }

  static importSSHKey() {
    const spinner = ora('Importing SSH key').start();
    return OCM.get()
      .then(pTap((ocm) => VirtualBox.mkdir(
        ocm,
        path.dirname(ssh.authorizedKeys.path),
        ssh.credential,
      )))
      .then((ocm) => VirtualBox.copyto(
        ocm,
        path.join(ssh.keys.path, ssh.keys.public),
        ssh.authorizedKeys.path,
        ssh.credential,
      ))
      .then(() => spinner.succeed('SSH keys imported'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static start() {
    const spinner = ora('Starting OCM').start();
    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate !== 'running',
        VirtualBox.startvm,
      ))
      .then(() => spinner.succeed('OCM started'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static stop() {
    const spinner = ora('Stoping OCM').start();
    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate === 'running' || ocm.vmstate === 'paused',
        VirtualBox.stopvm,
      ))
      .then(() => spinner.succeed('OCM stopped'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static acpipower() {
    const spinner = ora('Stoping OCM by acpi').start();
    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate === 'running',
        VirtualBox.acpipowerbutton,
      ))
      .then(() => spinner.succeed('OCM stopped by acpi'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static unregister() {
    const spinner = ora('Unregistering OCM').start();
    return OCM.get()
      .then((ocm) => pRetry(
        () => VirtualBox.unregister(ocm, { delete: true }),
        { forever: true, maxTimeout: 1000, maxRetryTime: 10000 },
      ))
      .then(() => spinner.succeed('OCM unregistered'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static waitGuestAdditionnals() {
    const spinner = ora('Waiting guest additions running').start();
    return pRetry(
      () => OCM.get()
        .then(pIf(
          (ocm) => ocm.vmstate !== 'running' || ocm.guestadditionsrunlevel !== '2',
          () => { throw new Error('Guest addtionals not running'); },
        )),
      {
        forever: true,
        maxTimeout: 1000,
        maxRetryTime: 30000,
      },
    )
      .then(() => spinner.succeed('Guest additions running'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static startSSHDaemon() {
    const spinner = ora('Starting OCM SSH daemon').start();
    return SSH.start({ interval: 100, timeout: 60000 })
      .then(() => spinner.succeed('OCM SSH daemon running'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static exec(cmd) {
    const spinner = ora('Connecting to OCM');
    const timeout = setTimeout(() => spinner.start(), 200);
    const clear = () => { clearTimeout(timeout); spinner.stop(); };
    const ready = () => {
      clear();

      const { error } = console;

      error(boxen(chalk.cyan('Experimental feature'), {
        padding: 1,
        margin: 1,
        align: 'center',
        borderColor: 'yellow',
        borderStyle: 'round',
      }));
    };

    return SSH.exec(cmd, { interval: 100, timeout: 2000, ready: cmd ? clear : ready })
      .catch((err) => { clear(); spinner.fail(err.message); });
  }

  static shell() {
    return OCM.exec();
  }

  static forward(port) {
    const spinner = ora(`Forwarding tcp/${port}`).start();
    return SSH.forward(port)
      .then(() => spinner.succeed(`Port tcp/${port} forwarded`))
      .catch(pTap.catch(() => spinner.fail()));
  }
}
