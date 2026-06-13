# SQL Execution: The Complete Guide

From first query to performance tuning: how SQL actually executes - queries, joins, writes, transactions, procedures, subqueries, window functions, indexes, execution plans, and partitioning - every step described and demonstrated with examples.

## Part I - Foundations: how SQL executes
1. The logical execution order of SELECT
2. FROM and JOIN: how row sources are built
3. The five SQL command families
4. The write path: INSERT, UPDATE, DELETE
5. Transactions and ACID
6. Stored procedures and procedural SQL

## Part II - Working like a DBA: complex SQL and performance
7. Subqueries and CTEs: how they execute
8. EXISTS, NOT EXISTS, IN, NOT IN: semi- and anti-joins
9. Aggregation beyond COUNT: string aggregation and friends
10. Window functions and PARTITION BY
11. Indexes: how they work and when they are used
12. Reading execution plans (EXPLAIN)
13. Table partitioning
14. The performance tuning playbook

## Part III - Week-one questions (a fresher's reading of this guide)
15. NULL, ids, locking, upserts, views, injection, and more

## Example schema used throughout this guide
All examples in this guide use one small web-shop schema, so each step is shown against data you already know:

```text
customers              addresses               categories
id PK                  id PK                   id PK
email UQ               customer_id FK          name
name                   city                    parent_id FK (self)
country                pincode

orders                 order_items             products
id PK                  order_id FK } PK        id PK
customer_id FK         product_id FK } PK      sku UQ
order_date             qty                     name
status                 unit_price              category_id FK
total_amount                                   price

payments               reviews                 inventory
id PK                  id PK                   product_id FK } PK
order_id FK            product_id FK           warehouse } PK
amount                 customer_id FK          qty
status                 rating 1-5              tree via parent_id
```

The e-commerce LLD used in every example: one customer places many orders; each order has items; each item points at a product; products sit in a (self-referencing) category tree.

```sql
CREATE TABLE customers (
 id INT PRIMARY KEY,
 email VARCHAR(120) UNIQUE NOT NULL,
 name VARCHAR(50) NOT NULL,
 country CHAR(2)
);

CREATE TABLE addresses (
 id INT PRIMARY KEY,
 customer_id INT NOT NULL REFERENCES customers(id),
 city VARCHAR(60),
 pincode VARCHAR(10),
 is_default BOOLEAN DEFAULT false
);

CREATE TABLE categories (
 id INT PRIMARY KEY,
 name VARCHAR(60) NOT NULL,
 parent_id INT REFERENCES categories(id) -- self-reference: tree
);

CREATE TABLE products (
 id INT PRIMARY KEY,
 sku VARCHAR(20) UNIQUE NOT NULL,
 name VARCHAR(80) NOT NULL,
 category_id INT REFERENCES categories(id),
 price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
 active BOOLEAN DEFAULT true
);

CREATE TABLE inventory (
 product_id INT REFERENCES products(id),
 warehouse VARCHAR(20),
 qty INT NOT NULL DEFAULT 0,
 PRIMARY KEY (product_id, warehouse)
);

CREATE TABLE orders (
 id INT PRIMARY KEY,
 customer_id INT NOT NULL REFERENCES customers(id),
 order_date DATE NOT NULL,
 status VARCHAR(10) NOT NULL, -- 'paid' | 'pending'
 total_amount DECIMAL(10,2) NOT NULL
);

CREATE TABLE order_items (
 order_id INT REFERENCES orders(id),
 product_id INT REFERENCES products(id),
 qty INT NOT NULL,
 unit_price DECIMAL(10,2) NOT NULL, -- price AT ORDER TIME
 PRIMARY KEY (order_id, product_id) -- composite key
);

CREATE TABLE payments (
 id INT PRIMARY KEY,
 order_id INT NOT NULL REFERENCES orders(id),
 method VARCHAR(12),
 amount DECIMAL(10,2) NOT NULL,
 status VARCHAR(10) NOT NULL
);

CREATE TABLE reviews (
 id INT PRIMARY KEY,
 product_id INT NOT NULL REFERENCES products(id),
 customer_id INT NOT NULL REFERENCES customers(id),
 rating INT CHECK (rating BETWEEN 1 AND 5),
 body TEXT
);

-- sample data the examples trace:
-- customers: (1,'Ana','IN') (2,'Bo','IN') (3,'Cy','US' - no orders)
-- products: (1,'BK-1','Book',12.00) (2,'PN-1','Pen',2.50)
-- (3,'MG-1','Mug', 8.00)
-- orders: (101,1,'2026-06-01','paid', 24.00)
-- (102,1,'2026-06-03','paid', 25.00)
-- (103,2,'2026-06-05','pending', 8.00)
-- order_items: (101,1,2,12.00) (102,2,10,2.50) (103,3,1,8.00)
```

---

## 1. The logical execution order of SELECT

The order you write a SQL query in is not the order the database executes it in. You write SELECT first, but the database runs it almost last. Each numbered block below is documented on the following pages with its own description and example.

```text
1. FROM / JOIN     Assemble source rows
2. WHERE           Filter individual rows
3. GROUP BY        Collapse rows into groups
4. HAVING          Filter the groups
5. SELECT          Compute output columns
6. DISTINCT        Remove duplicate rows
7. ORDER BY        Sort the result
8. LIMIT / OFFSET  Trim the row count
```
The logical pipeline every SELECT statement follows.

Another way to see it: watch the data shrink. Each step receives rows, transforms or discards some, and passes the rest on - here is our traced example query as row counts:

```text
FROM / JOIN        [████████████████████] 3 rows
WHERE              [██████████████]       2 rows
GROUP BY + HAVING  [███████]              1 group
SELECT ... LIMIT   [███████]              1 row out
```
each step hands fewer (or reshaped) rows to the next - the bar is your data
3 joined rows -> WHERE keeps 2 -> they collapse into 1 group -> 1 output row. Thinking in row counts is how you predict a query's cost.

The eight steps in detail
Each step receives the rows produced by the previous step, transforms them, and hands the result onward. We trace this query through all eight steps:

