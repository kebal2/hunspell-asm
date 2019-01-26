import { ENVIRONMENT, getModuleLoader, isNode } from 'emscripten-wasm-loader';
import { HunspellAsmModule } from './HunspellAsmModule';
import { HunspellFactory } from './HunspellFactory';
import { hunspellLoader } from './hunspellLoader';
import { log } from './util/logger';

/**
 * Load, initialize wasm binary to use actual cld wasm instances.
 *
 * @param [InitOptions] Options to initialize cld3 wasm binary.
 * @param {number} [InitOptions.timeout] - timeout to wait wasm binary compilation & load.
 * @param {string | object} [InitOptions.locateBinary] - custom resolution logic for wasm binary.
 * @param {ENVIRONMENT} [InitOptions.environment] For overriding running environment
 * It could be either remote endpoint url, or loader-returned object for bundler. Check examples/browser_* for references.
 *
 * @returns {() => Promise<CldFactory>} Function to load module
 */
const loadModule = async ({
  timeout,
  locateBinary,
  environment
}: Partial<{
  timeout: number;
  locateBinary: (filePath: string) => string | object;
  environment?: ENVIRONMENT;
}> = {}) => {
  const env = environment ? environment : isNode() ? ENVIRONMENT.NODE : ENVIRONMENT.WEB;

  log(`loadModule: loading hunspell module`, { env });

  //imports MODULARIZED emscripten preamble
  //tslint:disable-next-line:no-require-imports no-var-requires
  const runtimeModule = require(`./lib/hunspell`);

  //tslint:disable-next-line:no-require-imports no-var-requires
  const lookupBinary = locateBinary || ((_filePath: string) => require('./lib/hunspell.wasm'));

  //Build module object to construct wasm binary module via emscripten preamble.
  //This allows to override default wasm binary resolution in preamble.
  //By default, hunspell-asm overrides to direct require to binary on *browser* environment to allow bundler like webpack resolves it.
  //On node, it relies on default resolution logic.
  const overriddenModule =
    isNode() && !locateBinary
      ? undefined
      : {
          locateFile: (filePath: string) => (filePath.endsWith('.wasm') ? lookupBinary(filePath) : filePath)
        };

  const moduleLoader = await getModuleLoader<HunspellFactory, HunspellAsmModule>(
    (runtime: HunspellAsmModule) => hunspellLoader(runtime, env),
    runtimeModule,
    overriddenModule,
    { timeout }
  );

  return moduleLoader();
};

export { loadModule };
