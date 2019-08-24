import OCM from './class/OCM';
import Setup from './class/Setup';

const { log, error } = console;

const input = process.argv.slice(2);

if (input.length > 0) {
  const bin = input[0][0] === 'p' ? 'podman' : 'buildah';
  const args = input.slice(1).join(' ');

  switch (input[0]) {
    case 'install':
      Setup.install()
        .catch((err) => error(err.message));
      break;
    case 'podman':
    case 'pod':
    case 'p':
    case 'buildah':
    case 'b':
      OCM.exec(`sudo ${bin} ${args}`);
      break;
    case 'shell':
      log('/!\\ Exprerimental /!\\\n');
      OCM.shell();
      break;
    case 'start':
      OCM.start()
        .then(OCM.waitGuestAdditionnals);
      break;
    case 'stop':
      OCM.acpipower();
      break;
    default:
      break;
  }
}