```sql
SELECT DISTINCT customer_id, SUM(total_amount) AS total
FROM orders o JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'paid'
GROUP BY customer_id
HAVING SUM(total_amount) > 20
ORDER BY total DESC
LIMIT 10;
```

### Step 1 - FROM / JOIN: assemble source rows
Builds the working set of rows everything else operates on. Tables named in FROM are combined by JOINs (see section 2 for the full mechanics) into one wide virtual table. Subqueries and CTEs referenced here are also evaluated at this point.

In our example, orders is joined to customers, producing one combined row per matching (order, customer) pair:

```sql
FROM orders o JOIN customers c ON c.id = o.customer_id
-- produces rows like:
-- (101, 1, '2026-06-01', 'paid', 24.00, 1, 'Ana', 'IN')
-- (102, 1, '2026-06-03', 'paid', 25.00, 1, 'Ana', 'IN')
-- (103, 2, '2026-06-05', 'pending', 8.00, 2, 'Bo', 'IN')
```

### Step 2 - WHERE: filter individual rows
Examines each row from step 1 one at a time and keeps only those for which the condition is true. Because grouping has not happened yet, aggregate functions such as SUM() or COUNT() are not allowed here - and neither are aliases defined in SELECT, since SELECT has not run.

In our example, the pending order is removed:

```sql
WHERE o.status = 'paid'
-- keeps orders 101 and 102 (Ana), removes 103 (Bo, pending)
```

### Step 3 - GROUP BY: collapse rows into groups
Partitions the surviving rows into groups: every row with the same value of the grouping column(s) lands in the same group. From this point on, the query works with groups, not rows - each group will become at most one output row. Aggregates (SUM, COUNT, AVG, MIN, MAX) summarize each group.

In our example, Ana's two paid orders collapse into one group:

```sql
GROUP BY customer_id
-- group customer_id=1: {order 101, order 102}
-- SUM(total_amount) for this group = 24.00 + 25.00 = 49.00
```

### Step 4 - HAVING: filter the groups
The group-level counterpart of WHERE. It runs after grouping, so it can use aggregate functions. Any group failing the condition is discarded entirely. A common mistake is putting an aggregate condition in WHERE - it fails because the aggregate does not exist until this step.

In our example, only groups whose total exceeds 20 survive:

```sql
HAVING SUM(total_amount) > 20
-- group customer_id=1 has total 49.00 -> kept
```

### Step 5 - SELECT: compute output columns
Only now are the output expressions evaluated: columns picked, arithmetic performed, functions applied, and aliases born. This is why an alias cannot be referenced in WHERE/GROUP BY/HAVING (they ran earlier) but can be referenced in ORDER BY (it runs later). Window functions such as ROW_NUMBER() OVER (...) are also evaluated here.

In our example:

```sql
SELECT customer_id, SUM(total_amount) AS total
-- output row so far: (1, 49.00); the alias "total" now exists
```

### Step 6 - DISTINCT: remove duplicate rows
Compares the rows produced by SELECT and removes exact duplicates - two rows are duplicates only if every output column matches. It runs after SELECT because duplicates can only be judged on the final output columns.

A standalone example - country list without repeats:

```sql
SELECT DISTINCT country FROM customers;
-- ('IN'), ('US') <- Ana and Bo collapse into one 'IN' row
```

### Step 7 - ORDER BY: sort the result
Sorts the final rows. ASC (default) or DESC per column; multiple sort keys are applied left to right. Because it runs after SELECT, it may use aliases and even expressions over them. Without ORDER BY, row order is not guaranteed - never rely on "natural" order.

In our example:

```sql
ORDER BY total DESC -- alias is legal here
-- highest-spending customers first
```

### Step 8 - LIMIT / OFFSET: trim the row count
The last step: cut the sorted result down to a page. LIMIT n keeps the first n rows; OFFSET m skips m rows first. Because it runs after ORDER BY, "LIMIT 10" means "the top 10 by the chosen sort" - using LIMIT without ORDER BY returns an arbitrary 10 rows.

Pagination example - page 3 with 10 rows per page:

```sql
ORDER BY total DESC
LIMIT 10 OFFSET 20; -- rows 21-30 of the sorted result
```

Caveat: this is the logical order the SQL standard guarantees results match. The engine (PostgreSQL, MySQL, SQL Server...) reorders and optimizes freely under the hood as long as the output is identical - e.g. it may push the LIMIT down to stop scanning early.

### Questions you should be asking about SELECT
**Q: Can I GROUP BY an alias, like I can in ORDER BY?**
Depends on the engine. PostgreSQL and MySQL accept GROUP BY alias as a convenience; SQL Server and Oracle do not (GROUP BY logically precedes SELECT, as the pipeline shows). Portable habit: repeat the expression in GROUP BY, alias only for output.

**Q: COUNT(*) vs COUNT(column) vs COUNT(DISTINCT column)?**
COUNT(*) counts rows. COUNT(col) counts rows where col IS NOT NULL - a different number on nullable columns, and a frequent silent bug. COUNT(DISTINCT col) counts unique non-NULL values (and costs a dedupe per group).

```sql
SELECT COUNT(*), COUNT(customer_id), COUNT(DISTINCT customer_id)
FROM orders; -- 3 rows, but maybe 2 non-NULL customer_ids, 2 distinct
```

**Q: If I don't write ORDER BY, what order do rows come back in?**
Undefined - whatever order the plan happened to produce, which can change with data size, indexes, or a version upgrade. "It always came back sorted in dev" is a coincidence, not a contract. Same for ties: ORDER BY total_amount with equal totals returns those rows in arbitrary relative order - add a unique tiebreaker (ORDER BY total_amount, id) when stable pagination matters.

**Q: Does ORDER BY inside a subquery or view survive to the outside?**
No. Order is a property of the final result only; engines are free to discard an inner sort (an inner ORDER BY is meaningful only together with LIMIT, to choose which rows). If the output must be ordered, the outermost query says so.

