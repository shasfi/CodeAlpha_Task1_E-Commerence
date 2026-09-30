# MONO. — CodeAlpha Full Stack Development Internship

**Task 1: Simple E-commerce Store** · GitHub repository name: **`CodeAlpha_EcommerceStore`**

A responsive full-stack e-commerce project with a modern shopping interface, persistent SQLite database, product details, session-based authentication, shopping bag, checkout, order processing and order history. Demo products and prices are fictional. Orders are **simulated**: no payment gateway or shipping integration is used or claimed.

## Task checklist

| CodeAlpha requirement | Implementation |
|---|---|
| HTML, CSS, JavaScript frontend | `public/index.html`, `public/styles.css`, `public/app.js` |
| Express.js backend | `server.js` using `express` after installation |
| Product listings | `/api/products`, product cards, filtering, search and sorting |
| Product details | Individual product screen at `/?product=product-slug` |
| Shopping cart | Add/remove, stock-limited quantity and subtotal; saved to browser localStorage |
| Order processing | Authenticated POST `/api/orders`; server-calculated total, transaction and inventory deduction |
| User registration/login | Hashed passwords (scrypt), random HttpOnly session cookies, logout |
| Database: products, users, orders | SQLite tables in `db.js` (plus sessions and order_items) |
| Bonus | Responsive layout, order history, input validation, demo confirmation, automated API tests |

## 1. Requirements

- **Node.js 22.13 or newer** (uses the built-in `node:sqlite` module).
- npm and an internet connection to install Express.js for the official internship submission.

## 2. Run locally (Windows / macOS / Linux)

Open a terminal inside the project folder:

```bash
npm install
npm start
```

Visit **http://localhost:3000** in your browser. The first launch creates `data/store.sqlite` and adds eight demo products.

**Offline preview only:** `node server.js` also works without `npm install`, using the included lightweight HTTP adapter. For actual CodeAlpha submission, **run `npm install`** so the backend uses real Express.js as the task requests. The adapter is not Express.js and is included solely to make the source previewable without package downloads.

You may set `PORT` and `DB_PATH` as environment variables. Example on Windows PowerShell:

```powershell
$env:PORT=3001
npm start
```

Do not upload your local `data/` directory, production secrets or `node_modules/` to GitHub.

## 3. How to verify the entire workflow

1. Open the homepage and browse all products; use category filters, search, and sort.
2. Select an item to open its product details page, adjust quantity and **Add to bag**.
3. Open the shopping bag, adjust quantity and click **Continue to checkout**.
4. Register a new account or sign in (password must have 8+ characters).
5. Enter delivery details, then select **Place demo order**. No real charges or delivery occur.
6. See the order confirmation, then choose **View order history**. Your order and stock changes persist in SQLite even after restarting the server.
7. Sign out and sign back in to verify session handling.

## 4. Automated API tests

```bash
npm test
```

Tests exercise health, homepage, product assets/catalog/filter/detail, registration validation, duplicate email, login, authenticated session, invalid cart, price-tampering protection, checkout, inventory reduction, order history and logout. They use an isolated temporary test database.

## 5. Architecture

```text
CodeAlpha_EcommerceStore/
├── server.js                    Express REST API and session/order logic
├── db.js                        SQLite schema and demo catalog seeding
├── package.json                 Dependencies and npm commands
├── public/
│   ├── index.html               Responsive semantic storefront
│   ├── styles.css               Storefront styling and mobile layouts
│   ├── app.js                   Frontend state, fetch API, bag and forms
│   └── assets/                  Locally bundled custom demo product SVGs
├── lib/offline-express.js        Optional offline preview fallback
├── tests/api.test.mjs           Automated end-to-end API smoke tests
├── .env.example                 Optional environment reference
└── README.md
```

**Database entities:** `products`, `users`, `sessions`, `orders`, `order_items`. Prices use integer PKR amounts. The backend always looks up real prices and checks stock inside a transaction; browser cart data is never trusted as a source of prices.

**API endpoints:** `GET /api/health`, `GET /api/products`, `GET /api/products/:id`, `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/orders` (login required), `GET /api/orders` (login required).

**Security notes:** password hashing with salted scrypt, HttpOnly SameSite cookies, server-side sessions, basic Origin checking on changes and input validation. This is a **learning/portfolio project**, not a production commerce platform. Real deployment requires TLS, payment-provider integration, formal CSRF design, abuse/rate limiting, proper email verification, production logging, shipping workflows and additional security review. `NODE_ENV=production` marks session cookies `Secure`, so production must be served over HTTPS.

## 6. CodeAlpha submission checklist

1. Publish the repository to GitHub as **`CodeAlpha_EcommerceStore`**; include this README, all source code and assets, but not `node_modules` or `data`.
2. Record a short project demonstration: homepage → catalog filters → product details → bag → registration/sign-in → checkout → order confirmation → order history. Explain Node.js/Express, SQLite and the API.
3. Post your internship status on LinkedIn, tagging **@CodeAlpha**, if required by your internship coordinator.
4. Post the explanation video on LinkedIn with your public GitHub repository link, tagging **@CodeAlpha**.
5. Submit your project through the **official submission form supplied by CodeAlpha**. Verify your own internship timeframe and number of tasks with the program before submitting.

### Suggested project video voiceover (about 45–60 seconds)

> This is MONO., a full-stack e-commerce store that I built for CodeAlpha's Full Stack Development internship. The frontend uses HTML, CSS and JavaScript, and the backend uses Node.js with Express and a SQLite database. You can browse products, filter categories, open product pages, manage a shopping cart and create an account. Once signed in, you can place a demo order and view your order history. Orders are saved in the database, and product stock is updated when an order is placed. This is a demonstration project, so no real payment is collected. The full source code is available in my GitHub repository.

### Suggested LinkedIn caption

> I built MONO., a full-stack e-commerce store as part of my CodeAlpha Full Stack Development internship. It includes product browsing, product details, a shopping cart, user registration/login, order processing and order history. Built with HTML, CSS, JavaScript, Node.js, Express.js and SQLite.
>
> GitHub: [YOUR PUBLIC REPOSITORY LINK]
>
> #CodeAlpha #FullStackDevelopment #WebDevelopment #NodeJS #ExpressJS

Replace the GitHub placeholder and only claim the tasks you have personally verified/demonstrated.
