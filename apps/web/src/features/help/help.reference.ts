import {
  QuickStartStep,
  StatusExplanationItem,
  DataFieldExplanation,
  FeatureGuideItem,
  FaqItem,
  TroubleshootingItem,
  DataLimitationItem,
  ProductMetadata,
} from './help.types';

export const QUICK_START_STEPS: QuickStartStep[] = [
  {
    step: 1,
    title: 'Add or import portfolio assets',
    description:
      'Record your existing domain names, VPS compute nodes, and web applications manually or via CSV/JSON import.',
    targetRoute: '/domains',
    targetLabel: 'My Domains',
    icon: 'add_circle',
  },
  {
    step: 2,
    title: 'Map emails to provider accounts',
    description:
      'Group registrar and cloud hosting accounts under your mapped administrative and billing email addresses.',
    targetRoute: '/accounts',
    targetLabel: 'Accounts & Emails',
    icon: 'alternate_email',
  },
  {
    step: 3,
    title: 'Map domains to websites/apps',
    description:
      'Link apex domains and subdomains to active websites, microservices, and production web applications.',
    targetRoute: '/websites',
    targetLabel: 'Websites & Apps',
    icon: 'web',
  },
  {
    step: 4,
    title: 'Map websites/apps to servers',
    description:
      'Associate web applications with their hosting VPS compute instances, server IP addresses, and runtime environments.',
    targetRoute: '/servers',
    targetLabel: 'VPS & Servers',
    icon: 'dns',
  },
  {
    step: 5,
    title: 'Review relationships in Infrastructure Map',
    description:
      'Inspect the complete end-to-end dependency graph connecting emails, accounts, domains, servers, websites, and projects.',
    targetRoute: '/infrastructure-map',
    targetLabel: 'Infrastructure Map',
    icon: 'hub',
  },
  {
    step: 6,
    title: 'Review stored expiry / SSL / DNS risks',
    description:
      'Examine upcoming domain expiration dates, SSL certificate renewal windows, and DNS resolution classifications.',
    targetRoute: '/alerts',
    targetLabel: 'Alerts & Monitoring',
    icon: 'notifications',
  },
  {
    step: 7,
    title: 'Use Find Domain and Price Comparison',
    description:
      'Explore available names across preferred TLDs and benchmark multi-year registrar renewal economics.',
    targetRoute: '/pricing',
    targetLabel: 'Price Comparison',
    icon: 'payments',
  },
];

export const STATUS_EXPLANATIONS: StatusExplanationItem[] = [
  {
    badgeLabel: 'Critical',
    statusType: 'critical',
    triggerCondition: 'Expires in ≤ 7 days',
    recommendedAction:
      'Review renewal options promptly to reduce the risk of expiration or service interruption.',
  },
  {
    badgeLabel: 'Warning',
    statusType: 'warning',
    triggerCondition: 'Expires in 8 to 30 days',
    recommendedAction:
      'Review the domain’s renewal status and confirm renewal arrangements with the registrar.',
  },
  {
    badgeLabel: 'Healthy',
    statusType: 'healthy',
    triggerCondition: 'Expires in > 30 days',
    recommendedAction:
      'No immediate expiry action is required. Review DNS, SSL and domain metadata as needed.',
  },
  {
    badgeLabel: 'Auto-Renew Off',
    statusType: 'neutral',
    triggerCondition: 'Recorded auto-renew = Off',
    recommendedAction:
      'Saved portfolio record indicates registrar automated recurring renewal is toggled off.',
  },
  {
    badgeLabel: 'Unknown',
    statusType: 'unknown',
    triggerCondition: 'RDAP query unconfirmed or redacted',
    recommendedAction:
      'The authoritative registry timed out or redacted expiry timestamp. Review DNS or refresh record.',
  },
];

