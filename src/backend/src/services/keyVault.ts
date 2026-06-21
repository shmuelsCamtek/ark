import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

export async function bootstrapSecrets(): Promise<void> {
  // Azure Container Apps set IDENTITY_ENDPOINT when managed identity is enabled.
  // If it's absent we're running locally — skip Key Vault and rely on .env.
  if (!process.env.IDENTITY_ENDPOINT) return;

  const vaultUri = process.env.KEYVAULT_URI;
  if (!vaultUri) {
    console.warn('[keyVault] IDENTITY_ENDPOINT is set but KEYVAULT_URI is missing — skipping Key Vault bootstrap.');
    return;
  }

  try {
    const credential = new DefaultAzureCredential();
    const secretClient = new SecretClient(vaultUri, credential);
    // Key Vault names can't contain underscores; ANTHROPIC_API_KEY → ANTHROPIC-API-KEY
    const secret = await secretClient.getSecret('ANTHROPIC-API-KEY');
    if (secret.value) {
      process.env.ANTHROPIC_API_KEY = secret.value;
      console.log('[keyVault] ANTHROPIC_API_KEY loaded from Key Vault.');
    }
  } catch (err) {
    console.error('[keyVault] Failed to fetch secret from Key Vault:', err);
    // Don't throw — the startup warning in index.ts will fire if the key is still absent.
  }
}