---

## 2. FROM and JOIN: how row sources are built

FROM is step 1 because everything downstream needs a source of rows. With a single table it is trivial; with a JOIN, the SQL standard describes this conceptual model:

1. Take a Cartesian product - pair every row of the left table with every row of the right table.
2. Apply the ON condition, keeping only the pairs that satisfy it.
3. The surviving paired rows become one wide virtual table that the rest of the query sees.

```text
customers x orders    Book (c1)         Pen (c1)          Mug (c2)
Ana (id 1)            [Ana + Book]      [Ana + Pen]       Ana + Mug
Bo (id 2)             Bo + Book         Bo + Pen          [Bo + Mug]

[ ] = kept (id = customer_id)     unbracketed = discarded by ON
```

Two customers x three orders = six candidate pairs; ON customers.id = orders.customer_id keeps three.

### Every block in the grid, explained

**The corner block - customers x orders**
The Cartesian product itself: with 2 customers and 3 orders there are 2 x 3 = 6 candidate pairs. Written explicitly this is a CROSS JOIN - the only join with no ON condition, occasionally useful for generating combinations:

```sql
SELECT c.name, o.id
FROM customers c CROSS JOIN orders o; -- all 6 pairs, nothing filtered
```

**The header blocks - source rows**
The blue blocks are the original rows of each table: customers down the side (Ana id 1, Bo id 2), orders across the top with the customer_id each order points to (orders 101 'Book' and 102 'Pen' belong to customer 1, 103 'Mug' to 2). The foreign key orders.customer_id is what the ON condition will compare against customers.id.

**The kept cells - pairs where ON is true**
Ana+Book, Ana+Pen, Bo+Mug: in these pairs customers.id = orders.customer_id holds (1=1, 1=1, 2=2), so the ON condition keeps them. These three wide rows are what flows into WHERE:

```sql
SELECT c.name, o.id, o.total_amount
FROM customers c JOIN orders o ON c.id = o.customer_id;
-- ('Ana',101,24.00), ('Ana',102,25.00), ('Bo',103,8.00)
```

**The discarded cells - pairs where ON is false**
Ana+Mug (1 vs 2), Bo+Book and Bo+Pen (2 vs 1): the ids do not match, so the ON condition rejects them. They never reach WHERE or SELECT. Note this filtering is conceptual - real engines never build these pairs at all (see the optimizer note at the end of this section).

### Join types - what happens to unmatched rows
Our grid showed an INNER JOIN: only matched pairs survive. The join type decides the fate of rows that find no match at all. For these examples assume a third customer, Cy (id 3), who has no orders:

```text
Join type           Keeps unmatched left rows?   Keeps unmatched right rows?
INNER JOIN          No                           No
LEFT JOIN           Yes (right side NULL-filled) No
RIGHT JOIN          No                           Yes (left side NULL-filled)
FULL OUTER JOIN     Yes                          Yes
```

**INNER JOIN - matches only**
Returns only rows where the ON condition found a partner. Cy disappears from the result because no order points at id 3:

```sql
SELECT c.name, o.id
FROM customers c INNER JOIN orders o ON c.id = o.customer_id;
-- Ana/101, Ana/102, Bo/103 (no Cy row)
```

**LEFT JOIN - keep all left rows**
Every row of the left table appears at least once; where no right-side match exists, the right columns are NULL. The classic "all customers, and their orders if any":

```sql
SELECT c.name, o.id
FROM customers c LEFT JOIN orders o ON c.id = o.customer_id;
-- Ana/101, Ana/102, Bo/103, Cy/NULL

-- bonus: find customers with NO orders at all
SELECT c.name FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE o.id IS NULL; -- Cy
```

**RIGHT JOIN - keep all right rows**
The mirror image: every order appears, customers side NULL-filled if no user matches. Any RIGHT JOIN can be rewritten as a LEFT JOIN with the tables swapped, which is why many teams use LEFT JOIN exclusively:

```sql
SELECT c.name, o.id
FROM customers c RIGHT JOIN orders o ON c.id = o.customer_id;
-- identical to: FROM orders o LEFT JOIN customers c ON ...
```

**FULL OUTER JOIN - keep everything**
Union of LEFT and RIGHT: matched pairs once, plus unmatched rows from both sides NULL-filled. Useful for reconciliation - "what is in A, in B, and in both":

```sql
SELECT c.name, o.id
FROM customers c FULL OUTER JOIN orders o ON c.id = o.customer_id;
-- Ana/101, Ana/102, Bo/103, Cy/NULL (+ NULL/order rows if
-- an order had no valid customer)
```

### Two refinements

**ON vs WHERE - the outer-join trap**
The ON condition is applied during the join, so a LEFT JOIN still preserves unmatched left rows when ON fails. A condition in WHERE runs later on the joined result - and a comparison against a NULL-filled column is never true, so it silently removes the preserved rows, turning your LEFT JOIN into an effective INNER JOIN:

```sql
-- WRONG: Cy vanishes (o.status is NULL for him, NULL='paid' is not true)
SELECT c.name, o.id
FROM customers c LEFT JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'paid';

-- RIGHT: extra condition belongs in ON to keep unmatched customers
SELECT c.name, o.id
FROM customers c LEFT JOIN orders o
 ON c.id = o.customer_id AND o.status = 'paid';
```

**The Cartesian product is conceptual, not literal**
No engine builds all the pairs and throws most away - that would be catastrophic on large tables. The optimizer picks a physical algorithm: a nested loop (for each left row, probe the right side - great with an index), a hash join (build a hash table on one side, probe with the other), or a merge join (walk two sorted inputs in lockstep). The result is guaranteed identical to the pair-then-filter model.

**Which table is LEFT and which is RIGHT?**
Purely textual position - nothing else. The table written before the JOIN keyword is the left table; the one after is the right table. Swap them and LEFT JOIN becomes RIGHT JOIN in meaning:

```text
FROM customers c LEFT JOIN orders o ON c.id = o.customer_id
     ^ left table                  ^ right table
```

