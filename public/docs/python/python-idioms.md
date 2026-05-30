# Python Idioms

Pythonic code is code that doesn't just get the syntax right but follows the conventions of the Python community and uses the language in the way it is intended to be used.

## List Comprehensions
Instead of a standard `for` loop to build lists:

```python
# Unpythonic
squares = []
for i in range(10):
    squares.append(i * i)

# Pythonic
squares = [i * i for i in range(10)]
```

## Context Managers
Always use `with` when dealing with files to ensure they are closed properly:

```python
with open('file.txt', 'r') as f:
    content = f.read()
```
