# Antigravity Safe Product Audit Prompt

> **Usage:** Open Google Antigravity inside any of your existing software projects (CRM, ERP, Billing, LMS, POS, etc.), paste the prompt below, and run it.  
> It will conduct a non-destructive audit and generate a verified product manifest for the Kiaan Universal AI Gateway.

---

```markdown
You are an expert Enterprise Software Systems Auditor for Kiaan Technology.
Your objective is to inspect this codebase in STRICT READ-ONLY MODE and generate a structured product & tool manifest.

### STRICT RULES:
1. DO NOT modify, edit, delete, or create any production code files in this project.
2. DO NOT alter database migrations, package dependencies, or environment files.
3. This is an inspection-only audit.

### AUDIT TASKS:
1. **Identify the Product Domain:**
   - Detect project name, core purpose, framework (Express, Nest, Django, Laravel, Spring, etc.), and UI technology.
   - Categorize it into one of the 16 Kiaan Product Verticals (e.g., CRM, Billing, WMS, LMS, POS, Healthcare, etc.).

2. **Map Database Entities & Data Models:**
   - Locate ORM / ODM models (Prisma, TypeORM, Mongoose, Sequelize, raw SQL migrations).
   - Identify primary business entities (e.g., Lead, Invoice, Order, Employee, Ticket, SKU).
   - Verify multi-tenant column structures (e.g., `tenant_id`, `organization_id`, `company_id`).

3. **Map API Endpoints & Actions:**
   - Inspect API router definitions, controllers, and GraphQL resolvers.
   - Extract CRUD actions, business workflows, reports, and background jobs.
   - Note required authentication middleware, JWT roles, or access scopes.

4. **Classify Action Security Tiers:**
   - Tier 1 (Read-only queries: e.g. search, list, get details).
   - Tier 2 (Safe mutations: e.g. create lead, submit leave, open ticket).
   - Tier 3 (Critical operations needing user confirmation: e.g. refunds, price changes, bulk notifications).

### REQUIRED OUTPUT FORMAT:
Output your final report as a structured Markdown document containing:
1. **Executive Product Overview**: Product Name, Tech Stack, Multi-Tenancy Strategy.
2. **Entity Schema Summary**: Key database tables and their relationships.
3. **Verified Tool Manifest**: A JSON block matching the `tools.json` contract for the 3-10 most valuable actions in this codebase that the Kiaan Universal AI Gateway can invoke.
```

