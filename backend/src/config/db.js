import dns from 'dns';
import mongoose from 'mongoose';
import { config } from './env.js';

// Resolve MongoDB Atlas SRV records reliably on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (dnsErr) {
  // Ignore in environments where setting custom DNS servers is disallowed
}

export async function connectDB() {
  try {
    const conn = await mongoose.connect(config.mongodbUri);

    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    throw error;
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error(`[MongoDB] Disconnection error: ${error.message}`);
  }
}
