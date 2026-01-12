import requests, json
resp = requests.post('http://127.0.0.1:8000/auth/google', json={'token':'dummy_token'})
print(resp.status_code)
try:
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
except Exception:
    print('No JSON response:', resp.text)
