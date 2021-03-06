import os from 'os';
import path from 'path';

export default {
  ocm: {
    repository: {
      url: process.env.OCM_REPOSITORY_URL || 'https://cdn.ao-dev.com/ocm_latest.ova',
    },
    download: {
      path: process.env.OCM_DOWNLOAD_PATH || os.tmpdir(),
      file: process.env.OCM_DOWNLOAD_FILE || 'ocm.ova',
    },
    ssh: {
      host: 'localhost',
      port: 2222,
      authorizedKeys: {
        path: '/home/ocm/.ssh/authorized_keys',
      },
      credential: {
        username: 'ocm',
        password: 'ocm',
      },
      keys: {
        type: 'rsa',
        comment: 'ocm@host',
        generateOptions: {
          modulusLength: 4096,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        },
        path: path.join(os.homedir(), '.ssh'),
        public: 'ocm_rsa.pub',
        private: 'ocm_rsa',
      },
    },
    daemon: {
      bin: 'ocm-daemon',
      timeout: 60000,
    },
    cli: {
      timeout: 2000,
    },
  },
  vboxmanage: {
    bin: process.platform === 'win32' ? path.join(process.env.VBOX_MSI_INSTALL_PATH, 'VBoxManage') || 'VBoxManage' : 'VBoxManage',
    acpipower: {
      timeout: 10000,
    },
    unregister: {
      timeout: 10000,
    },
  },
};
