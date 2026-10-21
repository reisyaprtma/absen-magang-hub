const { refreshAccessToken } = require('../lib/maganghub');

module.exports = async (req, res) => {
  // Opsional: Cek Authorization header jika CRON_SECRET disetel di Vercel
  if (process.env.CRON_SECRET && req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized Cron Request' });
  }

  console.log('⏰ Running Vercel Cron: Auto Refresh Token MagangHub...');
  try {
    const newToken = await refreshAccessToken();
    return res.status(200).json({
      success: true,
      message: 'Token successfully refreshed and saved to Supabase',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Cron refresh failed:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
};
