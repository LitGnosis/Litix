const { Pool } = require('pg');
const axios = require('axios');

const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true }
});

/**
 * Top 1% Automation: Dynamically forces a strict 4x retail margin
 * by pulling baseline values directly from SmmGlob.
 */
async function runLiveMarginGuardAudit() {
    console.log("🔄 [Margin Guard]: Starting dynamic supplier price reconciliation...");
    try {
        // 1. Fetch current cost matrix from your supplier channel
        const supplierResponse = await axios.post("https://smmglob.com", {
            key: process.env.SMMGLOB_API_KEY.replace(/['"]+/g, '').trim(),
            action: "services"
        });

        if (!Array.isArray(supplierResponse.data)) {
            throw new Error("Invalid response format received from provider network.");
        }

        // 2. Identify your target service package (e.g., Service ID 100)
        const targetService = supplierResponse.data.find(s => s.service === "100");
        if (!targetService) return console.error("❌ Target service ID not found in supplier array.");

        const baseCostPerThousand = parseFloat(targetService.rate); // E.g., $0.20 per 1000 items

        // 3. Execute 4x Margin Arithmetic calculation
        const optimizedRetailPricePerThousand = baseCostPerThousand * 4;

        // 4. Atomically write the updated rate into your Neon database
        await pgPool.query(`
            UPDATE service_packages
            SET customer_price_per_thousand = $1, last_audited_at = NOW()
            WHERE supplier_service_id = '100'
        `, [optimizedRetailPricePerThousand]);

        console.log(`✅ [Margin Guard Synced]: Base cost $${baseCostPerThousand} auto-calibrated to 4x Retail: $${optimizedRetailPricePerThousand}`);

    } catch (error) {
        console.error("🚨 [Margin Guard Error]: Real-time pricing adjustment failed:", error.message);
    }
}

module.exports = { runLiveMarginGuardAudit };
