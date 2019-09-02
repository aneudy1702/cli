# Open Containers Manager
> CLI app to use podman & buildah through VirtualBox VM "seamlessly"

## Features
- Download and install OCM VirtualBox VM
- Expose Podman & Buildah commands seamlessly
- Automatic forwarding of the exposed port in the virtual machine from containers to host
- Automatic mount of the current directory in the virtual machine for build commands
- Persistent storage in separate VMDK (`~/.ocm/ocm-persistent.vmdk`)

## Limitations
- Only mount the current directory
- Podman `build` & Buildah `build-using-dockerfile`, `bud`, `add`, `copy`, `unshare` commands should be used with a relative path under current directory
- The `unshare` Buildah command called without argument does not mount the current directory
- Remove OCM virtual machine from VirtualBox __removes persistent storage__, detaches it before

## Install

```
$ npm -g i @open-container-manager/cli
```

or from source

```
$ npm run build
$ npm -g i file:$PWD
```


> Exposes four global commands : `ocm`, `podman`, `buildah` and `ocm-daemon`.

## Usage
### OCM
```
Usage:
  ocm [command]

Available commands:
  install     Download & install OCM VM
  status      Display the status of the OCM VM
  start       Start the OCM VM
  stop        Stop the OCM VM
  console     Open an interactive console
```

### Podman
```
Use "podman --help" for me information about command.
```

### Buildah
```
Use "buildah --help" for me information about command.
```

### OCM Daemon
Starts automatically in background with each of the above commands if it is not already active.

```
$ ocm-daemon
```

> Can be started manually before ocm `start` command for debugging purposes

## License

MIT © Tony Duburque
