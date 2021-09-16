/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export function rewriteExternalsPlugin(externals) {
  return {
    name: 'rollup-plugin-rewrite-externals',
    resolveId(source) {
      for (const ext of externals) {
        let regex;
        let id;
        if (Array.isArray(ext)) {
          regex = ext[0];
          id = ext[1] ?? source;
        } else {
          regex = ext;
          id = source;
        }
        if (
          (typeof regex === 'string' && regex === source) ||
          (typeof regex?.test === 'function' && regex.test(source))
        ) {
          return {id, external: true};
        }
      }
      return null;
    },
  };
}
