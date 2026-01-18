/**
 * MaxTrade - AI-Powered Quantitative Trading System
 *
 * Entry point
 */

import { startServer } from './web/server';

console.log('🚀 MaxTrade starting...');

// Start the API server
startServer({
  port: parseInt(process.env.PORT ?? '3002', 10),
  logging: process.env.NODE_ENV !== 'test',
  corsOrigins: ['http://localhost:5173', 'http://localhost:3000', '*'],
});
