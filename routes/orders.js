import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/**
 * Helper: format a DB order row for the frontend.
 */
function formatOrder(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    orderType: row.order_type,
    items: JSON.parse(row.items || '[]'),
    totalPrice: row.total_price,
    status: row.status,
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

/* ──────────────────────────────────────────
   GET /api/orders  –  authenticated
   Restaurant: sees all orders
   Customer: sees only own orders
   ────────────────────────────────────────── */
router.get('/', authenticate, (req, res) => {
  try {
    let rows;
    if (req.user.role === 'restaurant') {
      rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    } else {
      rows = db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC')
        .all(req.user.id);
    }
    res.json(rows.map(formatOrder));
  } catch (err) {
    console.error('GET /api/orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders.' });
  }
});

/* ──────────────────────────────────────────
   GET /api/orders/:id  –  authenticated
   ────────────────────────────────────────── */
router.get('/:id', authenticate, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Customers can only see their own orders
    if (req.user.role === 'customer' && row.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this order.' });
    }

    res.json(formatOrder(row));
  } catch (err) {
    console.error('GET /api/orders/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch order.' });
  }
});

/* ──────────────────────────────────────────
   POST /api/orders  –  customers only
   Creates a new order, server-side price verification
   ────────────────────────────────────────── */
router.post('/', authenticate, authorize('customer'), (req, res) => {
  try {
    const { items, orderType, notes } = req.body;

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    // Server-side price calculation using menu_items table
    let totalPrice = 0;
    const verifiedItems = [];

    for (const item of items) {
      if (!item.menuItemId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ error: `Invalid item: ${JSON.stringify(item)}` });
      }

      const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ? AND available = 1')
        .get(item.menuItemId);

      if (!menuItem) {
        return res.status(400).json({
          error: `Menu item "${item.menuItemId}" is not available.`
        });
      }

      const lineTotal = menuItem.price * item.quantity;
      totalPrice += lineTotal;

      verifiedItems.push({
        id: menuItem.id,
        name: menuItem.name,
        quantity: item.quantity,
        price: menuItem.price,
      });
    }

    // Fetch customer name
    const customer = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    const customerName = customer ? customer.name : 'Customer';

    const orderId = `ORD-${Date.now()}`;
    const type = orderType || 'Takeaway';

    db.prepare(`
      INSERT INTO orders (id, customer_id, customer_name, order_type, items, total_price, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
    `).run(
      orderId, req.user.id, customerName, type,
      JSON.stringify(verifiedItems), totalPrice,
      notes || ''
    );

    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    res.status(201).json(formatOrder(row));
  } catch (err) {
    console.error('POST /api/orders error:', err);
    res.status(500).json({ error: 'Failed to create order.' });
  }
});

/* ──────────────────────────────────────────
   PATCH /api/orders/:id/status  –  restaurant only
   ────────────────────────────────────────── */
router.patch('/:id/status', authenticate, authorize('restaurant'), (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'completed'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Status must be one of: ${validStatuses.join(', ')}.`
      });
    }

    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);

    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    res.json(formatOrder(row));
  } catch (err) {
    console.error('PATCH /api/orders/:id/status error:', err);
    res.status(500).json({ error: 'Failed to update order status.' });
  }
});

export default router;
