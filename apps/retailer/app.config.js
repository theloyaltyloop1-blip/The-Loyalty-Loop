// APP_VARIANT=test builds a separate "Business (Test)" app that installs next to
// the Play Store app, so changes can be tried on a real phone before release.
// It still talks to the live database; use disposable test shops only.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== "test") return config;
  const { googleServicesFile, ...android } = config.android;
  return {
    ...config,
    name: "Business (Test)",
    scheme: "loyaltyloop-business-test",
    // No google-services.json for this package, so push notifications are off.
    android: { ...android, package: "com.theloyaltyloop.retailer.test" },
  };
};
