# sql_detector.py — Rule-based SQL intent detector (LLM removed)
#
# Determines whether a user query warrants a database search using pattern matching.
# No external API calls — purely local regex/keyword logic.

import re

# Phrases that strongly indicate a business/location search intent
SEARCH_TRIGGERS = [
    r"\bfind\b", r"\bsearch\b", r"\blook for\b", r"\bshow me\b", r"\blist\b",
    r"\bnearby\b", r"\bnear\b", r"\bin\s+\w+",
    r"\brestaurant", r"\bhotel", r"\bhospital", r"\bgym", r"\bsalon",
    r"\bcafe", r"\bshop", r"\bdoctor", r"\bclinic", r"\bdentist",
    r"\bschool", r"\bcollege", r"\bcoaching", r"\bfitness", r"\byoga",
    r"\bpharmacy", r"\bchemist", r"\bbank\b", r"\batm\b",
    r"\bbakery", r"\bspa", r"\bboutique", r"\bjewellery",
    r"\bgrocery", r"\bsupermarket",
    r"\bbest\b", r"\btop\b", r"\bhighest rated\b", r"\bpopular\b",
    r"\bopen now\b", r"\bworking hours\b",
    r"\brating", r"\breview", r"\bcontact\b", r"\baddress\b", r"\bphone",
    r"\bbusiness", r"\bservice", r"\bstore\b", r"\boutlet\b",
]

# Phrases that clearly do NOT need a DB query
CONVERSATIONAL_TRIGGERS = [
    r"\bwho are you\b", r"\bwhat is your name\b", r"\bhello\b", r"\bhi\b",
    r"\bthank\b", r"\bbye\b", r"\bgoodbye\b", r"\bhelp\b",
    r"\bwhat can you do\b", r"\bhow do you work\b",
    r"\bexplain\b", r"\btell me about\b",
]


def needs_sql(query: str) -> bool:
    """
    Returns True if the query is about finding businesses/services in a location.
    Returns False for greetings, general questions, and chit-chat.
    """
    q = query.lower().strip()

    # First check conversational — these clearly don't need SQL
    for pattern in CONVERSATIONAL_TRIGGERS:
        if re.search(pattern, q):
            print(f"SQL ROUTER: NO (conversational match: {pattern})")
            return False

    # Check for strong search signals
    for pattern in SEARCH_TRIGGERS:
        if re.search(pattern, q):
            print(f"SQL ROUTER: YES (search trigger: {pattern})")
            return True

    # Short queries with no city/category signals → conversational
    if len(q.split()) <= 3:
        print("SQL ROUTER: NO (too short, likely conversational)")
        return False

    print("SQL ROUTER: NO (default — no search signals found)")
    return False


if __name__ == "__main__":
    test_query = input("Enter your query to check for SQL need: ")
    if needs_sql(test_query):
        print("YES — SQL is required")
    else:
        print("NO — SQL is not required")
