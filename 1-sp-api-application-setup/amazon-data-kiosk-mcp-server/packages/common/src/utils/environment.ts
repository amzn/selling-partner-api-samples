/**
 * Checks required environment variables
 * @returns True if all required variables are present
 */
export function checkEnvironment(): boolean {
    const requiredVars = [
      "DATA_KIOSK_CLIENT_ID",
      "DATA_KIOSK_CLIENT_SECRET",
      "DATA_KIOSK_REFRESH_TOKEN"
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error(`Missing required environment variables: ${missingVars.join(", ")}`);
      console.error(`
  Please ensure these variables are set in your environment or in the claude_desktop_config.json file.
  `);
      process.exit(1);
    }
    
    // Set default values for optional environment variables
    if (!process.env.DATA_KIOSK_BASE_URL) {
      process.env.DATA_KIOSK_BASE_URL = "https://sellingpartnerapi-na.amazon.com";
    }
    
    if (!process.env.DATA_KIOSK_OAUTH_URL) {
      process.env.DATA_KIOSK_OAUTH_URL = "https://api.amazon.com/auth/o2/token";
    }
    
    if (!process.env.DATA_KIOSK_API_VERSION) {
      process.env.DATA_KIOSK_API_VERSION = "2023-11-15";
    }
    
    return true;
  }