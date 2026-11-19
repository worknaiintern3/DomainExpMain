const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to mark screen orientation hardware features as optional.
 * This resolves the Google Play Console requirement:
 * "android.hardware.screen.portrait affects Phone, Tablet, Desktop, and Android XR users
 * To expand your app's availability, mark non-essential hardware features as optional in your app's manifest."
 */
function withOptionalScreenFeatures(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const manifest = androidManifest.manifest;

    if (!manifest.$) {
      manifest.$ = {};
    }
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    const featuresToAdd = [
      'android.hardware.screen.portrait',
      'android.hardware.screen.landscape',
    ];

    for (const featureName of featuresToAdd) {
      const existing = manifest['uses-feature'].find(
        (item) => item.$ && item.$['android:name'] === featureName
      );
      if (existing) {
        existing.$['android:required'] = 'false';
        existing.$['tools:replace'] = 'android:required';
      } else {
        manifest['uses-feature'].push({
          $: {
            'android:name': featureName,
            'android:required': 'false',
            'tools:replace': 'android:required',
          },
        });
      }
    }

    return config;
  });
}

module.exports = withOptionalScreenFeatures;

