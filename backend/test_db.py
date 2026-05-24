import os
from dotenv import load_dotenv
from supabase import create_client

# Load settings from .env file
load_dotenv(dotenv_path="../.env")

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

print(f"Supabase URL: {supabase_url}")
print(f"Supabase Key Length: {len(supabase_key) if supabase_key else 0}")

try:
    client = create_client(supabase_url, supabase_key)
    print("Supabase client created successfully.")
    
    # Try listing tables or making a simple query
    print("Querying 'users' table...")
    response = client.table("users").select("*").limit(1).execute()
    print("Query success! Data:", response.data)
except Exception as e:
    print("Supabase Error details:", e)
