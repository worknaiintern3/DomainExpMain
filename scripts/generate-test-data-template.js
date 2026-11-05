const path = require('path');
const { createXlsx } = require('./excel-generator');

const usersDataset = [
  ['Dataset ID', 'Category', 'Email', 'Role', 'Status', 'Plan', 'Simulated Assets', 'Purpose'],
  ['DATA-USR-01', 'Valid SuperAdmin', 'qa-superadmin@domainpulse.io', 'SUPER_ADMIN', 'active', 'Enterprise', 'All permissions', 'Full access administration'],
  ['DATA-USR-02', 'Standard Admin', 'qa-admin@domainpulse.io', 'ADMIN', 'active', 'Pro', 'Support & Config permissions', 'General administrative testing'],
  ['DATA-USR-03', 'Support Staff', 'qa-support@domainpulse.io', 'SUPPORT', 'active', 'Pro', 'Read-only & User notify', 'Limited tier administration'],
  ['DATA-USR-04', 'Standard User', 'qa-user@domainpulse.io', 'USER', 'active', 'Free', '0 domains, 0 servers', 'Testing 403 Forbidden barriers'],
  ['DATA-USR-05', 'Web Heavy User', 'web-architect@company.com', 'USER', 'active', 'Enterprise', '24 domains, 6 cloud servers', 'Testing large asset tables in User Modal'],
  ['DATA-USR-06', 'Mobile Heavy User', 'mobile-tester@pixel.device', 'USER', 'active', 'Pro', '3 mobile devices (Pixel, Galaxy, iPhone)', 'Testing device fleet & push token rendering'],
  ['DATA-USR-07', 'Suspended User', 'abusive-user@spammer.org', 'USER', 'suspended', 'Free', '1 expired domain', 'Testing reactivation & suspension barriers'],
  ['DATA-USR-08', 'Unicode / Emoji User', 'alex. Müller_üñîçødé@test.de', 'USER', 'active', 'Free', 'None', 'Testing UTF-8 name and email handling'],
  ['DATA-USR-09', 'SQL / NoSQL Injection', '\' OR 1=1 -- admin@domain.com', 'USER', 'active', 'Free', 'None', 'Security input sanitization validation'],
  ['DATA-USR-10', 'XSS Injection User', '<script>alert("XSS")</script>@test.com', 'USER', 'active', 'Free', 'None', 'HTML sanitization validation']
];

const mobileConfigDataset = [
  ['Setting Field', 'Valid Test Input', 'Invalid Test Input', 'Boundary / Edge Case', 'Expected Validation Behavior'],
  ['appName', 'DomainExpert Pro', '', 'A'.repeat(100), 'String between 1 and 100 characters'],
  ['primaryColor', '#38bdf8', '#ZZZZZZ, red, 123456', '#FFFFFF, #000000', 'Strict hex regex /^#[0-9a-fA-F]{6}$/'],
  ['secondaryColor', '#00040f', 'rgb(0,4,15)', '#0F172A', 'Strict hex regex /^#[0-9a-fA-F]{6}$/'],
  ['maintenanceMode', 'true / false', '"yes", 1, null', 'true (with active users)', 'Boolean flag; activates barrier overlay'],
  ['maintenanceMessage', 'Scheduled maintenance until 04:00 UTC', '<script>alert(1)</script>', 'A'.repeat(500), 'Nullable text string up to 500 characters'],
  ['logoUrl', 'https://domainexpert.io/logo.png', 'invalid-url, ftp://bad', 'null (clears logo)', 'Nullable valid URL string']
];

const announcementsDataset = [
  ['ID', 'Title', 'Message', 'Type', 'Action URL', 'Action Label', 'Expected Rendering'],
  ['DATA-ANN-01', 'System Upgrade Notice', 'We are updating server clusters tonight at 02:00 UTC.', 'info', 'https://status.domainpulse.io', 'View Status', 'Blue badge banner at top of mobile screen'],
  ['DATA-ANN-02', 'Urgent Security Patch', 'Please update your mobile app to version 1.0.5 immediately.', 'critical', 'https://play.google.com/store/apps/details?id=com.domainpulse.mobile', 'Update Now', 'Red alert banner with high visual priority'],
  ['DATA-ANN-03', 'Black Friday Deal', 'Get 50% off enterprise domain monitoring plans this week only.', 'promo', '/plans', 'Claim 50% Off', 'Emerald promotional card with in-app deep link'],
  ['DATA-ANN-04', 'Scheduled Downtime', 'DNS sync will be temporarily delayed for 15 minutes.', 'warning', '', '', 'Amber warning card without external action button']
];

const versionPoliciesDataset = [
  ['Platform', 'Minimum Version', 'Latest Version', 'Force Update', 'Update URL', 'Test Scenario'],
  ['android', '1.0.4', '1.0.5', 'false', 'https://play.google.com/store/apps/details?id=com.domainpulse.mobile', 'Soft recommendation update prompt'],
  ['android', '1.0.5', '1.0.5', 'true', 'https://play.google.com/store/apps/details?id=com.domainpulse.mobile', 'Hard barrier: clients below 1.0.5 completely blocked'],
  ['ios', '1.0.3', '1.0.5', 'false', 'https://apps.apple.com/app/id123456789', 'iOS soft update notification']
];

const sheets = [
  { name: 'Test Users Dataset', rows: usersDataset },
  { name: 'Mobile Config Data', rows: mobileConfigDataset },
  { name: 'Announcements Data', rows: announcementsDataset },
  { name: 'Version Policies Data', rows: versionPoliciesDataset }
];

const targetFile = path.join(__dirname, '../QA_Documentation/TEST_DATA_TEMPLATE.xlsx');
createXlsx(targetFile, sheets);
console.log('Successfully generated TEST_DATA_TEMPLATE.xlsx!');
