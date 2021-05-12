module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: 'https://api.iartx.com',
  admin: {
    auth: {
      secret: env('ADMIN_JWT_SECRET'),
    },
  },
});
