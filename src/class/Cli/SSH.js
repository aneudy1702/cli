import fs from 'fs-extra';
import forge from 'node-forge';
import path from 'path';
import pify from 'pify';
import pAll from 'p-all';
import os from 'os';
import { generateKeyPair } from 'crypto';

export default class SSH {
  static existsKeys(keyName) {
    return pAll([
      () => SSH.existsKey(keyName),
      () => SSH.existsKey(keyName.concat('.pub')),
    ])
      .then((exists) => exists.every((exist) => exist));
  }

  static existsKey(keyFile) {
    return fs.pathExists(path.join(os.homedir(), '.ssh', keyFile));
  }

  static generatePairKey(name, type = 'rsa', options = {}) {
    const pGenerateKeyPair = pify(generateKeyPair, { multiArgs: true });

    return pGenerateKeyPair(type, options)
      .then((keys) => {
        const [publicKey, privateKey] = keys;

        const publicKeyBuffer = forge.pki.publicKeyFromPem(publicKey);
        const privateKeyBuffer = forge.pki.privateKeyFromPem(privateKey);
        const { passphrase } = options.privateKeyEncoding || {};
        return {
          public: forge.ssh.publicKeyToOpenSSH(publicKeyBuffer, name),
          private: forge.ssh.privateKeyToOpenSSH(privateKeyBuffer, passphrase),
        };
      });
  }
}
