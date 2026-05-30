# LLM Internals

Large Language Models (LLMs) are deep learning models, typically based on the Transformer architecture, trained on massive amounts of text data.

## Transformers Overview
The transformer relies on the self-attention mechanism.
- **Tokens**: Text is split into tokens.
- **Embeddings**: Tokens are converted to dense vectors.
- **Self-Attention**: Allows the model to weigh the importance of different words in a sentence relative to each other.

```python
# A conceptual attention mechanism
def attention(Q, K, V):
    scores = softmax(Q @ K.T / sqrt(d_k))
    return scores @ V
```
