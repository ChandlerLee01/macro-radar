const createApiRoute = require("../lib/apiRoute");

module.exports = createApiRoute(async () => ({
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
}));
