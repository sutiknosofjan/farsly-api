import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcryptjs from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, 'farsly.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ──────────────────────────────────────────
   Schema
   ────────────────────────────────────────── */

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password    TEXT    NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'restaurant'))
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id          TEXT    PRIMARY KEY,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    price       REAL    NOT NULL DEFAULT 0,
    calories    TEXT    DEFAULT '0',
    protein     TEXT    DEFAULT '0g',
    rating      REAL    DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    badge       TEXT,
    ingredients TEXT    DEFAULT '[]',
    image       TEXT,
    available   INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id          TEXT    PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    customer_name TEXT  NOT NULL DEFAULT '',
    order_type  TEXT    DEFAULT 'Takeaway',
    items       TEXT    NOT NULL DEFAULT '[]',
    total_price REAL    NOT NULL DEFAULT 0,
    status      TEXT    NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed')),
    notes       TEXT    DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES users(id)
  );
`);

/* ──────────────────────────────────────────
   Seed data (only on first run)
   ────────────────────────────────────────── */

const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;

if (userCount === 0) {
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  );

  const salt = bcryptjs.genSaltSync(10);

  const seedUsers = db.transaction(() => {
    insertUser.run(
      'Sarah Customer',
      'customer@farsly.com',
      bcryptjs.hashSync('password123', salt),
      'customer'
    );
    insertUser.run(
      'Farsly Admin',
      'restaurant@farsly.com',
      bcryptjs.hashSync('password123', salt),
      'restaurant'
    );
  });

  seedUsers();
  console.log('✓ Seeded default users');
}

const menuCount = db.prepare('SELECT COUNT(*) AS cnt FROM menu_items').get().cnt;

if (menuCount === 0) {
  const insertMenu = db.prepare(`
    INSERT INTO menu_items (id, name, category, description, price, calories, protein, rating, review_count, badge, ingredients, image, available)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedMenuData = [
    {
      id: 'salmon-signature', name: 'Salmon Signature', category: 'Poke',
      description: 'Wild-caught salmon, avocado, edamame, and house ponzu over seasoned sushi rice.',
      price: 16.90, calories: '520', protein: '42g', rating: 4.9, reviewCount: 124,
      badge: 'POPULAR', ingredients: ['Salmon', 'Avocado', 'Edamame', 'Ponzu'],
      image: '/assets/images/salmon-signature.jpg',
    },
    {
      id: 'shrimp-garden', name: 'Shrimp Garden', category: 'Poke',
      description: 'Poached shrimp, mango, cucumber, and spicy mayo on a bed of mixed greens.',
      price: 15.50, calories: '440', protein: '34g', rating: 4.8, reviewCount: 98,
      badge: null, ingredients: ['Shrimp', 'Mango', 'Cucumber', 'Spicy Mayo'],
      image: '/assets/images/shrimp-garden.jpg',
    },
    {
      id: 'teriyaki-chicken', name: 'Teriyaki Chicken', category: 'Poke',
      description: 'Grilled chicken, broccoli, carrots, and sweet teriyaki glaze over brown rice.',
      price: 14.90, calories: '580', protein: '48g', rating: 4.7, reviewCount: 87,
      badge: null, ingredients: ['Chicken', 'Broccoli', 'Carrots', 'Teriyaki'],
      image: '/assets/images/teriyaki-chicken.jpg',
    },
    {
      id: 'earth-bowl', name: 'Earth Bowl', category: 'Salads',
      description: 'Roasted sweet potato, chickpeas, kale, tahini, and pickled onion over quinoa.',
      price: 14.50, calories: '460', protein: '18g', rating: 4.6, reviewCount: 63,
      badge: 'VEGAN', ingredients: ['Sweet Potato', 'Chickpeas', 'Kale', 'Tahini'],
      image: '/assets/images/earth-bowl.jpg',
    },
    {
      id: 'sunset-harvest', name: 'Sunset Harvest Salad', category: 'Salads',
      description: 'Fresh mixed greens, roasted beets, goat cheese, and balsamic vinaigrette.',
      price: 13.50, calories: '320', protein: '12g', rating: 4.5, reviewCount: 42,
      badge: null, ingredients: ['Greens', 'Beets', 'Goat Cheese', 'Balsamic'],
      image: '/assets/images/hero-bowl.jpg',
    },
    {
      id: 'citrus-glow', name: 'Citrus Glow Bowl', category: 'Seasonal',
      description: 'Seasonal citrus, seared tuna, avocado, and jalapeño over cilantro lime rice.',
      price: 17.50, calories: '490', protein: '38g', rating: 4.9, reviewCount: 28,
      badge: 'SEASONAL', ingredients: ['Seared Tuna', 'Citrus', 'Avocado', 'Jalapeño'],
      image: '/assets/images/salmon-signature.jpg',
    },
    {
      id: 'matcha-lemonade', name: 'Iced Matcha Lemonade', category: 'Drinks',
      description: 'Premium ceremonial grade matcha layered with fresh squeezed lemonade.',
      price: 5.50, calories: '120', protein: '1g', rating: 4.8, reviewCount: 156,
      badge: null, ingredients: ['Matcha', 'Lemon', 'Organic Cane Sugar'],
      image: null,
    },
    {
      id: 'ginger-kombucha', name: 'Ginger Peach Kombucha', category: 'Drinks',
      description: 'Locally brewed kombucha with real ginger and peach puree.',
      price: 6.00, calories: '60', protein: '0g', rating: 4.7, reviewCount: 89,
      badge: 'ORGANIC', ingredients: ['Kombucha', 'Ginger', 'Peach'],
      image: null,
    },
  ];

  const seedMenu = db.transaction(() => {
    for (const item of seedMenuData) {
      insertMenu.run(
        item.id, item.name, item.category, item.description,
        item.price, item.calories, item.protein, item.rating,
        item.reviewCount, item.badge, JSON.stringify(item.ingredients),
        item.image, 1
      );
    }
  });

  seedMenu();
  console.log('✓ Seeded menu items');
}