With more than two tables, joins chain left to right: the entire result built so far becomes the left side of the next join. That is why a LEFT JOIN late in a chain preserves the whole accumulated result, not just the table written immediately before it.

**What each join type actually outputs**

```text
INNER JOIN        LEFT JOIN         RIGHT JOIN        FULL OUTER
Ana + Book        Ana + Book        Ana + Book        Ana + Book
Bo + Mug          Bo + Mug          Bo + Mug          Bo + Mug
                  Cy + NULL         NULL + Hat        Cy + NULL
                                                      NULL + Hat
```

Can ON have multiple conditions? Yes - any boolean expression.

```sql
-- composite key: both columns must match
FROM order_items oi
JOIN order_lines ol ON ol.order_id = oi.order_id
 AND ol.line_no = oi.line_no

-- equality + extra filter (kept in ON to preserve outer rows)
FROM customers c LEFT JOIN orders o
 ON o.customer_id = c.id AND o.status = 'paid'

-- range (non-equi) join: each item matched to the price that was
-- valid on its order's date - a 3-table chain through the LLD
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN price_history p ON p.product_id = oi.product_id
 AND o.order_date >= p.valid_from
 AND o.order_date < p.valid_to
```

### Are there only four join types? No - the full roster

**CROSS JOIN - all combinations, on purpose**
The Cartesian product with no ON at all - every left row paired with every right row. 

```sql
SELECT d.day, c.name
FROM calendar_days d CROSS JOIN customers c; -- every day x every user
```

**SELF join - a table joined to itself (a pattern, not a keyword)**
Any join where both sides are the same table under different aliases. 

```sql
SELECT child.name AS category, parent.name AS parent
FROM categories child
LEFT JOIN categories parent
 ON parent.id = child.parent_id; -- same table twice

-- pairs of orders by the same customer (avoid double counting with <)
SELECT a.id, b.id
FROM orders a JOIN orders b
 ON a.customer_id = b.customer_id AND a.id < b.id;
```

**NATURAL JOIN and USING - convenience with teeth**
NATURAL JOIN joins on every pair of same-named columns, implicitly. USING (col) is the safe middle ground: explicit column list, and it outputs the join column once instead of twice:

```sql
SELECT * FROM customers NATURAL JOIN orders; -- joins on ALL shared
 -- column names: fragile!
SELECT * FROM customers JOIN orders USING (customer_id); -- explicit, and
-- the result has ONE customer_id column, no c.customer_id/o.customer_id pair
```

**LATERAL join - a per-row subquery in FROM**
A normal derived table in FROM cannot reference columns of tables to its left. LATERAL lifts that restriction: the subquery re-runs for each left row, which makes "top-N per group" and "call this set-returning function per row" natural to write.

```sql
-- each customer's 2 biggest orders
SELECT c.name, t.id, t.total_amount
FROM customers c
CROSS JOIN LATERAL (
 SELECT id, total_amount
 FROM orders o
 WHERE o.customer_id = c.id -- references c: only legal w/ LATERAL
 ORDER BY total_amount DESC
 LIMIT 2
) t;
```

**Semi-join and anti-join - joins that only filter**
"Keep customers that have orders" (semi) and "that have none" (anti) are join strategies with no columns taken from the right side. You write them as EXISTS / NOT EXISTS - section 8 documents them fully.

### Can I use JOIN in UPDATE and DELETE? Yes

```sql
-- PostgreSQL: UPDATE ... FROM
UPDATE orders o
SET status = 'vip'
FROM customers c
WHERE c.id = o.customer_id AND c.country = 'IN';

-- Portable everywhere: subquery
UPDATE orders SET status = 'vip'
WHERE customer_id IN (SELECT id FROM customers WHERE country = 'IN');

-- Deleting with EXISTS (NULL-safe)
DELETE FROM orders
WHERE EXISTS (SELECT 1 FROM customers c
 WHERE c.id = orders.customer_id AND c.country = 'US');
```

### Questions you should be asking about joins

**Q: What happens when the join key is NULL on either side?**
It never matches - NULL = NULL evaluates to unknown, not true, so rows with NULL keys vanish from INNER JOINs (and match nothing in outer joins, surviving only as NULL-padded rows). 

**Q: Does the order I write joins in affect performance?**
For chains of INNER joins: no - the optimizer reorders them freely to find the cheapest plan, so write them in the order that reads best. OUTER joins are different: they are not freely reorderable (moving them can change the result), so a long chain mixing LEFT JOINs constrains the optimizer.

**Q: Why did my row count explode after adding a join?**
Fan-out: if one left row matches N right rows, it appears N times. Joining customers to orders to payments multiplies per-customer rows by orders x payments - and a SUM over that is silently wrong (double counted). Fixes: aggregate each child table in a derived table before joining, or use EXISTS if you only needed a filter.

**Q: Is there a difference between ',' (comma) joins and JOIN?**
FROM a, b WHERE a.id = b.id is the pre-1992 syntax: a cross product filtered by WHERE. Always use explicit JOIN ... ON.

---

## 3. The five SQL command families

Every SQL statement falls into one of five command families.

```text
DDL - schema           DML - change data      DQL - read data
CREATE, ALTER, DROP    INSERT, UPDATE, DELETE SELECT queries

DCL - access           TCL - transactions
GRANT, REVOKE          COMMIT, ROLLBACK
```

**DDL - Data Definition Language (schema)**
Defines and changes the shape of the database.

```sql
CREATE TABLE customers ( id INT PRIMARY KEY, name VARCHAR(50) );
ALTER TABLE customers ADD COLUMN country VARCHAR(30);
CREATE INDEX idx_orders_user ON orders(customer_id);
TRUNCATE TABLE orders; -- empty a table fast (keeps structure)
DROP TABLE customers; -- remove object AND its data
```

**DML - Data Manipulation Language (change data)**
Changes the data inside tables. 

```sql
INSERT INTO orders (id, customer_id, order_date, status, total_amount)
VALUES (104, 3, '2026-06-10', 'paid', 25.00);

UPDATE orders SET status = 'paid' WHERE id = 103;

DELETE FROM orders WHERE status = 'pending';
```

