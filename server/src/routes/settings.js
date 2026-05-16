const router = require('express').Router();
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/v1/settings
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT portal_title,brand_colour,sheets_url FROM teachers WHERE id=$1', [req.teacherId]);
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    const { portal_title, brand_colour, sheets_url } = rows[0];
    res.json({ settings: { portalTitle: portal_title, brandColour: brand_colour, sheetsUrl: sheets_url } });
  } catch (err) { next(err); }
});

// PUT /api/v1/settings
router.put('/', requireAuth, async (req, res, next) => {
  try {
    const { portalTitle, brandColour, sheetsUrl } = req.body;
    const { rows } = await db.query(`
      UPDATE teachers SET
        portal_title  = COALESCE($1, portal_title),
        brand_colour  = COALESCE($2, brand_colour),
        sheets_url    = COALESCE($3, sheets_url),
        updated_at    = NOW()
      WHERE id=$4
      RETURNING portal_title, brand_colour, sheets_url
    `, [portalTitle||null, brandColour||null, sheetsUrl||null, req.teacherId]);
    const { portal_title, brand_colour, sheets_url } = rows[0];
    res.json({ settings: { portalTitle: portal_title, brandColour: brand_colour, sheetsUrl: sheets_url } });
  } catch (err) { next(err); }
});

module.exports = router;
