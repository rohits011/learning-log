# OWASP Top 10

The OWASP Top 10 is a standard awareness document for developers and web application security. It represents a broad consensus about the most critical security risks to web applications.

## 1. Broken Access Control
Users acting outside of their intended permissions.
* Fix: Deny by default, implement proper authorization checks.

## 2. Cryptographic Failures
Exposure of sensitive data (like passwords, credit cards).
* Fix: Encrypt all data in transit and at rest. Don't use weak algorithms (e.g. MD5).

## 3. Injection
Untrusted data sent to an interpreter (SQL, NoSQL, OS command).
* Fix: Use parameterized queries or prepared statements.
