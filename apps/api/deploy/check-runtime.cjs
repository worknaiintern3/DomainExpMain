// Validate compiled startup configuration without opening an HTTP port.
const parsers = [
  ['./dist/config/env.schema.js', 'parseEnvironment'],
  ['@domainpulse/database', 'parseDatabaseEnvironment'],
  ['@domainpulse/database', 'parseProviderCredentialEncryptionEnvironment'],
  ['./dist/auth/access-token/access-token.config.js', 'parseAccessTokenEnvironment'],
  ['./dist/auth/oauth/google-oauth.config.js', 'parseGoogleOAuthEnvironment'],
];
let failed = false;
for (const [module, parser] of parsers) {
  try {
    require(require.resolve(module, { paths: [process.cwd()] }))[parser](process.env);
  } catch (error) {
    console.error(`Runtime configuration failed: ${parser} (${error.name})`);
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
if (!failed) console.log('Compiled runtime configuration validated');