**DQL - Data Query Language (read data)**
SELECT - reading data without changing it.

```sql
SELECT c.name, SUM(o.total_amount) AS lifetime_value
FROM customers c JOIN orders o ON c.id = o.customer_id
GROUP BY c.name;
```

**DCL - Data Control Language (access)**
Controls who may do what.

```sql
CREATE ROLE analyst;
GRANT SELECT ON orders TO analyst; -- read-only access
REVOKE INSERT ON orders FROM app_user; -- take it back
```

**TCL - Transaction Control Language**
Groups statements so they succeed or fail together. 

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT; -- both updates become real together
```

### DELETE vs TRUNCATE vs DROP - what survives?

```text
DELETE ... WHERE       TRUNCATE                DROP TABLE
DML - row by row       DDL - deallocate all    DDL - remove object
[Table structure]      [Table structure]       <Table structure gone>
[Rows kept]            <All rows gone>         <All rows gone>
<Rows deleted>
```

**Q: Why is TRUNCATE classified as DDL and not DML?**
Because of how it works, not what it feels like: it does not visit rows through the write path at all - it deallocates the table's storage as a metadata operation.

**Q: Can DDL be rolled back inside a transaction?**
Engine-dependent: PostgreSQL - yes. MySQL and Oracle - no (DDL implicitly commits). SQL Server - mostly yes.

---

## 4. The write path: INSERT, UPDATE, DELETE

A write runs through a different sequence than a read, because it must protect the database's integrity before touching anything. 

```text
1. Parse & bind      Check syntax, resolve names
2. Plan & locate     Optimizer finds target rows
3. BEFORE triggers   Run pre-change logic
4. Constraint checks NOT NULL, UNIQUE, FK, CHECK
5. Modify rows + log Apply change, append to WAL
6. AFTER triggers    Run post-change logic
7. Visible on COMMIT Durable, released to others
```

```sql
UPDATE orders SET status = 'paid' WHERE customer_id = 2;
```

**Step 1 - Parse & bind: check syntax, resolve names**
The text is parsed into a statement tree; table and column names are resolved.

**Step 2 - Plan & locate rows: optimizer finds targets**
The optimizer decides how to find the rows the WHERE clause identifies - full table scan or index lookup - and locks them.

**Step 3 - BEFORE triggers: pre-change logic**
User-defined procedural code that fires before the change is applied, once per row.

**Step 4 - Constraint checks: the integrity gate**
The database verifies every declared rule against the new row state. Any failure aborts the whole statement - not just the offending row:

```sql
INSERT INTO orders VALUES (105, 99, '2026-06-10', 'paid', 9.00);
-- ERROR: violates foreign key (no customer with id 99)
```

**Step 5 - Modify rows + log: apply and make recoverable**
The row versions are actually changed in memory, and the change is appended to the write-ahead log (WAL).

**Step 6 - AFTER triggers: post-change logic**
Fires after the row change exists. AFTER triggers cannot modify the row - they are for reactions: audit logs, updating aggregates, queueing notifications.

**Step 7 - Visible on COMMIT: released to the world**
Until COMMIT, the change exists only inside your transaction.

### Questions you should be asking about writes

**Q: What happens if a trigger raises an error?**
The whole statement is rolled back.

**Q: How do I get back the rows I just inserted or changed?**
RETURNING (PostgreSQL/MariaDB) or OUTPUT (SQL Server):

```sql
INSERT INTO orders (customer_id, order_date, status, total_amount)
VALUES (1, '2026-06-11', 'paid', 25.00)
RETURNING id; -- the new id, no extra SELECT
```

**Q: Does an UPDATE that sets a column to its existing value cost anything?**
Yes - the engine generally does not check; it writes a new row version, logs it, fires triggers, updates indexes. 

```sql
UPDATE orders SET status = 'paid'
WHERE id = 101 AND status <> 'paid'; -- skip the no-op write
```

---

## 5. Transactions and ACID

Transactions are what make "transfer money from A to B" safe: both the debit and the credit happen, or neither does.

```text
           [BEGIN transaction]
                   |
           [Run statements]
                   |
             [Outcome?]
             /        \
      [COMMIT]      [ROLLBACK]
```

**BEGIN transaction - open the unit of work**
Starts an explicit transaction; everything until COMMIT/ROLLBACK belongs to it. 

**Run statements - changes stay private**
Any number of DML statements execute. Their effects are visible inside the transaction immediately but invisible to every other session.

**COMMIT - on success, persist everything**
Atomically publishes all changes: the WAL record is forced to disk (durability).

**ROLLBACK - on error, undo everything**
Discards every change since BEGIN as if it never happened.

**SAVEPOINT - a partial-undo marker**
A named checkpoint inside a transaction: ROLLBACK TO savepoint undoes only what came after it.

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
SAVEPOINT after_debit;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
-- credit failed validation:
ROLLBACK TO after_debit; -- debit survives, credit undone
UPDATE accounts SET balance = balance + 100 WHERE id = 3;
COMMIT;
```

### The ACID properties
- **Atomicity** - all statements apply, or none do.
- **Consistency** - constraints always hold before and after.
- **Isolation** - concurrent transactions do not see each other's half-done work. 
- **Durability** - once committed, the change survives a crash; guaranteed by the write-ahead log.

### Isolation levels
- **READ UNCOMMITTED:** dirty reads possible.
- **READ COMMITTED:** no dirty reads; rows may still change between your reads.
- **REPEATABLE READ:** rows you read stay stable; standard allows phantoms.
- **SERIALIZABLE:** as if transactions ran one at a time.

```sql
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ; -- per transaction
```

### Questions you should be asking about transactions

**Q: What if I BEGIN and simply forget to COMMIT?**
The transaction sits open: its locks keep blocking other writers, and it pins old row versions so cleanup cannot reclaim them - the dreaded "idle in transaction" session.

