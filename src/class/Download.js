import cliProgress from 'cli-progress';
import got from 'got';
import fs from 'fs';
import numeral from 'numeral';
import path from 'path';
import pEvent from 'p-event';
import pFinally from 'p-finally';
import pRace from 'p-race';
import speedometer from 'speedometer';

const bytesFormat = '0.00 ib';

export default function download(url, dest) {
  let transferred = 0;
  const prettySpeed = numeral();
  const prettyValue = numeral(0);
  const prettyTotal = numeral(0);

  const speed = speedometer();
  const progressBar = new cliProgress.Bar({
    format: '{bar} {percentage}% | {filename} | {prettySpeed}/s | {prettyValue} / {prettyTotal}',
    hideCursor: true,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });

  const dl = got.stream(url, { timeout: { socket: 10000 } });
  const stream = fs.createWriteStream(path.join(dest.path, dest.file));
  dl.pipe(stream);
  dl.on('response', (response) => {
    const start = 0;
    const total = response.headers['content-length'];

    prettyTotal.set(total);
    progressBar.start(total, start, {
      filename: dest.file,
      prettySpeed: prettySpeed.format(bytesFormat),
      prettyValue: prettyValue.format(bytesFormat),
      prettyTotal: prettyTotal.format(bytesFormat),
    });
  });

  dl.on('downloadProgress', (progress) => {
    prettySpeed.set(speed(progress.transferred - transferred));
    prettyValue.set(progress.transferred);

    progressBar.update(progress.transferred, {
      prettySpeed: prettySpeed.format(bytesFormat),
      prettyValue: prettyValue.format(bytesFormat),
    });

    transferred = progress.transferred;
  });

  return pFinally(
    pRace([
      pEvent(dl, 'end'),
      pEvent(dl, 'error'),
    ]),
    () => progressBar.stop(),
  )
    .then(() => path.join(dest.path, dest.file));
}
