# Resilient AI Pipelines & Auto-Fallbacks

When building production-ready AI agents or autonomous pipelines, you will inevitably hit external API failures. Modern AI Engineering requires designing for these failures proactively rather than hardcoding "happy paths."

## 1. True Auto-Fallback Architecture (The Try/Catch Pattern)
External APIs fail constantly for various reasons (rate limits, paywalls, endpoint deprecation). Hardcoding single providers makes pipelines brittle.

**The Solution:**
Implement a Try/Catch wrapper that attempts a primary high-end provider, catches specific HTTP/API errors, and seamlessly delegates to a cheaper, unlimited, or open-source fallback.

### Real-World Example (AI YouTube Studio)
- **Primary LLM**: `gemini-pro-latest` (High reasoning, but strict Free Tier limits causing `HTTP 429 Quota Exceeded`).
- **Fallback LLM**: `gemini-flash-latest` (Massive free tier, highly efficient).
- **Primary TTS**: `ElevenLabs API` (Incredible quality, but restricts library voices on free tiers causing `HTTP 402 Payment Required`).
- **Fallback TTS**: `Edge-TTS` (Hijacks Microsoft Edge Read Aloud API, 100% free, no token limits).

```python
class ResilientContentEngine:
    def generate(self, prompt):
        try:
            return primary_model.generate_content(prompt)
        except Exception as e:
            logger.warning(f"Primary model failed (Rate Limit/Deprecation). Falling back to Flash: {e}")
            return fallback_model.generate_content(prompt)
```

## 2. Bypassing Anti-Bot Firewalls (AWS / S3)
Many media APIs (like Pexels) host their assets on AWS S3 buckets equipped with anti-scraping Web Application Firewalls (WAF). 
Using Python's standard `urllib.request.urlretrieve` will often result in an immediate `HTTP 403 Forbidden` because it identifies itself as a default Python bot.

**The Fix:**
Never use `urllib` for external media downloads. Always use `requests` with a standard `User-Agent` header to impersonate a browser, and stream the content in chunks to preserve memory.
```python
import requests

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
response = requests.get(video_url, stream=True, headers=headers)
response.raise_for_status()

with open("output.mp4", 'wb') as f:
    for chunk in response.iter_content(chunk_size=8192):
        f.write(chunk)
```

## 3. Strict Dependency Pinning
Bleeding-edge AI pipelines often install the newest versions of libraries automatically. However, major version bumps (like `moviepy v1.0.3` to `v2.2.1`) frequently deprecate foundational syntax.

To guarantee pipeline stability across machines, never use loose constraints in `requirements.txt`. Always pin core structural dependencies to the specific major/minor versions you coded against.
```text
# Bad (Will install v2.x and break legacy API calls)
moviepy

# Good (Locks to the known stable v1.x architecture)
moviepy==1.0.3
```
