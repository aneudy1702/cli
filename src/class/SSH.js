import fs from 'fs-extra';
import forge from 'node-forge';
import path from 'path';
import pify from 'pify';
import pAll from 'p-all';
import os from 'os';
import { Client } from 'ssh2';
import { generateKeyPair } from 'crypto';
import config from '../config';

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

  static exec(cmd, privateKey, options = {}) {
    return new Promise((resolve, reject) => {
      const client = new Client();
      const exec = pify(client.exec.bind(client));
      const defaultOptions = {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
      };
      const { stdin, stdout, stderr } = { ...defaultOptions, ...options };

      client.on('ready', () => {
        if (typeof options.ready === 'function') {
          options.ready();
        }

        exec(cmd, { pty: stdout.isTTY ? { rows: stdout.rows, columns: stdout.columns } : true })
          .then((stream) => {
            if (stdout.isTTY) {
              const resize = () => { stream.setWindow(stdout.rows, stdout.columns); };
              resize();
              stdout.on('resize', resize);
            }

            stdin.setRawMode(true);
            stdin.pipe(stream);
            stream.pipe(stdout);
            stream.stderr.pipe(stderr);

            stream.on('close', () => { stdin.destroy(); client.end(); });
            stream.on('error', (err) => { reject(err); });
          })
          .catch((err) => reject(err));
      });

      client.connect({
        host: config.ocm.ssh.host,
        port: config.ocm.ssh.port,
        username: config.ocm.ssh.credential.username,
        privateKey,
      });

      client.on('error', (err) => reject(err));
      client.on('end', () => resolve());
    });
  }

  static shell(privateKey, options = {}) {
    return new Promise((resolve, reject) => {
      const client = new Client();
      const shell = pify(client.shell.bind(client));
      const defaultOptions = {
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
      };
      const { stdin, stdout, stderr } = { ...defaultOptions, ...options };

      client.on('ready', () => {
        if (typeof options.ready === 'function') {
          options.ready();
        }

        shell({ pty: stdout.isTTY ? { rows: stdout.rows, columns: stdout.columns } : true })
          .then((stream) => {
            if (stdout.isTTY) {
              const resize = () => { stream.setWindow(stdout.rows, stdout.columns); };
              resize();
              stdout.on('resize', resize);
            }

            stdin.setRawMode(true);
            stdin.pipe(stream);
            stream.pipe(stdout);
            stream.stderr.pipe(stderr);

            stream.on('close', () => { stdin.unref(); client.end(); });
            stream.on('error', (err) => { reject(err); });
          })
          .catch((err) => reject(err));
      });

      client.connect({
        host: config.ocm.ssh.host,
        port: config.ocm.ssh.port,
        username: config.ocm.ssh.credential.username,
        privateKey,
      });

      client.on('error', (err) => reject(err));
      client.on('end', () => resolve());
    });
  }
}
