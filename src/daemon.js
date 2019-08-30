#!/usr/bin/env node

import Server from './class/Daemon/Server';

const daemon = new Server();
daemon.start();
