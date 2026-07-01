export const configuration = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (!process.env.REFRESH_TOKEN_SECRET) {
    throw new Error('REFRESH_TOKEN_SECRET environment variable is required');
  }
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRY || '15m',
    },
    refreshToken: {
      secret: process.env.REFRESH_TOKEN_SECRET,
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    },
    database: {
      url: process.env.DATABASE_URL,
    },
  };
};
