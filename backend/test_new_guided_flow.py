try:
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
import requests
import json

BASE_URL = "http://127.0.0.1:5000"

def run_flow_tests():
    print("🤖 Starting Guided Chatbot Flow Backend Tests...")

    # 1. Health check
    try:
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        print("✅ Backend Health Check Passed.")
    except Exception as e:
        print(f"❌ Backend is offline: {e}. Please start the backend server first.")
        sys.exit(1)

    # 2. Explore Business Listings (starts business listings path)
    print("\n--- Test 2.1: Explore Business Listings ---")
    r = requests.post(f"{BASE_URL}/api/query", json={
        "query": "explore business listings",
        "language": "en"
    })
    assert r.status_code == 200
    res = r.json()
    assert res["type"] == "flow_step"
    assert res["flow"] == "business"
    assert res["step"] == "ask_city"
    assert len(res["suggestions"]) > 0
    print("✅ Explore Business Listings response correct.")
    print(f"Step: {res['step']}, Data: {res['data']}")
    print(f"Suggestions sample: {[s['title'] for s in res['suggestions'][:3]]}")

    # 3. Choose a city: city:mumbai
    print("\n--- Test 2.2: City selection (city:mumbai) ---")
    r = requests.post(f"{BASE_URL}/api/query", json={
        "query": "city:mumbai",
        "language": "en"
    })
    assert r.status_code == 200
    res = r.json()
    assert res["type"] == "flow_step"
    assert res["flow"] == "business"
    assert res["step"] == "ask_category"
    assert len(res["suggestions"]) > 0
    assert "mumbai" in res["data"].lower()
    print("✅ City Selection response correct.")
    print(f"Step: {res['step']}, Data: {res['data']}")
    print(f"Suggestions sample: {[s['title'] for s in res['suggestions'][:3]]}")

    # 4. Search: search:restaurant in mumbai
    print("\n--- Test 2.3: Search normalization (search:restaurant in mumbai) ---")
    r = requests.post(f"{BASE_URL}/api/query", json={
        "query": "search:restaurant in mumbai",
        "language": "en"
    })
    assert r.status_code == 200
    res = r.json()
    assert res["type"] in ["database", "faq"]  # depending on whether restaurants exist in mumbai in the database
    if res["type"] == "database":
        assert len(res["data"]) > 0
        print(f"✅ Found {len(res['data'])} businesses.")
        print(f"First business: {res['data'][0]['business_name']} ({res['data'][0]['city']})")
    else:
        print(f"✅ Normalization worked, returned fallback/FAQ: {res['data']}")

    # 5. Explore Products
    print("\n--- Test 2.4: Explore Products ---")
    r = requests.post(f"{BASE_URL}/api/query", json={
        "query": "explore products",
        "language": "en"
    })
    assert r.status_code == 200
    res = r.json()
    assert res["type"] == "flow_step"
    assert res["flow"] == "products"
    assert res["step"] == "ask_product"
    assert len(res["suggestions"]) > 0
    print("✅ Explore Products response correct.")
    print(f"Step: {res['step']}, Data: {res['data']}")
    print(f"Suggestions sample: {[s['title'] for s in res['suggestions'][:3]]}")

    print("\n🎉 ALL NEW CHATBOT FLOW BACKEND TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    run_flow_tests()
