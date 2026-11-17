import { Router } from 'express';
import db from '../database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/**
 * Helper: convert a DB row into the frontend-expected shape.
 */
function formatMenuItem(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: `$${Number(row.price).toFixed(2)}`,
    calories: row.calories,
    protein: row.protein,
    rating: row.rating,
    reviewCount: row.review_count,
    badge: row.badge || null,
    ingredients: JSON.parse(row.ingredients || '[]'),
    image: row.image || null,
    available: Boolean(row.available),
  };
}

/* ──────────────────────────────────────────
   GET /api/menu  –  public
   ────────────────────────────────────────── */
router.get('/', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM menu_items ORDER BY name ASC').all();
    res.json(rows.map(formatMenuItem));
  } catch (err) {
    console.error('GET /api/menu error:', err);
    res.status(500).json({ error: 'Failed to fetch menu items.' });
  }
});

/* ──────────────────────────────────────────
   GET /api/menu/:id  –  public
   ────────────────────────────────────────── */
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }
    res.json(formatMenuItem(row));
  } catch (err) {
    console.error('GET /api/menu/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch menu item.' });
  }
});

/* ──────────────────────────────────────────
   POST /api/menu  –  restaurant only
   ────────────────────────────────────────── */
router.post('/', authenticate, authorize('restaurant'), (req, res) => {
  try {
    const { name, category, description, price, calories, protein, badge, ingredients, image, available } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ error: 'Item name is required (at least 3 characters).' });
    }
    if (!category) {
      return res.status(400).json({ error: 'Category is required.' });
    }
    const priceNum = parseFloat(price);
    if (!price || Number.isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: 'Price must be greater than $0.00.' });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ error: 'Description is required (at least 10 characters).' });
    }

    const id = `item-${Date.now()}`;
    const ingredientsStr = JSON.stringify(
      Array.isArray(ingredients) ? ingredients : []
    );

    db.prepare(`
      INSERT INTO menu_items (id, name, category, description, price, calories, protein, rating, review_count, badge, ingredients, image, available)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `).run(
      id, name.trim(), category, description.trim(), priceNum,
      calories || '0', protein || '0g',
      badge || null, ingredientsStr, image || null,
      available === false ? 0 : 1
    );

    const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
    res.status(201).json(formatMenuItem(row));
  } catch (err) {
    console.error('POST /api/menu error:', err);
    res.status(500).json({ error: 'Failed to create menu item.' });
  }
});

/* ──────────────────────────────────────────
   PUT /api/menu/:id  –  restaurant only
   ────────────────────────────────────────── */
router.put('/:id', authenticate, authorize('restaurant'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    const { name, category, description, price, calories, protein, badge, ingredients, image, available } = req.body;

    // Validation
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 3)) {
      return res.status(400).json({ error: 'Item name must be at least 3 characters.' });
    }
    if (price !== undefined) {
      const priceNum = parseFloat(price);
      if (Number.isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({ error: 'Price must be greater than $0.00.' });
      }
    }
    if (description !== undefined && (typeof description !== 'string' || description.trim().length < 10)) {
      return res.status(400).json({ error: 'Description must be at least 10 characters.' });
    }

    const updatedValues = {
      name: name !== undefined ? name.trim() : existing.name,
      category: category !== undefined ? category : existing.category,
      description: description !== undefined ? description.trim() : existing.description,
      price: price !== undefined ? parseFloat(price) : existing.price,
      calories: calories !== undefined ? calories : existing.calories,
      protein: protein !== undefined ? protein : existing.protein,
      badge: badge !== undefined ? (badge || null) : existing.badge,
      ingredients: ingredients !== undefined
        ? JSON.stringify(Array.isArray(ingredients) ? ingredients : [])
        : existing.ingredients,
      image: image !== undefined ? (image || null) : existing.image,
      available: available !== undefined ? (available ? 1 : 0) : existing.available,
    };

    db.prepare(`
      UPDATE menu_items SET
        name = ?, category = ?, description = ?, price = ?,
        calories = ?, protein = ?, badge = ?, ingredients = ?,
        image = ?, available = ?
      WHERE id = ?
    `).run(
      updatedValues.name, updatedValues.category, updatedValues.description,
      updatedValues.price, updatedValues.calories, updatedValues.protein,
      updatedValues.badge, updatedValues.ingredients, updatedValues.image,
      updatedValues.available, req.params.id
    );

    const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
    res.json(formatMenuItem(row));
  } catch (err) {
    console.error('PUT /api/menu/:id error:', err);
    res.status(500).json({ error: 'Failed to update menu item.' });
  }
});

/* ──────────────────────────────────────────
   DELETE /api/menu/:id  –  restaurant only
   ────────────────────────────────────────── */
router.delete('/:id', authenticate, authorize('restaurant'), (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found.' });
    }

    db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
    res.json({ message: 'Menu item deleted successfully.' });
  } catch (err) {
    console.error('DELETE /api/menu/:id error:', err);
    res.status(500).json({ error: 'Failed to delete menu item.' });
  }
});

export default router;
