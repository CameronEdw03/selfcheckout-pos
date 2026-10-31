# Dallas College Library Self-Checkout POS

A full-stack self-checkout Point-of-Sale (POS) system designed for the **Dallas College Library**. The application allows students and library users to browse available products, view products by category, add items to a shopping cart, and eventually complete a self-checkout process.

This project is being developed as a **team capstone project** using a modern full-stack architecture with React, FastAPI, and a relational database.

---

## Project Overview

The Dallas College Library Self-Checkout POS system is designed to provide a simple and modern way for students and library users to purchase available products without requiring assistance from a staff member.

The system currently supports:

* Product browsing
* Product categories
* Product information
* Product inventory retrieved from a SQL database
* Adding products to a cart
* Full-stack communication between the React frontend and FastAPI backend

Future development will add user authentication, checkout functionality, PostgreSQL, CI/CD pipelines, and potential AI-powered features.

---

## Technology Stack

### Frontend

* **React.js**
* **Tailwind CSS**
* JavaScript
* Vite

The frontend is responsible for the user interface, product catalog, categories, cart functionality, and eventually the checkout and authentication experience.

### Backend

* **Python**
* **FastAPI**
* REST API
* SQL database integration

The backend handles API requests, product data, cart functionality, authentication, checkout processing, and communication with the database.

### Database

**Current:**

* MySQL

**Planned:**

* PostgreSQL

The database stores application data such as products, users, inventory, and eventually orders and checkout information.

### DevOps / CI/CD

Planned CI/CD implementation will automate parts of the development and deployment workflow.

Potential technologies include:

* GitHub Actions
* Automated testing
* Linting and code quality checks
* Build verification
* Automated deployment

---

## Architecture

The project follows a basic full-stack architecture:

```text
┌─────────────────────────┐
│       React Frontend    │
│     React + Tailwind    │
└────────────┬────────────┘
             │
             │ HTTP / REST API
             ▼
┌─────────────────────────┐
│      FastAPI Backend    │
│        Python           │
└────────────┬────────────┘
             │
             │ SQL
             ▼
┌─────────────────────────┐
│      SQL Database       │
│   MySQL → PostgreSQL    │
└─────────────────────────┘

             │
             ▼
┌─────────────────────────┐
│       CI/CD Pipeline    │
│     GitHub Actions      │
└─────────────────────────┘
```

---

## Current Features

### Product Catalog

Users can retrieve products from the database through the FastAPI backend and display them in the React frontend.

Products currently contain information such as:

* Product ID
* Name
* Description
* Price
* Quantity
* Category

### Product Categories

Products can be organized and displayed according to their category, making it easier for users to find what they are looking for.

### Shopping Cart

Users can currently:

* Select products
* Add products to their cart
* View their selected products
* Manage their cart through the application

### Backend API

The FastAPI backend provides endpoints for communicating between the frontend and database.

The API is responsible for retrieving and managing application data rather than having the frontend communicate directly with the database.

---

## Planned Features

The project is currently under active development.

### 1. PostgreSQL Migration

The current MySQL database will eventually be migrated to **PostgreSQL**.

Planned database improvements include:

* PostgreSQL setup
* Database schema migration
* Updated database connection configuration
* Testing existing API functionality with PostgreSQL
* Improving database relationships where necessary

---

### 2. Checkout System

The checkout process will be implemented to allow users to complete purchases.

Planned functionality includes:

* Checkout screen
* Cart summary
* Order total
* Item quantity validation
* Inventory validation
* Order creation
* Purchase confirmation
* Database order records

Potential checkout flow:

```text
Browse Products
      ↓
Select Product
      ↓
Add to Cart
      ↓
Review Cart
      ↓
Checkout
      ↓
Confirm Purchase
      ↓
Create Order
      ↓
Update Inventory
      ↓
Checkout Confirmation
```

---

### 3. User Authentication

Authentication will eventually be implemented on both the frontend and backend.

Planned functionality includes:

