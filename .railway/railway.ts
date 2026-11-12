import { defineRailway, github, preserve, project, service } from "railway/iac";

export const partial = "litix-owned-evidence-worker";

export default defineRailway((ctx) => {
  const worker = service("litix-owned-evidence-worker", {
    source: github("LitGnosis/Litix", {
      branch: "migration/litix-smmxpert-next-20261103",
      rootDirectory: "ops/partner-ledger",
    }),
    start: "python -u -m litix_partner_ledger.worker",
    replicas: 0,
    env: {
      DATABASE_URL: preserve(),
      REDIS_URL: preserve(),
      LITIX_PARTNER_EVIDENCE_SECRET: preserve(),
      LITIX_PARTNER_EVIDENCE_ENABLED: "false",
    },
  });

  return project(ctx.projectName || "litix-owned-ops", {
    resources: [worker],
  });
});
