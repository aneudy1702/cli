import os from 'os';

export default {
  ocm: {
    repository: {
      url: process.env.OCM_REPOSITORY_URL || 'http://spt-09.infra.fr.corp.leroymerlin.com/downloads/OCM.ova',
    },
    download: {
      path: process.env.OCM_DOWNLOAD_PATH || os.tmpdir(),
      file: process.env.OCM_DOWNLOAD_FILE || 'OCM.ova',
    },
    ssh: {
      authorizedKeys: {
        path: '/home/ocm/.ssh/authorized_keys',
      },
      credential: {
        username: 'ocm',
        password: 'ocm',
      },
    },
  },
};
