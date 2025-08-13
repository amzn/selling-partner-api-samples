export interface AppConfig {
  debug: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  catalogPath: string;
  maxTokens: number;
}

export const config: AppConfig = {
  debug: process.env.NODE_ENV !== 'production',
  logLevel: (process.env.LOG_LEVEL || 'info') as AppConfig['logLevel'],
  catalogPath: process.env.CATALOG_PATH || './swagger',
  maxTokens: parseInt(process.env.MAX_RESPONSE_TOKENS || '25000', 10)
};
