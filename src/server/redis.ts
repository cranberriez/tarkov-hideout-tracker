import { Redis } from "@upstash/redis";

// Singleton Redis client for server-side usage
export const redis = Redis.fromEnv();
