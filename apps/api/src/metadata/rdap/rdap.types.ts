export interface RdapSnapshot {
  readonly changedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly nameservers: readonly string[];
  readonly registeredAt: Date | null;
  readonly registrarIanaId: string | null;
  readonly registrarName: string | null;
  readonly secureDnsDelegationSigned: boolean | null;
  readonly sourceUrl: string;
  readonly statuses: readonly string[];
}

export interface RdapRetrieval {
  readonly snapshot: RdapSnapshot;
}
