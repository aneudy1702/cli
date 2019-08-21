import fs from 'fs-extra';
import path from 'path';
import pSettle from 'p-settle';
import os from 'os';

export default class SSH {
  static findKey() {
    const keys = ['id_rsa.pub', 'id_dsa.pub', 'id_ecdsa.pub', 'id_ed25519.pub'];
    return pSettle(keys.map((key) => SSH.existsKey(key)))
      .then((exists) => {
        const index = exists.findIndex((exist) => exist.value);
        if (index === -1) return Promise.reject(new Error(`No ssh key found in ${path.join(os.homedir(), '.ssh')}`));
        return Promise.resolve(path.join(os.homedir(), '.ssh', keys[index]));
      });
  }

  static existsKey(keyFile) {
    return fs.pathExists(path.join(os.homedir(), '.ssh', keyFile));
  }
}
