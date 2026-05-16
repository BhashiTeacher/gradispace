const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db     = require('../db');
const { requireAuth } = require('../middleware/auth');

const PLANS = [
  { id: 'free',   name: 'Free',   price: 0,  currency: 'usd', interval: null,    stripePriceId: null },
  { id: 'pro',    name: 'Pro',    price: 12, currency: 'usd', interval: 'month', stripePriceId: process.env.STRIPE_PRICE_PRO },
  { id: 'school', name: 'School', price: 35, currency: 'usd', interval: 'month', stripePriceId: process.env.STRIPE_PRICE_SCHOOL },
];

// GET /api/v1/billing/plans  — public
router.get('/plans', (_req, res) => res.json({ plans: PLANS }));

// GET /api/v1/billing/subscription
router.get('/subscription', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT plan,plan_status,stripe_sub_id,plan_expires_at FROM teachers WHERE id=$1', [req.teacherId]);
    const t = rows[0];
    if (!t) return res.status(404).json({ error: 'not_found' });

    let sub = null;
    if (t.stripe_sub_id) {
      sub = await stripe.subscriptions.retrieve(t.stripe_sub_id).catch(() => null);
    }
    res.json({
      plan: t.plan,
      status: t.plan_status,
      currentPeriodEnd: sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : t.plan_expires_at,
      cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    });
  } catch (err) { next(err); }
});

// POST /api/v1/billing/checkout
router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const { planId } = req.body;
    const plan = PLANS.find(p => p.id === planId);
    if (!plan || !plan.stripePriceId) return res.status(400).json({ error: 'validation_error', message: 'Invalid plan.' });

    const { rows } = await db.query('SELECT email,name,stripe_customer_id FROM teachers WHERE id=$1', [req.teacherId]);
    const teacher = rows[0];

    let customerId = teacher.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: teacher.email, name: teacher.name, metadata: { teacherId: req.teacherId } });
      customerId = customer.id;
      await db.query('UPDATE teachers SET stripe_customer_id=$1 WHERE id=$2', [customerId, req.teacherId]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/teacher/billing?success=1`,
      cancel_url:  `${process.env.CLIENT_URL}/teacher/billing?canceled=1`,
      metadata: { teacherId: req.teacherId, planId },
    });
    res.json({ url: session.url });
  } catch (err) { next(err); }
});

// POST /api/v1/billing/portal
router.post('/portal', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT stripe_customer_id FROM teachers WHERE id=$1', [req.teacherId]);
    if (!rows[0]?.stripe_customer_id) return res.status(400).json({ error: 'validation_error', message: 'No active subscription.' });
    const session = await stripe.billingPortal.sessions.create({
      customer:   rows[0].stripe_customer_id,
      return_url: `${process.env.CLIENT_URL}/teacher/billing`,
    });
    res.json({ url: session.url });
  } catch (err) { next(err); }
});

// POST /api/v1/billing/webhook  — raw body, verified by Stripe
async function webhook(req, res) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  const planFromPrice = (priceId) => {
    if (priceId === process.env.STRIPE_PRICE_PRO)    return 'pro';
    if (priceId === process.env.STRIPE_PRICE_SCHOOL) return 'school';
    return 'free';
  };

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const teacherId = session.metadata?.teacherId;
      const planId    = session.metadata?.planId || 'pro';
      if (teacherId) {
        await db.query('UPDATE teachers SET plan=$1, plan_status=\'active\', stripe_sub_id=$2 WHERE id=$3',
          [planId, session.subscription, teacherId]);
      }
    }
    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const priceId = sub.items?.data?.[0]?.price?.id;
      const plan = planFromPrice(priceId);
      await db.query('UPDATE teachers SET plan=$1, plan_status=$2, stripe_sub_id=$3 WHERE stripe_customer_id=$4',
        [plan, sub.status, sub.id, sub.customer]);
    }
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      await db.query('UPDATE teachers SET plan=\'free\', plan_status=\'canceled\', stripe_sub_id=NULL WHERE stripe_customer_id=$1',
        [sub.customer]);
    }
    if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object;
      await db.query('UPDATE teachers SET plan_status=\'past_due\' WHERE stripe_customer_id=$1', [inv.customer]);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error', err);
    res.status(500).json({ error: 'handler_error' });
  }
}

module.exports = { router, webhook };
