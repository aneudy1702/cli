#!/usr/bin/env node

import Daemon from './class/Daemon';

const daemon = new Daemon();
daemon.start();