export const DOMAIN_DATA_SPECS: DataFieldExplanation[] = [
  {
    name: 'Registrar',
    category: 'Entity',
    protocolTag: 'RDAP / WHOIS',
    description:
      'The accredited commercial or institutional organization managing the domain registration record with the upstream registry.',
  },
  {
    name: 'Registration Date',
    category: 'Timestamp',
    protocolTag: 'ISO 8601 UTC',
    description:
      'The timestamp identifying when the domain was first initialized in the registry database, establishing portfolio asset age.',
  },
  {
    name: 'Expiry Date',
    category: 'Countdown',
    protocolTag: 'Registry Deadline',
    description:
      'The definitive registry deadline when the active delegation term terminates. Used to compute Critical (≤7d) and Warning (8–30d) horizons.',
  },
  {
    name: 'Nameservers',
    category: 'DNS Delegation',
    protocolTag: 'NS Records',
    description:
      'Authoritative DNS hostnames tasked with answering zone queries and resolving your web applications, mail exchanges, and API endpoints.',
  },
  {
    name: 'DNSSEC',
    category: 'Security Extension',
    protocolTag: 'RFC 4033-4035',
    description:
      'Domain Name System Security Extensions. Uses cryptographic digital signatures to verify that resolver query responses have not been spoofed.',
  },
  {
    name: 'RDAP Protocol',
    category: 'Registry Feed',
    protocolTag: 'RFC 7480-7484',
    description:
      'Registration Data Access Protocol. The modern RESTful JSON standard delivering structured, machine-verifiable status flags and dates.',
  },
  {
    name: 'WHOIS Legacy',
    category: 'Legacy Query',
    protocolTag: 'Port 43 TCP',
    description:
      'A legacy registration-data protocol that may be used where compatible data is available.',
  },
  {
    name: 'SSL Certificate',
    category: 'TLS Inspection',
    protocolTag: 'X.509 TLS 1.3',
    description:
      'Certificate metadata may be inspected from an accessible HTTPS endpoint, commonly over port 443. Available fields can include issuer, validity dates, common name, SAN coverage, and expiration information.',
  },
];

export const DATA_SOURCES_DETAILS = [
  {
    id: 'rdap-whois',
    title: 'RDAP / WHOIS',
    tag: 'Registry Protocol',
    icon: 'dataset',
    description:
      'Registration metadata may be retrieved where registry or registrar data is publicly available. Available fields vary by registry, registrar, privacy policy and TLD.',
  },
  {
    id: 'dns',
    title: 'DNS',
    tag: 'Zone Resolution',
    icon: 'dns',
    description:
      'DNS data may include publicly resolvable nameservers, A/AAAA records and DNSSEC-related information when DNS retrieval is available.',
  },
  {
    id: 'ssl',
    title: 'SSL / TLS',
    tag: 'Certificate Inspection',
    icon: 'lock',
    description:
      'Certificate metadata may be inspected when an HTTPS endpoint is accessible. Available fields can include issuer, validity dates, common name and SAN coverage.',
  },
  {
    id: 'pricing',
    title: 'Pricing',
    tag: 'Benchmark Matrix',
    icon: 'payments',
    description:
      'Pricing is reference/stored data unless a supported provider integration supplies current pricing. Provides multi-year ownership estimates and renewal markup benchmarks.',
  },
  {
    id: 'provider-accounts',
    title: 'Provider Accounts',
    tag: 'Account Mapping',
    icon: 'account_tree',
    description:
      'Provider account ownership, account email, auto-renew, billing, VPS details and private account metadata require user mapping or supported provider integrations.',
  },
];

export const MONITORING_DISCLOSURE_DATA = {
  headline: 'Inventory & Monitoring Architecture Disclosure',
  summary:
    'Inventory status and live monitoring status are strictly separate in DomainPulse.',
  supportedFeatures: [
    'Portfolio asset inventory and organization',
    'User-mapped infrastructure relationship chains',
    'Stored domain expiry, DNS configuration, and SSL certificate records',
    'Configurable expiration risk classification thresholds',
    'Reference registrar benchmark comparisons',
  ],
  notConnectedFeatures: [
    'Live runtime server health & telemetry (Not Connected)',
    'Live website uptime & HTTP response-time polling (Not Connected)',
    'External email / WhatsApp notification dispatch (Not Connected)',
    'Automated registrar renewal execution (Not Supported)',
    'Live provider billing & payment card sync (Not Connected)',
  ],
  truthfulStatement:
    'DomainPulse stores and organizes your portfolio dataset. Runtime server monitoring, automated notification dispatch, and real-time provider sync require connected integrations.',
};

