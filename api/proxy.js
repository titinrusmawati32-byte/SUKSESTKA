/**
 * ============================================================================
 * Vercel Serverless Function - Proxy API Google Apps Script
 * File: api/proxy.js
 * Deskripsi: Mengatasi batasan CORS browser dan redirect Google Apps Script (302)
 *            secara aman di sisi server Vercel.
 * ============================================================================
 */

export default async function handler(req, res) {
  // Header CORS untuk mengizinkan request
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // URL Web App Google Apps Script
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbwu1pQN_wK3T8luVO7W6_jyA0X6jxUi4WwitSSMFQ1sMo1paZITI0khI6mkMidpQORb/exec';

  try {
    let payload = req.body;
    let bodyString = '';

    if (typeof payload === 'string') {
      bodyString = payload;
    } else if (payload && typeof payload === 'object') {
      bodyString = JSON.stringify(payload);
    }

    // Server-to-Server request (Bebas dari batasan CORS browser)
    const gasResponse = await fetch(GAS_URL, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: req.method === 'POST' ? bodyString : undefined,
      redirect: 'follow'
    });

    const responseText = await gasResponse.text();

    try {
      const jsonData = JSON.parse(responseText);
      return res.status(200).json(jsonData);
    } catch (parseErr) {
      // Jika respon bukan JSON murni (misal HTML error dari Google)
      return res.status(200).json({
        success: false,
        message: 'Respon dari Google Apps Script: ' + responseText.substring(0, 300)
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Proxy Server Error: ' + (err.message || 'Gagal menghubungi Google Apps Script')
    });
  }
}
