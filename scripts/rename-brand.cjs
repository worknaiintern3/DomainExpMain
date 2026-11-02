const fs = require('fs');

function replaceInFile(filePath, searchStr, replaceStr) {
  if (!fs.existsSync(filePath)) {
    console.warn('File not found:', filePath);
    return;
  }
  const original = fs.readFileSync(filePath, 'utf8');
  if (original.includes(searchStr)) {
    const updated = original.split(searchStr).join(replaceStr);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('Updated:', filePath);
  }
}

// 1. Mobile app.json
replaceInFile('apps/DomainExpMain/app.json', '"name": "DomainPulse"', '"name": "DomainExpert"');

// 2. Mobile store/remote-config-context.tsx
replaceInFile('apps/DomainExpMain/src/store/remote-config-context.tsx', "'DomainPulse'", "'DomainExpert'");
replaceInFile('apps/DomainExpMain/src/store/remote-config-context.tsx', 'DomainPulse Mobile', 'DomainExpert Mobile');

// 3. Mobile constants/config.ts
replaceInFile('apps/DomainExpMain/src/constants/config.ts', "APP_NAME: 'DomainPulse'", "APP_NAME: 'DomainExpert'");

// 4. Mobile HeaderBar.tsx
replaceInFile('apps/DomainExpMain/src/components/ui/HeaderBar.tsx', "title = 'DomainPulse'", "title = 'DomainExpert'");

// 5. Mobile LoadingIndicator.tsx
replaceInFile('apps/DomainExpMain/src/components/ui/LoadingIndicator.tsx', 'Loading DomainPulse data...', 'Loading DomainExpert data...');

// 6. Mobile AdminBarriers.tsx
replaceInFile('apps/DomainExpMain/src/components/AdminBarriers.tsx', "'DomainPulse'", "'DomainExpert'");

// 7. Mobile more.tsx
replaceInFile('apps/DomainExpMain/src/app/(tabs)/more.tsx', 'About DomainPulse', 'About DomainExpert');
replaceInFile('apps/DomainExpMain/src/app/(tabs)/more.tsx', "'DomainPulse'", "'DomainExpert'");
replaceInFile('apps/DomainExpMain/src/app/(tabs)/more.tsx', 'DomainPulse API', 'DomainExpert API');
replaceInFile('apps/DomainExpMain/src/app/(tabs)/more.tsx', 'DomainPulse Cloud Platform', 'DomainExpert Cloud Platform');

// 8. Mobile dashboard.tsx
replaceInFile('apps/DomainExpMain/src/app/(tabs)/dashboard.tsx', "'DomainPulse'", "'DomainExpert'");

// 9. Mobile index.tsx
replaceInFile('apps/DomainExpMain/src/app/index.tsx', "'DomainPulse'", "'DomainExpert'");
replaceInFile('apps/DomainExpMain/src/app/index.tsx', 'DomainPulse Hub', 'DomainExpert Hub');

// 10. Mobile auth screens
replaceInFile('apps/DomainExpMain/src/app/(auth)/login.tsx', 'Sign in to DomainPulse', 'Sign in to DomainExpert');
replaceInFile('apps/DomainExpMain/src/app/(auth)/register.tsx', 'DomainPulse portfolio intelligence', 'DomainExpert portfolio intelligence');

// 11. Mobile google-play.tsx
replaceInFile('apps/DomainExpMain/src/app/google-play.tsx', 'DomainPulse applications inventory', 'DomainExpert applications inventory');
replaceInFile('apps/DomainExpMain/src/app/google-play.tsx', 'Authorize DomainPulse with', 'Authorize DomainExpert with');

// 12. Mobile server/[id].tsx
replaceInFile('apps/DomainExpMain/src/app/server/[id].tsx', 'DomainPulse Web', 'DomainExpert Web');

// 13. Mobile services
replaceInFile('apps/DomainExpMain/src/services/applications.ts', "'DomainPulse Workspace'", "'DomainExpert Workspace'");
replaceInFile('apps/DomainExpMain/src/services/api.ts', 'DomainPulse API server', 'DomainExpert API server');

// 14. Web index.html
replaceInFile('apps/web/index.html', '<title>DomainPulse — Infrastructure &amp; Domain Portfolio Manager</title>', '<title>DomainExpert — Infrastructure &amp; Domain Portfolio Manager</title>');

// 15. Web LoginPage.tsx & ProtectedRoute.tsx
replaceInFile('apps/web/src/pages/LoginPage.tsx', 'New to DomainPulse?', 'New to DomainExpert?');
replaceInFile('apps/web/src/pages/LoginPage.tsx', 'alt="DomainPulse"', 'alt="DomainExpert"');
replaceInFile('apps/web/src/pages/LoginPage.tsx', 'DomainPulse\n            </div>', 'DomainExpert\n            </div>');
replaceInFile('apps/web/src/pages/LoginPage.tsx', 'DomainPulse\n              </div>', 'DomainExpert\n              </div>');
replaceInFile('apps/web/src/lib/auth/ProtectedRoute.tsx', 'alt="DomainPulse"', 'alt="DomainExpert"');

// 16. Web GooglePlayPage.tsx & GoogleCallbackPage.tsx
replaceInFile('apps/web/src/pages/GooglePlayPage.tsx', 'DomainPulse only reads the app list', 'DomainExpert only reads the app list');
replaceInFile('apps/web/src/pages/GoogleCallbackPage.tsx', 'DomainPulse session', 'DomainExpert session');

// 17. Web SecurityPage.tsx & OverviewPage.tsx
replaceInFile('apps/web/src/pages/SecurityPage.tsx', 'Manage how you sign in to DomainPulse.', 'Manage how you sign in to DomainExpert.');
replaceInFile('apps/web/src/pages/OverviewPage.tsx', "'DomainPulse Admin'", "'DomainExpert Admin'");

// 18. API privacy.controller.ts & google-play.controller.ts
replaceInFile('apps/api/src/privacy/privacy.controller.ts', 'DomainPulse', 'DomainExpert');
replaceInFile('apps/api/src/google-play/google-play.controller.ts', '<title>DomainPulse - Google Play Console</title>', '<title>DomainExpert - Google Play Console</title>');
replaceInFile('apps/api/src/google-play/google-play.controller.ts', 'connected to DomainPulse!', 'connected to DomainExpert!');
replaceInFile('apps/api/src/google-play/google-play.controller.ts', 'Return to DomainPulse App', 'Return to DomainExpert App');

// 19. API mobile-client.service.ts & mobile-admin.service.ts default appName
replaceInFile('apps/api/src/mobile-client/mobile-client.service.ts', "appName: 'DomainPulse'", "appName: 'DomainExpert'");
replaceInFile('apps/api/src/mobile-admin/mobile-admin.service.ts', "appName: 'DomainPulse'", "appName: 'DomainExpert'");
replaceInFile('apps/api/src/mobile-admin/mobile-admin.service.ts', "'DomainPulse Admin'", "'DomainExpert Admin'");

console.log('Brand renaming executed successfully.');
