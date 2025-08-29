import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure the Gemini API key
api_key = os.getenv('GOOGLE_API_KEY')
if not api_key:
    print("Error: GOOGLE_API_KEY environment variable not found.")
    print("Please ensure it is set in your environment or .env file.")
else:
    genai.configure(api_key=api_key)

    print("Listing available Gemini models that support 'generateContent':")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"- {m.name}")
    except Exception as e:
        print(f"An error occurred while fetching models: {e}")

"""
Command to use this script:
docker compose exec backend python /app/check_models.py
"""