**Q: What is a deadlock and what do I do about it?**
Transaction A holds a lock B needs, while B holds a lock A needs. The engine detects the cycle and kills one victim with a deadlock error. Prevention: touch rows/tables in a consistent order everywhere in the codebase.

---

## 6. Stored procedures and procedural SQL

A stored procedure is a named block of procedural code, stored in the database, that bundles SQL statements with logic plain SQL cannot express: variables, IF/CASE branches, WHILE/FOR loops, and error handling.

```text
1. CALL proc(args)        Invoke with input parameters
2. Bind params            Set up local variables
3. Execute body in order  IF / CASE, loops, error handling
4. Each SQL runs normally Goes through query execution
5. Return results         OUT params, result sets
```

```sql
CREATE PROCEDURE settle_user(IN p_customer_id INT, OUT p_count INT)
LANGUAGE plpgsql AS $$
DECLARE
 v_total DECIMAL(10,2) := 0;
BEGIN
 SELECT COALESCE(SUM(total_amount), 0) INTO v_total
 FROM orders WHERE customer_id = p_customer_id AND status = 'pending';
 
 IF v_total > 1000 THEN
  RAISE EXCEPTION 'manual review required for %', p_customer_id;
 END IF;
 
 UPDATE orders SET status = 'paid'
 WHERE customer_id = p_customer_id AND status = 'pending';
 GET DIAGNOSTICS p_count = ROW_COUNT;
END $$;
```

### The procedural family
- **Procedure:** you CALL explicitly.
- **Function:** a query expression evaluates.
- **Trigger:** an event fires automatically.

### Cursor - row-by-row iteration
Lets procedural code walk a result set one row at a time. Prefer set-based SQL when you can - it is almost always faster.

```sql
DECLARE cur CURSOR FOR
 SELECT id, total_amount FROM orders ORDER BY id;
OPEN cur;
LOOP
 FETCH cur INTO v_id, v_total;
 EXIT WHEN NOT FOUND;
 -- per-row logic
END LOOP;
CLOSE cur;
```

**Q: Procedure or function - which do I write?**
Function when the result plugs into a query. Procedure when the job is an action: multiple statements, data changes, possibly transaction control. 

**Q: Do stored procedures make things faster?**
For the right reasons, yes: fewer client-server round trips. Not because procedural code is fast - it is not. A WHILE loop updating row by row is dramatically slower than one set-based UPDATE.

---

## 7. Subqueries and CTEs: how they execute

A subquery is a query nested inside another. The decisive question is whether the inner query is independent (runs once) or correlated (references the outer row, so conceptually runs once per outer row).

- **Scalar:** returns one value.
- **IN-list:** returns one column.
- **Derived table:** subquery in FROM.
- **Correlated:** references the outer row.
- **CTE (WITH):** named, reusable, recursive.

**Scalar subquery**
```sql
SELECT id, customer_id, total_amount
FROM orders
WHERE total_amount > (SELECT AVG(total_amount) FROM orders); -- inner runs once
```

**Derived table**
```sql
SELECT t.customer_id, t.total
FROM (
 SELECT customer_id, SUM(total_amount) AS total
 FROM orders GROUP BY customer_id
) AS t -- alias is mandatory
WHERE t.total > 20;
```

**Correlated subquery - the hidden loop**
The inner query references a column of the outer row, so it cannot run once.

```sql
-- SLOW pattern: per-customer max computed per row
SELECT o.*
FROM orders o
WHERE o.total_amount = (SELECT MAX(o2.total_amount) FROM orders o2
 WHERE o2.customer_id = o.customer_id); -- correlated!

-- FAST rewrite: compute all maxima once, then join
SELECT o.*
FROM orders o
JOIN (SELECT customer_id, MAX(total_amount) AS max_price
 FROM orders GROUP BY customer_id) m
 ON m.customer_id = o.customer_id AND o.total_amount = m.max_price;
```

**CTE (WITH) - a named, reusable subquery**
```sql
WITH paid AS (
 SELECT customer_id, SUM(total_amount) AS total
 FROM orders WHERE status = 'paid'
 GROUP BY customer_id
)
SELECT c.name, p.total
FROM customers c JOIN paid p ON p.customer_id = c.id;

-- recursive: walk the category tree upward (breadcrumb path)
WITH RECURSIVE path AS (
 SELECT id, parent_id, name FROM categories WHERE id = 42
 UNION ALL
 SELECT cat.id, cat.parent_id, cat.name
 FROM categories cat JOIN path p ON cat.id = p.parent_id
)
SELECT * FROM path; 
```

**Q: CTE vs temp table - when do I use which?**
A CTE lives only inside its one statement. A temporary table persists for the session: you can fill it once, index it, ANALYZE it, and reuse it across several statements. 

---

## 8. EXISTS, NOT EXISTS, IN, NOT IN

**EXISTS - the semi-join (keep on first match)**
EXISTS asks only "is there at least one row?" - the engine probes the inner side and stops at the first hit.

```sql
SELECT c.name
FROM customers c
WHERE EXISTS (SELECT 1 FROM orders o
 WHERE o.customer_id = c.id AND o.status = 'paid');
```

**IN - usually the same plan**
For a simple single-column membership test, optimizers transform IN into the same semi-join as EXISTS.

**NOT EXISTS - the anti-join (keep when no match)**
The reliable way to express "has none".

```sql
SELECT c.name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o
 WHERE o.customer_id = c.id); -- customers with no orders
```

**NOT IN - the NULL trap (memorize this one)**
NOT IN compares with three-valued logic: `x NOT IN (a, b, NULL)` can never be true, because `x <> NULL` is unknown, not true. So if the subquery returns even one NULL, NOT IN returns zero rows - silently.

```sql
-- orders.customer_id is nullable; one guest order has customer_id = NULL
SELECT name FROM customers
WHERE id NOT IN (SELECT customer_id FROM orders);
-- returns NO ROWS AT ALL, even though Cy has no orders!

-- Fix 2 (preferred): NOT EXISTS is immune to the trap
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = customers.id);
```

