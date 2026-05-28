const router = require('express').Router();
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/v1/settings
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT portal_title, brand_colour, sheets_url, banner_image, profile_photo,
              welcome_message, footer_message, exam_display_mode, locale
       FROM teachers WHERE id=$1`,
      [req.teacherId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    const r = rows[0];
    res.json({
      settings: {
        portalName:       r.portal_title,
        brandColour:      r.brand_colour,
        sheetsUrl:        r.sheets_url,
        bannerImage:      r.banner_image,
        profilePhoto:     r.profile_photo,
        welcomeMessage:   r.welcome_message,
        footerMessage:    r.footer_message,
        examDisplayMode:  r.exam_display_mode,
        locale:           r.locale,
      }
    });
  } catch (err) { next(err); }
});

// PUT /api/v1/settings
router.put('/', requireAuth, async (req, res, next) => {
  try {
    const {
      portalName, brandColour, sheetsUrl, bannerImage, profilePhoto,
      welcomeMessage, footerMessage, examDisplayMode, locale
    } = req.body;

    const { rows } = await db.query(`
      UPDATE teachers SET
        portal_title      = COALESCE($1, portal_title),
        brand_colour      = COALESCE($2, brand_colour),
        sheets_url        = COALESCE($3, sheets_url),
        banner_image      = COALESCE($4, banner_image),
        profile_photo     = COALESCE($5, profile_photo),
        welcome_message   = COALESCE($6, welcome_message),
        footer_message    = COALESCE($7, footer_message),
        exam_display_mode = COALESCE($8, exam_display_mode),
        locale            = COALESCE($9, locale),
        updated_at        = NOW()
      WHERE id=$10
      RETURNING portal_title, brand_colour, sheets_url, banner_image, profile_photo,
                welcome_message, footer_message, exam_display_mode, locale
    `, [
      portalName    || null,
      brandColour   || null,
      sheetsUrl     || null,
      bannerImage   || null,
      profilePhoto  || null,
      welcomeMessage  !== undefined ? (welcomeMessage || null) : null,
      footerMessage   !== undefined ? (footerMessage  || null) : null,
      examDisplayMode || null,
      locale          || null,
      req.teacherId,
    ]);

    const r = rows[0];
    res.json({
      settings: {
        portalName:       r.portal_title,
        brandColour:      r.brand_colour,
        sheetsUrl:        r.sheets_url,
        bannerImage:      r.banner_image,
        profilePhoto:     r.profile_photo,
        welcomeMessage:   r.welcome_message,
        footerMessage:    r.footer_message,
        examDisplayMode:  r.exam_display_mode,
        locale:           r.locale,
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