* User login
* Student authentication
* Backend authentication
* Protected API endpoints
* User sessions/authentication tokens
* User-specific carts
* User-specific order history

Potential user flow:

```text
Login
  ↓
Authenticate User
  ↓
Access POS System
  ↓
Browse Products
  ↓
Add Items to Cart
  ↓
Checkout
```

---

### 4. AI Features

The team is also considering adding AI functionality to the application.

Potential AI features include:

* AI-powered product recommendations
* Natural-language product search
* Product discovery assistance
* Intelligent recommendations based on cart contents
* AI assistance for navigating the POS system

AI functionality will be evaluated based on usefulness to the application and the overall project requirements.

---

### 5. UI Improvements

The frontend will continue to be improved as development progresses.

Planned improvements include:

* Modern POS interface
* Improved navigation
* Better product cards
* Improved category navigation
* Responsive design
* Improved cart interface
* Checkout interface
* Login interface
* Improved accessibility
* Consistent Tailwind CSS styling

---

### 6. CI/CD Pipeline

The team plans to implement **Continuous Integration and Continuous Deployment (CI/CD)** to automate testing and improve the development workflow.

The CI/CD pipeline will eventually:

* Run automatically when code is pushed to GitHub
* Run when pull requests are opened or updated
* Install frontend and backend dependencies
* Run backend tests
* Run frontend tests
* Perform linting and code quality checks
* Verify that the application builds successfully
* Prevent broken code from being merged
* Prepare the application for automated deployment

A potential workflow will be:

```text
Developer
    ↓
Create Feature Branch
    ↓
Push Changes
    ↓
Open Pull Request
    ↓
GitHub Actions
    ↓
Install Dependencies
    ↓
Run Tests
    ↓
Run Linting / Checks
    ↓
Build Application
    ↓
    ├── Failed → Fix Issues
    │
    └── Passed
          ↓
      Code Review
          ↓
       Merge
          ↓
   Deployment Pipeline
```

The exact CI/CD tools and deployment environment will be determined as the project develops.

---

## Running the Project Locally

### Prerequisites

Make sure you have the following installed:

* Python 3.x
* Node.js
* npm
* MySQL
* Git

PostgreSQL will be required once the database migration is completed.

---

## Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a Python virtual environment:

```bash
python -m venv venv
```

Activate the virtual environment.

### macOS / Linux

```bash
source venv/bin/activate
```

### Windows

```bash
venv\Scripts\activate
```

Install the backend dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI development server:

```bash
python -m uvicorn main:app --reload
```

The backend should be available at:

```text
http://127.0.0.1:8000
```

FastAPI documentation is available at:

```text
http://127.0.0.1:8000/docs
```

---

## Frontend Setup

Open another terminal and navigate to the frontend:

```bash
cd frontend
cd pos
```

Install dependencies:

```bash
npm install
```

Start the React development server:

```bash
npm run dev
```

Vite will provide the local development URL in the terminal.

---

## Database

### Current Database

The project currently uses **MySQL**.

The database contains product information used by the POS application.

Example product structure:

```text
products
├── product_id
├── name
├── description
├── price
├── quantity
└── category
```

### Future Database

The project plans to migrate from MySQL to **PostgreSQL**.

The PostgreSQL implementation will eventually support additional entities such as:

```text
Users
Products
Cart
Orders
Order Items
Inventory
```

---

## API

The backend uses FastAPI to provide REST endpoints to the frontend.

Current functionality includes endpoints for retrieving product information and interacting with cart-related functionality.

The interactive API documentation can be accessed through:

```text
/docs
```

when the FastAPI server is running.

As additional functionality is implemented, API endpoints will be added for:

* Authentication
* Checkout
* Orders
* Inventory
* User accounts
* AI functionality

---

## Development Roadmap

### Phase 1 — Core POS

* [x] React frontend
* [x] Tailwind CSS
* [x] FastAPI backend
* [x] MySQL database
* [x] Product retrieval
* [x] Product categories
* [x] Product catalog
* [x] Add products to cart