**Anti-pattern: COUNT(*) to test existence**
COUNT must scan and count every match before comparing; EXISTS stops at the first.

```sql
-- WRONG: counts everything just to compare with 0
WHERE (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) > 0
-- RIGHT:
WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)
```

---

## 9. Aggregation beyond COUNT: string aggregation and friends

**String aggregation - one row per group, values joined**
Concatenates a column's values within each group into one string.

```sql
-- PostgreSQL / SQL Server (2017+)
SELECT o.customer_id,
 STRING_AGG(p.name, ', ' ORDER BY p.name) AS items
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON p.id = oi.product_id
GROUP BY o.customer_id;
-- (1, 'Book, Pen') (2, 'Mug')
```

**DISTINCT and ORDER BY inside aggregates**
```sql
SELECT o.customer_id,
 COUNT(DISTINCT oi.product_id) AS distinct_items,
 STRING_AGG(DISTINCT p.name, ', ') AS items
...
```

**Conditional aggregation - FILTER and the CASE trick**
```sql
-- PostgreSQL: FILTER clause
SELECT customer_id,
 COUNT(*) FILTER (WHERE status = 'paid') AS paid,
 COUNT(*) FILTER (WHERE status = 'pending') AS pending
FROM orders GROUP BY customer_id;

-- portable: CASE inside the aggregate (works everywhere)
SELECT customer_id,
 SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
 SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
FROM orders GROUP BY customer_id;
```

**ROLLUP and GROUPING SETS - subtotals in one query**
```sql
SELECT customer_id, status, SUM(total_amount) AS total
FROM orders
GROUP BY ROLLUP (customer_id, status);
```

**Q: Why can't I write WHERE SUM(total_amount) > 100?**
Pure timing (section 1): WHERE runs at step 2, the SUM does not exist until grouping at step 3. The group-level filter is HAVING.

---

## 10. Window functions and PARTITION BY

GROUP BY answers "one number per group" by collapsing rows. Window functions answer "a number per row, computed over its group" - the rows stay visible, and each gets a value calculated over its partition.

```sql
-- window: 3 rows out (every order), each annotated with its
-- user's total - impossible with plain GROUP BY
SELECT id, customer_id, price,
 SUM(total_amount) OVER (PARTITION BY customer_id) AS user_total
FROM orders;
```

**ROW_NUMBER / RANK / DENSE_RANK - and top-N per group**
Their killer application is top-N per group - here is "each customer's biggest order", the clean rewrite of section 7's correlated subquery:

```sql
SELECT *
FROM (
 SELECT o.*,
 ROW_NUMBER() OVER (PARTITION BY customer_id
 ORDER BY total_amount DESC) AS rn
 FROM orders o
) t
WHERE rn = 1; -- rn <= 3 gives "top 3 per user"
```

**Running totals and the frame clause**
With ORDER BY inside OVER, aggregates become cumulative. 

```sql
SELECT id, customer_id, total_amount,
 SUM(total_amount) OVER (PARTITION BY customer_id ORDER BY id
 ROWS BETWEEN UNBOUNDED PRECEDING
 AND CURRENT ROW) AS running
FROM orders;
```

**LAG and LEAD - reach into neighboring rows**
Read a column from the previous/next row of the partition without a self-join:

```sql
SELECT customer_id, id, total_amount,
 total_amount - LAG(total_amount) OVER (PARTITION BY customer_id
 ORDER BY id) AS change_vs_prev
FROM orders; 
```

**Q: Can I mix GROUP BY and a window function in one query?**
Yes - GROUP BY (step 3) runs first, then windows are computed over the grouped rows in SELECT (step 5). 

---

## 11. Indexes: how they work and when they are used

An index is a separately-maintained, sorted structure (almost always a B-tree) mapping key values to row locations. It turns "scan everything" into "descend a shallow tree".

```sql
CREATE INDEX idx_orders_user ON orders (customer_id);
SELECT * FROM orders WHERE customer_id = 2; -- index lookup
SELECT * FROM orders WHERE total_amount BETWEEN 5 AND 10; -- range scan
SELECT * FROM orders ORDER BY customer_id LIMIT 10; -- no sort needed
```

**Composite indexes and the leftmost-prefix rule**
An index on (a, b) is sorted by a first, then b within equal a.

```sql
CREATE INDEX idx_user_status ON orders (customer_id, status);
WHERE customer_id = 1 -- uses index
WHERE customer_id = 1 AND status = 'paid' -- uses index (both columns)
WHERE status = 'paid' -- CANNOT use this index
```

**Covering indexes - never touch the table**
If the index contains every column the query needs, the engine answers from the index alone (an index-only scan).

```sql
CREATE INDEX idx_cover
 ON orders (customer_id)
 INCLUDE (status, total_amount); -- PG 11+ / SQL Server
```

**Partial and expression indexes**
```sql
-- 99% of orders are done; you only ever query the pending 1%
CREATE INDEX idx_pending ON orders (customer_id)
WHERE status = 'pending';

-- case-insensitive email lookup
CREATE INDEX idx_email_lower ON customers (LOWER(email));
SELECT * FROM customers WHERE LOWER(email) = 'ana@x.com'; -- uses it
```

**Sargability - what silently disables your index**
Wrapping the column in a function, arithmetic, a type conversion, or a leading wildcard hides the sorted value - the index is ignored.

```sql
-- NOT sargable (full scan) -> sargable rewrite
WHERE YEAR(order_date) = 2026 -> WHERE order_date >= '2026-01-01'
 AND order_date < '2027-01-01'
WHERE price * 1.18 > 100 -> WHERE price > 100 / 1.18
WHERE LOWER(email) = 'a@x.com' -> expression index
WHERE name LIKE '%book' -> leading % cannot descend the tree; 'book%' is fine
```

**Q: Do PRIMARY KEY and UNIQUE create indexes automatically?**
Yes. Foreign keys are the asymmetry to remember: most engines (PostgreSQL, SQL Server, Oracle) do not auto-index the referencing column. Habit: index your FK columns.