const orderCount = db.prepare('SELECT COUNT(*) AS cnt FROM orders').get().cnt;

if (orderCount === 0) {
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, customer_id, customer_name, order_type, items, total_price, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedOrderData = [
    {
      id: 'ORD-1006', customer_id: 1, customer_name: 'Fajar Nugraha',
      order_type: 'Delivery', items: [
        { id: 'item-6a', name: 'Almond Berry Acai Bowl', quantity: 1, price: 62000 },
        { id: 'item-6b', name: 'Immunity Boost Orange Ginger', quantity: 1, price: 34000 }
      ],
      total_price: 96000, status: 'pending', notes: 'Leave package at reception desk',
      created_at: '2026-09-28T10:50:00.000Z'
    },
    {
      id: 'ORD-1005', customer_id: 1, customer_name: 'Elena Wijaya',
      order_type: 'Dine-in', items: [
        { id: 'item-5a', name: 'Grilled Salmon Poke Bowl', quantity: 1, price: 78000 },
        { id: 'item-5b', name: 'Matcha Chia Seed Pudding', quantity: 1, price: 35000 }
      ],
      total_price: 113000, status: 'processing', notes: 'Table 05. Less dressing on salmon',
      created_at: '2026-09-28T10:35:00.000Z'
    },
    {
      id: 'ORD-1004', customer_id: 1, customer_name: 'Dimas Anggara',
      order_type: 'Takeaway', items: [
        { id: 'item-4a', name: 'Mediterranean Herb Chicken Wrap', quantity: 2, price: 52000 },
        { id: 'item-4b', name: 'Cold-Pressed Green Detox Juice', quantity: 2, price: 32000 }
      ],
      total_price: 168000, status: 'pending', notes: 'Cut wrap into halves',
      created_at: '2026-09-28T10:20:00.000Z'
    },
    {
      id: 'ORD-1003', customer_id: 1, customer_name: 'Citra Dewi',
      order_type: 'Dine-in', items: [
        { id: 'item-3a', name: 'Tofu Tempeh Teriyaki Bowl', quantity: 1, price: 48000 },
        { id: 'item-3b', name: 'Coconut Water Hydrator', quantity: 1, price: 25000 }
      ],
      total_price: 73000, status: 'completed', notes: 'Table 02. No peanuts due to allergy',
      created_at: '2026-09-28T09:55:00.000Z'
    },
    {
      id: 'ORD-1002', customer_id: 1, customer_name: 'Budi Pratama',
      order_type: 'Delivery', items: [
        { id: 'item-2a', name: 'Warm Quinoa Veggie Bowl', quantity: 1, price: 55000 },
        { id: 'item-2b', name: 'Turmeric Ginger Tonic', quantity: 1, price: 30000 }
      ],
      total_price: 85000, status: 'completed', notes: 'Ring door bell upon arrival',
      created_at: '2026-09-28T09:40:00.000Z'
    },
    {
      id: 'ORD-1001', customer_id: 1, customer_name: 'Aulia Rahma',
      order_type: 'Dine-in', items: [
        { id: 'item-1a', name: 'Avocado Quinoa Salad Bowl', quantity: 1, price: 58000 },
        { id: 'item-1b', name: 'Cold-Pressed Green Detox Juice', quantity: 1, price: 32000 }
      ],
      total_price: 90000, status: 'completed', notes: 'Table 04. Extra virgin olive oil',
      created_at: '2026-09-28T09:15:00.000Z'
    },
  ];

  const seedOrders = db.transaction(() => {
    for (const order of seedOrderData) {
      insertOrder.run(
        order.id, order.customer_id, order.customer_name, order.order_type,
        JSON.stringify(order.items), order.total_price, order.status,
        order.notes, order.created_at
      );
    }
  });

  seedOrders();
  console.log('✓ Seeded initial orders');
}

export default db;
