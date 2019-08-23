import fs from 'fs-extra';
import path from 'path';
import pIf from 'p-if';
import pFinally from 'p-finally';
import pRetry from 'p-retry';
import download from './Download';
import SSH from './SSH';
import VirtualBox from './VirtualBox';
import config from '../config';

const { ssh } = config.ocm;
const { log } = console;

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
    log('Downloading OCM archive...');

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
    log('Importing OCM archive...');

    return VirtualBox.import(ovafile, { vsys: '0', eula: 'accept' });
  }

  static existsSSHKeys() {
    return SSH.existsKeys('ocm_rsa');
  }

  static generateSSHKeys() {
    log('Generating keys...');

    return SSH.generatePairKey(ssh.keys.comment, ssh.keys.type, ssh.keys.generateOptions)
      .then(OCM.saveSSHKeys);
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
    log('Importing ssh key');

    return OCM.get()
      .then((ocm) => VirtualBox.copyto(
        ocm,
        path.join(ssh.keys.path, ssh.keys.public),
        ssh.authorizedKeys.path,
        ssh.credential,
      ));
  }

  static start() {
    log('Starting OCM...');

    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate !== 'running',
        VirtualBox.startvm,
      ));
  }

  static pause() {
    log('Pausing OCM...');

    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate === 'running',
        VirtualBox.pause,
      ));
  }

  static resume() {
    log('Resumingg OCM...');

    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate !== 'running',
        VirtualBox.resume,
      ));
  }

  static stop() {
    log('Stoping OCM...');

    return OCM.get()
      .then(pIf(
        (ocm) => ocm.vmstate === 'running' || ocm.vmstate === 'paused',
        VirtualBox.stopvm,
      ));
  }

  static unregister() {
    log('Unregisterg OCM...');

    return OCM.get()
      .then((ocm) => pRetry(
        () => VirtualBox.unregister(ocm, { delete: true }),
        { forever: true, maxTimeout: 1000, maxRetryTime: 10000 },
      ));
  }

  static waitGuestAdditionnals() {
    log('Waiting guest additions running');

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
    );
  }
}
