import { config } from 'dotenv'

// Load config from .env
config();

export const API_PREFIX = process.env.API_PREFIX || '/api'
export const APP_PORT = process.env.APP_PORT || 3000
export const JWT_SECRET = process.env.JWT_SECRET || 'a secret key'
export const SALT_ROUNDS = process.env.SALT_ROUNDS || 10
export const NEO4J_URI = process.env.NEO4J_URI || 'bolt://3.228.18.21:7687'
export const NEO4J_USERNAME = process.env.NEO4J_USERNAME || "neo4j"
export const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || "depositions-change-margins"