export const SECURITY_PRIVACY_DATA = {
  headline: 'Security & Privacy Boundaries',
  summary:
    'DomainPulse is designed with strict zero-secret exposure architecture.',
  demoStatement:
    'DomainPulse demo does not collect or store provider credentials or secrets, and sensitive credential values are never displayed in the portfolio UI.',
  neverCollectedList: [
    'Provider account passwords',
    'API secrets & access tokens',
    'SSH private keys & TLS private keys',
    'Two-factor authentication recovery codes',
    'Payment card numbers, CVVs, or bank details',
    'Production environment .env secret values',
  ],
  clarification:
    'Future provider integrations must handle required credentials through secure backend-side secret storage or provider authorization flows. Plaintext secrets must never be exposed in the portfolio UI.',
};

export const FEATURE_GUIDES: FeatureGuideItem[] = [
  {
    id: 'domain-discovery',
    title: 'Domain Discovery',
    subtitle: 'Search across target TLDs & brandable suggestions',
    icon: 'travel_explore',
    summary:
      'Query keyword availability across selected extensions, evaluate heuristic brandable variations, and review reference pricing benchmarks.',
    keyPoints: [
      'Multi-TLD parallel availability preview against reference dataset',
      'Smart suggestion engine with Brandable, Short, Modern, and Tech styles',
      'Open registrar options to verify current availability and pricing externally.',
    ],
    targetRoute: '/find-domain',
    targetLabel: 'Open Find Domain',
  },
  {
    id: 'pricing-comparison',
    title: 'Price Comparison Methodology',
    subtitle: 'Evaluate 5-year cost of ownership & renewal markups',
    icon: 'price_change',
    summary:
      'Estimate long-term ownership cost using stored or reference registration and renewal pricing.',
    keyPoints: [
      'Formula: Cost = Y1_Registration + (4 × Y_Renewal) for true 5-year outlay estimate',
      'Renewal Markup Index identifies registrars with hidden subsequent-year hikes',
      'Optional fee switches for WHOIS Privacy and DNSSEC inclusions',
    ],
    targetRoute: '/pricing',
    targetLabel: 'Open Price Comparison',
  },
  {
    id: 'alerts-monitoring',
    title: 'Alerts & Risk Horizons',
    subtitle: 'Classify expiration deadlines & DNS anomalies',
    icon: 'notifications_active',
    summary:
      'Review expiration horizons, SSL certificate validity windows, and DNS resolution classifications calculated from stored records.',
    keyPoints: [
      'Customizable warning intervals: 30d, 15d, 7d, 3d, and 1d prior to expiry',
      'Auto-renew discrepancy alerts flag domains with unexpected Off posture',
      'Stored channel notification preferences (external delivery not connected)',
    ],
    targetRoute: '/alerts',
    targetLabel: 'Open Alerts & Monitoring',
  },
  {
    id: 'infrastructure-map',
    title: 'Infrastructure Map',
    subtitle: 'Interactive dependency topology visualization',
    icon: 'hub',
    summary:
      'Explore stored dependency chains, relationship paths and high mapping-density infrastructure.',
    keyPoints: [
      'Visual topology graph with node filtering by entity type',
      'Highlight critical risk chains and mapping dependencies across portfolio',
      'Side-drawer entity inspector with quick metadata navigation',
    ],
    targetRoute: '/infrastructure-map',
    targetLabel: 'Open Infrastructure Map',
  },
  {
    id: 'settings-data-management',
    title: 'Settings & Data Management',
    subtitle: 'Portfolio preferences, import/export, and backup tools',
    icon: 'settings',
    summary:
      'Configure workspace localization, default currency denomination, table row density, and manage your portfolio dataset.',
    keyPoints: [
      '7 comprehensive configuration categories for granular control',
      'CSV and JSON import/export tools for complete data portability',
      'Local in-memory backup snapshot creation and session restoration',
    ],
    targetRoute: '/settings',
    targetLabel: 'Open Settings',
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-warning',
    question: 'Why is a domain shown as Warning?',
    answer:
      'A domain displays the Warning badge when its stored expiration date falls between 8 and 30 days from today. This indicates an active attention window where you should review the domain’s renewal arrangements with your registrar.',
    category: 'Status & Health',
    tags: ['status', 'warning', 'expiry'],
  },
  {
    id: 'faq-critical',
    question: 'Why is a domain shown as Critical?',
    answer:
      'A domain is flagged as Critical when its recorded expiry deadline is within ≤ 7 days. You should review renewal options promptly with your registrar to prevent expiration or service disruption.',
    category: 'Status & Health',
    tags: ['status', 'critical', 'expiry'],
  },
  {
    id: 'faq-monitoring-not-connected',
    question: 'Why does Monitoring say Not Connected?',
    answer:
      'DomainPulse currently stores and visualizes portfolio inventory and relationship data. Live runtime server metrics, automated uptime probing, and external notification dispatch require a connected monitoring integration.',
    category: 'Monitoring',
    tags: ['monitoring', 'disclosure'],
  },
  {
    id: 'faq-pricing-difference',
    question: 'Why can pricing differ from a registrar website?',
    answer:
      'Pricing shown in the demo is stored reference benchmark data. Registrars frequently adjust promotional rates, coupon codes, currency conversion margins, and taxes. Actual pricing should always be verified on the registrar’s website before purchase.',
    category: 'Pricing',
    tags: ['pricing', 'registrars', 'currency'],
  },
  {
    id: 'faq-rdap-fields-missing',
    question: 'Why are some RDAP / WHOIS fields missing?',
    answer:
      'Available RDAP and WHOIS fields vary significantly depending on top-level domain registry policies, GDPR/privacy redactions, and registrar privacy proxies. Certain ccTLDs also rate-limit automated queries.',
    category: 'Data Sources',
    tags: ['rdap', 'whois', 'privacy'],
  },
  {
    id: 'faq-unmapped-asset',
    question: 'Why is an asset shown as unmapped?',
    answer:
      'An asset is marked as Unmapped when it has not yet been linked to a corresponding parent entity (e.g. a domain without an assigned website, or a website without an associated VPS server). You can map entities in their respective detail drawers.',
    category: 'Relationships',
    tags: ['mapping', 'topology', 'unmapped'],
  },
  {
    id: 'faq-link-email-to-provider',
    question: 'How do I link an email to a provider account?',
    answer:
      'Navigate to Accounts & Emails, open the provider account detail view, and select the administrative email address from your registered email inventory. This establishes the ownership link in the Infrastructure Map.',
    category: 'Relationships',
    tags: ['accounts', 'emails', 'workflow'],
  },
  {
    id: 'faq-map-website-to-vps',
    question: 'How do I map a website to a VPS?',
    answer:
      'In Websites & Apps, open the target website drawer and assign the host VPS instance from your server inventory. The Infrastructure Map will automatically reflect the hosting dependency chain.',
    category: 'Relationships',
    tags: ['websites', 'servers', 'vps'],
  },
  {
    id: 'faq-export-portfolio',
    question: 'How do I export portfolio data?',
    answer:
      'Go to Settings > Data Management and choose either Export CSV or Export JSON. This generates a structured export of your domain records, servers, websites, and configuration parameters.',
    category: 'Data Management',
    tags: ['export', 'csv', 'json', 'backup'],
  },
  {
    id: 'faq-user-mapped-meaning',
    question: 'What does User Mapped mean?',
    answer:
      'User Mapped indicates that a relationship or technical attribute was configured manually by you within the workspace, rather than inferred from automated public registry/DNS lookups.',
    category: 'Data Provenance',
    tags: ['provenance', 'user-mapped'],
  },
  {
    id: 'faq-stored-record-meaning',
    question: 'What does Stored Record mean?',
    answer:
      'Stored Record denotes data that has been saved in your local workspace session dataset, representing the baseline configuration without requiring an immediate live query.',
    category: 'Data Provenance',
    tags: ['provenance', 'stored-record'],
  },
  {
    id: 'faq-dns-retrieved-meaning',
    question: 'What does DNS Retrieved mean?',
    answer:
      'DNS Retrieved confirms that the nameservers, IP addresses, or DNSSEC records were obtained via public DNS resolver queries for the target domain zone.',
    category: 'Data Provenance',
    tags: ['provenance', 'dns'],
  },
  {
    id: 'faq-ssl-retrieved-meaning',
    question: 'What does SSL Retrieved mean?',
    answer:
      'SSL Retrieved indicates that certificate validity, issuer, and expiration dates were extracted from a direct HTTPS TLS handshake on port 443.',
    category: 'Data Provenance',
    tags: ['provenance', 'ssl', 'tls'],
  },
  {
    id: 'faq-renew-directly',
    question: 'Does DomainPulse renew domains directly?',
    answer:
      'No. DomainPulse is an independent portfolio management and intelligence platform, not an ICANN registrar. You must process actual renewals directly through your accredited registrar account.',
    category: 'General',
    tags: ['renewals', 'registrar'],
  },
  {
    id: 'faq-sell-domains',
    question: 'Does DomainPulse sell domains?',
    answer:
      'No. DomainPulse does not sell domains or collect transaction fees. We provide neutral discovery, price benchmarking, and portfolio intelligence tools, directing you to accredited registrars for registration.',
    category: 'General',
    tags: ['sales', 'registrar'],
  },
];

