const config = {
  shopify: {
    // apiKey: process.env.SHOPIFY_API_KEY || '',
    // apiSecretKey: process.env.SHOPIFY_API_SECRET_KEY || '',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || '',
    // domain: process.env.SHOPIFY_DOMAIN || '',
    adminApiEndpoint: process.env.SHOPIFY_ADMIN_API_ENDPOINT || '',
  },
};

export default config;
