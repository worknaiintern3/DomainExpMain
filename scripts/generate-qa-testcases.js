const path = require('path');
const { createXlsx } = require('./excel-generator');

const headers = [
  'Test Case ID',
  'Module Name',
  'Test Scenario',
  'Test Description',
  'Preconditions',
  'Test Data',
  'Execution Steps',
  'Expected Result',
  'Actual Result',
  'Status',
  'Priority',
  'Test Type',
  'Automation Feasibility'
];

// Helper to make test case row
function tc(id, module, scenario, desc, pre, data, steps, expected, priority, type, auto) {
  return [
    id,
    module,
    scenario,
    desc,
    pre,
    data,
    steps,
    expected,
    '', // Actual Result (initially blank)
    'Not Executed',
    priority,
    type,
    auto
  ];
}

// 1. Authentication
const authRows = [
  headers,
  tc('TC-AUTH-01', 'Authentication', 'Valid Admin Login', 'Verify successful login with valid admin credentials', 'User exists with SUPER_ADMIN role', 'admin@domainpulse.io / ValidPass123!', '1. Navigate to /\n2. Open login modal\n3. Enter email & password\n4. Click Submit', 'User is authenticated, token stored in localStorage, Platform Overview page rendered', 'Critical', 'Functional', 'Yes (Automated)'),
  tc('TC-AUTH-02', 'Authentication', 'Invalid Password', 'Verify system rejects incorrect password', 'Registered admin user', 'admin@domainpulse.io / WrongPassword!', '1. Open login modal\n2. Enter correct email and wrong password\n3. Click Submit', 'Error banner "Authentication failed. Please verify credentials." displayed; no token stored', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-AUTH-03', 'Authentication', 'Empty Input Fields', 'Verify client-side validation on empty email/password', 'Admin login modal open', 'Email: "" / Password: ""', '1. Leave email and password blank\n2. Click Submit', 'HTML5 form validation triggers "Please fill out this field" or button remains disabled', 'Medium', 'UI', 'Yes (Automated)'),
  tc('TC-AUTH-04', 'Authentication', 'Invalid Email Format', 'Verify validation for malformed email strings', 'Admin login modal open', 'Email: "notanemail" / Password: "Password123!"', '1. Enter "notanemail"\n2. Click Submit', 'Form prevents submission with invalid email format message', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-AUTH-05', 'Authentication', 'Admin Logout', 'Verify Sign Out action clears tokens and session', 'Admin is logged in with valid token', 'N/A', '1. Click Sign Out in sidebar footer\n2. Check localStorage', 'localStorage token removed; page reloads and prompts for re-authentication', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-AUTH-06', 'Authentication', 'Session Auto-Refresh (401 Interceptor)', 'Verify client re-authenticates automatically when JWT expires', 'Active session with simulated expired token', 'Expired JWT Token', '1. Trigger protected API call with expired token\n2. Inspect network tab', 'Client intercepts 401, calls /api/v1/admin/platform/session, retrieves fresh token, and retries request', 'Critical', 'API / Security', 'Yes (Automated)'),
  tc('TC-AUTH-07', 'Authentication', 'Unauthorized User Role Access', 'Verify standard USER role cannot access admin APIs', 'User registered with USER role', 'user@domainpulse.io / UserPass123!', '1. Authenticate as USER\n2. Send request to /api/v1/admin/users', 'API returns 403 Forbidden with "Forbidden resource" or role restriction error', 'Critical', 'Security', 'Yes (Automated)'),
  tc('TC-AUTH-08', 'Authentication', 'Manual Token Injection', 'Verify manual JWT token injection via settings', 'Valid JWT token generated externally', 'Bearer eyJhbGciOi...', '1. Navigate to /settings\n2. Paste token into Token input\n3. Click Save Token', 'Token saved to localStorage, page refreshes, authenticated API calls succeed', 'Medium', 'Functional', 'Yes (Automated)')
];

// 2. Command Center (Platform Overview)
const overviewRows = [
  headers,
  tc('TC-CMD-01', 'Platform Overview', 'Initial Dashboard Load', 'Verify all platform stats cards load correctly', 'Admin authenticated', 'N/A', '1. Navigate to /\n2. Wait for API response', 'Platform Command Center renders with Total Users, Domains, Servers, and Devices metrics', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-CMD-02', 'Platform Overview', 'Real-Time Sync Button', 'Verify manual synchronization triggers data re-fetch', 'Admin on overview page', 'N/A', '1. Click "Sync Real-Time Data"\n2. Observe network request and UI', 'Button shows active state, GET /api/v1/admin/platform/stats is invoked, cards update', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-CMD-03', 'Platform Overview', 'System Health Indicators', 'Verify system health statuses are displayed accurately', 'API, MongoDB, and Worker running', 'N/A', '1. Scroll to System Health card\n2. Inspect latency, DB status, worker', 'Displays "Operational", API latency in ms, "Connected" for DB, and "Active" for worker', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-CMD-04', 'Platform Overview', 'Recent Audit Trail Feed', 'Verify recent administrator actions display in feed', 'At least 1 audit event exists', 'N/A', '1. Review "Recent Audit Trail" table on overview page', 'Shows latest 5 audit entries with timestamp, action category, target, and IP address', 'Medium', 'UI', 'Yes (Automated)'),
  tc('TC-CMD-05', 'Platform Overview', 'KPI Deep Navigation Links', 'Verify clicking KPI cards navigates to corresponding modules', 'Admin on overview page', 'N/A', '1. Click "Total Users" card\n2. Click "Monitored Domains" card\n3. Click "Cloud Servers" card', 'Navigates to /users?tab=all, /domains, and /servers respectively', 'Low', 'UI / Navigation', 'Yes (Automated)'),
  tc('TC-CMD-06', 'Platform Overview', 'API Failure Fallback State', 'Verify graceful degradation if stats API fails', 'Network disconnected or API mock 500', 'HTTP 500 error', '1. Block /api/v1/admin/platform/stats\n2. Reload page', 'UI shows loading spinner or empty graceful message without unhandled crashes', 'Medium', 'Regression', 'Yes (Automated)')
];

// 3. Users Management
const usersRows = [
  headers,
  tc('TC-USR-01', 'Users Management', 'Load All Users Table', 'Verify all registered users are listed in the table', 'Users exist in database', 'N/A', '1. Navigate to /users?tab=all\n2. Verify table content', 'Table renders users with Name, Email, Role, Status, Plan, and Web/Mobile badges', 'Critical', 'Functional', 'Yes (Automated)'),
  tc('TC-USR-02', 'Users Management', 'Tab Filtering (Web SaaS Users)', 'Verify switching to "Website Users" tab filters list', 'Users with domain/server assets exist', 'Tab: web', '1. Click "Website Users" tab (/users?tab=web)\n2. Inspect list', 'Only users with web infrastructure assets or type="web" / "both" are displayed', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-USR-03', 'Users Management', 'Tab Filtering (Mobile App Users)', 'Verify switching to "Mobile Users" tab filters list', 'Users with registered mobile devices exist', 'Tab: mobile', '1. Click "Mobile Users" tab (/users?tab=mobile)\n2. Inspect list', 'Only users with mobile devices, push tokens, or type="mobile" / "both" are displayed', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-USR-04', 'Users Management', 'Search by Name / Email / ID', 'Verify real-time search query filtering', 'Target user: testuser@example.com', 'Search: "testuser"', '1. Enter "testuser" into search input\n2. Observe table update', 'Table immediately filters rows to match testuser without full page reload', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-USR-05', 'Users Management', 'Role Filter Dropdown', 'Verify filtering by role (SUPER_ADMIN, ADMIN, USER)', 'Users with varying roles exist', 'Role: ADMIN', '1. Select "ADMIN" in role filter dropdown\n2. Inspect table', 'Only users with platformRole="ADMIN" are displayed', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-USR-06', 'Users Management', 'Status Filter Dropdown', 'Verify filtering by user account status (Active / Suspended)', 'Suspended user exists', 'Status: suspended', '1. Select "Suspended" in status filter\n2. Inspect table', 'Only suspended accounts appear in table with red status badges', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-USR-07', 'Users Management', 'User Detail Modal Deep Inspection', 'Verify clicking user row opens 360-degree modal', 'Target user exists', 'User ID: usr_123', '1. Click row of target user\n2. Verify modal tabs', 'Modal opens displaying Overview, Web Assets, Mobile Devices, Active Sessions, and Direct Notify tabs', 'High', 'UI / Functional', 'Yes (Automated)'),
  tc('TC-USR-08', 'Users Management', 'Suspend User Account', 'Verify admin can suspend an active user with reason', 'Target user status: active', 'Reason: "Payment chargeback dispute"', '1. Open User Modal -> Security tab\n2. Toggle status to Suspended\n3. Enter reason and confirm', 'User status becomes "suspended", PATCH /api/v1/admin/users/:id succeeds, toast confirms', 'Critical', 'Functional', 'Yes (Automated)'),
  tc('TC-USR-09', 'Users Management', 'Reactivate Suspended User', 'Verify admin can reinstate suspended user', 'Target user status: suspended', 'N/A', '1. Open User Modal -> Security tab\n2. Toggle status to Active\n3. Save changes', 'User status returns to "active", user can authenticate on web/mobile apps', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-USR-10', 'Users Management', 'Update User Role', 'Verify promoting user to ADMIN or SUPPORT', 'Target user role: USER', 'New Role: ADMIN', '1. Open User Modal -> Security tab\n2. Select role "ADMIN"\n3. Click Save Changes', 'User role updates to ADMIN in table and DB; permission privileges take effect immediately', 'High', 'Security', 'Yes (Automated)'),
  tc('TC-USR-11', 'Users Management', 'Revoke All User Sessions', 'Verify immediate termination of active refresh tokens', 'User has 2 active sessions', 'N/A', '1. Open User Modal -> Active Sessions tab\n2. Click "Revoke All Sessions"', 'POST /api/v1/admin/users/:id/revoke-sessions called; sessions cleared from list; user forced to re-login', 'Critical', 'Security', 'Yes (Automated)'),
  tc('TC-USR-12', 'Users Management', 'Dispatch Direct Push/In-App Notification', 'Verify sending custom message to single user', 'User has registered mobile device', 'Title: "Alert", Body: "Action required"', '1. Open User Modal -> Direct Notification tab\n2. Enter Title and Message\n3. Click Send Notification', 'Notification queued to FCM/Expo, success toast displayed, entry logged in audit trail', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-USR-13', 'Users Management', 'Delete User Account', 'Verify permanent deletion of user and related assets', 'Disposable test user', 'User ID: usr_del_test', '1. Open User Modal -> Security tab\n2. Click "Delete User"\n3. Confirm danger prompt', 'DELETE /api/v1/admin/users/:id succeeds; modal closes; user removed from table', 'Critical', 'Functional', 'Manual / Careful Auto'),
  tc('TC-USR-14', 'Users Management', 'Prevent Self-Deletion', 'Verify current logged-in admin cannot delete their own account', 'Admin logged in', 'Current Admin ID', '1. Open modal for currently logged-in admin\n2. Check delete option', 'Delete action is disabled or API returns 400 Bad Request "Cannot delete self"', 'High', 'Security', 'Yes (Automated)')
];

// 4. Website Platform (Domains & Servers)
const webPlatformRows = [
  headers,
  tc('TC-DOM-01', 'All Domains & SSL', 'Load Domains Registry', 'Verify all registered domains across all users load', 'Domains exist in database', 'N/A', '1. Navigate to /domains\n2. Verify table columns', 'Lists domain name, owner email, registrar name, expiry date, and SSL status badge', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-DOM-02', 'All Domains & SSL', 'Search Domains by Name', 'Verify filtering domains by partial string or TLD', 'Domain: example.com', 'Search: "example"', '1. Type "example" into search field\n2. Observe filtered list', 'Only domains matching "example" are shown', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-DOM-03', 'All Domains & SSL', 'Status Filter (Active vs Expiring)', 'Verify filtering by expiry status threshold', 'Domains with varying expiry dates', 'Status: expiring', '1. Select "Expiring Soon" in status dropdown\n2. Verify results', 'Only domains expiring in < 30 days are displayed with warning styling', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-DOM-04', 'All Domains & SSL', 'SSL Health Indicators', 'Verify SSL status badges (valid, expiring, expired, missing)', 'Certificates in various states', 'N/A', '1. Inspect SSL column icons', 'Valid certificates show green lock; expired show red broken lock', 'Medium', 'UI', 'Yes (Automated)'),
  tc('TC-SRV-01', 'Infrastructure Nodes', 'Load Monitored Servers', 'Verify all cloud servers and VPS instances are listed', 'Servers exist in DB', 'N/A', '1. Navigate to /servers\n2. Check table data', 'Displays Server Name, Hostname, IPv4, Operating System, Health, and Uptime %', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-SRV-02', 'Infrastructure Nodes', 'Ping All Nodes Button', 'Verify manual telemetry refresh triggers live ping checks', 'Active server nodes', 'N/A', '1. Click "Ping All Nodes"\n2. Observe response', 'Button shows spinning icon, calls GET /api/v1/admin/platform/servers, updates last seen ping', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-SRV-03', 'Infrastructure Nodes', 'Search Servers by IP / Hostname', 'Verify server search filter', 'Target IP: 198.51.100.24', 'Search: "198.51"', '1. Enter IP prefix in search input\n2. Verify filtered rows', 'Table immediately filters to matching IP address', 'Low', 'Functional', 'Yes (Automated)')
];

// 5. Mobile Application Management
const mobileRows = [
  headers,
  tc('TC-MOB-01', 'Mobile Fleet', 'Load Device Fleet', 'Verify active mobile devices are displayed with OS telemetry', 'Mobile users exist', 'N/A', '1. Navigate to /mobile-fleet\n2. Check device cards', 'Shows device model, OS (iOS/Android), app version, owner email, and active status', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-MOB-02', 'Mobile Fleet', 'OS Platform Filtering', 'Verify filtering devices by iOS vs Android', 'Both iOS and Android devices exist', 'Filter: ios', '1. Select "iOS Devices" filter\n2. Select "Android Devices" filter', 'Table filters strictly to the selected operating system hardware', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-MOB-03', 'Mobile Fleet', 'Push Broadcast to All Devices', 'Verify sending global push notification to all mobile installs', 'FCM/Expo push tokens exist', 'Title: "Update", Message: "New features live"', '1. Click "Broadcast Push Notification"\n2. Enter Title and Message\n3. Click Send Broadcast', 'POST /api/v1/admin/users/broadcast executed; modal shows recipient count; banner confirms delivery', 'Critical', 'Functional', 'Yes (Automated)'),
  tc('TC-MOB-04', 'Mobile Fleet', 'Push Broadcast Validation', 'Verify validation on empty title/body in broadcast modal', 'Broadcast modal open', 'Title: "" / Message: ""', '1. Leave fields blank\n2. Click Send Broadcast', 'Form prevents submission, highlights required fields', 'Low', 'UI', 'Yes (Automated)'),
  tc('TC-MOB-05', 'Branding & Theme', 'Update Application Name OTA', 'Verify changing app name updates mobile branding', 'Admin on /appearance', 'Name: "DomainExpert Pro"', '1. Navigate to /appearance\n2. Change Application Name\n3. Click Save Changes', 'PATCH /api/v1/admin/mobile/config succeeds; live preview updates; toast confirms save', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-MOB-06', 'Branding & Theme', 'Update Brand Accent Colors', 'Verify primary/secondary hex color validation and update', 'Admin on /appearance', 'Primary: #38bdf8, Secondary: #00040f', '1. Pick valid hex colors\n2. Click Save Changes', 'Colors update in live preview and persist in backend config', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-MOB-07', 'Branding & Theme', 'Invalid Hex Color Validation', 'Verify rejection of malformed hex color codes', 'Admin on /appearance', 'Color: "invalid-hex"', '1. Enter "invalid-hex"\n2. Click Save Changes', 'Client or backend Zod schema rejects input with regex error /^#[0-9a-fA-F]{6}$/', 'Medium', 'Functional / Security', 'Yes (Automated)'),
  tc('TC-MOB-08', 'Branding & Theme', 'Emergency Maintenance Mode Kill-Switch', 'Verify toggling maintenance mode blocks mobile apps', 'Admin on /appearance', 'Maintenance: true, Message: "System upgrade"', '1. Toggle Maintenance Mode ON\n2. Enter message\n3. Save\n4. Open mobile app', 'Mobile app displays non-dismissible MaintenanceBarrier overlay preventing access', 'Critical', 'Functional / Security', 'Yes (Automated)'),
  tc('TC-MOB-09', 'Feature Flags', 'Toggle Feature Flag', 'Verify enabling/disabling a feature flag remotely', 'Feature: cloud_server_telemetry', 'Toggle ON / OFF', '1. Navigate to /features\n2. Click toggle switch for cloud_server_telemetry\n3. Observe toast', 'PATCH /api/v1/admin/mobile/features/:key called; toggle state flips; mobile client receives updated flag', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-MOB-10', 'Home Screen Layout', 'Reorder Sections (Move Up / Down)', 'Verify drag or button reordering of mobile home sections', 'Admin on /home-layout', 'Sections: hero_metrics, recent_activity', '1. Click "Move Down" on hero_metrics\n2. Click "Save Layout"', 'PUT /api/v1/admin/mobile/home called with updated sortOrder integers; saved successfully', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-MOB-11', 'Navigation Tabs', 'Reorder and Toggle Bottom Tabs', 'Verify updating mobile navigation tab structure', 'Admin on /navigation', 'Tab: domains (Move Up)', '1. Move Domains tab above Dashboard\n2. Toggle Alerts tab to disabled\n3. Save Navigation', 'Navigation array updated in DB; mobile app renders tabs in new order and hides disabled tabs', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-MOB-12', 'Announcements', 'Create New Announcement Banner', 'Verify creating and scheduling an in-app banner', 'Admin on /announcements', 'Title: "Flash Sale", Type: "promo", URL: "/pricing"', '1. Fill in Announcement Title, Message, Type, and Action URL\n2. Click Publish Announcement', 'Announcement added to list with Active badge; mobile apps fetch and display top alert banner', 'High', 'Functional', 'Yes (Automated)'),
  tc('TC-MOB-13', 'Announcements', 'Delete Announcement', 'Verify deleting an existing announcement banner', 'Existing announcement exists', 'ID: ann_123', '1. Click Trash icon on announcement card\n2. Confirm deletion', 'DELETE /api/v1/admin/mobile/announcements/:id succeeds; card removed from list immediately', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-MOB-14', 'App Versions', 'Enforce Minimum Version Policy', 'Verify updating minimum version policy for Android/iOS', 'Admin on /versions', 'Platform: android, MinVersion: "1.0.5", ForceUpdate: true', '1. Set Minimum Version to "1.0.5"\n2. Check Force Update\n3. Click Save Policies', 'PUT /api/v1/admin/mobile/versions/android succeeds; mobile clients on < 1.0.5 display blocking update modal', 'Critical', 'Functional', 'Yes (Automated)')
];

// 6. System & Audit Logs
const systemRows = [
  headers,
  tc('TC-SYS-01', 'Audit Logs', 'Verify Immutable Admin Audit Entry', 'Verify every admin modification produces an audit record', 'Perform any update (e.g. toggle feature flag)', 'Action: UPDATE_FEATURE_FLAG', '1. Toggle any feature flag\n2. Navigate to /audit-logs\n3. Check top entry', 'New row exists showing Action, Target, IP Address, Timestamp, and Admin ID', 'High', 'Security / Audit', 'Yes (Automated)'),
  tc('TC-SYS-02', 'Audit Logs', 'Audit Trail Refresh', 'Verify refresh button loads newest audit entries', 'Admin on /audit-logs', 'N/A', '1. Click "Refresh" button\n2. Inspect network request', 'Calls GET /api/v1/admin/mobile/audit-logs and updates list with loading spinner indicator', 'Low', 'UI', 'Yes (Automated)'),
  tc('TC-SYS-03', 'Preferences & Settings', 'Theme Switching (Dark / Light / System)', 'Verify theme changes dynamically and persists', 'Admin on /settings', 'Themes: Light, Dark, System', '1. Select Dark Theme\n2. Select Light Theme\n3. Refresh browser', 'html tag class updates to "dark" or "light"; preference persists across page reloads', 'Low', 'UI', 'Yes (Automated)'),
  tc('TC-SYS-04', 'Preferences & Settings', 'Purge Admin Cache & Resync', 'Verify clearing cached tokens and legacy localStorage keys', 'Admin on /settings', 'N/A', '1. Click "Clear Admin Cache & Resync"\n2. Confirm dialog', 'Removes legacy keys, forces re-sync with MongoDB Atlas, and reloads page smoothly', 'Medium', 'Functional', 'Yes (Automated)'),
  tc('TC-SYS-05', 'Global Navigation', 'Global Search Shortcut (Ctrl+K / Cmd+K)', 'Verify keyboard shortcut opens global command palette', 'Admin on any page', 'Keys: Ctrl+K or Cmd+K', '1. Press Ctrl+K\n2. Type "domains"\n3. Press Enter', 'Search modal opens, displays filtered pages/users, and navigates upon selection', 'Low', 'UI', 'Yes (Automated)')
];

// 7. Security & Edge Cases
const securityRows = [
  headers,
  tc('TC-SEC-01', 'Security', 'Unauthenticated Admin Access (401)', 'Verify accessing admin routes without token redirects or fails', 'No token in localStorage', 'N/A', '1. Clear token\n2. Send GET to /api/v1/admin/users', 'API returns 401 Unauthorized; UI prompts login modal', 'Critical', 'Security', 'Yes (Automated)'),
  tc('TC-SEC-02', 'Security', 'Unauthorized Role Access (403 Forbidden)', 'Verify standard user token cannot query admin APIs', 'JWT token with role: "USER"', 'N/A', '1. Set Bearer token to user token\n2. Call GET /api/v1/admin/platform/stats', 'Returns 403 Forbidden with "Forbidden resource" error', 'Critical', 'Security', 'Yes (Automated)'),
  tc('TC-SEC-03', 'Security', 'IDOR Prevention on User Updates', 'Verify admin role is required to modify other user accounts', 'Target user: usr_victim', 'Body: { status: "suspended" }', '1. Attempt to PATCH /api/v1/admin/users/usr_victim with standard user token', 'Request rejected with 403 Forbidden; account cannot be tampered with by non-admins', 'Critical', 'Security', 'Yes (Automated)'),
  tc('TC-SEC-04', 'Security', 'XSS Injection Prevention in Announcement Title', 'Verify script tags in announcement titles are sanitized', 'Title: "<script>alert(1)</script>"', 'Payload: "<script>alert(1)</script>"', '1. Create announcement with script payload\n2. Inspect rendered card in DOM', 'Script tags are escaped and rendered as text string; no script execution occurs', 'Critical', 'Security', 'Yes (Automated)'),
  tc('TC-SEC-05', 'Security', 'NoSQL Injection in User Search', 'Verify MongoDB queries resist object injection in search param', 'Search: "{\"$ne\": null}"', 'Payload: "{\"$ne\": null}"', '1. Send search query with regex/object injection string\n2. Observe response', 'Treated as literal string query; does not dump database or cause syntax errors', 'High', 'Security', 'Yes (Automated)'),
  tc('TC-SEC-06', 'Security', 'Sensitive Password & Secret Leakage Check', 'Verify API responses never expose password hashes or secrets', 'GET /api/v1/admin/users', 'N/A', '1. Fetch users list\n2. Inspect JSON response for "password", "passwordHash", "secret"', 'Sensitive credential fields are strictly omitted from response serialization', 'Critical', 'Security', 'Yes (Automated)')
];

const allSheets = [
  { name: 'Authentication', rows: authRows },
  { name: 'Command Center', rows: overviewRows },
  { name: 'Users Management', rows: usersRows },
  { name: 'Web Platform', rows: webPlatformRows },
  { name: 'Mobile App Management', rows: mobileRows },
  { name: 'System & Audit Logs', rows: systemRows },
  { name: 'Security & Edge Cases', rows: securityRows }
];

const targetFile = path.join(__dirname, '../QA_Documentation/QA_TEST_CASES.xlsx');
createXlsx(targetFile, allSheets);
console.log('Successfully generated QA_TEST_CASES.xlsx with 7 module sheets!');
