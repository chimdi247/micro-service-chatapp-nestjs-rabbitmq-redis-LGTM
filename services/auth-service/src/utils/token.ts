import { env } from "@/config/env";
import bcrypt from "bcrypt";
import { withSpan } from "@chatapp/common";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

const ACCESS_TOKEN: Secret = env.JWT_SECRET;
const REFRESH_TOKEN: Secret = env.JWT_REFRESH_SECRET;
const ACCESS_OPTIONS: SignOptions = {
  expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
};
const REFRESH_OPTIONS: SignOptions = {
  expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
};

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  // bcrypt is the most CPU-heavy step of registration; give it its own span.
  return withSpan("auth.password.hash", () => bcrypt.hash(password, saltRounds), {
    attributes: { "bcrypt.rounds": saltRounds },
  });
};

export const verifyPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return withSpan("auth.password.verify", () => bcrypt.compare(password, hash));
};

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  tokenId: string;
}

export const signAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, ACCESS_TOKEN, ACCESS_OPTIONS);
};

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, REFRESH_TOKEN, REFRESH_OPTIONS);
};

export const verifyRefreshToken = (payload: string): RefreshTokenPayload => {
  return jwt.verify(payload, REFRESH_TOKEN) as RefreshTokenPayload;
};
