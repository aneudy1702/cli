import fs from 'fs-extra';
import ora from 'ora';
import path from 'path';
import pIf from 'p-if';
import pFinally from 'p-finally';
import pRetry from 'p-retry';
import download from './Download';
import SSH from './SSH';
import VirtualBox from './VirtualBox';
import config from '../config';

const { ssh } = config.ocm;

export default class OCM {
  static get() {
    return VirtualBox.showvminfo('OCM', { machinereadable: true })
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

  static delete() {
    return pFinally(
      OCM.stop(),
      OCM.unregister,
    );
  }

  static download() {
    return pIf(
      !/^file:/.test(config.ocm.repository.url),
      () => download(config.ocm.repository.url, {
        path: config.ocm.download.path,
        file: config.ocm.download.file,
      }),
      () => config.ocm.repository.url.replace(/^file:\/\//, ''),
    )();
  }

  static import(ovafile) {
    const spinner = ora('Importing OCM Archive').start();
    return VirtualBox.import(ovafile, { vsys: '0', eula: 'accept' })
      .then(() => spinner.stop());
  }

  static existsSSHKeys() {
    return SSH.existsKeys('ocm_rsa');
  }

  static generateSSHKeys() {
    const spinner = ora('Generating keys').start();
    return SSH.generatePairKey(ssh.keys.comment, ssh.keys.type, ssh.keys.generateOptions)
      .then(OCM.saveSSHKeys)
      .then(() => spinner.stop());
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
      .then((ocm) => VirtualBox.copyto(
        ocm,
        path.join(ssh.keys.path, ssh.keys.public),
        ssh.authorizedKeys.path,
        ssh.credential,
      ))
      .then(() => spinner.stop());
  }

  static start() {
    const spinner = ora('Starting OCM').start();
    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate !== 'running',
        VirtualBox.startvm,
      ))
      .then(() => spinner.stop());
  }

  static pause() {
    const spinner = ora('Pausing OCM').start();
    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate === 'running',
        VirtualBox.pause,
      ))
      .then(() => spinner.stop());
  }

  static resume() {
    const spinner = ora('Resuming OCM').start();
    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate !== 'running',
        VirtualBox.resume,
      ))
      .then(() => spinner.stop());
  }

  static stop() {
    const spinner = ora('Stoping OCM').start();
    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate === 'running' || ocm.vmstate === 'paused',
        VirtualBox.stopvm,
      ))
      .then(() => spinner.stop());
  }

  static acpipower() {
    const spinner = ora('Stoping OCM by acpi').start();
    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate === 'running',
        VirtualBox.acpipowerbutton,
      ))
      .then(() => spinner.stop());
  }

  static unregister() {
    const spinner = ora('Unregistering OCM').start();
    return OCM.get()
      .then((ocm) => pRetry(
        () => VirtualBox.unregister(ocm, { delete: true }),
        { forever: true, maxTimeout: 1000, maxRetryTime: 10000 },
      ))
      .then(() => spinner.stop());
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
      .then(() => spinner.stop());
  }

  static exec(cmd) {
    return fs.readFile(path.join(ssh.keys.path, ssh.keys.private))
      .then((privateKey) => SSH.exec(cmd, privateKey));
  }

  static shell() {
    return fs.readFile(path.join(ssh.keys.path, ssh.keys.private))
      .then((privateKey) => SSH.shell(privateKey));
  }
}
