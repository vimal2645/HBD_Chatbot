"""Live chatbot flow testing - comprehensive 15-minute test"""
import requests
import json
import time

BASE = 'http://127.0.0.1:5000'
SESSION_ID = 'live-test-session-001'

def chat(query, session_id=SESSION_ID):
    try:
        r = requests.post(
            f'{BASE}/chat',
            json={'query': query, 'session_id': session_id, 'language': 'en'},
            timeout=30
        )
        return r.json()
    except Exception as e:
        return {'type': 'error', 'data': str(e)}

def pp(resp, label=''):
    print(f'\n{"="*60}')
    print(f'QUERY: {label}')
    print(f'TYPE: {resp.get("type")}')
    
    data = resp.get("data", "")
    if isinstance(data, list):
        print(f'DATA (list, {len(data)} items):')
        for i, item in enumerate(data[:2]):
            if isinstance(item, dict):
                print(f'  [{i}] business_name={item.get("business_name")} | city={item.get("city")} | category={item.get("business_category")} | rating={item.get("ratings")} | phone={item.get("phone_number")}')
    elif data:
        print(f'DATA: {str(data)[:300]}')
    
    intro = resp.get("intro", "")
    if intro:
        print(f'INTRO: {str(intro)[:300]}')
    
    prompt = resp.get("prompt", "")
    if prompt:
        print(f'PROMPT: {prompt}')
    
    suggs = resp.get('suggestions', [])
    if suggs:
        print(f'SUGGESTIONS ({len(suggs)}):')
        for s in suggs[:6]:
            if isinstance(s, dict):
                print(f'  - [{s.get("action","?")}] {s.get("title", s)}')
            else:
                print(f'  - {s}')
    
    meta = resp.get('search_metadata', {})
    if meta:
        print(f'META: {meta}')

print("\n" + "="*60)
print("CHATBOT LIVE TEST - ALL FLOW PATHS")
print("="*60)

# ================================================================
# FLOW 1: GREETING -> EXPLORE BUSINESS -> CITY -> CATEGORY -> SEARCH
# ================================================================
print("\n\n--- FLOW 1: Business Search Flow ---")

r = chat('hi')
pp(r, 'GREETING: hi')

r = chat('explore business listings')
pp(r, 'ACTION: explore business listings')

r = chat('Mumbai')
pp(r, 'CITY: Mumbai')

r = chat('best restaurants in Mumbai')
pp(r, 'CATEGORY: best restaurants in Mumbai')

r = chat('top rated restaurants in Mumbai')
pp(r, 'FOLLOW-UP: top rated restaurants in Mumbai')

r = chat('open now')
pp(r, 'FILTER: open now')

r = chat('next')
pp(r, 'PAGINATION: next')

# ================================================================
# FLOW 2: DIRECT SEARCH WITHOUT FLOW
# ================================================================
print("\n\n--- FLOW 2: Direct NLU Search ---")

SESSION2 = 'live-test-session-002'
r = chat('gyms in Ahmedabad', SESSION2)
pp(r, 'DIRECT: gyms in Ahmedabad')

r = chat('budget gyms', SESSION2)
pp(r, 'FOLLOW-UP FILTER: budget gyms')

r = chat('most reviewed', SESSION2)
pp(r, 'FOLLOW-UP: most reviewed')

# ================================================================
# FLOW 3: PRODUCT SEARCH
# ================================================================
print("\n\n--- FLOW 3: Product Search Flow ---")

SESSION3 = 'live-test-session-003'
r = chat('explore products', SESSION3)
pp(r, 'ACTION: explore products')

r = chat('smartphones', SESSION3)
pp(r, 'PRODUCT: smartphones')

r = chat('Amazon products', SESSION3)
pp(r, 'FILTER: Amazon products')

r = chat('top rated', SESSION3)
pp(r, 'FOLLOW-UP: top rated')

# ================================================================
# FLOW 4: CATEGORY CHIPS AND FOLLOW-UPS
# ================================================================
print("\n\n--- FLOW 4: Category & Context Chips ---")

SESSION4 = 'live-test-session-004'
r = chat('hotels in Jaipur', SESSION4)
pp(r, 'DIRECT: hotels in Jaipur')

r = chat('luxury hotels in Jaipur', SESSION4)
pp(r, 'FOLLOW-UP: luxury hotels in Jaipur')

r = chat('change city', SESSION4)
pp(r, 'CHIP: change city')

# ================================================================
# FLOW 5: EDGE CASES
# ================================================================
print("\n\n--- FLOW 5: Edge Cases ---")

SESSION5 = 'live-test-session-005'
r = chat('what can you do', SESSION5)
pp(r, 'HELP: what can you do')

r = chat('salons in Chennai', SESSION5)
pp(r, 'DIRECT: salons in Chennai')

r = chat('compare restaurants Mumbai', SESSION5)
pp(r, 'COMPARE intent')

r = chat('start new search', SESSION5)
pp(r, 'RESET: start new search')

print("\n\n" + "="*60)
print("TEST COMPLETE")
print("="*60)
