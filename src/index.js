import Err from 'err';
import deasync from 'deasync';
import isPromise from 'is-promise';
import path from 'path';
import pkgDir from 'pkg-dir';
import Filesystem from './filesystem';
import Socket from './socket';

const rootPath = pkgDir.sync(process.cwd()) || process.cwd();

export default class MultithreadConfig {
  constructor(options) {
    this.options = {
      socket: true,
      sync: false,
      timeout: 100,
      name:
        require(path.resolve(rootPath, 'package.json')).name || 'some-config',
      ...options
    };
    if (this.options.socket) {
      this.socket = new Socket(this.options);
      this.socket.onUpdate = config => this.onUpdate(config);
    } else {
      this.filesystem = new Filesystem(this.options);
      this.filesystem.onUpdate = config => this.onUpdate(config);
    }
  }

  set config(config) {
    return this.setConfigSync(config);
  }

  get config() {
    return this.getConfigSync();
  }

  get isStarted() {
    if (this.options.socket) return this.socket.isStarted;
    return this.filesystem.isStarted;
  }

  get transport() {
    if (this.socket) return this.socket;
    return this.filesystem;
  }

  setConfigSync(config = {}, name) {
    if (!this.options.sync) throw new Err('synchronous operations not enabled');
    let setConfigSync = (config, name) => {
      return this.filesystem.setConfigSync(config, name);
    };
    let isStartedSync = () => this.filesystem.isStartedSync();
    if (this.socket) {
      setConfigSync = deasync(async (config, name) =>
        this.socket.setConfig(config, name)
      );
      isStartedSync = deasync(async () => this.socket.isStarted());
    }
    if (isPromise(this.preProcess)) {
      throw new Err('synchronous operations not enabled');
    }
    if (!isStartedSync()) this.startSync();
    config = this.preProcess(config);
    return setConfigSync(config, name);
  }

  getConfigSync(name) {
    if (!this.options.sync) throw new Err('synchronous operations not enabled');
    let getConfigSync = name => this.filesystem.getConfigSync(name);
    let isStartedSync = () => this.filesystem.isStartedSync();
    if (this.socket) {
      getConfigSync = deasync(async name => this.socket.getConfig(name));
      isStartedSync = deasync(async () => this.socket.isStarted());
    }
    if (isPromise(this.postProcess)) {
      throw new Err('synchronous operations not enabled');
    }
    if (!isStartedSync()) this.startSync();
    const config = getConfigSync(name);
    return this.postProcess(config);
  }

  async setConfig(config = {}, name) {
    if (this.options.sync) throw new Err('asynchronous operations not enabled');
    if (!(await this.transport.isStarted())) await this.start();
    config = await this.preProcess(config);
    return this.transport.setConfig(config, name);
  }

  async getConfig(name) {
    if (this.options.sync) throw new Err('asynchronous operations not enabled');
    if (!(await this.transport.isStarted())) await this.start();
    let config = null;
    config = await this.transport.getConfig(name);
    return this.postProcess(config);
  }

  preProcess(config) {
    return config;
  }

  postProcess(config) {
    return config;
  }

  async start() {
    if (this.options.sync) throw new Err('asynchronous operations not enabled');
    if (this.socket) return this.socket.start();
    return this.filesystem.start();
  }

  startSync() {
    if (!this.options.sync) throw new Err('synchronous operations not enabled');
    if (this.socket) {
      const start = deasync(async () => this.socket.start());
      return start();
    }
    return this.filesystem.startSync();
  }

  onUpdate(config) {
    return config;
  }

  finish() {
    try {
      if (this.socket) return this.socket.finish();
      return this.filesystem.finish();
    } catch (err) {}
    return null;
  }
}
