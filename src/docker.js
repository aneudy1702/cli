#!/usr/bin/env node
"use strict";

var _v = _interopRequireDefault(require("uuid/v4"));

var _Cli = _interopRequireDefault(require("./class/Cli"));

var _VirtualBox = _interopRequireDefault(require("./class/Cli/VirtualBox"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _console = console,
    error = _console.error;
var input = process.argv.slice(2);

var args = _Cli["default"].escape(input).join(' ');

if (input.length > 1 && input[0] === 'build') {
  var id = (0, _v["default"])();

  _VirtualBox["default"].share('ocm', {
    name: id,
    hostpath: process.cwd(),
    readonly: true,
    "transient": true
  }).then(function () {
    return _Cli["default"].exec("mkdir -p /tmp/ocm-volatile/".concat(id));
  }).then(function () {
    return _Cli["default"].exec("sudo mount -t vboxsf -o gid=vboxsf ".concat(id, " /tmp/ocm-volatile/").concat(id));
  }).then(function () {
    return _Cli["default"].exec("cd /tmp/ocm-volatile/".concat(id, " && podman ").concat(args));
  }).then(function () {
    return _Cli["default"].exec("sudo umount /tmp/ocm-volatile/".concat(id));
  }).then(function () {
    return _Cli["default"].exec("rmdir /tmp/ocm-volatile/".concat(id));
  }).then(function () {
    return _VirtualBox["default"].unshare('ocm', {
      name: id,
      "transient": true
    });
  })["catch"](function (err) {
    error(err.message);
  });
}

if (input.length > 1 && input[0] === 'network') {
  _Cli["default"].exec("sudo docker ".concat(args))["catch"](function (err) {
    return error(err.message);
  });
} else {
  _Cli["default"].exec("docker ".concat(args))["catch"](function (err) {
    return error(err.message);
  });
}