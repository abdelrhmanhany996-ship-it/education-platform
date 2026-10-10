// electron-builder afterPack hook: turns off Electron features that would let someone run the app as plain
// Node, attach an inspector, or load code from outside the packaged app.
const path = require('path');
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

exports.default = async ctx => {
  const name = ctx.packager.appInfo.productFilename;
  const exe =
    ctx.electronPlatformName === 'darwin'
      ? path.join(ctx.appOutDir, `${name}.app`)
      : path.join(ctx.appOutDir, ctx.electronPlatformName === 'win32' ? `${name}.exe` : ctx.packager.executableName);
  await flipFuses(exe, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: ctx.electronPlatformName === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.EnableCookieEncryption]: true
  });
};
