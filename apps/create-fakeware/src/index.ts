#!/usr/bin/env node
import { runInit } from '@fakeware/cli/init'
import pkg from '../package.json' with { type: 'json' }

await runInit({ name: 'create-fakeware', version: pkg.version })
