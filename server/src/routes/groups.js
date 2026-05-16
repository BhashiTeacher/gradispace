const router = require('express').Router();
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePlan } = require('../middleware/plan');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT g.*, COUNT(ege.exam_id)::int AS exam_count
      FROM exam_groups g LEFT JOIN exam_group_exams ege ON ege.group_id=g.id
      WHERE g.teacher_id=$1 GROUP BY g.id ORDER BY g.created_at DESC
    `, [req.teacherId]);
    res.json({ groups: rows.map(g => ({ ...g, groupLink: `${process.env.CLIENT_URL}/g/${g.access_token}` })) });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, requirePlan('pro', 'school'), async (req, res, next) => {
  try {
    const { name, gradeLevel, subject, description } = req.body;
    if (!name) return res.status(400).json({ error: 'validation_error', message: 'name is required.' });
    const { rows } = await db.query(
      'INSERT INTO exam_groups(teacher_id,name,grade_level,subject,description) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [req.teacherId, name, gradeLevel||null, subject||null, description||null]
    );
    const group = rows[0];
    res.status(201).json({ group: { ...group, groupLink: `${process.env.CLIENT_URL}/g/${group.access_token}` } });
  } catch (err) { next(err); }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, gradeLevel, subject, description } = req.body;
    const { rows } = await db.query(
      'UPDATE exam_groups SET name=COALESCE($1,name), grade_level=COALESCE($2,grade_level), subject=COALESCE($3,subject), description=COALESCE($4,description) WHERE id=$5 AND teacher_id=$6 RETURNING *',
      [name||null, gradeLevel||null, subject||null, description||null, req.params.id, req.teacherId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ group: rows[0] });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await db.query('DELETE FROM exam_groups WHERE id=$1 AND teacher_id=$2', [req.params.id, req.teacherId]);
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/:id/exams', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT e.* FROM exam_group_exams ege JOIN exams e ON e.id=ege.exam_id
      WHERE ege.group_id=$1 AND e.teacher_id=$2 ORDER BY e.created_at
    `, [req.params.id, req.teacherId]);
    res.json({ exams: rows });
  } catch (err) { next(err); }
});

router.post('/:id/exams', requireAuth, async (req, res, next) => {
  try {
    const { examIds = [] } = req.body;
    let added = 0;
    for (const eid of examIds) {
      await db.query('INSERT INTO exam_group_exams(group_id,exam_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.params.id, eid]);
      added++;
    }
    res.json({ added });
  } catch (err) { next(err); }
});

router.delete('/:id/exams/:examId', requireAuth, async (req, res, next) => {
  try {
    await db.query('DELETE FROM exam_group_exams WHERE group_id=$1 AND exam_id=$2', [req.params.id, req.params.examId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
