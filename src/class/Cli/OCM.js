import fs from 'fs-extra';
import ora from 'ora';
import os from 'os';
import path from 'path';
import pIf from 'p-if';
import pRetry from 'p-retry';
import pTap from 'p-tap';
import pWaitFor from 'p-wait-for';
import Cli from '../Cli';
import download from './Download';
import Client from './IPC/Client';
import Launcher from '../Daemon/Launcher';
import VirtualBox from './VirtualBox';
import SSH from './SSH';
import config from '../../config';

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
    const client = new Client();

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
      .then(() => client.status())
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
    return OCM.acpipower()
      .then(OCM.existsPersistentStorage)
      .then(pIf(
        (exists) => exists === true,
        () => OCM.detachPersistentStorage(),
      ))
      .then(OCM.unregister);
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
      .then(() => pWaitFor(
        () => OCM.get()
          .catch(() => ({}))
          .then((ocm) => ocm.vmstate === 'poweroff'),
        { interval: 100, timeout: config.vboxmanage.acpipower.timeout },
      ))
      .then(() => spinner.succeed('OCM stopped by acpi'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static unregister() {
    const spinner = ora('Unregistering OCM').start();
    return OCM.get()
      .then((ocm) => pRetry(
        () => VirtualBox.unregister(ocm, { delete: true }),
        { forever: true, maxTimeout: 1000, maxRetryTime: config.vboxmanage.unregister.timeout },
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

  static existsPersistentStorage() {
    const persistentFile = path.join(os.homedir(), '.ocm', 'ocm-persistent.vmdk');

    return fs.pathExists(persistentFile);
  }

  static createPersistentStorage() {
    const spinner = ora('Create persistent storage');
    const persistentFile = path.join(os.homedir(), '.ocm', 'ocm-persistent.vmdk');

    return OCM.existsPersistentStorage()
      .then(pIf(
        (exists) => exists === false,
        () => fs.ensureDir(path.dirname(persistentFile))
          .then(() => spinner.start())
          .then(() => VirtualBox.createmedium('disk', {
            filename: persistentFile,
            size: '65536',
            format: 'VMDK',
          })),
      ))
      .then(() => spinner.succeed('Persistent storage created'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static attachPersistentStorage() {
    const spinner = ora('Attach persistent storage').start();
    const persistentFile = path.join(os.homedir(), '.ocm', 'ocm-persistent.vmdk');

    return VirtualBox.storageattach('ocm', {
      storagectl: 'SATA',
      port: '1',
      device: '0',
      type: 'hdd',
      medium: persistentFile,
    })
      .then(() => spinner.succeed('Persistent storage attached'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static detachPersistentStorage() {
    const spinner = ora('Detach persistent storage').start();

    return VirtualBox.storageattach('ocm', {
      storagectl: 'SATA',
      port: '1',
      device: '0',
      type: 'hdd',
      medium: 'none',
    })
      .then(() => spinner.succeed('Persistent storage detached'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static formatPersistentStorage() {
    const spinner = ora('Mount persistent storage').start();

    return OCM.exec('sudo mkfs.ext4 /dev/sdb')
      .then(() => spinner.succeed('Persistent storage formated'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static mountPersistentStorage() {
    const spinner = ora('Mount persistent storage').start();

    return OCM.exec('sudo mkdir /persistent')
      .then(() => OCM.exec('echo -e "# Persistent storage\\n/dev/sdb\\t\\t/persistent\\text4\\trw,relatime\\t0 2\\n" | sudo tee -a /etc/fstab'))
      .then(() => OCM.exec('sudo mount /persistent'))
      .then(() => OCM.exec('sudo sed -i -e \'s#root = "#root = "\\/persistent#g\' /etc/containers/storage.conf'))
      .then(() => spinner.succeed('Persistent storage mounted'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static startDaemon() {
    const spinner = ora('Starting OCM SSH daemon').start();

    return Launcher.start({ interval: 100, timeout: config.ocm.daemon.timeout })
      .then(() => spinner.succeed('OCM SSH daemon running'))
      .catch(pTap.catch(() => spinner.fail()));
  }

  static exec(cmd) {
    return Cli.exec(cmd, { stdio: false });
  }

  static shell() {
    return Cli.exec();
  }
}
