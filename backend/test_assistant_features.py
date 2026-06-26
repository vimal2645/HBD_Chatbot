# test_assistant_features.py
import requests
import json
import time

BASE_URL = "http://127.0.0.1:5000"

def run_tests():
    print("🧪 Starting Assistant Features Verification Suite...")
    
    # 1. Health Check
    try:
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        print("✅ Health check passed.")
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return

    # Test parameters
    user_id = "test_assistant_qa@example.com"
    business_id = 1 # Sample business in Jaipur
    
    # 2. Bookmarks / Favorites API
    print("\n--- Testing Bookmarks API ---")
    try:
        # Clear existing bookmark first if any
        requests.delete(f"{BASE_URL}/api/bookmarks/{business_id}?user_id={user_id}")
        
        # Add bookmark
        r = requests.post(
            f"{BASE_URL}/api/bookmarks",
            json={"user_id": user_id, "business_id": business_id}
        )
        assert r.status_code == 200
        assert r.json().get("success") is True
        print("✅ Add Bookmark passed.")
        
        # List bookmarks
        r = requests.get(f"{BASE_URL}/api/bookmarks?user_id={user_id}")
        assert r.status_code == 200
        bookmarks = r.json()
        assert isinstance(bookmarks, list)
        assert len(bookmarks) > 0
        assert int(bookmarks[0]["global_business_id"]) == business_id
        print(f"✅ List Bookmarks passed. Found bookmarked: '{bookmarks[0]['business_name']}'")
        
        # Remove bookmark
        r = requests.delete(f"{BASE_URL}/api/bookmarks/{business_id}?user_id={user_id}")
        assert r.status_code == 200
        assert r.json().get("success") is True
        print("✅ Remove Bookmark passed.")
        
        # Verify removal
        r = requests.get(f"{BASE_URL}/api/bookmarks?user_id={user_id}")
        assert len(r.json()) == 0
        print("✅ Bookmark deletion verified.")
    except Exception as e:
        print(f"❌ Bookmarks API failed: {e}")
        return

    # 3. Compare Businesses API
    print("\n--- Testing Compare Businesses API ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/business/compare",
            json={"business_ids": [1, 2]}
        )
        print(f"Compare Status Code: {r.status_code}")
        print(f"Compare Response Content: {r.text}")
        assert r.status_code == 200
        compare_data = r.json()
        assert isinstance(compare_data, list)
        assert len(compare_data) == 2
        
        # Verify fields mapped including products and deals
        for biz in compare_data:
            assert "business_name" in biz
            assert "products" in biz
            assert "deals" in biz
            assert isinstance(biz["products"], list)
            assert isinstance(biz["deals"], list)
        
        print(f"✅ Compare Businesses passed. Business 1: '{compare_data[0]['business_name']}', Business 2: '{compare_data[1]['business_name']}'")
    except Exception as e:
        import traceback
        print(f"❌ Compare Businesses API failed: {e}")
        traceback.print_exc()
        return

    # 4. Autocomplete / Smart Suggestions API
    print("\n--- Testing Autocomplete API ---")
    try:
        r = requests.post(
            f"{BASE_URL}/api/smart-suggestions",
            json={"text": "piz", "language": "en", "flow": "QUERY"}
        )
        assert r.status_code == 200
        suggs = r.json().get("suggestions", [])
        assert isinstance(suggs, list)
        print(f"✅ Autocomplete suggestions passed. Suggestions found: {suggs}")
    except Exception as e:
        print(f"❌ Autocomplete API failed: {e}")
        return

    print("\n🎉 ALL NEW ASSISTANT FEATURES TESTS PASSED SUCCESSFULLY! 🎉")

if __name__ == "__main__":
    run_tests()
