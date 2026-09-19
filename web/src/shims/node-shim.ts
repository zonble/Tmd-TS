// Browser shims for node:* modules used in CLI/server features
export const normalize = (p: string) => p;
export const join = (...args: string[]) => args.filter(Boolean).join('/');
export const resolve = (...args: string[]) => args.filter(Boolean).join('/');
export const dirname = (p: string) => p.split('/').slice(0, -1).join('/') || '.';
export const homedir = () => '/';
export const readFileSync = () => { throw new Error('readFileSync is not supported in the browser'); };
export const writeFileSync = () => { throw new Error('writeFileSync is not supported in the browser'); };
export const mkdirSync = () => { throw new Error('mkdirSync is not supported in the browser'); };
export const existsSync = () => false;

export default {
  normalize,
  join,
  resolve,
  dirname,
  homedir,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
};
