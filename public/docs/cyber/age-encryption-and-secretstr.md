# `age` Encryption & `SecretStr` (Deep Dive)

When building secure software, managing secrets (API keys, database credentials) presents two separate attack vectors:
1. **Data at Rest:** If an attacker steals your hard drive or gains access to your server's filesystem, can they read your config files?
2. **Data in Motion / Memory:** If your application crashes and dumps a stack trace to the logs, or if an attacker takes a memory heap dump, are your secrets exposed in plaintext?

In D.O.S.T., we solve #1 using the **`age`** CLI tool, and #2 using Pydantic's **`SecretStr`**.

---

## 1. Data at Rest: `age` Encryption

For decades, the standard for file encryption was **GPG (GnuPG)**. However, GPG suffers from extreme complexity, legacy cryptographic defaults, and a steep learning curve that often leads to devastating misconfigurations.

**`age`** (Actually Good Encryption) is a modern, simple alternative designed by Filippo Valsorda (former Go cryptographer at Google).

### Mechanics
`age` uses **Asymmetric Cryptography** (specifically `X25519` for key exchange and `ChaCha20-Poly1305` for symmetric encryption).
*   **Public Key:** Given to anyone. Used ONLY to encrypt data.
*   **Private Key:** Kept strictly secret. Used ONLY to decrypt data.

When you run `age -r <public_key> -o secrets.age secrets.json`, it generates a random symmetric key, encrypts `secrets.json` with that symmetric key (using ChaCha20), and then encrypts the symmetric key itself using your Public Key (X25519).

### Why `age` in D.O.S.T.?
*   **Zero Configuration:** There are no key-servers, no web of trust, no complex cipher suites to pick.
*   **Decoupled:** By shelling out to the `age` binary via Python's `subprocess`, we avoid compiling massive C-based cryptography libraries (like `cryptography` or `libsodium`) into our lightweight Python environment.

---

## 2. Data in Memory: Pydantic `SecretStr`

If you decrypt your `secrets.age` file, load it into a Python dictionary, and pass it around your app, you are vulnerable to **Information Disclosure**.

**Java Analogy:** In Java, best practice dictates storing passwords in a `char[]` rather than a `String`. Why? Because `String` objects in Java are immutable and live in the String Pool. You cannot explicitly overwrite a `String` in memory; you have to wait for the Garbage Collector. A `char[]` can be manually zeroed out (`Arrays.fill(password, '\0')`) immediately after use.

Python strings are also immutable. Worse, Python makes it trivially easy to accidentally log everything via `print(locals())` or a logging framework that captures exceptions.

### Enter `SecretStr`
Pydantic provides the `SecretStr` class. It overrides the `__str__` and `__repr__` methods (the methods Python calls when you try to print an object).

```python
from pydantic import SecretStr

# Wrap the raw string in a SecretStr
api_key = SecretStr("sk-live-123456789")

# If you accidentally log it or print it, Python calls __str__ or __repr__
print(api_key) 
# Output: ********** (Safe!)

# To actually use the secret (e.g., passing it to an HTTP request), 
# you must explicitly call .get_secret_value()
headers = {"Authorization": f"Bearer {api_key.get_secret_value()}"}
```

By wrapping decrypted values in `SecretStr` the absolute millisecond they exit the `age` decryption boundary, we ensure that no downstream code (like our `structlog` logger or the agent's runtime) can accidentally leak the secret into a text file or terminal output.
