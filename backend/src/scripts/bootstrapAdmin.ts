// Operator-only. Never expose this function as an HTTP route.
import { supabase } from "../config/supabase";
async function main() {
  const email = process.argv[2];
  if (!email || process.argv[3] !== "--confirm-verified-owner")
    throw new Error(
      "Usage: npm run admin:bootstrap -- verified-owner@example.com --confirm-verified-owner",
    );
  const { error } = await supabase.rpc("bootstrap_first_admin", {
    p_email: email,
  });
  if (error) throw new Error(error.message);
  console.log(
    "First administrator created. Existing sessions revoked. Sign in with the account’s own password.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
