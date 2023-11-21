const withNextIntl = require("next-intl/plugin")(
  "./app/internationalization/i18n.ts",
);

module.exports = withNextIntl({
  // Other Next.js configuration ...
});
