ALTER TABLE "domain_dns_metadata" ALTER COLUMN "provenance" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "domain_dns_metadata" ALTER COLUMN "provenance" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_rdap_metadata" ALTER COLUMN "provenance" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "domain_rdap_metadata" ALTER COLUMN "provenance" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "domain_tls_metadata" ALTER COLUMN "provenance" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "domain_tls_metadata" ALTER COLUMN "provenance" DROP NOT NULL;