export const TROUBLESHOOTING_ITEMS: TroubleshootingItem[] = [
  {
    id: 'trouble-lookup-failed',
    title: 'Domain Lookup Failed',
    symptom: 'Query returns no records or fails to parse registry response.',
    resolution:
      'Verify that the domain syntax contains no protocol prefixes (e.g., https://) or trailing slashes. Re-run manual lookup.',
    commandSnippet: 'whois example.com',
    severity: 'error',
  },
  {
    id: 'trouble-rdap-unavailable',
    title: 'RDAP Data Unavailable',
    symptom: 'RDAP response is rate-limited, incomplete, or times out.',
    resolution:
      'Certain ccTLDs lack public RDAP endpoints or enforce strict query throttling. Inspect public DNS or input registration dates manually.',
    commandSnippet:
      'curl -s -H "Accept: application/rdap+json" https://rdap.verisign.com/com/v1/domain/example.com',
    severity: 'warning',
  },
  {
    id: 'trouble-dns-not-found',
    title: 'DNS Records Not Found',
    symptom: 'Nameservers or IP addresses return NXDOMAIN or SERVFAIL.',
    resolution:
      'Check if DNS zone changes are still propagating across global anycast resolvers. Validate authoritative delegation at the registry.',
    commandSnippet: 'dig +noall +answer example.com NS',
    severity: 'warning',
  },
  {
    id: 'trouble-ssl-unavailable',
    title: 'SSL Information Unavailable',
    symptom: 'TLS handshake fails or times out on port 443.',
    resolution:
      'The target server may not have HTTPS enabled, or a firewall/WAF may be blocking automated connection handshakes.',
    commandSnippet:
      'openssl s_client -connect example.com:443 -servername example.com',
    severity: 'info',
  },
  {
    id: 'trouble-import-failed',
    title: 'CSV / JSON Import Failed',
    symptom: 'File upload fails to parse domain records.',
    resolution:
      'Ensure CSV files include a lowercase "domain" column header. Ensure JSON matches the schema format with valid ISO date strings.',
    commandSnippet: 'head -n 5 domains_export.csv',
    severity: 'error',
  },
  {
    id: 'trouble-unlinked-chain',
    title: 'Unlinked Infrastructure Chain',
    symptom: 'Asset appears disconnected in Infrastructure Map.',
    resolution:
      'Open the entity inspector and assign the upstream provider account or host compute node to restore topology continuity.',
    severity: 'info',
  },
];

