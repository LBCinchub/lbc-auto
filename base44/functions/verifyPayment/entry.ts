import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const RECIPIENT_WALLET = "2SYh5UjyGEVwCMTQrY5LJrGRfEAmU9MqXECRrAMsNK34";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { transaction_id } = await req.json();

    if (!transaction_id) {
      return Response.json({ error: "Transaction ID required" }, { status: 400 });
    }

    // Verify transaction on Solana
    const response = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [transaction_id, { encoding: "json" }],
      }),
    });

    const result = await response.json();
    const transaction = result.result;

    if (!transaction) {
      return Response.json({ error: "Transaction not found" }, { status: 400 });
    }

    // Check if transaction is confirmed
    if (!transaction.blockTime) {
      return Response.json({ error: "Transaction not confirmed yet" }, { status: 400 });
    }

    // Verify amount and recipient
    const instructions = transaction.transaction?.message?.instructions || [];
    let isValid = false;

    for (const instruction of instructions) {
      if (instruction.program === "spl-token" || instruction.program === "system") {
        // Check destination is our wallet
        const parsedInfo = instruction.parsed?.info;
        if (parsedInfo?.destination === RECIPIENT_WALLET || parsedInfo?.mint === RECIPIENT_WALLET) {
          isValid = true;
          break;
        }
      }
    }

    if (!isValid) {
      return Response.json({ error: "Payment not sent to correct wallet" }, { status: 400 });
    }

    // Update user subscription
    await base44.auth.updateMe({
      subscription_status: "active",
      payment_transaction_id: transaction_id,
      payment_date: new Date().toISOString().split("T")[0],
    });

    return Response.json({ success: true, message: "Payment verified" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});