### Phase 2 — Checkout

* [ ] Checkout screen
* [ ] Cart validation
* [ ] Order creation
* [ ] Inventory updates
* [ ] Checkout confirmation

### Phase 3 — Authentication

* [ ] Frontend login
* [ ] Backend authentication
* [ ] Protected endpoints
* [ ] User sessions
* [ ] User-specific carts
* [ ] Order history

### Phase 4 — Database Migration

* [ ] PostgreSQL setup
* [ ] Schema migration
* [ ] Update backend database configuration
* [ ] Test application with PostgreSQL
* [ ] Optimize database relationships

### Phase 5 — UI/UX

* [ ] Modernize POS interface
* [ ] Improve navigation
* [ ] Improve cart experience
* [ ] Build checkout UI
* [ ] Build login UI
* [ ] Responsive design
* [ ] Accessibility improvements

### Phase 6 — CI/CD

* [ ] Set up GitHub Actions
* [ ] Automate dependency installation
* [ ] Add backend tests
* [ ] Add frontend tests
* [ ] Add linting/code quality checks
* [ ] Add frontend build verification
* [ ] Configure pull request checks
* [ ] Configure automated deployment
* [ ] Document CI/CD workflow

### Phase 7 — AI

* [ ] Determine appropriate AI use cases
* [ ] Implement selected AI feature
* [ ] Connect AI functionality to backend
* [ ] Integrate AI functionality into frontend
* [ ] Test AI functionality

---

## Team Development

This project is being developed collaboratively by a team of four.

Each team member has access to the GitHub repository and contributes to different areas of the application.

### Recommended Git Workflow

Before beginning work:

```bash
git pull
```

Create a feature branch:

```bash
git checkout -b feature-name
```

After making changes:

```bash
git add .
git commit -m "Describe your changes"
git push origin feature-name
```

Pull requests should be used to merge completed features into the main development branch.

### Branching

Feature branches should be used when developing new functionality.

Examples:

```text
feature/checkout
feature/login
feature/postgres
feature/ai
feature/ui
feature/cicd
```

This helps prevent multiple developers from accidentally overwriting each other's work.

---

## Project Goals

The overall goal of the project is to create a functional, modern, and maintainable self-checkout POS system that demonstrates full-stack software development and modern software engineering practices.

The project will demonstrate experience with:

* Frontend development
* Backend development
* REST APIs
* Database design
* Authentication
* Software architecture
* Git/GitHub collaboration
* CI/CD
* Automated testing
* UI/UX
* AI technologies
* Full-stack application development

---

## Future Vision

The final version of the application will provide a complete self-checkout experience:

```text
                    ┌───────────────┐
                    │     Login     │
                    └───────┬───────┘
                            ↓
                    ┌───────────────┐
                    │ Browse Items  │
                    └───────┬───────┘
                            ↓
                    ┌───────────────┐
                    │   Categories  │
                    └───────┬───────┘
                            ↓
                    ┌───────────────┐
                    │  Add to Cart  │
                    └───────┬───────┘
                            ↓
                    ┌───────────────┐
                    │ Review Cart   │
                    └───────┬───────┘
                            ↓
                    ┌───────────────┐
                    │   Checkout    │
                    └───────┬───────┘
                            ↓
                    ┌───────────────┐
                    │ Create Order  │
                    └───────┬───────┘
                            ↓
                    ┌───────────────┐
                    │ Confirmation  │
                    └───────────────┘
```

The long-term goal is to combine a clean user experience with a reliable backend, scalable database architecture, automated development workflows, and useful AI functionality.

---

## Status

**Project Status:** Active Development

**Current Focus:**

1. Checkout screen and checkout logic
2. PostgreSQL migration
3. Frontend/backend authentication
4. UI improvements
5. CI/CD pipeline implementation
6. AI feature exploration

---

## License

This project is being developed as an academic capstone project for Dallas College.