export const DATA_LIMITATIONS_LIST: DataLimitationItem[] = [
  {
    icon: 'check_circle',
    text: 'Domain registration information may be retrieved from public RDAP and compatible WHOIS sources where available. Fields vary by registry policy and privacy redactions.',
  },
  {
    icon: 'check_circle',
    text: 'DNS information may be based on publicly resolvable DNS records and stored/user-mapped DNS information.',
  },
  {
    icon: 'check_circle',
    text: 'SSL/TLS certificate information may be inspected when the target exposes an accessible HTTPS endpoint on port 443.',
  },
  {
    icon: 'check_circle',
    text: 'Registrar pricing is stored/reference data unless a supported provider integration supplies current pricing.',
  },
  {
    icon: 'check_circle',
    text: 'Availability results in the current demo are reference previews and should be confirmed with the registry or registrar.',
  },
  {
    icon: 'check_circle',
    text: 'DomainPulse does not execute renewals, process payments, or guarantee third-party registrar pricing.',
  },
  {
    icon: 'check_circle',
    text: 'Actual registration terms, renewal fees, transfer eligibility, and applicable taxes must be verified directly with the registrar.',
  },
];

export const PRODUCT_METADATA: ProductMetadata = {
  product: 'DomainPulse',
  workspace: 'Portfolio Workspace',
  build: 'Demo Build',
  dataSources: 'RDAP / DNS / SSL',
  pricing: 'Reference Dataset',
  monitoring: 'Not Connected',
};