---

## 12. Reading execution plans (EXPLAIN)

Tuning without a plan is guessing. EXPLAIN shows the tree of operations the optimizer chose; EXPLAIN ANALYZE runs the query and shows what actually happened. A plan is read from the leaves up.

```sql
EXPLAIN SELECT * FROM orders WHERE customer_id = 2;

BEGIN;
EXPLAIN ANALYZE UPDATE orders SET status='paid' WHERE customer_id = 2;
ROLLBACK; -- the update really ran; undo it
```

**Scan nodes - how a table is read**
- **Seq Scan (full table scan):** read every row.
- **Index Scan:** descend the B-tree, fetch matching table rows.
- **Index Only Scan:** answer from the index alone (covering index).

**Join nodes - which algorithm and why**
- **Nested Loop:** probe inner for each outer row - unbeatable when the outer side is tiny and the inner probe hits an index.
- **Hash Join:** build a hash table on the smaller input - workhorse for big equality joins.
- **Merge Join:** walk two sorted inputs in lockstep.

---

## 13. Table partitioning

Partitioning splits one logical table into multiple physical pieces by a key (usually a date). Queries that filter on the key touch only the relevant pieces - partition pruning - and old data can be dropped instantly instead of deleted row by row. 

```sql
CREATE TABLE orders (
 id BIGINT,
 customer_id INT,
 order_date DATE NOT NULL,
 status VARCHAR(10),
 total_amount DECIMAL(10,2)
) PARTITION BY RANGE (order_date);

CREATE TABLE orders_2025 PARTITION OF orders
 FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

**Partition pruning - the key must be in the query**
Pruning happens only when the WHERE clause constrains the partition key sargably.

```sql
SELECT * FROM orders
WHERE order_date >= '2026-01-01'; -- scans orders_2026 only

SELECT * FROM orders
WHERE customer_id = 2; -- key absent: scans ALL partitions
```

**The operational win - retention in milliseconds**
```sql
DELETE FROM orders WHERE order_date < '2025-01-01'; -- hours
ALTER TABLE orders DETACH PARTITION orders_2024; -- instant
DROP TABLE orders_2024; -- instant
```

---

## 14. The performance tuning playbook

The method is always the same loop: measure (EXPLAIN ANALYZE), fix the most expensive node, measure again.

**1. SELECT * in production code**
Drags every column across the wire, defeats covering indexes. Name what you need.

**2. Functions wrapped around indexed columns**
The most common index killer (sargability, section 11). Move the computation to the constant side.

**3. NOT IN against a nullable column**
One NULL in the subquery and you silently get zero rows (section 8). Use NOT EXISTS.

**4. Correlated subquery executed per row**
Rewrite as a window function (section 10) or a join on a grouped derived table.

**5. Deep OFFSET pagination**
LIMIT 20 OFFSET 100000 computes and throws away 100,000 rows. Use Keyset pagination:
```sql
SELECT * FROM orders
WHERE id > :last_seen_id -- from the previous page
ORDER BY id LIMIT 20;
```

**6. OR across different columns**
A single index can rarely serve an OR over two columns; the planner often falls back to a full scan. Split into two index-friendly branches (UNION).

**7. N+1 queries from the application**
One query for the list, then one more per item. The database is good at sets; ask once with a JOIN.

**8. One giant DELETE / UPDATE**
A single statement touching 50M rows holds locks for the whole run. Batch it with `LIMIT` in a loop.

**9. DISTINCT pasted on to hide join fan-out**
If a JOIN multiplies rows and DISTINCT "fixes" it, the query is doing the work of producing duplicates and then more work removing them. Use EXISTS.

---

## 15. Week-one questions: gaps a fresher hits on first read

**NULL, properly - the rules behind section 8's trap**
NULL means unknown, and comparing anything with unknown yields unknown - never true.
```sql
SELECT * FROM customers WHERE country = NULL; -- always 0 rows
SELECT * FROM customers WHERE country IS NULL; -- correct
```
COALESCE(a, b, c) returns the first non-NULL argument; NULLIF(a, b) turns a into NULL when it equals b.

**Why a separate order_items table - why not product1, product2 columns on orders?**
Because an order can hold any number of items, and "repeating columns" break the moment item 4 arrives. One row per (order, product) fact is normalization.

**Why does orders store total_amount when it could be computed from order_items?**
A deliberate denormalization: order lists and customer lifetime-value queries read totals constantly, and pre-storing the sum spares a join + aggregate on every read.

**Why does order_items copy unit_price when products.price already exists?**
Deliberate, and important: products.price is now; the order is history. When the Pen's price changes next month, Ana's old invoice must still say 2.50.

**DELETE FROM customers WHERE id = 1 fails with a foreign key error. Now what?**
The FK's delete action decides what happens. The default (RESTRICT/NO ACTION) blocks you. You could use CASCADE, or better, soft-delete with an active flag.

**Two buyers, one mug in inventory - how do I not sell it twice?**
The lost-update race. Fix it by making the check and the write inseparable:
```sql
-- atomic: let the UPDATE do the check itself
UPDATE inventory SET qty = qty - 1
WHERE product_id = 3 AND warehouse = 'BLR' AND qty >= 1;
```

**A shipment arrives: insert the stock row if new, add to it if it exists?**
That is an upsert.
```sql
-- PostgreSQL / SQLite
INSERT INTO inventory (product_id, warehouse, qty)
VALUES (3, 'BLR', 50)
ON CONFLICT (product_id, warehouse)
DO UPDATE SET qty = inventory.qty + EXCLUDED.qty;
```

**Single quotes vs double quotes - when do I use which?**
`'single quotes'` make a string value; `"double quotes"` make an identifier (a table or column name). Portable habit: single quotes for values, always.

**What is a view?**
A stored, named query that behaves like a read-only table. A materialized view stores the result physically.

**My application builds SQL by gluing strings together. Is that OK?**
No - this is the most important answer in this section. Concatenating user input into SQL is SQL injection, the classic way applications are breached. ALWAYS parameterize.
