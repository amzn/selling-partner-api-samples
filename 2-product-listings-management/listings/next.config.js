const { NormalModuleReplacementPlugin } = require("webpack");
const withNextIntl = require("next-intl/plugin")(
  "./app/internationalization/i18n.ts",
);

module.exports = withNextIntl({
  webpack: (config) => {
    /** Fix known issue with formidable package
     * https://github.com/node-formidable/formidable/issues/960
     * I found a fix here https://github.com/pubnub/javascript/issues/352
     * The error comes from hexoid dependency not resolving in formidable package.
     * The NormalModuleReplacementPlugin allows you to replace resources that match
     * resourceRegExp with newResource.
     * require.resolve() uses the internal require() machinery to look up the
     * location of a module, but rather than
     * loading the module, just return the resolved filename.
     * Both methods combined helped resolve the package.
     **/

    config.plugins.push(
      new NormalModuleReplacementPlugin(
        /^hexoid$/,
        require.resolve("hexoid/dist/index.js"),
      ),
    );
    return config;
  },
});
